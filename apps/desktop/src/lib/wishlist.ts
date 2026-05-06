/**
 * Frontend bindings for FEAT-22 (Wishlist anggota / request pengadaan).
 *
 * Status state machine (mirrored server-side):
 *
 *   pending ──┬──> disetujui ──┬──> sudah_diadakan
 *             │                └──> dibatalkan
 *             ├──> ditolak  ─────> pending  (revive)
 *             └──> dibatalkan ───> pending  (revive)
 */
import { isTauri } from '@/lib/auth';

export type WishlistStatus =
  | 'pending'
  | 'disetujui'
  | 'ditolak'
  | 'sudah_diadakan'
  | 'dibatalkan';

export const WISHLIST_STATUSES: WishlistStatus[] = [
  'pending',
  'disetujui',
  'ditolak',
  'sudah_diadakan',
  'dibatalkan',
];

export interface WishlistRow {
  id: number;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  judul: string;
  pengarang?: string | null;
  isbn?: string | null;
  alasan?: string | null;
  status: WishlistStatus;
  catatanAdmin?: string | null;
  bukuId?: number | null;
  bukuJudul?: string | null;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistCreateInput {
  anggotaId: number;
  judul: string;
  pengarang?: string;
  isbn?: string;
  alasan?: string;
}

export interface WishlistUpdateStatusInput {
  id: number;
  status: WishlistStatus;
  catatanAdmin?: string;
  bukuId?: number;
}

export interface WishlistListQuery {
  status?: WishlistStatus;
  anggotaId?: number;
  limit?: number;
  offset?: number;
}

export interface WishlistRpc {
  list(query?: WishlistListQuery): Promise<WishlistRow[]>;
  create(input: WishlistCreateInput): Promise<WishlistRow>;
  updateStatus(input: WishlistUpdateStatusInput): Promise<WishlistRow>;
  upvote(id: number): Promise<WishlistRow>;
  delete(id: number): Promise<void>;
}

/**
 * Pure decision: is `from → to` a permitted status transition? Mirrors
 * `is_valid_transition` in `commands/wishlist.rs`. Used to dim disallowed
 * action buttons on the admin queue.
 */
export function canTransition(from: WishlistStatus, to: WishlistStatus): boolean {
  if (from === to) return true;
  switch (from) {
    case 'pending':
      return to === 'disetujui' || to === 'ditolak' || to === 'dibatalkan';
    case 'disetujui':
      return to === 'sudah_diadakan' || to === 'dibatalkan';
    case 'ditolak':
      return to === 'pending';
    case 'dibatalkan':
      return to === 'pending';
    case 'sudah_diadakan':
      return false;
  }
}

const tauriRpc: WishlistRpc = {
  async list(query) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<WishlistRow[]>('wishlist_list', { query });
  },
  async create(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<WishlistRow>('wishlist_create', { input });
  },
  async updateStatus(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<WishlistRow>('wishlist_update_status', { input });
  },
  async upvote(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<WishlistRow>('wishlist_upvote', { id });
  },
  async delete(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('wishlist_delete', { id });
  },
};

const STORAGE_KEY = 'mock.wishlist';

function readMock(): WishlistRow[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistRow[]) : [];
  } catch {
    return [];
  }
}

function writeMock(rows: WishlistRow[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* SSR / locked storage */
  }
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const mockRpc: WishlistRpc = {
  async list(query) {
    let rows = readMock();
    if (query?.status) rows = rows.filter((r) => r.status === query.status);
    if (query?.anggotaId) rows = rows.filter((r) => r.anggotaId === query.anggotaId);
    rows = [...rows].sort((a, b) => {
      if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount;
      return b.id - a.id;
    });
    if (query?.limit) rows = rows.slice(0, query.limit);
    return rows;
  },
  async create(input) {
    const rows = readMock();
    const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const now = nowIso();
    const row: WishlistRow = {
      id,
      anggotaId: input.anggotaId,
      anggotaNama: `Anggota #${input.anggotaId}`,
      anggotaKode: `A${String(input.anggotaId).padStart(4, '0')}`,
      judul: input.judul.trim(),
      pengarang: input.pengarang?.trim() || null,
      isbn: input.isbn?.trim() || null,
      alasan: input.alasan?.trim() || null,
      status: 'pending',
      catatanAdmin: null,
      bukuId: null,
      bukuJudul: null,
      upvoteCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    writeMock([...rows, row]);
    return row;
  },
  async updateStatus(input) {
    const rows = readMock();
    const idx = rows.findIndex((r) => r.id === input.id);
    const current = idx >= 0 ? rows[idx] : undefined;
    if (!current) throw new Error(`wishlist id ${input.id} not found`);
    if (!canTransition(current.status, input.status)) {
      throw new Error(
        `transisi status tidak diizinkan: ${current.status} → ${input.status}`,
      );
    }
    const next: WishlistRow = {
      ...current,
      status: input.status,
      catatanAdmin: input.catatanAdmin ?? current.catatanAdmin ?? null,
      bukuId: input.bukuId ?? current.bukuId ?? null,
      updatedAt: nowIso(),
    };
    rows[idx] = next;
    writeMock(rows);
    return next;
  },
  async upvote(id) {
    const rows = readMock();
    const idx = rows.findIndex((r) => r.id === id);
    const current = idx >= 0 ? rows[idx] : undefined;
    if (!current) throw new Error(`wishlist id ${id} not found`);
    const next: WishlistRow = {
      ...current,
      upvoteCount: current.upvoteCount + 1,
      updatedAt: nowIso(),
    };
    rows[idx] = next;
    writeMock(rows);
    return next;
  },
  async delete(id) {
    writeMock(readMock().filter((r) => r.id !== id));
  },
};

export const wishlistApi: WishlistRpc = isTauri() ? tauriRpc : mockRpc;
