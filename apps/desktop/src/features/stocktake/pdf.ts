import jsPDF from 'jspdf';
import type { LibraryIdentity } from '@/stores/identityStore';
import type { StocktakeItemRow, StocktakeSessionRow } from '@/lib/stocktake';

const A4_WIDTH_MM = 210;
const PAGE_MARGIN_MM = 14;
const HEADER_LINE_GAP_MM = 6;
const TABLE_HEADER_HEIGHT_MM = 7;
const TABLE_ROW_HEIGHT_MM = 7;
const PAGE_BREAK_BOTTOM_MM = 280;

export interface StocktakeReportLabels {
  reportTitle: string;
  subtitle: string;
  summary: string; // pre-formatted "Total: X | Found: Y | Missing: Z"
  tableHeader: {
    no: string;
    kode: string;
    judul: string;
    pengarang: string;
    status: string;
  };
  status: Record<StocktakeItemRow['status'], string>;
  noMissing: string;
  footer: {
    ttd: string;
    kepsek: string;
  };
}

export interface StocktakeReportInput {
  session: StocktakeSessionRow;
  missing: StocktakeItemRow[];
  identity: LibraryIdentity;
  labels: StocktakeReportLabels;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const trimmed = iso.replace('T', ' ').slice(0, 19);
  return trimmed;
}

/**
 * Render a formal stocktake / opname report as PDF (A4 portrait). Layout:
 * 1. Header: school name + address + report title + session metadata.
 * 2. Summary line.
 * 3. Table: missing eksemplar (No, Kode, Judul, Pengarang, Status).
 * 4. Footer: signature blocks for petugas + kepala sekolah.
 *
 * Pure function — returns the jsPDF instance; the caller decides whether
 * to `.save()`, `.output('arraybuffer')`, etc. Lets us unit-test page count
 * + content without spawning a browser.
 */
export function buildStocktakeReport(input: StocktakeReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const { session, missing, identity, labels } = input;

  let y = PAGE_MARGIN_MM;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(identity.nama || 'Perpustakaan', A4_WIDTH_MM / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (identity.alamat && identity.alamat !== '-') {
    doc.text(identity.alamat, A4_WIDTH_MM / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN_MM, y, A4_WIDTH_MM - PAGE_MARGIN_MM, y);
  y += HEADER_LINE_GAP_MM;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(labels.reportTitle, A4_WIDTH_MM / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(11);
  doc.text(labels.subtitle, A4_WIDTH_MM / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`ID Sesi: ${session.id}${session.nama ? ' — ' + session.nama : ''}`, PAGE_MARGIN_MM, y);
  y += 5;
  doc.text(`Tanggal Mulai : ${formatDate(session.tanggalMulai)}`, PAGE_MARGIN_MM, y);
  y += 5;
  doc.text(
    `Tanggal Selesai : ${formatDate(session.tanggalSelesai)}`,
    PAGE_MARGIN_MM,
    y,
  );
  y += 5;
  if (session.petugasNama) {
    doc.text(`Petugas : ${session.petugasNama}`, PAGE_MARGIN_MM, y);
    y += 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(labels.summary, PAGE_MARGIN_MM, y);
  y += 8;

  if (missing.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text(labels.noMissing, PAGE_MARGIN_MM, y);
  } else {
    drawTable(doc, missing, labels, y);
  }

  drawFooter(doc, identity, labels);
  return doc;
}

const COL_X = {
  no: PAGE_MARGIN_MM,
  kode: PAGE_MARGIN_MM + 12,
  judul: PAGE_MARGIN_MM + 50,
  pengarang: PAGE_MARGIN_MM + 120,
  status: PAGE_MARGIN_MM + 160,
};

function drawTable(
  doc: jsPDF,
  rows: StocktakeItemRow[],
  labels: StocktakeReportLabels,
  startY: number,
): void {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(30, 41, 59);
  doc.setTextColor(255, 255, 255);
  doc.rect(PAGE_MARGIN_MM, y - 5, A4_WIDTH_MM - 2 * PAGE_MARGIN_MM, TABLE_HEADER_HEIGHT_MM, 'F');
  doc.text(labels.tableHeader.no, COL_X.no + 1, y);
  doc.text(labels.tableHeader.kode, COL_X.kode, y);
  doc.text(labels.tableHeader.judul, COL_X.judul, y);
  doc.text(labels.tableHeader.pengarang, COL_X.pengarang, y);
  doc.text(labels.tableHeader.status, COL_X.status, y);
  doc.setTextColor(0, 0, 0);
  y += TABLE_HEADER_HEIGHT_MM;

  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    if (y > PAGE_BREAK_BOTTOM_MM) {
      doc.addPage();
      y = PAGE_MARGIN_MM + 5;
    }
    doc.text(`${i + 1}`, COL_X.no + 1, y);
    doc.text(truncate(row.eksemplarKode, 18), COL_X.kode, y);
    doc.text(truncate(row.bukuJudul, 35), COL_X.judul, y);
    doc.text(truncate(row.bukuPengarang ?? '-', 22), COL_X.pengarang, y);
    doc.text(labels.status[row.status] ?? row.status, COL_X.status, y);
    y += TABLE_ROW_HEIGHT_MM;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function drawFooter(
  doc: jsPDF,
  _identity: LibraryIdentity,
  labels: StocktakeReportLabels,
): void {
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  const footerY = 270;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(formatToday(), A4_WIDTH_MM - PAGE_MARGIN_MM, footerY, { align: 'right' });
  doc.text(labels.footer.ttd, PAGE_MARGIN_MM + 5, footerY + 6);
  doc.text(labels.footer.kepsek, A4_WIDTH_MM - PAGE_MARGIN_MM - 5, footerY + 6, { align: 'right' });
  doc.text('(……………………………………)', PAGE_MARGIN_MM + 5, footerY + 26);
  doc.text('(……………………………………)', A4_WIDTH_MM - PAGE_MARGIN_MM - 5, footerY + 26, {
    align: 'right',
  });
}

function formatToday(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
