/**
 * Registry jenjang perpustakaan & instrumen akreditasi Perpusnas.
 *
 * Single source of truth for the "Akreditasi" module: which SNP standard and
 * assessment instrument applies to a library jenjang, how the 6 components are
 * weighted, the pass bands, and the minimum requirements to register.
 *
 * Sources (2025 instrument set, effective 2 Jan 2026):
 * - SNP Sekolah/Madrasah: Peraturan Perpusnas No. 4 Tahun 2024
 * - SNP Perguruan Tinggi: Peraturan Perpusnas No. 5 Tahun 2024
 * - SNP Umum/Khusus: Peraturan Perpusnas No. 6 & 7 Tahun 2022
 * - Instrumen: Keputusan Kepala Perpusnas (see `keputusanRef` per entry)
 * - JDIH: https://jdih.perpusnas.go.id
 *
 * NOTE: per-component butir/bobot is only *verified* for SD/MI (8/7/13/5/4/4
 * and 15/10/35/15/15/10). Other entries carry a provisional equal-weight split
 * until the JDIH PDFs are extracted; see `komponenVerified`.
 */

export type JenjangGroup = 'sekolah' | 'pt' | 'umum' | 'khusus';

export type KomponenKey =
  | 'koleksi'
  | 'sarpras'
  | 'pelayanan'
  | 'tenaga'
  | 'penyelenggaraan'
  | 'pengelolaan';

export interface KomponenDef {
  key: KomponenKey;
  butir: number;
  /** Component weight (percent, 6 components sum to 100). */
  bobot: number;
}

export interface JenjangPredikat {
  /** Percentage bands. A/B/C are inclusive ranges; below `C[0]` = tidak terakreditasi. */
  A: [number, number];
  B: [number, number];
  C: [number, number];
}

export interface JenjangSyarat {
  /** Minimum number of titles required to register. */
  minJudul: number;
  butuhNpp: boolean;
  butuhSk: boolean;
}

export interface JenjangDef {
  id: string;
  label: string;
  group: JenjangGroup;
  /** SNP standard reference. */
  standarRef: string;
  standarUrl?: string;
  /** Assessment instrument (Keputusan Kepala Perpusnas). */
  keputusanRef: string;
  keputusanUrl?: string;
  komponen: KomponenDef[];
  jumlahButir: number;
  /** Raw max score (= jumlahButir x 4; each butir is scored a-d = 4..1). */
  skorMaks: number;
  predikat: JenjangPredikat;
  syaratDaftar: JenjangSyarat;
  /** false => komponen butir/bobot is provisional (equal split). */
  komponenVerified: boolean;
}

export const KOMPONEN_ORDER: KomponenKey[] = [
  'koleksi',
  'sarpras',
  'pelayanan',
  'tenaga',
  'penyelenggaraan',
  'pengelolaan',
];

/** Verified SD/MI component split — the reference profile. */
const SD_KOMPONEN: KomponenDef[] = [
  { key: 'koleksi', butir: 8, bobot: 15 },
  { key: 'sarpras', butir: 7, bobot: 10 },
  { key: 'pelayanan', butir: 13, bobot: 35 },
  { key: 'tenaga', butir: 5, bobot: 15 },
  { key: 'penyelenggaraan', butir: 4, bobot: 15 },
  { key: 'pengelolaan', butir: 4, bobot: 10 },
];

/** Provisional equal-weight split used when only the total butir count is known. */
function provisionalKomponen(jumlahButir: number): KomponenDef[] {
  const n = KOMPONEN_ORDER.length;
  const baseButir = Math.floor(jumlahButir / n);
  let butirRemainder = jumlahButir - baseButir * n;
  const baseBobot = Math.floor(100 / n);
  let bobotRemainder = 100 - baseBobot * n;
  return KOMPONEN_ORDER.map((key) => {
    const butir = baseButir + (butirRemainder > 0 ? 1 : 0);
    const bobot = baseBobot + (bobotRemainder > 0 ? 1 : 0);
    if (butirRemainder > 0) butirRemainder -= 1;
    if (bobotRemainder > 0) bobotRemainder -= 1;
    return { key, butir, bobot };
  });
}

const PREDIKAT_DEFAULT: JenjangPredikat = {
  A: [91, 100],
  B: [76, 90.99],
  C: [60, 75.99],
};

const SYARAT_DEFAULT: JenjangSyarat = {
  minJudul: 1000,
  butuhNpp: true,
  butuhSk: true,
};

const SNP_SEKOLAH = 'Perpusnas No. 4 Tahun 2024';
const SNP_PT = 'Perpusnas No. 5 Tahun 2024';
const SNP_UMUM = 'Perpusnas No. 6 Tahun 2022';
const SNP_KHUSUS = 'Perpusnas No. 7 Tahun 2022';

const jdih = (id: string) => `https://jdih.perpusnas.go.id/detail/${id}`;

interface RawJenjang {
  id: string;
  label: string;
  group: JenjangGroup;
  standarRef: string;
  keputusanRef: string;
  keputusanId?: string;
  jumlahButir: number;
  komponen?: KomponenDef[];
}

const RAW: RawJenjang[] = [
  // --- Sekolah / Madrasah -------------------------------------------------
  { id: 'PAUD', label: 'PAUD/TK/RA', group: 'sekolah', standarRef: SNP_SEKOLAH, keputusanRef: 'Keputusan Kepala Perpusnas No. 160 Tahun 2025', keputusanId: '1159', jumlahButir: 32 },
  { id: 'SD', label: 'SD/MI', group: 'sekolah', standarRef: SNP_SEKOLAH, keputusanRef: 'Keputusan Kepala Perpusnas No. 157 Tahun 2025', keputusanId: '1156', jumlahButir: 41, komponen: SD_KOMPONEN },
  { id: 'SMP', label: 'SMP/MTs', group: 'sekolah', standarRef: SNP_SEKOLAH, keputusanRef: 'Keputusan Kepala Perpusnas No. 158 Tahun 2025', keputusanId: '1157', jumlahButir: 41 },
  { id: 'SMA', label: 'SMA/SMK/MA/MAK', group: 'sekolah', standarRef: SNP_SEKOLAH, keputusanRef: 'Keputusan Kepala Perpusnas No. 159 Tahun 2025', keputusanId: '1158', jumlahButir: 42 },
  { id: 'SLB', label: 'SLB', group: 'sekolah', standarRef: SNP_SEKOLAH, keputusanRef: 'Keputusan Kepala Perpusnas No. 161 Tahun 2025', keputusanId: '1160', jumlahButir: 36 },
  // --- Perguruan Tinggi ---------------------------------------------------
  { id: 'PT_UNIV', label: 'Universitas', group: 'pt', standarRef: SNP_PT, keputusanRef: 'Keputusan Kepala Perpusnas No. 196 Tahun 2025', keputusanId: '1173', jumlahButir: 56 },
  { id: 'PT_IST', label: 'Institut/Sekolah Tinggi/Politeknik', group: 'pt', standarRef: SNP_PT, keputusanRef: 'Keputusan Kepala Perpusnas No. 197 Tahun 2025', keputusanId: '1170', jumlahButir: 56 },
  { id: 'PT_AKA', label: 'Akademi & Akademi Komunitas', group: 'pt', standarRef: SNP_PT, keputusanRef: 'Keputusan Kepala Perpusnas No. 198 Tahun 2025', keputusanId: '1174', jumlahButir: 56 },
  // --- Umum ---------------------------------------------------------------
  { id: 'UMUM_PROV', label: 'Perpustakaan Umum Provinsi', group: 'umum', standarRef: SNP_UMUM, keputusanRef: 'Keputusan Kepala Perpusnas No. 186 Tahun 2025', jumlahButir: 43 },
  { id: 'UMUM_KAB', label: 'Perpustakaan Umum Kab/Kota', group: 'umum', standarRef: SNP_UMUM, keputusanRef: 'Keputusan Kepala Perpusnas No. 187 Tahun 2025', jumlahButir: 43 },
  { id: 'UMUM_KEC', label: 'Perpustakaan Umum Kecamatan', group: 'umum', standarRef: SNP_UMUM, keputusanRef: 'Keputusan Kepala Perpusnas No. 188 Tahun 2025', jumlahButir: 31 },
  { id: 'UMUM_DESA', label: 'Perpustakaan Desa/Kelurahan', group: 'umum', standarRef: SNP_UMUM, keputusanRef: 'Keputusan Kepala Perpusnas No. 189 Tahun 2025', jumlahButir: 31 },
  // --- Khusus -------------------------------------------------------------
  { id: 'KHUSUS_PEM', label: 'Perpustakaan Khusus Lembaga Pemerintah', group: 'khusus', standarRef: SNP_KHUSUS, keputusanRef: 'Keputusan Kepala Perpusnas No. 181 Tahun 2025', jumlahButir: 34 },
  { id: 'KHUSUS_NON', label: 'Perpustakaan Khusus Lembaga Nonpemerintah', group: 'khusus', standarRef: SNP_KHUSUS, keputusanRef: 'Keputusan Kepala Perpusnas No. 182 Tahun 2025', jumlahButir: 34 },
  { id: 'KHUSUS_IBADAH', label: 'Perpustakaan Khusus Rumah Ibadah', group: 'khusus', standarRef: SNP_KHUSUS, keputusanRef: 'Keputusan Kepala Perpusnas No. 183 Tahun 2025', jumlahButir: 34 },
];

export const JENJANG_LIST: JenjangDef[] = RAW.map((raw) => ({
  id: raw.id,
  label: raw.label,
  group: raw.group,
  standarRef: raw.standarRef,
  standarUrl: jdih(raw.keputusanId ?? ''),
  keputusanRef: raw.keputusanRef,
  keputusanUrl: raw.keputusanId ? jdih(raw.keputusanId) : undefined,
  komponen: raw.komponen ?? provisionalKomponen(raw.jumlahButir),
  jumlahButir: raw.jumlahButir,
  skorMaks: raw.jumlahButir * 4,
  predikat: PREDIKAT_DEFAULT,
  syaratDaftar: SYARAT_DEFAULT,
  komponenVerified: raw.komponen != null,
}));

/** Default jenjang when nothing is configured yet. */
export const JENJANG_DEFAULT = 'SMP';

export function getJenjang(id: string | null | undefined): JenjangDef | null {
  if (!id) return null;
  return JENJANG_LIST.find((j) => j.id === id) ?? null;
}

export function jenjangByGroup(group: JenjangGroup): JenjangDef[] {
  return JENJANG_LIST.filter((j) => j.group === group);
}

/** Map a score percentage to its predikat label. */
export function predikatFromScore(
  persen: number,
  predikat: JenjangPredikat = PREDIKAT_DEFAULT,
): 'A' | 'B' | 'C' | 'TidakTerakreditasi' {
  if (persen >= predikat.A[0]) return 'A';
  if (persen >= predikat.B[0]) return 'B';
  if (persen >= predikat.C[0]) return 'C';
  return 'TidakTerakreditasi';
}
