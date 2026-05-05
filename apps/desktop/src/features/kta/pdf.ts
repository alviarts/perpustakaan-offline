import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { assetsApi } from '@/lib/assets';
import type { Anggota } from '@/lib/anggota';
import { buildQrPayload, type KtaField, type KtaLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const CARD_GAP_MM = 8;

/**
 * jsPDF wraps `text()` font sizes in points (pt). The KTA layout schema
 * stores `fontSize` in CSS pixels (px) — the same unit the print HTML uses.
 * 1 px ≈ 0.75 pt at 96 dpi, which is the ratio CSS itself uses.
 */
const PX_TO_PT = 0.75;

/** Default text colour when the layout doesn't specify one — slate-900. */
const DEFAULT_TEXT_RGB: readonly [number, number, number] = [15, 23, 42];
/** Foto placeholder colour when the member has no photo — slate-200. */
const FOTO_PLACEHOLDER_RGB: readonly [number, number, number] = [226, 232, 240];
/** Card border colour — slate-400, dashed. */
const CARD_BORDER_RGB: readonly [number, number, number] = [148, 163, 184];

export interface KtaPdfInput {
  layout: KtaLayout;
  anggota: Anggota[];
  identity: LibraryIdentity;
}

function parseHexRgb(hex: string | null | undefined): readonly [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function resolveText(field: KtaField, anggota: Anggota, identity: LibraryIdentity): string {
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'nama':
      return anggota.nama;
    case 'kodeAnggota':
      return anggota.kodeAnggota;
    case 'kelas':
      return anggota.kelas ?? '-';
    case 'jurusan':
      return anggota.jurusan ?? '-';
    case 'agama':
      return anggota.agama ?? '-';
    default:
      return '';
  }
}

async function loadFotoDataUrl(fotoPath: string | null | undefined): Promise<string | null> {
  if (!fotoPath) return null;
  try {
    return await assetsApi.readDataUrl(fotoPath);
  } catch {
    return null;
  }
}

async function buildQrDataUrl(memberId: number): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(memberId), {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
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

function placeCard(idx: number, cols: number, rows: number, cardW: number, cardH: number): CardRect {
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

function drawCardBorder(doc: jsPDF, rect: CardRect): void {
  doc.setDrawColor(...CARD_BORDER_RGB);
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.roundedRect(rect.x, rect.y, rect.width, rect.height, 2, 2);
  doc.setLineDashPattern([], 0);
}

function drawTextField(doc: jsPDF, field: KtaField, rect: CardRect, text: string): void {
  if (!text) return;
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;

  const fontPt = (field.fontSize ?? 10) * PX_TO_PT;
  doc.setFontSize(fontPt);
  doc.setFont('helvetica', field.fontWeight === 'bold' ? 'bold' : 'normal');

  const rgb = parseHexRgb(field.color) ?? DEFAULT_TEXT_RGB;
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);

  // jsPDF measures in mm but the y coord is the baseline. Approximate the
  // visual centre of the field by anchoring the baseline at field-mid + a
  // small ascent offset (font size in mm ÷ 4 puts the baseline roughly in
  // the lower half of the cap height).
  const fontMm = fontPt * 0.3528; // 1 pt ≈ 0.3528 mm
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

function drawFotoField(
  doc: jsPDF,
  field: KtaField,
  rect: CardRect,
  fotoUrl: string | null,
): void {
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;

  if (fotoUrl) {
    try {
      doc.addImage(fotoUrl, 'AUTO', fx, fy, fw, fh, undefined, 'FAST');
      return;
    } catch {
      // Fall through to placeholder.
    }
  }
  doc.setFillColor(...FOTO_PLACEHOLDER_RGB);
  doc.rect(fx, fy, fw, fh, 'F');
}

function drawQrField(doc: jsPDF, field: KtaField, rect: CardRect, qrUrl: string): void {
  const fx = rect.x + (field.x / 100) * rect.width;
  const fy = rect.y + (field.y / 100) * rect.height;
  const fw = (field.width / 100) * rect.width;
  const fh = (field.height / 100) * rect.height;
  try {
    doc.addImage(qrUrl, 'PNG', fx, fy, fw, fh, undefined, 'FAST');
  } catch {
    // QR rendering should never fail; if jsPDF rejects the data URL the
    // caller still gets a usable PDF without the QR rather than an
    // exception that aborts the whole batch.
  }
}

function drawCardBackground(doc: jsPDF, rect: CardRect, layoutBg: string | undefined): void {
  if (!layoutBg) return;
  if (layoutBg.toLowerCase() === '#ffffff' || layoutBg.toLowerCase() === '#fff') return;
  const rgb = parseHexRgb(layoutBg);
  if (!rgb) return;
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(rect.x, rect.y, rect.width, rect.height, 'F');
}

/**
 * Render a batch of KTA cards as A4 pages and return the PDF bytes.
 * The layout iteration mirrors `print.ts.buildKtaPrintHtml` so the
 * printed output and the PDF stay visually identical (modulo the
 * dashed border which is purely decorative).
 */
export async function buildKtaPdfBytes(input: KtaPdfInput): Promise<Uint8Array> {
  const { layout, anggota, identity } = input;

  const cardW = layout.widthMm;
  const cardH = layout.heightMm;
  const { cols, rows, perPage } = computeGrid(cardW, cardH);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let idx = 0; idx < anggota.length; idx += 1) {
    const a = anggota[idx];
    if (!a) continue;
    if (idx > 0 && idx % perPage === 0) {
      doc.addPage();
    }
    const rect = placeCard(idx, cols, rows, cardW, cardH);

    drawCardBackground(doc, rect, layout.background);
    drawCardBorder(doc, rect);

    const [qrUrl, fotoUrl] = await Promise.all([
      buildQrDataUrl(a.id),
      loadFotoDataUrl(a.fotoPath),
    ]);

    for (const f of layout.fields) {
      if (f.kind === 'foto') {
        drawFotoField(doc, f, rect, fotoUrl);
      } else if (f.kind === 'qr') {
        drawQrField(doc, f, rect, qrUrl);
      } else {
        drawTextField(doc, f, rect, resolveText(f, a, identity));
      }
    }
  }

  const buf = doc.output('arraybuffer') as ArrayBuffer;
  return new Uint8Array(buf);
}
