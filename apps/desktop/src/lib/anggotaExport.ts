import { utils, write } from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

import { isTauri } from '@/lib/auth';
import { anggotaApi, type Anggota, type AnggotaListArgs } from '@/lib/anggota';

export interface AnggotaExportRow {
  kode_anggota: string;
  nama: string;
  jenis_kelamin: string;
  kelas: string;
  jurusan: string;
  agama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  no_telp: string;
  email: string;
  alamat: string;
  tanggal_daftar: string;
  aktif: string;
  catatan: string;
}

const HEADERS: Array<{ key: keyof AnggotaExportRow; label: string }> = [
  { key: 'kode_anggota', label: 'Kode Anggota' },
  { key: 'nama', label: 'Nama' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'jurusan', label: 'Jurusan' },
  { key: 'agama', label: 'Agama' },
  { key: 'tempat_lahir', label: 'Tempat Lahir' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
  { key: 'no_telp', label: 'No. Telepon' },
  { key: 'email', label: 'Email' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'tanggal_daftar', label: 'Tanggal Daftar' },
  { key: 'aktif', label: 'Status Aktif' },
  { key: 'catatan', label: 'Catatan' },
];

export function toExportRow(a: Anggota): AnggotaExportRow {
  return {
    kode_anggota: a.kodeAnggota,
    nama: a.nama,
    jenis_kelamin: a.jenisKelamin ?? '',
    kelas: a.kelas ?? '',
    jurusan: a.jurusan ?? '',
    agama: a.agama ?? '',
    tempat_lahir: a.tempatLahir ?? '',
    tanggal_lahir: a.tanggalLahir ?? '',
    no_telp: a.noTelp ?? '',
    email: a.email ?? '',
    alamat: a.alamat ?? '',
    tanggal_daftar: a.tanggalDaftar,
    aktif: a.aktif ? 'Aktif' : 'Nonaktif',
    catatan: a.catatan ?? '',
  };
}

/** Build an XLSX workbook (in-memory) for the supplied anggota rows. */
export function buildAnggotaWorkbookBytes(items: Anggota[]): Uint8Array {
  const rows = items.map(toExportRow);
  const labels = HEADERS.map((h) => h.label);
  const aoa: (string | number)[][] = [labels];
  for (const row of rows) {
    aoa.push(HEADERS.map((h) => row[h.key]));
  }
  const sheet = utils.aoa_to_sheet(aoa);
  // Reasonable default widths — keeps the output legible without forcing the
  // user to auto-fit.
  sheet['!cols'] = HEADERS.map((h) => ({
    wch: Math.max(h.label.length + 2, 14),
  }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'Anggota');
  const out = write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function defaultExportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear().toString().padStart(4, '0');
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const mi = now.getMinutes().toString().padStart(2, '0');
  return `anggota-${yyyy}${mm}${dd}-${hh}${mi}.xlsx`;
}

/** Fetches every anggota matching the supplied filters, paginating to avoid
 *  hitting backend limits on a single call. */
export async function fetchAllAnggota(
  filters: Omit<AnggotaListArgs, 'limit' | 'offset'>,
): Promise<Anggota[]> {
  const PAGE = 500;
  const out: Anggota[] = [];
  let offset = 0;
  // Hard upper bound to keep the loop bounded even if backend mis-reports total.
  const HARD_CAP = 100_000;
  while (offset < HARD_CAP) {
    const page = await anggotaApi.list({ ...filters, limit: PAGE, offset });
    out.push(...page.items);
    if (page.items.length < PAGE) break;
    offset += page.items.length;
  }
  return out;
}

export interface ExportResult {
  path: string;
  count: number;
  bytes: number;
}

/**
 * Picks a save destination via Tauri save dialog, builds the workbook, writes
 * via the `export_write_bytes` Rust command. Returns null when the user
 * cancels the dialog.
 */
export async function runAnggotaExport(
  filters: Omit<AnggotaListArgs, 'limit' | 'offset'>,
): Promise<ExportResult | null> {
  const items = await fetchAllAnggota(filters);
  const bytes = buildAnggotaWorkbookBytes(items);

  const defaultName = defaultExportFilename();
  let target: string;
  if (isTauri()) {
    const picked = await saveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      title: 'Ekspor Anggota ke Excel',
    });
    if (!picked) return null;
    target = picked;
  } else {
    // Browser-mode fallback — used by Vitest. Just return a synthetic path.
    target = `/tmp/${defaultName}`;
  }

  const written = await invoke<number>('export_write_bytes', {
    destPath: target,
    bytes: Array.from(bytes),
  });

  return { path: target, count: items.length, bytes: written };
}
