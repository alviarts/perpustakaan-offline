import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';
import type { Buku } from '@/lib/buku';

/**
 * E1-OPACBukuPilihan — single carousel slide returned by `listActive`.
 * Mirrors the Rust `BukuPilihanSlide` struct (camelCase via serde).
 */
export interface BukuPilihanSlide {
  id: number;
  bukuId: number;
  position: number;
  pinnedAt: string;
  label: string | null;
  expiresAt: string | null;
  buku: Buku;
}

export interface PinInput {
  bukuId: number;
  label?: string | null;
  expiresAt?: string | null;
}

export interface BukuPilihanRpc {
  listActive: () => Promise<BukuPilihanSlide[]>;
  pin: (input: PinInput) => Promise<BukuPilihanSlide>;
  unpin: (id: number) => Promise<void>;
  reorder: (ids: number[]) => Promise<void>;
}

/** Maximum number of active pins enforced both client- and server-side. */
export const MAX_ACTIVE_PINS = 5;

const tauriRpc: BukuPilihanRpc = {
  listActive: () => invoke<BukuPilihanSlide[]>('buku_pilihan_list_active'),
  pin: (input) => invoke<BukuPilihanSlide>('buku_pilihan_pin', { input }),
  unpin: (id) => invoke<void>('buku_pilihan_unpin', { id }),
  reorder: (ids) => invoke<void>('buku_pilihan_reorder', { ids }),
};

/**
 * In-memory mock for the dev browser. Filters out expired pins on
 * `listActive` and rejects `pin` calls when 5 pins are already active —
 * mirroring the Rust contract so the dev experience matches production.
 */
function makeMockRpc(): BukuPilihanRpc {
  let nextId = 1;
  const store: BukuPilihanSlide[] = [];

  const isActive = (s: BukuPilihanSlide): boolean => {
    if (!s.expiresAt) return true;
    return new Date(s.expiresAt).getTime() > Date.now();
  };

  return {
    async listActive() {
      return store.filter(isActive).sort((a, b) => a.position - b.position);
    },
    async pin(input) {
      const active = store.filter(isActive);
      if (active.length >= MAX_ACTIVE_PINS) {
        throw new Error(
          `Maksimum ${MAX_ACTIVE_PINS} buku pilihan aktif. Lepas pin lama dulu.`,
        );
      }
      const slide: BukuPilihanSlide = {
        id: nextId++,
        bukuId: input.bukuId,
        position: store.length,
        pinnedAt: new Date().toISOString(),
        label: input.label ?? null,
        expiresAt: input.expiresAt ?? null,
        buku: {
          id: input.bukuId,
          kodeBuku: `MOCK-${input.bukuId}`,
          judul: `Mock buku ${input.bukuId}`,
          jumlahEksemplar: 1,
          jumlahTersedia: 1,
          harga: 0,
          tanggalInput: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      store.push(slide);
      return slide;
    },
    async unpin(id) {
      const idx = store.findIndex((s) => s.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
    async reorder(ids) {
      ids.forEach((id, idx) => {
        const slide = store.find((s) => s.id === id);
        if (slide) slide.position = idx;
      });
    },
  };
}

const mockRpc: BukuPilihanRpc = makeMockRpc();

export const bukuPilihanApi: BukuPilihanRpc = {
  listActive: () => (isTauri() ? tauriRpc.listActive() : mockRpc.listActive()),
  pin: (input) => (isTauri() ? tauriRpc.pin(input) : mockRpc.pin(input)),
  unpin: (id) => (isTauri() ? tauriRpc.unpin(id) : mockRpc.unpin(id)),
  reorder: (ids) => (isTauri() ? tauriRpc.reorder(ids) : mockRpc.reorder(ids)),
};

/**
 * Test-only factory: returns a fresh in-memory RPC so each test starts
 * from an empty store. Not used at runtime.
 */
export function __makeMockBukuPilihanApi(): BukuPilihanRpc {
  return makeMockRpc();
}
