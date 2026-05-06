/**
 * Frontend bindings for FEAT-21 (Surat Keterangan Bebas Pustaka).
 *
 * The backend is the source of truth for eligibility + nomor allocation. This
 * file is a thin RPC wrapper plus a browser-mock for `pnpm dev` outside Tauri.
 */
import { isTauri } from '@/lib/auth';

export interface SuratEligibility {
  eligible: boolean;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  anggotaAktif: boolean;
  activeLoans: number;
  outstandingDenda: number;
  reasons: string[];
}

export interface SuratGenerateResult {
  logId: number;
  nomorSurat: string;
  tanggalCetak: string;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  anggotaKelas?: string | null;
  templateHtml: string;
  kepalaSekolahNama: string;
  kepalaSekolahNip: string;
  kepalaSekolahTtdPath: string;
  nomorTerakhir: number;
  formatNomor: string;
}

export interface SuratLogRow {
  id: number;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  nomorSurat: string;
  tanggalCetak: string;
  petugasId?: number | null;
  petugasUsername?: string | null;
}

export interface SuratLogQuery {
  anggotaId?: number;
  limit?: number;
}

export interface SuratRpc {
  checkEligibility(anggotaId: number): Promise<SuratEligibility>;
  generate(anggotaId: number): Promise<SuratGenerateResult>;
  logList(query?: SuratLogQuery): Promise<SuratLogRow[]>;
}

const tauriRpc: SuratRpc = {
  async checkEligibility(anggotaId) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SuratEligibility>('surat_check_eligibility', { anggotaId });
  },
  async generate(anggotaId) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SuratGenerateResult>('surat_generate', { anggotaId });
  },
  async logList(query) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SuratLogRow[]>('surat_log_list', { query });
  },
};

interface MockState {
  log: SuratLogRow[];
  nextNomor: number;
}

const STORAGE_KEY = 'mock.surat';

function readMock(): MockState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { log: [], nextNomor: 1 };
    return JSON.parse(raw) as MockState;
  } catch {
    return { log: [], nextNomor: 1 };
  }
}

function writeMock(state: MockState): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* SSR / locked storage */
  }
}

const mockRpc: SuratRpc = {
  async checkEligibility(anggotaId) {
    return {
      eligible: true,
      anggotaId,
      anggotaNama: `Anggota #${anggotaId}`,
      anggotaKode: `A${String(anggotaId).padStart(4, '0')}`,
      anggotaAktif: true,
      activeLoans: 0,
      outstandingDenda: 0,
      reasons: [],
    };
  },
  async generate(anggotaId) {
    const state = readMock();
    const seq = state.nextNomor;
    const today = new Date().toISOString().slice(0, 10);
    const [yyyy, mm] = today.split('-');
    const nomorSurat = `${yyyy}/${mm}/SBP-${String(seq).padStart(4, '0')}`;
    const row: SuratLogRow = {
      id: state.log.length + 1,
      anggotaId,
      anggotaNama: `Anggota #${anggotaId}`,
      anggotaKode: `A${String(anggotaId).padStart(4, '0')}`,
      nomorSurat,
      tanggalCetak: today,
      petugasId: null,
      petugasUsername: null,
    };
    writeMock({ log: [...state.log, row], nextNomor: seq + 1 });
    return {
      logId: row.id,
      nomorSurat,
      tanggalCetak: today,
      anggotaId,
      anggotaNama: row.anggotaNama,
      anggotaKode: row.anggotaKode,
      anggotaKelas: null,
      templateHtml:
        'Template browser-mock. Lihat versi Tauri untuk tampilan asli.\n\nNama: {nama}\nNo. Anggota: {kode_anggota}\nTanggal: {tanggal}',
      kepalaSekolahNama: '',
      kepalaSekolahNip: '',
      kepalaSekolahTtdPath: '',
      nomorTerakhir: seq,
      formatNomor: '{tahun}/{bulan}/SBP-{nomor:04d}',
    };
  },
  async logList(query) {
    const state = readMock();
    const filtered = query?.anggotaId
      ? state.log.filter((r) => r.anggotaId === query.anggotaId)
      : state.log;
    const limit = query?.limit ?? 200;
    return [...filtered].reverse().slice(0, limit);
  },
};

export const suratApi: SuratRpc = isTauri() ? tauriRpc : mockRpc;

/**
 * Render a `format_nomor` template. Mirrors the Rust implementation —
 * the frontend uses this only to preview the *next* nomor in Settings.
 */
export function previewNomor(
  format: string,
  tahun: number,
  bulan: number,
  nomor: number,
): string {
  const yyyy = String(tahun).padStart(4, '0');
  const mm = String(bulan).padStart(2, '0');
  let out = format.replace(/\{tahun\}/g, yyyy).replace(/\{bulan\}/g, mm);
  out = out.replace(/\{nomor:(\d+)d\}/g, (_m, w) =>
    String(nomor).padStart(Number(w), '0'),
  );
  out = out.replace(/\{nomor\}/g, String(nomor));
  return out;
}

/**
 * Substitute placeholders in the surat template with the per-cetak data
 * returned from the backend. Used by `lib/suratPdf.ts` during PDF render.
 */
export function fillSuratTemplate(
  template: string,
  data: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(data)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}
