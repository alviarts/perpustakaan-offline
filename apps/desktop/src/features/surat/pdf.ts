/**
 * Render a "Surat Keterangan Bebas Pustaka" PDF in the WebView via jsPDF.
 *
 * Single-page A4 portrait, plain Times-Roman 12pt body. The template is
 * filled in with `fillSuratTemplate` (placeholders → real values) before
 * being laid out as paragraphs.
 *
 * Why so simple: the user-visible output the librarian will read is dominated
 * by the body text + nomor surat + signatory block. Anything fancier (custom
 * fonts, embedded TTD image, headers/footers) lives in v1.0.9+ once we have
 * data on whether schools actually want it.
 */
import jsPDF from 'jspdf';

import { fillSuratTemplate, type SuratGenerateResult } from '@/lib/surat';

export interface SuratPdfIdentity {
  namaPerpustakaan: string;
  alamat?: string | null;
  kota?: string | null;
}

export interface SuratPdfInput {
  result: SuratGenerateResult;
  identity: SuratPdfIdentity;
}

/**
 * Replace `\\n`-separated paragraphs in the template with real wrapped text
 * blocks. Returns a jsPDF document positioned at the bottom of the body so
 * the caller can append the signatory block.
 */
function renderBody(doc: jsPDF, body: string, x: number, yStart: number, width: number): number {
  let y = yStart;
  const lineHeight = 6;
  for (const paragraph of body.split('\n')) {
    if (paragraph.trim() === '') {
      y += lineHeight / 2;
      continue;
    }
    const wrapped = doc.splitTextToSize(paragraph, width) as string[];
    for (const line of wrapped) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, x, y);
      y += lineHeight;
    }
    y += lineHeight / 2;
  }
  return y;
}

/**
 * Build the surat PDF and return the populated jsPDF doc. The caller is
 * responsible for `doc.save(...)` / `doc.output(...)` so we don't force a
 * filesystem path here (lets the dialog show a "Pratinjau" inline blob too).
 */
export function buildSuratPdf(input: SuratPdfInput): jsPDF {
  const { result, identity } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 25;
  const pageWidth = 210;
  const bodyWidth = pageWidth - margin * 2;

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text(identity.namaPerpustakaan || 'Perpustakaan', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(12);
  doc.text('SURAT KETERANGAN BEBAS PUSTAKA', pageWidth / 2, 33, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(`Nomor: ${result.nomorSurat}`, pageWidth / 2, 40, { align: 'center' });

  doc.setFontSize(12);
  const filled = fillSuratTemplate(result.templateHtml, {
    nama: result.anggotaNama,
    kode_anggota: result.anggotaKode,
    kelas: result.anggotaKelas ?? '-',
    tanggal: result.tanggalCetak,
    nomor_surat: result.nomorSurat,
    nama_perpustakaan: identity.namaPerpustakaan,
    kota: identity.kota ?? '-',
  });
  const bodyEnd = renderBody(doc, filled, margin, 55, bodyWidth);

  // Signatory block.
  const ttdY = Math.max(bodyEnd + 10, 230);
  doc.text('Mengetahui,', pageWidth - margin, ttdY, { align: 'right' });
  doc.text(
    result.kepalaSekolahNama || '(_______________________)',
    pageWidth - margin,
    ttdY + 28,
    { align: 'right' },
  );
  if (result.kepalaSekolahNip) {
    doc.text(`NIP. ${result.kepalaSekolahNip}`, pageWidth - margin, ttdY + 34, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Convenience helper: build + trigger a browser-style download. Works inside
 * Tauri's WebView (the user gets a native save dialog through the WebView's
 * own download handler).
 */
export function downloadSuratPdf(input: SuratPdfInput, filename?: string): void {
  const doc = buildSuratPdf(input);
  const safeNomor = input.result.nomorSurat.replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(filename ?? `surat-bebas-pustaka-${safeNomor}.pdf`);
}
