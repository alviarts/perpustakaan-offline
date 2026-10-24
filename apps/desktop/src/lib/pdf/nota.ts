/**
 * Generate "nota peminjaman" — printed receipt.
 *
 * Prints via a hidden iframe (`printHtmlDocument`) so it works inside Tauri's
 * WebView2, which blocks pop-up windows. No extra runtime dependencies.
 */

import { printHtmlDocument } from '@/lib/print';

export interface NotaItem {
  judul: string;
  kode: string;
  eksemplarKode?: string | null;
}

export interface NotaInput {
  nomor: string;
  anggotaNama: string;
  anggotaKode: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
  items: NotaItem[];
  totalDenda?: number;
  identitas?: {
    nama?: string;
    alamat?: string;
  };
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildNotaHtml(input: NotaInput): string {
  const itemsRows = input.items
    .map(
      (it, idx) =>
        `<tr><td>${idx + 1}</td><td>${escape(it.kode)}</td><td>${escape(it.judul)}</td></tr>`,
    )
    .join('');
  const denda =
    input.totalDenda && input.totalDenda > 0
      ? `<p><strong>Total Denda:</strong> Rp ${input.totalDenda.toLocaleString('id-ID')}</p>`
      : '';
  const lib = input.identitas?.nama ? escape(input.identitas.nama) : 'Perpustakaan';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Nota Peminjaman ${escape(input.nomor)}</title>
<style>
  body { font-family: 'Segoe UI', Roboto, sans-serif; font-size: 12px; margin: 24px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
  .sub { text-align: center; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  .meta { display: flex; justify-content: space-between; gap: 12px; margin: 12px 0; }
  .meta div { flex: 1; }
  .footer { margin-top: 24px; font-size: 11px; color: #555; text-align: center; }
</style>
</head>
<body>
  <h1>${lib}</h1>
  <p class="sub">Nota Peminjaman</p>
  <hr />
  <div class="meta">
    <div>
      <p><strong>No. Pinjam:</strong> ${escape(input.nomor)}</p>
      <p><strong>Tgl Pinjam:</strong> ${escape(input.tanggalPinjam)}</p>
    </div>
    <div>
      <p><strong>Anggota:</strong> ${escape(input.anggotaNama)} (${escape(input.anggotaKode)})</p>
      <p><strong>Jatuh Tempo:</strong> ${escape(input.tanggalJatuhTempo)}</p>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:32px">#</th><th style="width:100px">Kode</th><th>Judul</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>
  ${denda}
  <p class="footer">Terima kasih. Mohon kembalikan tepat waktu.</p>
</body>
</html>`;
}

export function generateNotaPdf(input: NotaInput): void {
  if (typeof window === 'undefined') return;
  const html = buildNotaHtml(input);
  // Tauri/WebView2 blocks pop-ups, so print through a hidden iframe.
  printHtmlDocument(html);
}
