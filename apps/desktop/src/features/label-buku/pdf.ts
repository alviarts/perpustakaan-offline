import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { LabelBukuField, LabelBukuLayout } from '@/lib/labelBuku';
import type { LibraryIdentity } from '@/stores/identityStore';
import type { LabelBukuItem } from './print';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const CARD_GAP_MM = 4;

const PX_TO_PT = 0.75;

const DEFAULT_TEXT_RGB: readonly [number, number, number] = [15, 23, 42];
const CARD_BORDER_RGB: readonly [number, number, number] = [148, 163, 184];

export interface LabelBukuPdfInput {
  layout: LabelBukuLayout;
  items: LabelBukuItem[];
  identity: LibraryIdentity;
}

function parseHexRgb(hex: string | null | undefined): readonly [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
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
 * Render a CODE128 barcode for `value` to a PNG data URL by drawing onto a
 * detached canvas. Returns null if rendering fails so the caller can skip
 * the field instead of aborting the whole batch.
 */
function buildBarcodeDataUrl(value: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value || '0000', {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 80,
      width: 2,
      background: '#ffffff',
      lineColor: '#0f172a',
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('barcode render failed', e);
    return null;
  }
}

interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeGrid(cardW: number, cardH: number) {
  const usableW = A4_WIDTH_MM - 2 * PAGE_MARGIN_MM;
  const usableH = A4_HEIGHT_MM - 2 * PAGE_MARGIN_MM;
  const cols = Math.max(1, Math.floor((usableW + CARD_GAP_MM) / (cardW + CARD_GAP_MM)));
  const rows = Math.max(1, Math.floor((usableH + CARD_GAP_MM) / (cardH + CARD_GAP_MM)));
  return { cols, rows, perPage: cols * rows };
}

function placeCard(
  idx: number,
  cols: number,
  rows: number,
  cardW: number,
  cardH: number,
): CardRect {
  const onPage = idx % (cols * rows);
  const col = onPage % cols;
  const row = Math.floor(onPage / cols);
  return {
    x: PAGE_MARGIN_MM + col * (cardW + CARD_GAP_MM),
    y: PAGE_MARGIN_MM + row * (cardH + CARD_GAP_MM),
    width: cardW,
    height: cardH,
  };
}

function drawRectField(doc: jsPDF, field: LabelBukuField, rect: CardRect): void {
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;
  const rgb = parseHexRgb(field.fill) ?? [15, 23, 42];
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const r = Math.max(0, field.radius ?? 0);
  if (r > 0) {
    doc.roundedRect(fx, fy, fw, fh, r, r, 'F');
  } else {
    doc.rect(fx, fy, fw, fh, 'F');
  }
}

function drawCardBorder(doc: jsPDF, rect: CardRect): void {
  doc.setDrawColor(...CARD_BORDER_RGB);
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.roundedRect(rect.x, rect.y, rect.width, rect.height, 1.5, 1.5);
  doc.setLineDashPattern([], 0);
}

function drawTextField(
  doc: jsPDF,
  field: LabelBukuField,
  rect: CardRect,
  text: string,
): void {
  if (!text) return;
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;

  const fontPt = (field.fontSize ?? 9) * PX_TO_PT;
  doc.setFontSize(fontPt);
  doc.setFont('helvetica', field.fontWeight === 'bold' ? 'bold' : 'normal');

  const rgb = parseHexRgb(field.color) ?? DEFAULT_TEXT_RGB;
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  const fontMm = fontPt * 0.3528;
  const yBaseline = fy + fh / 2 + fontMm / 4;

  const align = field.align ?? 'left';
  const padX = 1;
  let xPos = fx + padX;
  let textAlign: 'left' | 'center' | 'right' = 'left';
  if (align === 'center') {
    xPos = fx + fw / 2;
    textAlign = 'center';
  } else if (align === 'right') {
    xPos = fx + fw - padX;
    textAlign = 'right';
  }

  doc.text(text, xPos, yBaseline, {
    align: textAlign,
    baseline: 'alphabetic',
    maxWidth: Math.max(fw - padX * 2, 1),
  });
}

function drawBarcodeField(
  doc: jsPDF,
  field: LabelBukuField,
  rect: CardRect,
  dataUrl: string | null,
): void {
  if (!dataUrl) return;
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;
  try {
    doc.addImage(dataUrl, 'PNG', fx, fy, fw, fh, undefined, 'FAST');
  } catch {
    // fall through silently
  }
}

function drawQrField(
  doc: jsPDF,
  field: LabelBukuField,
  rect: CardRect,
  qrUrl: string,
): void {
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;
  try {
    doc.addImage(qrUrl, 'PNG', fx, fy, fw, fh, undefined, 'FAST');
  } catch {
    // ignore
  }
}

function drawCardBackground(
  doc: jsPDF,
  rect: CardRect,
  layoutBg: string | undefined,
): void {
  if (!layoutBg) return;
  if (layoutBg.toLowerCase() === '#ffffff' || layoutBg.toLowerCase() === '#fff') return;
  const rgb = parseHexRgb(layoutBg);
  if (!rgb) return;
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(rect.x, rect.y, rect.width, rect.height, 'F');
}

/**
 * Render a batch of book labels as A4 pages and return the PDF bytes.
 * Layout iteration mirrors `print.ts.buildLabelBukuPrintHtml` so the
 * printed HTML and the PDF stay visually consistent.
 */
export async function buildLabelBukuPdfBytes(input: LabelBukuPdfInput): Promise<Uint8Array> {
  const { layout, items, identity } = input;

  const cardW = layout.widthMm;
  const cardH = layout.heightMm;
  const { cols, rows, perPage } = computeGrid(cardW, cardH);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let idx = 0; idx < items.length; idx += 1) {
    const it = items[idx];
    if (!it) continue;
    if (idx > 0 && idx % perPage === 0) {
      doc.addPage();
    }
    const rect = placeCard(idx, cols, rows, cardW, cardH);

    drawCardBackground(doc, rect, layout.background);
    drawCardBorder(doc, rect);

    const [qrUrl, barcodeUrl] = await Promise.all([
      buildQrDataUrl(it.kodeEksemplar),
      Promise.resolve(buildBarcodeDataUrl(it.kodeEksemplar)),
    ]);

    for (const f of layout.fields) {
      if (f.kind === 'rect') {
        drawRectField(doc, f, rect);
      } else if (f.kind === 'barcode') {
        drawBarcodeField(doc, f, rect, barcodeUrl);
      } else if (f.kind === 'qr') {
        drawQrField(doc, f, rect, qrUrl);
      } else {
        drawTextField(doc, f, rect, resolveText(f, it, identity));
      }
    }
  }

  const buf = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(buf);
}
