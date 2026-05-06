import { isTauri } from '@/lib/auth';

export type StocktakeSessionStatus = 'berlangsung' | 'selesai' | 'dibatalkan';

export type StocktakeItemStatus = 'belum_scan' | 'ditemukan' | 'tidak_ditemukan';

export interface StocktakeSessionRow {
  id: number;
  nama?: string | null;
  tanggalMulai: string;
  tanggalSelesai?: string | null;
  status: StocktakeSessionStatus;
  catatan?: string | null;
  petugasId?: number | null;
  petugasNama?: string | null;
  total: number;
  ditemukan: number;
  missing: number;
}

export interface StocktakeItemRow {
  id: number;
  sessionId: number;
  eksemplarId: number;
  eksemplarKode: string;
  bukuId: number;
  bukuJudul: string;
  bukuPengarang?: string | null;
  status: StocktakeItemStatus;
  eksemplarStatus: string;
  tanggalScan?: string | null;
  catatan?: string | null;
}

export interface StocktakeStartInput {
  nama?: string;
  catatan?: string;
  petugasId?: number;
}

export interface StocktakeListArgs {
  status?: StocktakeSessionStatus;
  limit?: number;
  offset?: number;
}

export interface StocktakeItemListArgs {
  sessionId: number;
  status?: StocktakeItemStatus;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface StocktakeScanInput {
  sessionId: number;
  kode: string;
}

export interface StocktakeScanResult {
  item: StocktakeItemRow;
  alreadyScanned: boolean;
  session: StocktakeSessionRow;
}

export interface StocktakeFinishInput {
  sessionId: number;
  status?: 'selesai' | 'dibatalkan';
  catatan?: string;
}

export interface StocktakeRpc {
  start(input: StocktakeStartInput): Promise<StocktakeSessionRow>;
  sessionList(args?: StocktakeListArgs): Promise<StocktakeSessionRow[]>;
  sessionGet(sessionId: number): Promise<StocktakeSessionRow>;
  itemList(args: StocktakeItemListArgs): Promise<StocktakeItemRow[]>;
  scan(input: StocktakeScanInput): Promise<StocktakeScanResult>;
  finish(input: StocktakeFinishInput): Promise<StocktakeSessionRow>;
  delete(sessionId: number): Promise<void>;
}

const tauriRpc: StocktakeRpc = {
  async start(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeSessionRow>('stocktake_start', { input });
  },
  async sessionList(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeSessionRow[]>('stocktake_session_list', { args });
  },
  async sessionGet(sessionId) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeSessionRow>('stocktake_session_get', { sessionId });
  },
  async itemList(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeItemRow[]>('stocktake_item_list', { args });
  },
  async scan(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeScanResult>('stocktake_scan', { input });
  },
  async finish(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<StocktakeSessionRow>('stocktake_finish', { input });
  },
  async delete(sessionId) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('stocktake_session_delete', { sessionId });
  },
};

// ----------------------------------------------------------------------------
// Browser-mode mock — backs to localStorage so `pnpm dev` outside Tauri still
// renders the page. The mock seeds a fixed eksemplar pool so manual testing
// works without a real DB. Mirrors the Rust state machine exactly so unit
// tests can run in node env.
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'stocktake.mock.v1';

interface MockEksemplar {
  id: number;
  kode: string;
  bukuId: number;
  bukuJudul: string;
  bukuPengarang?: string | null;
  status: string;
}

interface MockState {
  sessions: Array<{
    id: number;
    nama?: string | null;
    tanggalMulai: string;
    tanggalSelesai?: string | null;
    status: StocktakeSessionStatus;
    catatan?: string | null;
    petugasId?: number | null;
    petugasNama?: string | null;
  }>;
  items: Array<{
    id: number;
    sessionId: number;
    eksemplarId: number;
    status: StocktakeItemStatus;
    tanggalScan?: string | null;
    catatan?: string | null;
  }>;
  pool: MockEksemplar[];
  sessionSeq: number;
  itemSeq: number;
}

function defaultPool(): MockEksemplar[] {
  return [
    {
      id: 1,
      kode: 'B0001-01',
      bukuId: 1,
      bukuJudul: 'Laskar Pelangi',
      bukuPengarang: 'Andrea Hirata',
      status: 'tersedia',
    },
    {
      id: 2,
      kode: 'B0001-02',
      bukuId: 1,
      bukuJudul: 'Laskar Pelangi',
      bukuPengarang: 'Andrea Hirata',
      status: 'tersedia',
    },
    {
      id: 3,
      kode: 'B0002-01',
      bukuId: 2,
      bukuJudul: 'Bumi Manusia',
      bukuPengarang: 'Pramoedya Ananta Toer',
      status: 'tersedia',
    },
  ];
}

function readMock(): MockState {
  if (typeof window === 'undefined') {
    return { sessions: [], items: [], pool: defaultPool(), sessionSeq: 0, itemSeq: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sessions: [], items: [], pool: defaultPool(), sessionSeq: 0, itemSeq: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<MockState>;
    return {
      sessions: parsed.sessions ?? [],
      items: parsed.items ?? [],
      pool: parsed.pool ?? defaultPool(),
      sessionSeq: parsed.sessionSeq ?? 0,
      itemSeq: parsed.itemSeq ?? 0,
    };
  } catch {
    return { sessions: [], items: [], pool: defaultPool(), sessionSeq: 0, itemSeq: 0 };
  }
}

function writeMock(state: MockState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function counters(state: MockState, sessionId: number): {
  total: number;
  ditemukan: number;
  missing: number;
} {
  const items = state.items.filter((i) => i.sessionId === sessionId);
  const total = items.length;
  const ditemukan = items.filter((i) => i.status === 'ditemukan').length;
  return { total, ditemukan, missing: total - ditemukan };
}

function toRow(state: MockState, sessionId: number): StocktakeSessionRow {
  const s = state.sessions.find((row) => row.id === sessionId);
  if (!s) throw new Error(`session ${sessionId} not found`);
  return { ...s, ...counters(state, sessionId) };
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const mockRpc: StocktakeRpc = {
  async start(input) {
    const state = readMock();
    state.sessionSeq += 1;
    const id = state.sessionSeq;
    state.sessions.unshift({
      id,
      nama: input.nama?.trim() || null,
      tanggalMulai: nowIso(),
      tanggalSelesai: null,
      status: 'berlangsung',
      catatan: input.catatan?.trim() || null,
      petugasId: input.petugasId ?? null,
      petugasNama: null,
    });
    for (const e of state.pool) {
      state.itemSeq += 1;
      state.items.push({
        id: state.itemSeq,
        sessionId: id,
        eksemplarId: e.id,
        status: 'belum_scan',
        tanggalScan: null,
        catatan: null,
      });
    }
    writeMock(state);
    return toRow(state, id);
  },
  async sessionList(args) {
    const state = readMock();
    let rows = [...state.sessions];
    if (args?.status) rows = rows.filter((s) => s.status === args.status);
    rows.sort((a, b) => b.id - a.id);
    const limit = Math.max(1, Math.min(args?.limit ?? 100, 500));
    const offset = Math.max(0, args?.offset ?? 0);
    return rows.slice(offset, offset + limit).map((s) => ({
      ...s,
      ...counters(state, s.id),
    }));
  },
  async sessionGet(sessionId) {
    const state = readMock();
    return toRow(state, sessionId);
  },
  async itemList(args) {
    const state = readMock();
    const items = state.items.filter((i) => i.sessionId === args.sessionId);
    const rows: StocktakeItemRow[] = items.map((i) => {
      const e = state.pool.find((p) => p.id === i.eksemplarId);
      return {
        id: i.id,
        sessionId: i.sessionId,
        eksemplarId: i.eksemplarId,
        eksemplarKode: e?.kode ?? `EKS-${i.eksemplarId}`,
        bukuId: e?.bukuId ?? 0,
        bukuJudul: e?.bukuJudul ?? '(buku tidak ditemukan)',
        bukuPengarang: e?.bukuPengarang,
        status: i.status,
        eksemplarStatus: e?.status ?? 'tersedia',
        tanggalScan: i.tanggalScan,
        catatan: i.catatan,
      };
    });
    let filtered = rows;
    if (args.status) filtered = filtered.filter((r) => r.status === args.status);
    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.eksemplarKode.toLowerCase().includes(q) || r.bukuJudul.toLowerCase().includes(q),
      );
    }
    filtered.sort((a, b) => {
      const aScanned = a.status === 'ditemukan' ? 1 : 0;
      const bScanned = b.status === 'ditemukan' ? 1 : 0;
      if (aScanned !== bScanned) return aScanned - bScanned;
      const judulCompare = a.bukuJudul.localeCompare(b.bukuJudul);
      if (judulCompare !== 0) return judulCompare;
      return a.eksemplarKode.localeCompare(b.eksemplarKode);
    });
    const limit = Math.max(1, Math.min(args.limit ?? 500, 5000));
    const offset = Math.max(0, args.offset ?? 0);
    return filtered.slice(offset, offset + limit);
  },
  async scan(input) {
    const state = readMock();
    const session = state.sessions.find((s) => s.id === input.sessionId);
    if (!session) throw new Error(`session ${input.sessionId} not found`);
    if (session.status !== 'berlangsung') {
      throw new Error(`sesi stocktake sudah ${session.status}, tidak bisa scan lagi`);
    }
    const kode = input.kode.trim();
    if (!kode) throw new Error('kode eksemplar tidak boleh kosong');
    const e = state.pool.find((p) => p.kode === kode);
    if (!e) throw new Error(`eksemplar dengan kode '${kode}' tidak ditemukan`);
    let item = state.items.find(
      (i) => i.sessionId === input.sessionId && i.eksemplarId === e.id,
    );
    const alreadyScanned = item?.status === 'ditemukan';
    if (!item) {
      state.itemSeq += 1;
      item = {
        id: state.itemSeq,
        sessionId: input.sessionId,
        eksemplarId: e.id,
        status: 'ditemukan',
        tanggalScan: nowIso(),
        catatan: null,
      };
      state.items.push(item);
    } else {
      item.status = 'ditemukan';
      if (!item.tanggalScan) item.tanggalScan = nowIso();
    }
    writeMock(state);
    const itemRow: StocktakeItemRow = {
      id: item.id,
      sessionId: item.sessionId,
      eksemplarId: item.eksemplarId,
      eksemplarKode: e.kode,
      bukuId: e.bukuId,
      bukuJudul: e.bukuJudul,
      bukuPengarang: e.bukuPengarang,
      status: item.status,
      eksemplarStatus: e.status,
      tanggalScan: item.tanggalScan,
      catatan: item.catatan,
    };
    return { item: itemRow, alreadyScanned, session: toRow(state, input.sessionId) };
  },
  async finish(input) {
    const state = readMock();
    const session = state.sessions.find((s) => s.id === input.sessionId);
    if (!session) throw new Error(`session ${input.sessionId} not found`);
    if (session.status !== 'berlangsung') {
      throw new Error(
        `sesi stocktake sudah ${session.status}, tidak bisa difinalisasi lagi`,
      );
    }
    const status = input.status ?? 'selesai';
    if (status !== 'selesai' && status !== 'dibatalkan') {
      throw new Error(`status finish '${status}' tidak valid (selesai|dibatalkan)`);
    }
    session.status = status;
    session.tanggalSelesai = nowIso();
    if (input.catatan !== undefined) session.catatan = input.catatan;
    if (status === 'selesai') {
      for (const i of state.items) {
        if (i.sessionId === input.sessionId && i.status === 'belum_scan') {
          i.status = 'tidak_ditemukan';
        }
      }
    }
    writeMock(state);
    return toRow(state, input.sessionId);
  },
  async delete(sessionId) {
    const state = readMock();
    state.sessions = state.sessions.filter((s) => s.id !== sessionId);
    state.items = state.items.filter((i) => i.sessionId !== sessionId);
    writeMock(state);
  },
};

export const stocktakeApi: StocktakeRpc = isTauri() ? tauriRpc : mockRpc;

// Pure helpers exported for tests + UI.

export function progressPercent(session: Pick<StocktakeSessionRow, 'total' | 'ditemukan'>): number {
  if (session.total <= 0) return 0;
  return Math.round((session.ditemukan / session.total) * 100);
}

export function formatStatus(status: StocktakeSessionStatus): string {
  return status;
}

export function isTerminal(status: StocktakeSessionStatus): boolean {
  return status === 'selesai' || status === 'dibatalkan';
}
