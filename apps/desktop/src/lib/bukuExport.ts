import { utils, write } from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

import { isTauri } from '@/lib/auth';
import { triggerDownload } from '@/lib/importWizard';
import { bukuApi, type Buku, type BukuListArgs } from '@/lib/buku';

export interface BukuExportRow {
  kode_buku: string;
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun_terbit: string;
  kode_ddc: string;
  kategori: string;
  isbn: string;
  jumlah_eksemplar: number;
  jumlah_tersedia: number;
  bahasa: string;
  rak: string;
  sumber: string;
  harga: number;
  tanggal_input: string;
}

const HEADERS: Array<{ key: keyof BukuExportRow; label: string }> = [
  { key: 'kode_buku', label: 'Kode Buku' },
  { key: 'judul', label: 'Judul' },
  { key: 'pengarang', label: 'Pengarang' },
  { key: 'penerbit', label: 'Penerbit' },
  { key: 'tahun_terbit', label: 'Tahun Terbit' },
  { key: 'kode_ddc', label: 'Kode DDC' },
  { key: 'kategori', label: 'Kategori' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'jumlah_eksemplar', label: 'Jumlah Eksemplar' },
  { key: 'jumlah_tersedia', label: 'Jumlah Tersedia' },
  { key: 'bahasa', label: 'Bahasa' },
  { key: 'rak', label: 'Rak' },
  { key: 'sumber', label: 'Sumber' },
  { key: 'harga', label: 'Harga' },
  { key: 'tanggal_input', label: 'Tanggal Input' },
];

export function toBukuExportRow(b: Buku): BukuExportRow {
  return {
    kode_buku: b.kodeBuku,
    judul: b.judul,
    pengarang: b.pengarang ?? '',
    penerbit: b.penerbit ?? '',
    tahun_terbit: b.tahunTerbit == null ? '' : String(b.tahunTerbit),
    kode_ddc: b.kodeDdc ?? '',
    kategori: b.kategori ?? '',
    isbn: b.isbn ?? '',
    jumlah_eksemplar: b.jumlahEksemplar,
    jumlah_tersedia: b.jumlahTersedia,
    bahasa: b.bahasa ?? '',
    rak: b.rak ?? '',
    sumber: b.sumber ?? '',
    harga: b.harga ?? 0,
    tanggal_input: b.tanggalInput ?? '',
  };
}

/** Build an in-memory XLSX workbook for the supplied buku rows. */
export function buildBukuWorkbookBytes(items: Buku[]): Uint8Array {
  const rows = items.map(toBukuExportRow);
  const labels = HEADERS.map((h) => h.label);
  const aoa: (string | number)[][] = [labels];
  for (const row of rows) {
    aoa.push(HEADERS.map((h) => row[h.key]));
  }
  const sheet = utils.aoa_to_sheet(aoa);
  sheet['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.label.length + 2, 14) }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'Buku');
  const out = write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function defaultBukuExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `buku-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
}

/** Fetch every buku matching the filters, paginating to avoid backend limits. */
export async function fetchAllBuku(
  filters: Omit<BukuListArgs, 'limit' | 'offset'>,
): Promise<Buku[]> {
  const PAGE = 500;
  const out: Buku[] = [];
  let offset = 0;
  const HARD_CAP = 100_000;
  while (offset < HARD_CAP) {
    const page = await bukuApi.list({ ...filters, limit: PAGE, offset });
    out.push(...page.items);
    if (page.items.length < PAGE) break;
    offset += page.items.length;
  }
  return out;
}

export interface BukuExportResult {
  path: string;
  count: number;
  bytes: number;
}

/**
 * Export all buku matching `filters` to `.xlsx`. Uses a Tauri save dialog +
 * `export_write_bytes` in the desktop app, and an anchor download in browser
 * dev mode. Returns null when the user cancels the dialog.
 */
export async function runBukuExport(
  filters: Omit<BukuListArgs, 'limit' | 'offset'>,
): Promise<BukuExportResult | null> {
  const items = await fetchAllBuku(filters);
  const bytes = buildBukuWorkbookBytes(items);
  const defaultName = defaultBukuExportFilename();

  if (!isTauri()) {
    triggerDownload(defaultName, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return { path: defaultName, count: items.length, bytes: bytes.length };
  }

  const picked = await saveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    title: 'Ekspor Buku ke Excel',
  });
  if (!picked) return null;

  const written = await invoke<number>('export_write_bytes', {
    destPath: picked,
    bytes: Array.from(bytes),
  });

  return { path: picked, count: items.length, bytes: written };
}
