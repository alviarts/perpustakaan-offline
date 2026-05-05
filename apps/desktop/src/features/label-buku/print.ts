import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { LabelBukuField, LabelBukuLayout } from '@/lib/labelBuku';
import type { LibraryIdentity } from '@/stores/identityStore';

const MM_TO_PX = 3.78;

/** Combined eksemplar + buku payload used to render labels. */
export interface LabelBukuItem {
  kodeEksemplar: string;
  judul: string;
  kodeBuku: string;
  pengarang: string;
  penerbit: string;
  tahun: string;
  kodeDdc: string;
}

export interface LabelBukuPrintInput {
  layout: LabelBukuLayout;
  items: LabelBukuItem[];
  identity: LibraryIdentity;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveText(
  field: LabelBukuField,
  item: LabelBukuItem,
  identity: LibraryIdentity,
): string {
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'judul':
      return item.judul;
    case 'kodeBuku':
      return item.kodeBuku;
    case 'kodeEksemplar':
      return item.kodeEksemplar;
    case 'pengarang':
      return item.pengarang;
    case 'penerbit':
      return item.penerbit;
    case 'tahun':
      return item.tahun;
    case 'kodeDdc':
      return item.kodeDdc;
    default:
      return '';
  }
}

async function buildQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value || '0000', {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
}

/**
 * Renders the kodeEksemplar as a CODE128 barcode SVG string. We create a
 * detached SVGElement, hand it to JsBarcode, then serialise it to text so it
 * can be embedded directly in the print HTML without an extra round-trip.
 */
function buildBarcodeSvg(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, value || '0000', {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 40,
      width: 1.4,
      background: '#ffffff',
      lineColor: '#0f172a',
    });
  } catch (e) {
    console.warn('barcode render failed', e);
  }
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.width = '100%';
  svg.style.height = '100%';
  return new XMLSerializer().serializeToString(svg);
}

function fieldHtml(
  field: LabelBukuField,
  item: LabelBukuItem,
  identity: LibraryIdentity,
  qrUrl: string,
): string {
  const baseStyle = [
    'position:absolute',
    `left:${field.x}%`,
    `top:${field.y}%`,
    `width:${field.width}%`,
    `height:${field.height}%`,
    'box-sizing:border-box',
    'padding:0 4px',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
  ].join(';');

  if (field.kind === 'rect') {
    const fill = field.fill ?? '#0f172a';
    const radius = field.radius ? `border-radius:${Math.max(0, field.radius)}mm;` : '';
    return `<div style="${baseStyle};background:${fill};${radius}padding:0"></div>`;
  }

  if (field.kind === 'barcode') {
    return `<div style="${baseStyle};padding:0">${buildBarcodeSvg(item.kodeEksemplar)}</div>`;
  }

  if (field.kind === 'qr') {
    return `<div style="${baseStyle}"><img src="${qrUrl}" style="width:100%;height:100%" alt="QR"/></div>`;
  }

  const text = resolveText(field, item, identity);
  const align = field.align ?? 'left';
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const textStyle = [
    `font-size:${field.fontSize ?? 9}px`,
    `font-weight:${field.fontWeight ?? 'normal'}`,
    `color:${field.color ?? '#0f172a'}`,
    `text-align:${align}`,
    `justify-content:${justify}`,
    'line-height:1.15',
    'overflow:hidden',
  ].join(';');
  return `<div style="${baseStyle};${textStyle}"><span style="width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis">${escape(text)}</span></div>`;
}

/** Build self-contained printable HTML untuk batch label buku. */
export async function buildLabelBukuPrintHtml(input: LabelBukuPrintInput): Promise<string> {
  const { layout, items, identity } = input;
  const widthPx = Math.round(layout.widthMm * MM_TO_PX);
  const heightPx = Math.round(layout.heightMm * MM_TO_PX);

  const cards: string[] = [];
  for (const it of items) {
    const qrUrl = await buildQrDataUrl(it.kodeEksemplar);
    const fields = layout.fields.map((f) => fieldHtml(f, it, identity, qrUrl)).join('');
    cards.push(
      `<div class="label-card" style="width:${widthPx}px;height:${heightPx}px;background:${layout.background ?? '#ffffff'};">${fields}</div>`,
    );
  }

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Cetak Label Buku — ${escape(identity.nama)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 12px; background: #f1f5f9; }
  .grid { display: flex; flex-wrap: wrap; gap: 4mm; justify-content: flex-start; }
  .label-card {
    position: relative;
    border: 1px dashed #94a3b8;
    border-radius: 4px;
    overflow: hidden;
    box-sizing: border-box;
    page-break-inside: avoid;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .label-card { border: none; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="grid">${cards.join('')}</div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 200);
    });
  </script>
</body>
</html>`;
}

/** Open printable HTML in a new window for OS print dialog. */
export function openLabelBukuPrintWindow(html: string): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
