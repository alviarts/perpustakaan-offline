/**
 * Nota (bukti peminjaman) — template + cetak (single & massal).
 *
 * - Template disimpan di settings (key `nota.template`) sehingga admin bisa
 *   mengatur ukuran kertas, judul, catatan kaki, dan field yang dicetak.
 * - Cetak memakai iframe tersembunyi (lihat `lib/print`) karena Tauri/WebView2
 *   memblokir pop-up.
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
  totalPoin?: number;
  identitas?: { nama?: string; alamat?: string };
}

export type NotaPaper = 'a4' | 'a5' | 'thermal80' | 'thermal58';
export type NotaPerPage = 1 | 2 | 4;

export interface NotaTemplate {
  /** Ukuran kertas. */
  paper: NotaPaper;
  /** Berapa nota per halaman (untuk a4/a5). */
  perPage: NotaPerPage;
  /** Judul di bawah nama perpustakaan. */
  heading: string;
  /** Catatan kaki (boleh kosong). */
  footer: string;
  /** Tampilkan alamat perpustakaan di kop. */
  showAlamat: boolean;
  /** Tampilkan kolom kode eksemplar. */
  showEksemplar: boolean;
  /** Tampilkan ringkasan denda (uang/poin). */
  showDenda: boolean;
  /** Tampilkan baris tanda tangan. */
  showTandaTangan: boolean;
}

export const DEFAULT_NOTA_TEMPLATE: NotaTemplate = {
  paper: 'a4',
  perPage: 1,
  heading: 'Nota Peminjaman',
  footer: 'Terima kasih. Mohon kembalikan tepat waktu.',
  showAlamat: true,
  showEksemplar: false,
  showDenda: true,
  showTandaTangan: true,
};

const PAPER_CSS: Record<NotaPaper, { size: string; margin: string }> = {
  a4: { size: 'A4', margin: '18mm 16mm' },
  a5: { size: 'A5', margin: '12mm 10mm' },
  thermal80: { size: '80mm auto', margin: '4mm' },
  thermal58: { size: '58mm auto', margin: '3mm' },
};

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** Satu blok nota (dipakai untuk single maupun grid massal). */
function buildNotaBlock(input: NotaInput, tpl: NotaTemplate): string {
  const rows = input.items
    .map((it, idx) => {
      const eks = tpl.showEksemplar
        ? `<td>${escape(it.eksemplarKode ?? '-')}</td>`
        : '';
      return `<tr><td class="num">${idx + 1}</td>${eks}<td>${escape(it.kode)}</td><td>${escape(it.judul)}</td></tr>`;
    })
    .join('');

  const eksHead = tpl.showEksemplar ? '<th>Eksemplar</th>' : '';

  const dendaBits: string[] = [];
  if (tpl.showDenda) {
    if (input.totalDenda && input.totalDenda > 0) {
      dendaBits.push(`<span><strong>Denda:</strong> ${rupiah(input.totalDenda)}</span>`);
    }
    if (input.totalPoin && input.totalPoin > 0) {
      dendaBits.push(`<span><strong>Poin:</strong> ${input.totalPoin}</span>`);
    }
  }
  const denda = dendaBits.length ? `<p class="denda">${dendaBits.join(' &nbsp; ')}</p>` : '';

  const lib = input.identitas?.nama ? escape(input.identitas.nama) : 'Perpustakaan';
  const alamat =
    tpl.showAlamat && input.identitas?.alamat
      ? `<p class="addr">${escape(input.identitas.alamat)}</p>`
      : '';

  const ttd = tpl.showTandaTangan
    ? `<div class="ttd">
         <div><span>Peminjam</span><em>${escape(input.anggotaNama)}</em></div>
         <div><span>Petugas</span><em>&nbsp;</em></div>
       </div>`
    : '';

  return `<section class="nota">
    <header>
      <h1>${lib}</h1>
      ${alamat}
      <p class="heading">${escape(tpl.heading)}</p>
    </header>
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
      <thead><tr><th class="num">#</th>${eksHead}<th>Kode</th><th>Judul</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${denda}
    ${ttd}
    ${tpl.footer ? `<p class="footer">${escape(tpl.footer)}</p>` : ''}
  </section>`;
}

export function buildNotaHtml(
  inputs: NotaInput | NotaInput[],
  template: Partial<NotaTemplate> = {},
): string {
  const tpl: NotaTemplate = { ...DEFAULT_NOTA_TEMPLATE, ...template };
  const list = Array.isArray(inputs) ? inputs : [inputs];
  const paper = PAPER_CSS[tpl.paper] ?? PAPER_CSS.a4;
  const grid = tpl.paper === 'a4' || tpl.paper === 'a5';
  const cols = grid ? (tpl.perPage === 4 ? 2 : 1) : 1;

  const blocks = list.map((i) => buildNotaBlock(i, tpl)).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escape(tpl.heading)}${list.length > 1 ? ` (${list.length})` : ''}</title>
<style>
  @page { size: ${paper.size}; margin: ${paper.margin}; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, sans-serif; font-size: ${grid ? '11px' : '12px'}; margin: 0; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${grid ? '8mm' : '0'}; }
  .nota { border: ${grid ? '1px dashed #cbd5e1' : 'none'}; border-radius: 4px; padding: ${grid ? '4mm' : '0'}; }
  .nota + .nota { page-break-before: ${grid ? 'auto' : 'always'}; }
  header { text-align: center; margin-bottom: 6px; }
  h1 { font-size: ${grid ? '13px' : '16px'}; margin: 0 0 2px; }
  .addr { margin: 0; font-size: 10px; color: #555; }
  .heading { margin: 4px 0 0; font-size: 11px; color: #333; font-weight: 600; }
  .meta { display: flex; justify-content: space-between; gap: 10px; margin: 8px 0; }
  .meta div { flex: 1; }
  .meta p { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ccc; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  .num { width: 24px; text-align: right; }
  .denda { margin: 6px 0 0; font-size: 11px; }
  .ttd { display: flex; justify-content: space-between; margin-top: 18px; font-size: 10px; text-align: center; }
  .ttd div { width: 40%; }
  .ttd span { display: block; color: #555; }
  .ttd em { display: block; margin-top: 22px; border-top: 1px solid #999; padding-top: 2px; font-style: normal; }
  .footer { margin-top: 12px; font-size: 10px; color: #555; text-align: center; }
  .grid .nota { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="grid">${blocks}</div>
</body>
</html>`;
}

/** Cetak satu atau banyak nota sekaligus. */
export function printNota(
  inputs: NotaInput | NotaInput[],
  template: Partial<NotaTemplate> = {},
): void {
  if (typeof window === 'undefined') return;
  printHtmlDocument(buildNotaHtml(inputs, template));
}

/** Kompatibilitas: cetak satu nota. */
export function generateNotaPdf(input: NotaInput): void {
  printNota(input);
}
