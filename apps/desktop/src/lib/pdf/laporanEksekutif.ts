/**
 * Generate the "Laporan Eksekutif" — monthly executive report for the
 * kepala sekolah meeting (C1-LaporanEksekutifPDF, v1.1.0).
 *
 * Renders an HTML document with:
 *  - Page 1 cover: school identity + period KPIs.
 *  - Page 2 trends: weekly loans line chart, top-5 books bar chart,
 *    top-5 borrowers bar chart (all inline SVG so print quality stays
 *    crisp).
 *  - Page 3 action items: auto-generated suggestions (members with
 *    outstanding fine > Rp 50.000, books with reservasi queue but
 *    zero stock) + signature blocks.
 *
 * Stays consistent with the existing HTML/`window.print()` PDF stack
 * (`apps/desktop/src/lib/pdf/nota.ts`) — no new runtime deps. The pure
 * HTML builder is exported so unit tests can assert content without
 * needing a browser context.
 */

export interface LaporanEksekutifPeriod {
  /** Inclusive ISO start date `YYYY-MM-DD`. */
  startIso: string;
  /** Inclusive ISO end date `YYYY-MM-DD`. */
  endIso: string;
}

export interface LaporanEksekutifIdentitas {
  nama?: string;
  alamat?: string;
  kepala?: string;
  npsn?: string;
  tahunAjaran?: string;
  /** Optional logo (data: URI or absolute URL); skipped if missing. */
  logoSrc?: string;
}

export interface LaporanEksekutifKpi {
  totalAnggotaAktif: number;
  totalBuku: number;
  peminjamanPeriode: number;
  dendaOutstanding: number;
}

export interface LaporanEksekutifWeekly {
  /** Bucket label e.g. `M1` or `2026-W18`. */
  bucket: string;
  count: number;
}

export interface LaporanEksekutifTopBuku {
  judul: string;
  count: number;
}

export interface LaporanEksekutifTopAnggota {
  nama: string;
  kelas?: string | null;
  count: number;
}

export interface LaporanEksekutifAnggotaDenda {
  nama: string;
  kelas?: string | null;
  outstanding: number;
}

export interface LaporanEksekutifBukuReservasiZeroStock {
  judul: string;
  reservasiCount: number;
}

export interface LaporanEksekutifData {
  kpi: LaporanEksekutifKpi;
  weeklyLoans: LaporanEksekutifWeekly[];
  topBuku: LaporanEksekutifTopBuku[];
  topAnggota: LaporanEksekutifTopAnggota[];
  anggotaDendaTinggi: LaporanEksekutifAnggotaDenda[];
  bukuReservasiTanpaStok: LaporanEksekutifBukuReservasiZeroStock[];
}

export interface LaporanEksekutifInput {
  period: LaporanEksekutifPeriod;
  identitas?: LaporanEksekutifIdentitas;
  data: LaporanEksekutifData;
  /** Override the print/generate timestamp; defaults to `new Date()`. */
  generatedAt?: Date;
}

const DENDA_THRESHOLD = 50_000;

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtRupiah(n: number): string {
  return `Rp ${Math.max(0, Math.round(n)).toLocaleString('id-ID')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function lineChartSvg(buckets: LaporanEksekutifWeekly[]): string {
  if (buckets.length === 0) return '';
  const w = 520;
  const h = 160;
  const padX = 30;
  const padY = 20;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const stepX = buckets.length > 1 ? innerW / (buckets.length - 1) : 0;
  const points = buckets
    .map((b, i) => {
      const x = padX + stepX * i;
      const y = padY + innerH - (b.count / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const labels = buckets
    .map((b, i) => {
      const x = padX + stepX * i;
      return `<text x="${x.toFixed(1)}" y="${(h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="#555">${escape(b.bucket)}</text>`;
    })
    .join('');
  const yAxis = `<line x1="${padX}" y1="${padY}" x2="${padX}" y2="${padY + innerH}" stroke="#ccc" stroke-width="1"/>`;
  const xAxis = `<line x1="${padX}" y1="${padY + innerH}" x2="${padX + innerW}" y2="${padY + innerH}" stroke="#ccc" stroke-width="1"/>`;
  const dots = buckets
    .map((b, i) => {
      const x = padX + stepX * i;
      const y = padY + innerH - (b.count / max) * innerH;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#1d4ed8"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    ${yAxis}${xAxis}
    <polyline fill="none" stroke="#1d4ed8" stroke-width="2" points="${points}"/>
    ${dots}
    ${labels}
  </svg>`;
}

function barChartSvg(rows: ReadonlyArray<{ label: string; count: number }>): string {
  if (rows.length === 0) return '';
  const barH = 18;
  const gap = 6;
  const labelW = 200;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const w = 520;
  const h = rows.length * (barH + gap) + 8;
  const valueW = w - labelW - 30;
  const items = rows
    .map((r, i) => {
      const y = i * (barH + gap) + 4;
      const barLen = (r.count / max) * valueW;
      return `
        <text x="0" y="${y + barH * 0.7}" font-size="11" fill="#222">${escape(r.label.slice(0, 36))}</text>
        <rect x="${labelW}" y="${y}" width="${barLen.toFixed(1)}" height="${barH}" fill="#1d4ed8" rx="2"/>
        <text x="${labelW + barLen + 4}" y="${y + barH * 0.7}" font-size="11" fill="#222">${r.count}</text>
      `;
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${items}</svg>`;
}

function actionItems(data: LaporanEksekutifData): string[] {
  const items: string[] = [];
  for (const a of data.anggotaDendaTinggi) {
    if (a.outstanding > DENDA_THRESHOLD) {
      const kelas = a.kelas ? ` (${escape(a.kelas)})` : '';
      items.push(
        `Anggota <strong>${escape(a.nama)}</strong>${kelas} memiliki denda ${fmtRupiah(a.outstanding)} — kirim surat penagihan.`,
      );
    }
  }
  for (const b of data.bukuReservasiTanpaStok) {
    if (b.reservasiCount > 0) {
      items.push(
        `Buku <strong>${escape(b.judul)}</strong> memiliki ${b.reservasiCount} reservasi dengan stok 0 — pertimbangkan pengadaan tambahan.`,
      );
    }
  }
  return items;
}

export function buildLaporanEksekutifHtml(input: LaporanEksekutifInput): string {
  const namaSekolah = input.identitas?.nama || 'Perpustakaan';
  const alamat = input.identitas?.alamat || '';
  const npsn = input.identitas?.npsn || '';
  const tahunAjaran = input.identitas?.tahunAjaran || '';
  const kepala = input.identitas?.kepala || '';
  const logoTag = input.identitas?.logoSrc
    ? `<img src="${escape(input.identitas.logoSrc)}" alt="logo" style="height:64px;object-fit:contain"/>`
    : '';
  const periodLabel = `${fmtDate(input.period.startIso)} – ${fmtDate(input.period.endIso)}`;
  const generatedAt = fmtDateTime(input.generatedAt ?? new Date());

  const { kpi, weeklyLoans, topBuku, topAnggota } = input.data;
  const noLoans = (kpi.peminjamanPeriode ?? 0) === 0;
  const items = actionItems(input.data);

  const lineChart = noLoans ? '' : lineChartSvg(weeklyLoans);
  const topBukuChart = barChartSvg(
    topBuku.map((b) => ({ label: b.judul, count: b.count })),
  );
  const topAnggotaChart = barChartSvg(
    topAnggota.map((a) => ({
      label: a.kelas ? `${a.nama} — ${a.kelas}` : a.nama,
      count: a.count,
    })),
  );

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Laporan Eksekutif Perpustakaan — ${escape(namaSekolah)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 12px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13px; margin: 12px 0 4px; color: #1d4ed8; }
  .cover-header { display: flex; align-items: center; gap: 16px; }
  .cover-header .school-meta { flex: 1; }
  .meta-line { font-size: 11px; color: #555; }
  .period { font-size: 14px; font-weight: 600; margin: 12px 0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 16px; }
  .kpi-cell { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .kpi-cell .label { font-size: 11px; color: #666; }
  .kpi-cell .value { font-size: 20px; font-weight: 700; color: #1d4ed8; }
  .page { page-break-after: always; padding-bottom: 12px; }
  .page:last-child { page-break-after: auto; }
  ul.action-items { margin: 0; padding-left: 18px; }
  ul.action-items li { margin-bottom: 6px; }
  .signature-row { display: flex; justify-content: space-between; gap: 20px; margin-top: 36px; }
  .sig { flex: 1; border-top: 1px solid #aaa; padding-top: 4px; text-align: center; font-size: 11px; color: #555; }
  .sig strong { display: block; font-size: 12px; color: #111; margin-top: 36px; }
  .footer { font-size: 10px; color: #777; text-align: center; margin-top: 12px; }
  .empty-note { font-style: italic; color: #777; margin: 12px 0; }
</style>
</head>
<body>
  <section class="page">
    <div class="cover-header">
      ${logoTag}
      <div class="school-meta">
        <h1>${escape(namaSekolah)}</h1>
        <div class="meta-line">${escape(alamat)}</div>
        <div class="meta-line">${npsn ? 'NPSN: ' + escape(npsn) : ''}${npsn && tahunAjaran ? ' · ' : ''}${tahunAjaran ? 'TA: ' + escape(tahunAjaran) : ''}</div>
      </div>
    </div>
    <h2 style="text-align:center;border:none;margin-top:32px">Laporan Eksekutif Perpustakaan</h2>
    <p class="period" style="text-align:center">${escape(periodLabel)}</p>

    <div class="kpi-grid">
      <div class="kpi-cell">
        <div class="label">Total Anggota Aktif</div>
        <div class="value">${kpi.totalAnggotaAktif.toLocaleString('id-ID')}</div>
      </div>
      <div class="kpi-cell">
        <div class="label">Total Judul Buku</div>
        <div class="value">${kpi.totalBuku.toLocaleString('id-ID')}</div>
      </div>
      <div class="kpi-cell">
        <div class="label">Peminjaman Periode</div>
        <div class="value">${kpi.peminjamanPeriode.toLocaleString('id-ID')}</div>
      </div>
      <div class="kpi-cell">
        <div class="label">Denda Outstanding</div>
        <div class="value">${fmtRupiah(kpi.dendaOutstanding)}</div>
      </div>
    </div>
    <p class="footer">Dicetak: ${escape(generatedAt)}</p>
  </section>

  <section class="page">
    <h2>Tren &amp; Performa</h2>
    ${
      noLoans
        ? '<p class="empty-note">Tidak ada peminjaman dalam periode ini.</p>'
        : `<h3>Peminjaman per minggu</h3>${lineChart}`
    }
    <h3>Top 5 Buku</h3>
    ${topBuku.length === 0 ? '<p class="empty-note">Belum ada data.</p>' : topBukuChart}
    <h3>Top 5 Anggota Peminjam</h3>
    ${topAnggota.length === 0 ? '<p class="empty-note">Belum ada data.</p>' : topAnggotaChart}
  </section>

  <section class="page">
    <h2>Action Items</h2>
    ${
      items.length === 0
        ? '<p class="empty-note">Tidak ada item tindak lanjut otomatis.</p>'
        : `<ul class="action-items">${items.map((it) => `<li>${it}</li>`).join('')}</ul>`
    }

    <div class="signature-row">
      <div class="sig">
        Pustakawan
        <strong>(__________________)</strong>
      </div>
      <div class="sig">
        Kepala Sekolah
        <strong>${escape(kepala || '(__________________)')}</strong>
      </div>
    </div>
    <p class="footer">Dicetak: ${escape(generatedAt)} · ${escape(namaSekolah)}</p>
  </section>
</body>
</html>`;
}

/**
 * Open a print window with the executive report. Returns a `Blob` of the
 * generated HTML so callers can also export-to-file if desired.
 */
export function generateLaporanEksekutifPdf(input: LaporanEksekutifInput): Blob {
  const html = buildLaporanEksekutifHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  if (typeof window !== 'undefined') {
    const win = window.open('', '_blank', 'width=820,height=1100');
    if (!win) {
      throw new Error('Popup diblokir browser. Izinkan popup untuk mencetak laporan.');
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // ignore — user can print manually
      }
    }, 250);
  }
  return blob;
}
