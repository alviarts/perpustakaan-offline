/**
 * Generate "nota peminjaman" — printed receipt.
 *
 * Uses browser-native `window.print()` against a pop-up document. Avoids extra
 * runtime dependencies (pdf-lib) while still producing a printable artifact
 * that desktop OS can route to default printer or PDF.
 */

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
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) {
    throw new Error('Popup diblokir browser. Izinkan popup untuk mencetak nota.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Trigger print on next tick (after layout/paint).
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // ignore — user can print manually
    }
  }, 200);
}
