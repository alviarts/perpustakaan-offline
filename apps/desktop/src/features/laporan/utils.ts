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

/** Open a print-ready HTML window using window.print(). */
export function printHtml(html: string): void {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      // ignore
    }
  }, 200);
}

export function buildLaporanPdfHtml(opts: {
  title: string;
  periode: string;
  identitas?: { nama?: string; alamat?: string };
  table: { headers: string[]; rows: Array<Array<string | number>> };
  summary?: Array<{ label: string; value: string }>;
}): string {
  const { title, periode, identitas, table, summary } = opts;
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

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; padding: 24px; color: #111; }
    .pustaka-header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .pustaka-header h1 { margin: 0 0 4px; font-size: 18px; }
    .pustaka-header p { margin: 0; font-size: 12px; color: #555; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; }
    .summary { display: flex; gap: 16px; margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 6px 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    footer { margin-top: 32px; font-size: 10px; color: #777; text-align: right; }
    @media print {
      body { padding: 12mm; }
      .pustaka-header { border-color: #000; }
    }
  </style>
</head>
<body>
  <div class="pustaka-header">
    <h1>${escape(identitas?.nama ?? 'Perpustakaan')}</h1>
    <p>${escape(identitas?.alamat ?? '')}</p>
  </div>
  <div class="meta">
    <div><strong>${escape(title)}</strong></div>
    <div>Periode: ${escape(periode)}</div>
  </div>
  ${summaryHtml}
  <table>
    <thead>${headerHtml}</thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  <footer>Dicetak pada ${new Date().toLocaleString('id-ID')}</footer>
</body>
</html>`;
}
