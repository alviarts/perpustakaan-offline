import { isTauri } from '@/lib/auth';

export interface KunjunganRow {
  id: number;
  anggotaId?: number | null;
  anggotaNama?: string | null;
  anggotaKode?: string | null;
  anggotaKelas?: string | null;
  tanggal: string;
  jam: string;
  keperluan?: string | null;
  sumber: 'manual' | 'peminjaman' | 'pengembalian' | 'kelas';
  jumlahOrang: number;
  kelas?: string | null;
  catatan?: string | null;
  createdAt: string;
}

export interface KunjunganListArgs {
  query?: string;
  from?: string;
  to?: string;
  sumber?: string;
  limit?: number;
  offset?: number;
}

export interface KunjunganListResult {
  items: KunjunganRow[];
  total: number;
}

export interface KunjunganCreateInput {
  anggotaId?: number | null;
  keperluan?: string | null;
  sumber?: 'manual' | 'peminjaman' | 'pengembalian' | 'kelas';
  jumlahOrang?: number | null;
  kelas?: string | null;
  catatan?: string | null;
}

export interface KunjunganQuickStats {
  hariIni: number;
  mingguIni: number;
  bulanIni: number;
  total: number;
}

interface KunjunganRpc {
  list(args: KunjunganListArgs): Promise<KunjunganListResult>;
  create(input: KunjunganCreateInput): Promise<KunjunganRow>;
  quickStats(): Promise<KunjunganQuickStats>;
  remove(id: number): Promise<void>;
}

// ----------------------------------------------------------------------------
// Mock store (browser dev mode)
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'po:kunjungan-mock';

interface MockState {
  rows: KunjunganRow[];
  seq: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function timeNow(): string {
  return new Date().toTimeString().slice(0, 8);
}

function readMock(): MockState {
  if (typeof window === 'undefined') return { rows: [], seq: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed: MockState = { rows: [], seq: 0 };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as MockState;
  } catch {
    return { rows: [], seq: 0 };
  }
}

function writeMock(state: MockState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.floor((da - db) / (1000 * 60 * 60 * 24));
}

const tauriRpc: KunjunganRpc = {
  async list(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<KunjunganListResult>('kunjungan_list', { args });
  },
  async create(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<KunjunganRow>('kunjungan_create', { input });
  },
  async quickStats() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<KunjunganQuickStats>('kunjungan_quick_stats');
  },
  async remove(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('kunjungan_delete', { id });
  },
};

const mockRpc: KunjunganRpc = {
  async list(args) {
    const state = readMock();
    let filtered = state.rows;
    const q = args.query?.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (r) =>
          (r.anggotaNama ?? '').toLowerCase().includes(q) ||
          (r.anggotaKode ?? '').toLowerCase().includes(q) ||
          (r.keperluan ?? '').toLowerCase().includes(q),
      );
    }
    if (args.from) filtered = filtered.filter((r) => r.tanggal >= args.from!);
    if (args.to) filtered = filtered.filter((r) => r.tanggal <= args.to!);
    if (args.sumber && args.sumber !== 'all') {
      filtered = filtered.filter((r) => r.sumber === args.sumber);
    }
    const total = filtered.length;
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    const items = filtered
      .slice()
      .sort((a, b) => `${b.tanggal} ${b.jam}`.localeCompare(`${a.tanggal} ${a.jam}`))
      .slice(offset, offset + limit);
    return { items, total };
  },
  async create(input) {
    const state = readMock();
    const id = ++state.seq;
    const row: KunjunganRow = {
      id,
      anggotaId: input.anggotaId ?? null,
      anggotaNama: input.anggotaId ? `Anggota ${input.anggotaId}` : null,
      anggotaKode: input.anggotaId ? `A${String(input.anggotaId).padStart(4, '0')}` : null,
      anggotaKelas: null,
      tanggal: todayIso(),
      jam: timeNow(),
      keperluan: input.keperluan ?? null,
      sumber: input.sumber ?? 'manual',
      jumlahOrang: input.jumlahOrang ?? 1,
      kelas: input.kelas ?? null,
      catatan: input.catatan ?? null,
      createdAt: nowIso(),
    };
    state.rows.unshift(row);
    writeMock(state);
    return row;
  },
  async quickStats() {
    const state = readMock();
    const today = todayIso();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const weekStart = start.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    const sum = (rows: KunjunganRow[]) => rows.reduce((acc, r) => acc + r.jumlahOrang, 0);
    return {
      hariIni: sum(state.rows.filter((r) => r.tanggal === today)),
      mingguIni: sum(state.rows.filter((r) => r.tanggal >= weekStart && r.tanggal <= today)),
      bulanIni: sum(state.rows.filter((r) => r.tanggal >= monthStart && r.tanggal <= today)),
      total: sum(state.rows),
    };
  },
  async remove(id) {
    const state = readMock();
    state.rows = state.rows.filter((r) => r.id !== id);
    writeMock(state);
  },
};

export const kunjunganApi: KunjunganRpc = isTauri() ? tauriRpc : mockRpc;

export function rangeForPreset(
  preset: 'today' | 'week' | 'month' | 'year',
): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'month': {
      const d = new Date(now);
      d.setDate(1);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case 'year': {
      const d = new Date(now);
      d.setMonth(0, 1);
      return { from: d.toISOString().slice(0, 10), to };
    }
  }
}

// Reuse for pure unit testing — same logic the backend uses.
export { dayDiff as kunjunganDayDiff };
