import { printHtmlViaIframe } from '@/lib/print';
import type { BulanCountRow } from '@/lib/laporan';

/** Trigger a download of `content` (UTF-8 string) as a file. */
export function downloadText(content: string, filename: string, mime: string = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open a print-ready HTML document (hidden iframe, no pop-up). */
export function printHtml(html: string): void {
  printHtmlViaIframe(html);
}

export interface LaporanIdentitas {
  nama?: string;
  alamat?: string;
  npsn?: string;
  /** Nomor Pokok Perpustakaan (akreditasi). */
  npp?: string;
  kontak?: string;
  /** Data URL (base64) logo perpustakaan/sekolah untuk kop. */
  logoDataUrl?: string;
}

export interface LaporanTtd {
  /** default "Kepala Sekolah" */
  jabatan?: string;
  nama?: string;
  nip?: string;
  /** mis. "Jakarta, 24 Oktober 2026" */
  tempatTanggal?: string;
}

export function buildLaporanPdfHtml(opts: {
  title: string;
  periode: string;
  identitas?: LaporanIdentitas;
  table: { headers: string[]; rows: Array<Array<string | number>> };
  summary?: Array<{ label: string; value: string }>;
  /** Blok tanda tangan resmi (akreditasi). */
  ttd?: LaporanTtd;
}): string {
  const { title, periode, identitas, table, summary, ttd } = opts;
  const escape = (v: string | number): string =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const headerHtml = `<tr>${table.headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr>`;
  const bodyHtml = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`)
    .join('');
  const summaryHtml = summary?.length
    ? `<div class="summary">${summary
        .map((s) => `<div><strong>${escape(s.label)}</strong>: ${escape(s.value)}</div>`)
        .join('')}</div>`
    : '';

  const subLineParts = [
    identitas?.npsn ? `NPSN: ${identitas.npsn}` : '',
    identitas?.npp ? `NPP: ${identitas.npp}` : '',
    identitas?.kontak ? identitas.kontak : '',
  ].filter(Boolean);
  const kop = `<div class="kop">
    ${identitas?.logoDataUrl ? `<img class="kop-logo" src="${escape(identitas.logoDataUrl)}" alt="logo" />` : ''}
    <div class="kop-text">
      <div class="kop-nama">${escape(identitas?.nama ?? 'Perpustakaan')}</div>
      <div class="kop-alamat">${escape(identitas?.alamat ?? '')}</div>
      ${subLineParts.length ? `<div class="kop-sub">${escape(subLineParts.join('  |  '))}</div>` : ''}
    </div>
  </div>`;

  const ttdHtml = ttd
    ? `<div class="ttd">
    <div class="ttd-tgl">${escape(ttd.tempatTanggal ?? '')}</div>
    <div class="ttd-jabatan">${escape(ttd.jabatan ?? 'Kepala Sekolah')}</div>
    <div class="ttd-space"></div>
    <div class="ttd-nama">${escape(ttd.nama ?? '....................')}</div>
    ${ttd.nip ? `<div class="ttd-nip">NIP. ${escape(ttd.nip)}</div>` : ''}
  </div>`
    : '';

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; padding: 24px; color: #111; }
    .kop { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .kop-logo { height: 64px; width: 64px; object-fit: contain; flex: none; }
    .kop-text { flex: 1; text-align: center; }
    .kop-nama { font-size: 18px; font-weight: 700; text-transform: uppercase; }
    .kop-alamat { font-size: 12px; color: #333; }
    .kop-sub { font-size: 11px; color: #555; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; }
    .summary { display: flex; gap: 16px; margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 6px 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    .ttd { margin-top: 40px; margin-left: auto; width: 260px; text-align: left; font-size: 12px; }
    .ttd-tgl { margin-bottom: 4px; }
    .ttd-jabatan { font-weight: 600; }
    .ttd-space { height: 56px; }
    .ttd-nama { font-weight: 700; text-decoration: underline; }
    footer { margin-top: 32px; font-size: 10px; color: #777; text-align: right; }
    @media print {
      body { padding: 12mm; }
      .kop { border-color: #000; }
    }
  </style>
</head>
<body>
  ${kop}
  <div class="meta">
    <div><strong>${escape(title)}</strong></div>
    <div>Periode: ${escape(periode)}</div>
  </div>
  ${summaryHtml}
  <table>
    <thead>${headerHtml}</thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  ${ttdHtml}
  <footer>Dicetak pada ${new Date().toLocaleString('id-ID')}</footer>
</body>
</html>`;
}

export interface MatrixPivot {
  columns: string[];
  rows: Array<{ label: string; values: number[]; total: number }>;
}

/** Pivot long-format `BulanCountRow[]` into a label x month matrix. */
export function pivotBulan(rows: BulanCountRow[]): MatrixPivot {
  const columns = Array.from(new Set(rows.map((r) => r.bulan))).sort();
  const byLabel = new Map<string, number[]>();
  for (const r of rows) {
    let arr = byLabel.get(r.label);
    if (!arr) {
      arr = new Array(columns.length).fill(0);
      byLabel.set(r.label, arr);
    }
    const idx = columns.indexOf(r.bulan);
    if (idx >= 0) arr[idx] = (arr[idx] ?? 0) + r.jumlah;
  }
  const out = Array.from(byLabel.entries()).map(([label, values]) => ({
    label,
    values,
    total: values.reduce((a, b) => a + b, 0),
  }));
  out.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return { columns, rows: out };
}
