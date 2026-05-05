import { isTauri } from '@/lib/auth';

/**
 * FEAT-18: book reservation queue.
 *
 * Mirrors the Rust types in
 * `apps/desktop/src-tauri/src/commands/reservasi.rs`. Field names use the
 * same camelCase as the backend `#[serde(rename_all = "camelCase")]`
 * attributes so we can pass results through to UI directly without any
 * intermediate mapping.
 */

export type ReservasiStatus =
  | 'menunggu'
  | 'siap_diambil'
  | 'diambil'
  | 'expired'
  | 'dibatalkan';

export interface ReservasiRow {
  id: number;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  bukuId: number;
  bukuJudul: string;
  bukuKode: string;
  /**
   * 1-based queue position within `(buku_id, status='menunggu')`. Stable
   * once assigned; only re-numbered if the operator cancels an entry.
   */
  urutan: number;
  status: ReservasiStatus;
  /**
   * Deterministic shelf slot (e.g. `"R-0007"`) assigned the moment a row
   * flips to `siap_diambil`. The admin writes this on the physical book.
   */
  slotRak?: string | null;
  tanggalRequest: string;
  tanggalSiapDiambil?: string | null;
  expiredAt?: string | null;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservasiCreateInput {
  anggotaId: number;
  bukuId: number;
  catatan?: string;
}

interface ReservasiRpc {
  create(input: ReservasiCreateInput): Promise<ReservasiRow>;
  cancel(id: number): Promise<void>;
  markDiambil(id: number): Promise<void>;
  /** All rows whose status is `menunggu` or `siap_diambil`. */
  listActive(): Promise<ReservasiRow[]>;
  listByBuku(bukuId: number): Promise<ReservasiRow[]>;
  listByAnggota(anggotaId: number): Promise<ReservasiRow[]>;
  /**
   * Idempotent maintenance tick: expires any `siap_diambil` rows past
   * `expired_at` and promotes the next queued anggota. Returns the count
   * of rows expired by this call.
   */
  checkExpiredTick(): Promise<number>;
}

const tauriRpc: ReservasiRpc = {
  async create(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ReservasiRow>('reservasi_create', { input });
  },
  async cancel(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('reservasi_cancel', { id });
  },
  async markDiambil(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('reservasi_mark_diambil', { id });
  },
  async listActive() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ReservasiRow[]>('reservasi_list_active');
  },
  async listByBuku(bukuId) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ReservasiRow[]>('reservasi_list_by_buku', { bukuId });
  },
  async listByAnggota(anggotaId) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ReservasiRow[]>('reservasi_list_by_anggota', { anggotaId });
  },
  async checkExpiredTick() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<number>('reservasi_check_expired_tick');
  },
};

// ----------------------------------------------------------------------------
// Browser mock — small in-memory queue so the dev UI works without Tauri.
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'po:reservasi-mock';

interface MockState {
  rows: ReservasiRow[];
  seq: number;
}

function readMock(): MockState {
  if (typeof window === 'undefined') return { rows: [], seq: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rows: [], seq: 0 };
    return JSON.parse(raw) as MockState;
  } catch {
    return { rows: [], seq: 0 };
  }
}

function writeMock(state: MockState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function slotLabel(id: number): string {
  return `R-${String(id).padStart(4, '0')}`;
}

const mockRpc: ReservasiRpc = {
  async create(input) {
    const state = readMock();
    const sameAnggota = state.rows.find(
      (r) =>
        r.anggotaId === input.anggotaId &&
        r.bukuId === input.bukuId &&
        (r.status === 'menunggu' || r.status === 'siap_diambil'),
    );
    if (sameAnggota) {
      throw new Error('Anggota sudah punya reservasi aktif untuk buku ini');
    }
    const queueLen = state.rows.filter(
      (r) => r.bukuId === input.bukuId && r.status === 'menunggu',
    ).length;
    const id = ++state.seq;
    const row: ReservasiRow = {
      id,
      anggotaId: input.anggotaId,
      anggotaNama: `Anggota ${input.anggotaId}`,
      anggotaKode: `A${String(input.anggotaId).padStart(4, '0')}`,
      bukuId: input.bukuId,
      bukuJudul: `Buku ${input.bukuId}`,
      bukuKode: `B${String(input.bukuId).padStart(4, '0')}`,
      urutan: queueLen + 1,
      status: 'menunggu',
      slotRak: null,
      tanggalRequest: todayIso(),
      tanggalSiapDiambil: null,
      expiredAt: null,
      catatan: input.catatan ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.rows.push(row);
    writeMock(state);
    return row;
  },
  async cancel(id) {
    const state = readMock();
    const row = state.rows.find((r) => r.id === id);
    if (!row) throw new Error(`reservasi id=${id} not found`);
    if (row.status !== 'menunggu' && row.status !== 'siap_diambil') {
      throw new Error('Reservasi sudah final, tidak bisa dibatalkan');
    }
    row.status = 'dibatalkan';
    row.updatedAt = nowIso();
    writeMock(state);
  },
  async markDiambil(id) {
    const state = readMock();
    const row = state.rows.find((r) => r.id === id);
    if (!row) throw new Error(`reservasi id=${id} not found`);
    if (row.status !== 'siap_diambil') {
      throw new Error('Reservasi belum siap diambil');
    }
    row.status = 'diambil';
    row.updatedAt = nowIso();
    writeMock(state);
  },
  async listActive() {
    const state = readMock();
    return state.rows
      .filter((r) => r.status === 'menunggu' || r.status === 'siap_diambil')
      .sort((a, b) => a.bukuId - b.bukuId || a.urutan - b.urutan);
  },
  async listByBuku(bukuId) {
    const state = readMock();
    return state.rows
      .filter((r) => r.bukuId === bukuId)
      .sort((a, b) => a.urutan - b.urutan);
  },
  async listByAnggota(anggotaId) {
    const state = readMock();
    return state.rows
      .filter((r) => r.anggotaId === anggotaId)
      .sort((a, b) => b.id - a.id);
  },
  async checkExpiredTick() {
    const state = readMock();
    const today = todayIso();
    let expired = 0;
    for (const row of state.rows) {
      if (
        row.status === 'siap_diambil' &&
        row.expiredAt &&
        row.expiredAt < today
      ) {
        row.status = 'expired';
        row.updatedAt = nowIso();
        expired += 1;
      }
    }
    writeMock(state);
    return expired;
  },
};

export const reservasiApi: ReservasiRpc = isTauri() ? tauriRpc : mockRpc;

/**
 * Format a reservasi status into the i18n key suffix expected by
 * `reservasi:status.<key>`.
 */
export function reservasiStatusToneKey(status: ReservasiStatus): string {
  return status;
}

/**
 * Days remaining (positive) or overdue (negative) until `expiredAt`.
 * Returns null when `expiredAt` is missing.
 */
export function expiredAtCountdownDays(expiredAt: string | null | undefined): number | null {
  if (!expiredAt) return null;
  const target = new Date(expiredAt + 'T00:00:00Z').getTime();
  const today = new Date(todayIso() + 'T00:00:00Z').getTime();
  return Math.round((target - today) / 86_400_000);
}

export { slotLabel as reservasiSlotLabel };
