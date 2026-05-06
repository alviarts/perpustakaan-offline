import { isTauri } from '@/lib/auth';
import { masterDataApi, type MasterTable } from '@/lib/masterData';

export interface AnggotaFormOptions {
  kelas: string[];
  jurusan: string[];
  agama: string[];
}

/**
 * Merge a master-data list with free-text distinct values into a stable,
 * deduplicated, alphabetically-sorted string array.
 */
function mergeOptionSources(master: string[], distinct: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of [master, distinct]) {
    for (const v of list) {
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function loadFieldOptions(
  field: 'kelas' | 'jurusan' | 'agama',
  table: MasterTable,
): Promise<string[]> {
  // The two RPCs are independent: a failure in one shouldn't kill the other.
  const [masterRes, distinctRes] = await Promise.allSettled([
    masterDataApi.list(table),
    rpc().distinct(field),
  ]);
  const master =
    masterRes.status === 'fulfilled' ? masterRes.value.map((m) => m.nama) : [];
  const distinct = distinctRes.status === 'fulfilled' ? distinctRes.value : [];
  return mergeOptionSources(master, distinct);
}

async function loadAnggotaFormOptions(): Promise<AnggotaFormOptions> {
  const [kelas, jurusan, agama] = await Promise.all([
    loadFieldOptions('kelas', 'kelas'),
    loadFieldOptions('jurusan', 'jurusan'),
    loadFieldOptions('agama', 'agama'),
  ]);
  return { kelas, jurusan, agama };
}

export interface Anggota {
  id: number;
  kodeAnggota: string;
  nama: string;
  jenisKelamin?: string | null;
  kelas?: string | null;
  jurusan?: string | null;
  agama?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  noTelp?: string | null;
  email?: string | null;
  alamat?: string | null;
  fotoPath?: string | null;
  tanggalDaftar: string;
  aktif: boolean;
  catatan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnggotaInput {
  kodeAnggota: string;
  nama: string;
  jenisKelamin?: string | null;
  kelas?: string | null;
  jurusan?: string | null;
  agama?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  noTelp?: string | null;
  email?: string | null;
  alamat?: string | null;
  fotoPath?: string | null;
  tanggalDaftar?: string | null;
  aktif?: boolean | null;
  catatan?: string | null;
}

export interface AnggotaListArgs {
  query?: string;
  kelas?: string;
  jurusan?: string;
  aktif?: boolean | null;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface AnggotaListResult {
  items: Anggota[];
  total: number;
}

export interface AnggotaImportItem {
  kodeAnggota: string;
  nama: string;
  kelas?: string | null;
  jurusan?: string | null;
  agama?: string | null;
  jenisKelamin?: string | null;
  noTelp?: string | null;
  email?: string | null;
}

export interface AnggotaImportError {
  row: number;
  kodeAnggota: string;
  message: string;
}

export interface AnggotaImportResult {
  inserted: number;
  /**
   * FEAT-19 — number of rows that updated an existing anggota when
   * `updateExisting=true` was passed to `importBatch`.
   */
  updated: number;
  skipped: number;
  errors: AnggotaImportError[];
}

export interface AnggotaImportOptions {
  /**
   * When true, importing a row whose `kode_anggota` already exists in the
   * database overwrites the existing record instead of skipping it. Defaults
   * to false (legacy behaviour).
   */
  updateExisting?: boolean;
}

export interface KelasItem {
  id: number;
  nama: string;
  tingkat?: number | null;
  urutan: number;
}

interface AnggotaRpc {
  list(args: AnggotaListArgs): Promise<AnggotaListResult>;
  get(id: number): Promise<Anggota>;
  getByKode(kode: string): Promise<Anggota | null>;
  create(payload: AnggotaInput): Promise<Anggota>;
  update(id: number, payload: AnggotaInput): Promise<Anggota>;
  remove(id: number): Promise<void>;
  importBatch(
    items: AnggotaImportItem[],
    options?: AnggotaImportOptions,
  ): Promise<AnggotaImportResult>;
  distinct(field: 'kelas' | 'jurusan' | 'agama'): Promise<string[]>;
  kelasList(): Promise<KelasItem[]>;
}

const STORAGE_KEY = 'po:anggota-mock';

function readMock(): Anggota[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMockData();
    const parsed = JSON.parse(raw) as Anggota[];
    if (!Array.isArray(parsed)) return seedMockData();
    return parsed;
  } catch {
    return seedMockData();
  }
}

function writeMock(items: Anggota[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedMockData(): Anggota[] {
  const seed: Anggota[] = [
    {
      id: 1,
      kodeAnggota: 'A0001',
      nama: 'Andini Putri',
      jenisKelamin: 'P',
      kelas: '10 IPA 1',
      jurusan: 'IPA',
      agama: 'Islam',
      tempatLahir: 'Jakarta',
      tanggalLahir: '2008-04-12',
      noTelp: '081234567890',
      email: 'andini@example.com',
      alamat: 'Jl. Mawar No. 12',
      fotoPath: null,
      tanggalDaftar: '2024-08-01',
      aktif: true,
      catatan: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 2,
      kodeAnggota: 'A0002',
      nama: 'Bagas Pratama',
      jenisKelamin: 'L',
      kelas: '11 IPS 2',
      jurusan: 'IPS',
      agama: 'Kristen',
      tempatLahir: 'Bandung',
      tanggalLahir: '2007-09-30',
      noTelp: '082233445566',
      email: 'bagas@example.com',
      alamat: 'Jl. Melati No. 5',
      fotoPath: null,
      tanggalDaftar: '2024-08-01',
      aktif: true,
      catatan: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 3,
      kodeAnggota: 'A0003',
      nama: 'Citra Lestari',
      jenisKelamin: 'P',
      kelas: '12 Bahasa 1',
      jurusan: 'Bahasa',
      agama: 'Islam',
      tempatLahir: 'Surabaya',
      tanggalLahir: '2006-12-05',
      noTelp: '081200001111',
      email: 'citra@example.com',
      alamat: 'Jl. Anggrek No. 9',
      fotoPath: null,
      tanggalDaftar: '2024-08-01',
      aktif: false,
      catatan: 'Sedang cuti',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
  writeMock(seed);
  return seed;
}

const tauriRpc: AnggotaRpc = {
  async list(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AnggotaListResult>('anggota_list', { args });
  },
  async get(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_get', { id });
  },
  async getByKode(kode) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota | null>('anggota_get_by_kode', { kode });
  },
  async create(payload) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_create', { payload });
  },
  async update(id, payload) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_update', { id, payload });
  },
  async remove(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('anggota_delete', { id });
  },
  async importBatch(items, options) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AnggotaImportResult>('anggota_import', {
      items,
      updateExisting: options?.updateExisting ?? false,
    });
  },
  async distinct(field) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<{ values: string[] }>('anggota_distinct', { field });
    return res.values;
  },
  async kelasList() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<KelasItem[]>('kelas_list');
  },
};

const mockRpc: AnggotaRpc = {
  async list(args) {
    const all = readMock();
    const q = args.query?.trim().toLowerCase();
    const filtered = all.filter((it) => {
      if (q) {
        const haystack = [it.nama, it.kodeAnggota, it.kelas, it.jurusan]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (args.kelas && it.kelas !== args.kelas) return false;
      if (args.jurusan && it.jurusan !== args.jurusan) return false;
      if (args.aktif != null && it.aktif !== args.aktif) return false;
      return true;
    });
    const sortBy = args.sortBy ?? 'nama';
    const dir = args.sortDir === 'desc' ? -1 : 1;
    const sorted = [...filtered].sort((a, b) => {
      const av = (a as unknown as Record<string, string | null>)[sortBy] ?? '';
      const bv = (b as unknown as Record<string, string | null>)[sortBy] ?? '';
      return av.localeCompare(bv) * dir;
    });
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    return { items: sorted.slice(offset, offset + limit), total: sorted.length };
  },
  async get(id) {
    const found = readMock().find((it) => it.id === id);
    if (!found) throw new Error('not_found');
    return found;
  },
  async getByKode(kode) {
    return readMock().find((it) => it.kodeAnggota === kode.trim()) ?? null;
  },
  async create(payload) {
    const all = readMock();
    if (!payload.kodeAnggota.trim() || !payload.nama.trim()) {
      throw new Error('validation: kode_anggota dan nama wajib diisi');
    }
    if (all.some((it) => it.kodeAnggota === payload.kodeAnggota.trim())) {
      throw new Error(`validation: kode_anggota '${payload.kodeAnggota}' sudah dipakai`);
    }
    const id = (all.reduce((max, it) => Math.max(max, it.id), 0) ?? 0) + 1;
    const now = nowIso();
    const created: Anggota = {
      id,
      kodeAnggota: payload.kodeAnggota.trim(),
      nama: payload.nama.trim(),
      jenisKelamin: payload.jenisKelamin ?? null,
      kelas: payload.kelas ?? null,
      jurusan: payload.jurusan ?? null,
      agama: payload.agama ?? null,
      tempatLahir: payload.tempatLahir ?? null,
      tanggalLahir: payload.tanggalLahir ?? null,
      noTelp: payload.noTelp ?? null,
      email: payload.email ?? null,
      alamat: payload.alamat ?? null,
      fotoPath: payload.fotoPath ?? null,
      tanggalDaftar: payload.tanggalDaftar ?? new Date().toISOString().slice(0, 10),
      aktif: payload.aktif ?? true,
      catatan: payload.catatan ?? null,
      createdAt: now,
      updatedAt: now,
    };
    writeMock([...all, created]);
    return created;
  },
  async update(id, payload) {
    const all = readMock();
    const existing = all.find((it) => it.id === id);
    if (!existing) throw new Error('not_found');
    if (
      all.some((it) => it.id !== id && it.kodeAnggota === payload.kodeAnggota.trim())
    ) {
      throw new Error(`validation: kode_anggota '${payload.kodeAnggota}' sudah dipakai anggota lain`);
    }
    const updated: Anggota = {
      ...existing,
      kodeAnggota: payload.kodeAnggota.trim(),
      nama: payload.nama.trim(),
      jenisKelamin: payload.jenisKelamin ?? null,
      kelas: payload.kelas ?? null,
      jurusan: payload.jurusan ?? null,
      agama: payload.agama ?? null,
      tempatLahir: payload.tempatLahir ?? null,
      tanggalLahir: payload.tanggalLahir ?? null,
      noTelp: payload.noTelp ?? null,
      email: payload.email ?? null,
      alamat: payload.alamat ?? null,
      fotoPath: payload.fotoPath ?? null,
      tanggalDaftar: payload.tanggalDaftar ?? existing.tanggalDaftar,
      aktif: payload.aktif ?? true,
      catatan: payload.catatan ?? null,
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
  async importBatch(items, options) {
    const all = readMock();
    const overwrite = options?.updateExisting === true;
    const result: AnggotaImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    let nextId = (all.reduce((max, it) => Math.max(max, it.id), 0) ?? 0) + 1;
    items.forEach((raw, idx) => {
      const row = idx + 1;
      const kode = raw.kodeAnggota?.trim();
      const nama = raw.nama?.trim();
      if (!kode || !nama) {
        result.errors.push({ row, kodeAnggota: kode ?? '', message: 'kode_anggota dan nama wajib diisi' });
        result.skipped += 1;
        return;
      }
      const existing = all.find((it) => it.kodeAnggota === kode);
      if (existing) {
        if (!overwrite) {
          result.errors.push({ row, kodeAnggota: kode, message: 'kode_anggota sudah ada' });
          result.skipped += 1;
          return;
        }
        existing.nama = nama;
        existing.jenisKelamin = raw.jenisKelamin ?? existing.jenisKelamin;
        existing.kelas = raw.kelas ?? existing.kelas;
        existing.jurusan = raw.jurusan ?? existing.jurusan;
        existing.agama = raw.agama ?? existing.agama;
        existing.noTelp = raw.noTelp ?? existing.noTelp;
        existing.email = raw.email ?? existing.email;
        existing.updatedAt = nowIso();
        result.updated += 1;
        return;
      }
      const now = nowIso();
      all.push({
        id: nextId,
        kodeAnggota: kode,
        nama,
        jenisKelamin: raw.jenisKelamin ?? null,
        kelas: raw.kelas ?? null,
        jurusan: raw.jurusan ?? null,
        agama: raw.agama ?? null,
        tempatLahir: null,
        tanggalLahir: null,
        noTelp: raw.noTelp ?? null,
        email: raw.email ?? null,
        alamat: null,
        fotoPath: null,
        tanggalDaftar: new Date().toISOString().slice(0, 10),
        aktif: true,
        catatan: null,
        createdAt: now,
        updatedAt: now,
      });
      nextId += 1;
      result.inserted += 1;
    });
    writeMock(all);
    return result;
  },
  async distinct(field) {
    const all = readMock();
    const set = new Set<string>();
    for (const it of all) {
      const v = it[field];
      if (typeof v === 'string' && v.trim()) set.add(v);
    }
    return [...set].sort();
  },
  async kelasList() {
    const all = readMock();
    const set = new Set<string>();
    for (const it of all) {
      if (it.kelas) set.add(it.kelas);
    }
    return [...set]
      .sort()
      .map((nama, idx) => ({ id: idx + 1, nama, tingkat: null, urutan: idx + 1 }));
  },
};

function rpc(): AnggotaRpc {
  return isTauri() ? tauriRpc : mockRpc;
}

export const anggotaApi = {
  list: (args: AnggotaListArgs) => rpc().list(args),
  get: (id: number) => rpc().get(id),
  getByKode: (kode: string) => rpc().getByKode(kode),
  create: (payload: AnggotaInput) => rpc().create(payload),
  update: (id: number, payload: AnggotaInput) => rpc().update(id, payload),
  remove: (id: number) => rpc().remove(id),
  importBatch: (items: AnggotaImportItem[], options?: AnggotaImportOptions) =>
    rpc().importBatch(items, options),
  distinct: (field: 'kelas' | 'jurusan' | 'agama') => rpc().distinct(field),
  kelasList: () => rpc().kelasList(),
  /**
   * Load Kelas / Jurusan / Agama options for the Tambah/Edit Anggota form.
   *
   * Source of truth is the master-data table (`master_list({ kind })`), so a
   * fresh DB exposes the seeded entries (BUG-003). Free-text values stored on
   * existing anggota rows are merged on top via `anggota_distinct(field)` so
   * pre-master legacy data isn't dropped from the dropdowns. Each of the
   * three fetches is independent: a master-data outage doesn't kill the
   * distinct fallback, and vice versa.
   */
  loadFormOptions: () => loadAnggotaFormOptions(),
  // Test-only helper: reset the in-memory mock store. No-op in Tauri builds.
  __resetMock(): void {
    if (typeof window !== 'undefined' && !isTauri()) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
};
