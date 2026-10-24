import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';
import { JENJANG_DEFAULT } from '@perpustakaan/shared';

export interface AkreditasiProfil {
  jenjang: string;
  npp: string;
  skPendirian: string;
  /** 1..=12 — bulan mulai tahun ajaran (default Juli). */
  tahunAjaranAwal: number;
  catatan: string;
}

export interface AkreditasiRpc {
  profilGet: () => Promise<AkreditasiProfil>;
  profilSet: (payload: AkreditasiProfil) => Promise<AkreditasiProfil>;
  manualGet: () => Promise<AkreditasiManual>;
  manualSet: (payload: AkreditasiManual) => Promise<AkreditasiManual>;
  buktiList: () => Promise<AkreditasiBuktiRow[]>;
  buktiSet: (kode: string, ada: boolean, catatan?: string, filePath?: string) => Promise<AkreditasiBuktiRow>;
  buktiUpload: (srcPath: string) => Promise<BuktiUploadResult>;
  buktiOpen: (relPath: string) => Promise<void>;
  butirList: (jenjang: string) => Promise<ButirJawaban[]>;
  butirSet: (
    jenjang: string,
    komponen: number,
    butir: number,
    jawaban: string,
    catatan?: string,
  ) => Promise<ButirJawaban>;
  butirReset: (jenjang: string) => Promise<void>;
  arsipSave: (input: ArsipInput) => Promise<ArsipRow>;
  arsipList: () => Promise<ArsipRow[]>;
  arsipDelete: (id: number) => Promise<void>;
}

export interface AkreditasiManual {
  tenagaPustakawan: number;
  tenagaKualifikasi: number;
  jumlahGuru: number;
  jumlahTendik: number;
  luasRuang: number;
  jumlahKomputer: number;
  /** Anggaran 3 tahun terakhir (index 0 = tahun lalu). */
  anggaranSekolah: [number, number, number];
  anggaranPerpus: [number, number, number];
  catatan: string;
}

export interface AkreditasiBuktiRow {
  kode: string;
  ada: boolean;
  catatan: string;
  filePath: string;
}

export interface BuktiUploadResult {
  relPath: string;
}

export interface ArsipInput {
  jenis: string;
  jenjang?: string | null;
  periode?: string | null;
  nilai?: number | null;
  predikat?: string | null;
  kontenJson: string;
  penandatangan?: string | null;
  jabatan?: string | null;
}

export interface ArsipRow {
  id: number;
  jenis: string;
  jenjang: string | null;
  periode: string | null;
  nilai: number | null;
  predikat: string | null;
  kontenJson: string;
  penandatangan: string | null;
  jabatan: string | null;
  createdAt: string;
}

export interface ButirJawaban {
  komponen: number;
  butir: number;
  /** '' | 'a' | 'b' | 'c' | 'd' */
  jawaban: string;
  catatan: string;
}

export const DEFAULT_AKREDITASI_MANUAL: AkreditasiManual = {
  tenagaPustakawan: 0,
  tenagaKualifikasi: 0,
  jumlahGuru: 0,
  jumlahTendik: 0,
  luasRuang: 0,
  jumlahKomputer: 0,
  anggaranSekolah: [0, 0, 0],
  anggaranPerpus: [0, 0, 0],
  catatan: '',
};

export const DEFAULT_AKREDITASI_PROFIL: AkreditasiProfil = {
  jenjang: JENJANG_DEFAULT,
  npp: '',
  skPendirian: '',
  tahunAjaranAwal: 7,
  catatan: '',
};

const tauriRpc: AkreditasiRpc = {
  profilGet: () => invoke<AkreditasiProfil>('akreditasi_profil_get'),
  profilSet: (payload) => invoke<AkreditasiProfil>('akreditasi_profil_set', { payload }),
  manualGet: () => invoke<AkreditasiManual>('akreditasi_manual_get'),
  manualSet: (payload) => invoke<AkreditasiManual>('akreditasi_manual_set', { payload }),
  buktiList: () => invoke<AkreditasiBuktiRow[]>('akreditasi_bukti_list'),
  buktiSet: (kode, ada, catatan, filePath) =>
    invoke<AkreditasiBuktiRow>('akreditasi_bukti_set', { kode, ada, catatan, filePath }),
  buktiUpload: async (srcPath) => {
    const r = await invoke<{ relPath: string }>('akreditasi_bukti_upload', { srcPath });
    return { relPath: r.relPath };
  },
  buktiOpen: (relPath) => invoke<void>('akreditasi_bukti_open', { relPath }),
  butirList: (jenjang) => invoke<ButirJawaban[]>('akreditasi_butir_list', { jenjang }),
  butirSet: (jenjang, komponen, butir, jawaban, catatan) =>
    invoke<ButirJawaban>('akreditasi_butir_set', { jenjang, komponen, butir, jawaban, catatan }),
  butirReset: (jenjang) => invoke<void>('akreditasi_butir_reset', { jenjang }),
  arsipSave: (input) => invoke<ArsipRow>('akreditasi_arsip_save', { input }),
  arsipList: () => invoke<ArsipRow[]>('akreditasi_arsip_list'),
  arsipDelete: (id) => invoke<void>('akreditasi_arsip_delete', { id }),
};

/** Open an OS file dialog (documents + images) and return the picked path. */
export async function pickBuktiFile(): Promise<string | null> {
  if (!isTauri()) return `mock-bukti-${Date.now()}.pdf`;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: 'Dokumen',
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'webp'],
      },
    ],
  });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}

let mockProfil: AkreditasiProfil = { ...DEFAULT_AKREDITASI_PROFIL };
let mockManual: AkreditasiManual = { ...DEFAULT_AKREDITASI_MANUAL };
const mockBukti = new Map<string, AkreditasiBuktiRow>();
const mockButir = new Map<string, ButirJawaban>();
const mockArsip: ArsipRow[] = [];

const butirKey = (jenjang: string, komponen: number, butir: number): string =>
  `${jenjang}:${komponen}:${butir}`;

const mockRpc: AkreditasiRpc = {
  async profilGet() {
    return { ...mockProfil };
  },
  async profilSet(payload) {
    mockProfil = { ...payload };
    return { ...mockProfil };
  },
  async manualGet() {
    return { ...mockManual, anggaranSekolah: [...mockManual.anggaranSekolah], anggaranPerpus: [...mockManual.anggaranPerpus] } as AkreditasiManual;
  },
  async manualSet(payload) {
    mockManual = { ...payload };
    return { ...mockManual };
  },
  async buktiList() {
    return Array.from(mockBukti.values());
  },
  async buktiSet(kode, ada, catatan, filePath) {
    const row: AkreditasiBuktiRow = { kode, ada, catatan: catatan ?? '', filePath: filePath ?? '' };
    mockBukti.set(kode, row);
    return row;
  },
  async buktiUpload(srcPath) {
    return { relPath: `uploads/akreditasi/mock-${Date.now()}-${srcPath.split(/[\\/]/).pop() ?? 'file'}` };
  },
  async buktiOpen() {
    /* noop in browser */
  },
  async butirList(jenjang) {
    return Array.from(mockButir.values()).filter((b) =>
      mockButir.has(butirKey(jenjang, b.komponen, b.butir)),
    );
  },
  async butirSet(jenjang, komponen, butir, jawaban, catatan) {
    const row: ButirJawaban = { komponen, butir, jawaban, catatan: catatan ?? '' };
    mockButir.set(butirKey(jenjang, komponen, butir), row);
    return row;
  },
  async butirReset(jenjang) {
    for (const key of Array.from(mockButir.keys())) {
      if (key.startsWith(`${jenjang}:`)) mockButir.delete(key);
    }
  },
  async arsipSave(input) {
    const row: ArsipRow = {
      id: mockArsip.length + 1,
      jenis: input.jenis,
      jenjang: input.jenjang ?? null,
      periode: input.periode ?? null,
      nilai: input.nilai ?? null,
      predikat: input.predikat ?? null,
      kontenJson: input.kontenJson,
      penandatangan: input.penandatangan ?? null,
      jabatan: input.jabatan ?? null,
      createdAt: new Date().toISOString(),
    };
    mockArsip.unshift(row);
    return row;
  },
  async arsipList() {
    return [...mockArsip];
  },
  async arsipDelete(id) {
    const i = mockArsip.findIndex((a) => a.id === id);
    if (i >= 0) mockArsip.splice(i, 1);
  },
};

export const akreditasiApi: AkreditasiRpc = isTauri() ? tauriRpc : mockRpc;

export type AcademicPreset = 'ganjil' | 'genap' | 'tahunAjaran';

const fmtDate = (d: Date): string =>
  `${d.getFullYear().toString().padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
const minDate = (a: Date, b: Date): Date => (a <= b ? a : b);

/**
 * Date range for the school year (tahun ajaran) starting at `awalBulan`
 * (1..=12, default Juli). `ganjil` = first 6 months, `genap` = second 6 months,
 * `tahunAjaran` = the whole year. Each range is capped at today so far-future
 * periods don't appear empty. Uses local date arithmetic (no TZ shift).
 */
export function academicRange(
  preset: AcademicPreset,
  awalBulan: number = 7,
  now: Date = new Date(),
): { from: string; to: string } {
  const m0 = Math.min(Math.max(Math.trunc(awalBulan), 1), 12) - 1;
  const startYear = now.getMonth() >= m0 ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(startYear, m0, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'ganjil') {
    const ganjilEnd = new Date(startYear, m0 + 6, 0);
    return { from: fmtDate(start), to: fmtDate(minDate(ganjilEnd, today)) };
  }
  if (preset === 'genap') {
    const genapStart = new Date(startYear, m0 + 6, 1);
    const yearEnd = new Date(startYear + 1, m0, 0);
    return { from: fmtDate(genapStart), to: fmtDate(minDate(yearEnd, today)) };
  }
  const yearEnd = new Date(startYear + 1, m0, 0);
  return { from: fmtDate(start), to: fmtDate(minDate(yearEnd, today)) };
}
