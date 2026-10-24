/**
 * Akreditasi module data: the mandatory/supporting physical evidence (bukti
 * fisik) checklist that applies to a library accreditation submission.
 *
 * Legal/administrative documents referenced by the Perpusnas accreditation
 * instruments. `wajib` marks items that are effectively required; the rest add
 * value. Kept in code (not i18n) so both desktop and future mobile can share it;
 * labels are Indonesian as they appear in the instrument.
 */

export interface BuktiDef {
  kode: string;
  label: string;
  /** Required vs supporting evidence. */
  wajib: boolean;
}

export const BUKTI_WAJIB: BuktiDef[] = [
  { kode: 'sk_pendirian', label: 'SK Pendirian Perpustakaan/Sekolah', wajib: true },
  { kode: 'npp', label: 'Nomor Pokok Perpustakaan (NPP)', wajib: true },
  { kode: 'kebijakan_koleksi', label: 'Kebijakan Pengembangan Koleksi', wajib: true },
  { kode: 'pos_pengembangan', label: 'POS Pengembangan Koleksi', wajib: true },
  { kode: 'pos_pengorganisasian', label: 'POS Pengorganisasian', wajib: true },
  { kode: 'pos_pelayanan', label: 'POS Pelayanan', wajib: true },
  { kode: 'struktur_organisasi', label: 'Struktur Organisasi & Uraian Tugas', wajib: false },
  { kode: 'laporan_tahunan', label: 'Laporan Tahunan Perpustakaan', wajib: true },
  { kode: 'laporan_semester', label: 'Laporan Semester', wajib: false },
  { kode: 'laporan_bulanan', label: 'Laporan Bulanan', wajib: false },
  { kode: 'laporan_kegiatan', label: 'Laporan Kegiatan / Literasi + Foto', wajib: false },
  { kode: 'anggaran', label: 'Bukti Anggaran / RKAS', wajib: false },
];

export function getBuktiDef(kode: string): BuktiDef | null {
  return BUKTI_WAJIB.find((b) => b.kode === kode) ?? null;
}
