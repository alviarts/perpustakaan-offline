import { isTauri } from '@/lib/auth';

export interface Buku {
  id: number;
  kodeBuku: string;
  judul: string;
  pengarang?: string | null;
  penerbit?: string | null;
  tahunTerbit?: number | null;
  kodeDdc?: string | null;
  kategori?: string | null;
  isbn?: string | null;
  jumlahEksemplar: number;
  jumlahTersedia: number;
  sumber?: string | null;
  harga: number;
  coverPath?: string | null;
  bahasa?: string | null;
  deskripsi?: string | null;
  rak?: string | null;
  tanggalInput: string;
  createdAt: string;
  updatedAt: string;
}

export interface Eksemplar {
  id: number;
  bukuId: number;
  kodeEksemplar: string;
  status: 'tersedia' | 'dipinjam' | 'hilang' | 'rusak';
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BukuInput {
  kodeBuku: string;
  judul: string;
  pengarang?: string | null;
  penerbit?: string | null;
  tahunTerbit?: number | null;
  kodeDdc?: string | null;
  kategori?: string | null;
  isbn?: string | null;
  jumlahEksemplar?: number | null;
  sumber?: string | null;
  harga?: number | null;
  coverPath?: string | null;
  bahasa?: string | null;
  deskripsi?: string | null;
  rak?: string | null;
  tanggalInput?: string | null;
}

export interface BukuListArgs {
  query?: string;
  kategori?: string;
  bahasa?: string;
  kodeDdc?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface BukuListResult {
  items: Buku[];
  total: number;
}

export interface BukuDetail {
  buku: Buku;
  eksemplar: Eksemplar[];
}

export interface BukuImportItem {
  kodeBuku: string;
  judul: string;
  pengarang?: string | null;
  penerbit?: string | null;
  tahunTerbit?: number | null;
  kodeDdc?: string | null;
  kategori?: string | null;
  isbn?: string | null;
  jumlahEksemplar?: number | null;
  bahasa?: string | null;
}

export interface BukuImportError {
  row: number;
  message: string;
}

export interface BukuImportResult {
  inserted: number;
  skipped: number;
  errors: BukuImportError[];
}

interface BukuRpc {
  list(args: BukuListArgs): Promise<BukuListResult>;
  get(id: number): Promise<BukuDetail>;
  create(input: BukuInput): Promise<Buku>;
  update(id: number, input: BukuInput): Promise<Buku>;
  remove(id: number): Promise<void>;
  importBatch(items: BukuImportItem[]): Promise<BukuImportResult>;
  eksemplarCreate(bukuId: number, kode: string): Promise<Eksemplar>;
  eksemplarRemove(id: number): Promise<void>;
  __resetMock(): void;
}

const STORAGE_KEY = 'po:buku-mock';
const SEED: Buku[] = [
  {
    id: 1,
    kodeBuku: 'B0001',
    judul: 'Bumi Manusia',
    pengarang: 'Pramoedya Ananta Toer',
    penerbit: 'Hasta Mitra',
    tahunTerbit: 1980,
    kodeDdc: '813',
    kategori: 'Fiksi',
    isbn: '978-979-97312-3-2',
    jumlahEksemplar: 3,
    jumlahTersedia: 3,
    sumber: 'BOS',
    harga: 75000,
    coverPath: null,
    bahasa: 'id',
    deskripsi: 'Tetralogi Pulau Buru, jilid pertama.',
    rak: 'A1',
    tanggalInput: '2025-01-15',
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 2,
    kodeBuku: 'B0002',
    judul: 'Laskar Pelangi',
    pengarang: 'Andrea Hirata',
    penerbit: 'Bentang Pustaka',
    tahunTerbit: 2005,
    kodeDdc: '813',
    kategori: 'Fiksi',
    isbn: '978-979-3062-79-2',
    jumlahEksemplar: 2,
    jumlahTersedia: 2,
    sumber: 'Hibah',
    harga: 65000,
    coverPath: null,
    bahasa: 'id',
    deskripsi: null,
    rak: 'A1',
    tanggalInput: '2025-02-10',
    createdAt: '2025-02-10T09:00:00Z',
    updatedAt: '2025-02-10T09:00:00Z',
  },
  {
    id: 3,
    kodeBuku: 'B0003',
    judul: 'Sapiens: A Brief History of Humankind',
    pengarang: 'Yuval Noah Harari',
    penerbit: 'Harvill Secker',
    tahunTerbit: 2011,
    kodeDdc: '909',
    kategori: 'Non-fiksi',
    isbn: '978-0-09-959008-8',
    jumlahEksemplar: 1,
    jumlahTersedia: 1,
    sumber: null,
    harga: 150000,
    coverPath: null,
    bahasa: 'en',
    deskripsi: null,
    rak: 'B2',
    tanggalInput: '2025-03-05',
    createdAt: '2025-03-05T10:00:00Z',
    updatedAt: '2025-03-05T10:00:00Z',
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function readMock(): Buku[] {
  if (typeof window === 'undefined') return [...SEED];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return [...SEED];
  }
  try {
    const parsed = JSON.parse(raw) as Buku[];
    return Array.isArray(parsed) ? parsed : [...SEED];
  } catch {
    return [...SEED];
  }
}

function writeMock(items: Buku[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function nextId(items: Buku[]): number {
  return items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
}

const tauriRpc: BukuRpc = {
  async list(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<BukuListResult>('buku_list', { args });
  },
  async get(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<BukuDetail>('buku_get', { id });
  },
  async create(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Buku>('buku_create', { input });
  },
  async update(id, input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Buku>('buku_update', { id, input });
  },
  async remove(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('buku_delete', { id });
  },
  async importBatch(items) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<BukuImportResult>('buku_import', { items });
  },
  async eksemplarCreate(bukuId, kode) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Eksemplar>('eksemplar_create', { bukuId, kode });
  },
  async eksemplarRemove(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('eksemplar_delete', { id });
  },
  __resetMock() {
    /* no-op for tauri */
  },
};

const browserRpc: BukuRpc = {
  async list(args) {
    let items = readMock();
    const q = args.query?.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (it) =>
          it.judul.toLowerCase().includes(q) ||
          it.kodeBuku.toLowerCase().includes(q) ||
          (it.pengarang ?? '').toLowerCase().includes(q) ||
          (it.isbn ?? '').toLowerCase().includes(q),
      );
    }
    if (args.kategori) items = items.filter((it) => it.kategori === args.kategori);
    if (args.bahasa) items = items.filter((it) => it.bahasa === args.bahasa);
    if (args.kodeDdc) items = items.filter((it) => (it.kodeDdc ?? '').startsWith(args.kodeDdc!));
    const total = items.length;
    const sortBy = args.sortBy ?? 'judul';
    const dir = args.sortDir === 'desc' ? -1 : 1;
    items = [...items].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortBy] ?? '');
      const bv = String((b as unknown as Record<string, unknown>)[sortBy] ?? '');
      return av.localeCompare(bv) * dir;
    });
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 100;
    return { items: items.slice(offset, offset + limit), total };
  },
  async get(id) {
    const all = readMock();
    const buku = all.find((it) => it.id === id);
    if (!buku) throw new Error(`buku id=${id} not found`);
    // Mock eksemplar derived from jumlahEksemplar
    const eksemplar: Eksemplar[] = Array.from({ length: buku.jumlahEksemplar }, (_, i) => ({
      id: id * 100 + i + 1,
      bukuId: id,
      kodeEksemplar: `${buku.kodeBuku}-${String(i + 1).padStart(2, '0')}`,
      status: i < buku.jumlahTersedia ? 'tersedia' : 'dipinjam',
      catatan: null,
      createdAt: buku.createdAt,
      updatedAt: buku.updatedAt,
    }));
    return { buku, eksemplar };
  },
  async create(input) {
    if (!input.kodeBuku.trim()) throw new Error('validation: kodeBuku required');
    if (!input.judul.trim()) throw new Error('validation: judul required');
    const all = readMock();
    if (all.some((it) => it.kodeBuku === input.kodeBuku.trim())) {
      throw new Error(`validation: kodeBuku '${input.kodeBuku}' sudah dipakai`);
    }
    const jumlah = Math.max(0, input.jumlahEksemplar ?? 1);
    const created: Buku = {
      id: nextId(all),
      kodeBuku: input.kodeBuku.trim(),
      judul: input.judul.trim(),
      pengarang: input.pengarang ?? null,
      penerbit: input.penerbit ?? null,
      tahunTerbit: input.tahunTerbit ?? null,
      kodeDdc: input.kodeDdc ?? null,
      kategori: input.kategori ?? null,
      isbn: input.isbn ?? null,
      jumlahEksemplar: jumlah,
      jumlahTersedia: jumlah,
      sumber: input.sumber ?? null,
      harga: Math.max(0, input.harga ?? 0),
      coverPath: input.coverPath ?? null,
      bahasa: input.bahasa ?? null,
      deskripsi: input.deskripsi ?? null,
      rak: input.rak ?? null,
      tanggalInput: input.tanggalInput ?? new Date().toISOString().slice(0, 10),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeMock([...all, created]);
    return created;
  },
  async update(id, input) {
    const all = readMock();
    const existing = all.find((it) => it.id === id);
    if (!existing) throw new Error('not_found');
    if (all.some((it) => it.id !== id && it.kodeBuku === input.kodeBuku.trim())) {
      throw new Error(`validation: kodeBuku '${input.kodeBuku}' sudah dipakai buku lain`);
    }
    const updated: Buku = {
      ...existing,
      kodeBuku: input.kodeBuku.trim(),
      judul: input.judul.trim(),
      pengarang: input.pengarang ?? null,
      penerbit: input.penerbit ?? null,
      tahunTerbit: input.tahunTerbit ?? null,
      kodeDdc: input.kodeDdc ?? null,
      kategori: input.kategori ?? null,
      isbn: input.isbn ?? null,
      jumlahEksemplar: input.jumlahEksemplar ?? existing.jumlahEksemplar,
      sumber: input.sumber ?? null,
      harga: input.harga ?? existing.harga,
      coverPath: input.coverPath ?? existing.coverPath,
      bahasa: input.bahasa ?? null,
      deskripsi: input.deskripsi ?? null,
      rak: input.rak ?? null,
      updatedAt: nowIso(),
    };
    writeMock(all.map((it) => (it.id === id ? updated : it)));
    return updated;
  },
  async remove(id) {
    const all = readMock();
    if (!all.some((it) => it.id === id)) throw new Error('not_found');
    writeMock(all.filter((it) => it.id !== id));
  },
  async importBatch(items) {
    const all = readMock();
    let inserted = 0;
    let skipped = 0;
    const errors: BukuImportError[] = [];
    const next: Buku[] = [...all];
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (!item.kodeBuku.trim() || !item.judul.trim()) {
        errors.push({ row: i + 1, message: 'kode_buku and judul are required' });
        skipped += 1;
        continue;
      }
      if (next.some((it) => it.kodeBuku === item.kodeBuku.trim())) {
        errors.push({ row: i + 1, message: `kode_buku '${item.kodeBuku}' sudah ada` });
        skipped += 1;
        continue;
      }
      const jumlah = Math.max(0, item.jumlahEksemplar ?? 1);
      next.push({
        id: nextId(next),
        kodeBuku: item.kodeBuku.trim(),
        judul: item.judul.trim(),
        pengarang: item.pengarang ?? null,
        penerbit: item.penerbit ?? null,
        tahunTerbit: item.tahunTerbit ?? null,
        kodeDdc: item.kodeDdc ?? null,
        kategori: item.kategori ?? null,
        isbn: item.isbn ?? null,
        jumlahEksemplar: jumlah,
        jumlahTersedia: jumlah,
        sumber: null,
        harga: 0,
        coverPath: null,
        bahasa: item.bahasa ?? null,
        deskripsi: null,
        rak: null,
        tanggalInput: new Date().toISOString().slice(0, 10),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      inserted += 1;
    }
    writeMock(next);
    return { inserted, skipped, errors };
  },
  async eksemplarCreate(bukuId, kode) {
    if (!kode.trim()) throw new Error('validation: kodeEksemplar required');
    const all = readMock();
    const buku = all.find((it) => it.id === bukuId);
    if (!buku) throw new Error('not_found');
    const updated: Buku = {
      ...buku,
      jumlahEksemplar: buku.jumlahEksemplar + 1,
      jumlahTersedia: buku.jumlahTersedia + 1,
      updatedAt: nowIso(),
    };
    writeMock(all.map((it) => (it.id === bukuId ? updated : it)));
    return {
      id: bukuId * 100 + buku.jumlahEksemplar + 1,
      bukuId,
      kodeEksemplar: kode.trim(),
      status: 'tersedia',
      catatan: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  },
  async eksemplarRemove() {
    /* mock: ignore for now */
  },
  __resetMock() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
};

export const bukuApi: BukuRpc = isTauri() ? tauriRpc : browserRpc;

// ----------------------------------------------------------------------------
// FEAT-20 — Bulk import buku via ISBN
// ----------------------------------------------------------------------------

/** Metadata returned by the backend ISBN lookup (Open Library + Google Books). */
export interface IsbnMetadata {
  isbn: string;
  judul?: string | null;
  pengarang?: string | null;
  penerbit?: string | null;
  tahunTerbit?: number | null;
  kategori?: string | null;
  bahasa?: string | null;
  /** Optional cover URL — frontend can call `fetchIsbnCover(url)` to embed it. */
  coverUrl?: string | null;
  /** Which upstream produced the record. Empty string when not found. */
  source: string;
}

/**
 * One row of `bukuIsbnApi.lookupBatch`. `metadata` is null when neither
 * upstream had a record. `error` is set when the lookup itself failed.
 */
export interface IsbnLookupResult {
  isbn: string;
  metadata: IsbnMetadata | null;
  error: string | null;
}

interface BukuIsbnRpc {
  /** Resolve a list of ISBNs to metadata. Backend throttles ~1 req/sec. */
  lookupBatch(isbns: string[]): Promise<IsbnLookupResult[]>;
  /**
   * Download a cover URL into a `data:image/...;base64,...` string suitable
   * for embedding in `<img src>` or persisting via the buku cover field.
   */
  fetchCover(url: string): Promise<string>;
}

const tauriIsbnRpc: BukuIsbnRpc = {
  async lookupBatch(isbns) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<IsbnLookupResult[]>('buku_isbn_lookup_batch', { isbns });
  },
  async fetchCover(url) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('buku_isbn_fetch_cover', { url });
  },
};

/**
 * Browser/test fallback. Fakes a deterministic record for any ISBN that
 * normalizes to 13 digits so vitest specs and the in-browser preview can
 * exercise the dialog without hitting the network.
 */
const browserIsbnRpc: BukuIsbnRpc = {
  async lookupBatch(isbns) {
    return isbns.map((isbn) => {
      const cleaned = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      if (cleaned.length !== 10 && cleaned.length !== 13) {
        return {
          isbn,
          metadata: null,
          error: 'ISBN tidak valid (harus 10 atau 13 digit)',
        };
      }
      return {
        isbn,
        metadata: {
          isbn: cleaned,
          judul: `Buku ${cleaned}`,
          pengarang: 'Penulis Demo',
          penerbit: 'Penerbit Demo',
          tahunTerbit: 2024,
          kategori: null,
          bahasa: 'id',
          coverUrl: null,
          source: 'mock',
        },
        error: null,
      } satisfies IsbnLookupResult;
    });
  },
  async fetchCover() {
    return '';
  },
};

export const bukuIsbnApi: BukuIsbnRpc = isTauri() ? tauriIsbnRpc : browserIsbnRpc;

/**
 * Convert an `IsbnMetadata` row + auto-generated kodeBuku into a
 * `BukuImportItem` that `bukuApi.importBatch` can consume. Returns null when
 * `meta` lacks the minimum required field (`judul`).
 */
export function metadataToImportItem(
  meta: IsbnMetadata,
  kodeBuku: string,
): BukuImportItem | null {
  const judul = meta.judul?.trim();
  if (!judul) return null;
  return {
    kodeBuku: kodeBuku.trim(),
    judul,
    pengarang: meta.pengarang ?? null,
    penerbit: meta.penerbit ?? null,
    tahunTerbit: meta.tahunTerbit ?? null,
    kodeDdc: null,
    kategori: meta.kategori ?? null,
    isbn: meta.isbn,
    jumlahEksemplar: 1,
    bahasa: meta.bahasa ?? null,
  };
}
