import { isTauri } from '@/lib/auth';

export type MasterTable = 'kategori' | 'bahasa' | 'jurusan' | 'agama' | 'kelas' | 'ddc';

export interface MasterItem {
  id?: number | null;
  kode?: string | null;
  nama: string;
  deskripsi?: string | null;
  urutan?: number | null;
}

export interface MasterInput {
  kode?: string | null;
  nama: string;
  deskripsi?: string | null;
  urutan?: number | null;
}

interface MasterRpc {
  list(table: MasterTable, query?: string): Promise<MasterItem[]>;
  create(table: MasterTable, input: MasterInput): Promise<MasterItem>;
  update(table: MasterTable, key: string, input: MasterInput): Promise<MasterItem>;
  remove(table: MasterTable, key: string): Promise<void>;
  __resetMock(): void;
}

const STORAGE_KEY = 'po:master-mock';

interface MockState {
  kategori: MasterItem[];
  bahasa: MasterItem[];
  jurusan: MasterItem[];
  agama: MasterItem[];
  kelas: MasterItem[];
  ddc: MasterItem[];
}

const SEED: MockState = {
  kategori: [
    { id: 1, nama: 'Fiksi', urutan: 0 },
    { id: 2, nama: 'Non-fiksi', urutan: 1 },
    { id: 3, nama: 'Referensi', urutan: 2 },
    { id: 4, nama: 'Buku Pelajaran', urutan: 3 },
    { id: 5, nama: 'Karya Ilmiah', urutan: 4 },
    { id: 6, nama: 'Majalah', urutan: 5 },
    { id: 7, nama: 'Komik', urutan: 6 },
    { id: 8, nama: 'Biografi', urutan: 7 },
  ],
  bahasa: [
    { kode: 'id', nama: 'Indonesia' },
    { kode: 'en', nama: 'Inggris' },
    { kode: 'ar', nama: 'Arab' },
    { kode: 'jw', nama: 'Jawa' },
    { kode: 'su', nama: 'Sunda' },
    { kode: 'zh', nama: 'Mandarin' },
    { kode: 'ja', nama: 'Jepang' },
    { kode: 'fr', nama: 'Prancis' },
    { kode: 'de', nama: 'Jerman' },
    { kode: 'ms', nama: 'Melayu' },
  ],
  jurusan: [
    { id: 1, nama: 'IPA', urutan: 0 },
    { id: 2, nama: 'IPS', urutan: 1 },
    { id: 3, nama: 'Bahasa', urutan: 2 },
    { id: 4, nama: 'TKJ', urutan: 3 },
    { id: 5, nama: 'RPL', urutan: 4 },
    { id: 6, nama: 'Multimedia', urutan: 5 },
  ],
  agama: [
    { id: 1, nama: 'Islam', urutan: 0 },
    { id: 2, nama: 'Kristen', urutan: 1 },
    { id: 3, nama: 'Katolik', urutan: 2 },
    { id: 4, nama: 'Hindu', urutan: 3 },
    { id: 5, nama: 'Buddha', urutan: 4 },
    { id: 6, nama: 'Konghucu', urutan: 5 },
  ],
  kelas: [
    { id: 1, nama: '7A', urutan: 0 },
    { id: 2, nama: '7B', urutan: 1 },
    { id: 3, nama: '8A', urutan: 2 },
    { id: 4, nama: '8B', urutan: 3 },
    { id: 5, nama: '9A', urutan: 4 },
    { id: 6, nama: '10 IPA 1', urutan: 5 },
    { id: 7, nama: '11 IPS 1', urutan: 6 },
    { id: 8, nama: '12 IPA 3', urutan: 7 },
  ],
  ddc: [
    { kode: '000', nama: 'Karya Umum' },
    { kode: '100', nama: 'Filsafat & Psikologi' },
    { kode: '200', nama: 'Agama' },
    { kode: '300', nama: 'Ilmu Sosial' },
    { kode: '400', nama: 'Bahasa' },
    { kode: '500', nama: 'Sains' },
    { kode: '600', nama: 'Teknologi' },
    { kode: '700', nama: 'Seni & Olahraga' },
    { kode: '800', nama: 'Sastra' },
    { kode: '813', nama: 'Sastra Indonesia' },
    { kode: '900', nama: 'Geografi & Sejarah' },
    { kode: '909', nama: 'Sejarah Dunia' },
  ],
};

function readMock(): MockState {
  if (typeof window === 'undefined') return JSON.parse(JSON.stringify(SEED));
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return JSON.parse(JSON.stringify(SEED));
  }
  try {
    return JSON.parse(raw) as MockState;
  } catch {
    return JSON.parse(JSON.stringify(SEED));
  }
}

function writeMock(state: MockState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function keyForRow(table: MasterTable, item: MasterItem): string {
  if (table === 'bahasa' || table === 'ddc') return item.kode ?? '';
  return String(item.id ?? '');
}

function nextNumericId(items: MasterItem[]): number {
  return items.reduce((max, it) => Math.max(max, it.id ?? 0), 0) + 1;
}

const tauriRpc: MasterRpc = {
  async list(table, query) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<MasterItem[]>('master_list', { table, query: query ?? null });
  },
  async create(table, input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<MasterItem>('master_create', { table, input });
  },
  async update(table, key, input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<MasterItem>('master_update', { table, key, input });
  },
  async remove(table, key) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('master_delete', { table, key });
  },
  __resetMock() {
    /* no-op */
  },
};

const browserRpc: MasterRpc = {
  async list(table, query) {
    const state = readMock();
    let rows = [...state[table]];
    const q = query?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.nama.toLowerCase().includes(q) ||
          (r.kode ?? '').toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      const ord = (a.urutan ?? 0) - (b.urutan ?? 0);
      if (ord !== 0) return ord;
      return a.nama.localeCompare(b.nama);
    });
    return rows;
  },
  async create(table, input) {
    if (!input.nama.trim()) throw new Error('validation: nama required');
    const state = readMock();
    const rows = state[table];
    if (table === 'bahasa') {
      const kode = input.kode?.trim();
      if (!kode) throw new Error('validation: kode required for bahasa');
      if (rows.some((r) => r.kode === kode || r.nama === input.nama.trim())) {
        throw new Error(`validation: bahasa '${kode}' / '${input.nama}' sudah ada`);
      }
      const created: MasterItem = { kode, nama: input.nama.trim() };
      writeMock({ ...state, [table]: [...rows, created] });
      return created;
    }
    if (table === 'ddc') {
      const kode = input.kode?.trim();
      if (!kode) throw new Error('validation: kode required for ddc');
      if (rows.some((r) => r.kode === kode)) {
        throw new Error(`validation: ddc '${kode}' sudah ada`);
      }
      const created: MasterItem = { kode, nama: input.nama.trim() };
      writeMock({ ...state, [table]: [...rows, created] });
      return created;
    }
    const namaLc = input.nama.trim().toLowerCase();
    if (rows.some((r) => r.nama.toLowerCase() === namaLc)) {
      throw new Error(`validation: ${table} '${input.nama}' sudah ada`);
    }
    const created: MasterItem = {
      id: nextNumericId(rows),
      nama: input.nama.trim(),
      deskripsi: input.deskripsi ?? null,
      kode: input.kode ?? null,
      urutan: input.urutan ?? rows.length,
    };
    writeMock({ ...state, [table]: [...rows, created] });
    return created;
  },
  async update(table, key, input) {
    if (!input.nama.trim()) throw new Error('validation: nama required');
    const state = readMock();
    const rows = state[table];
    const idx = rows.findIndex((r) => keyForRow(table, r) === key);
    if (idx < 0) throw new Error('not_found');
    const existing = rows[idx]!;
    const updated: MasterItem = {
      ...existing,
      nama: input.nama.trim(),
      deskripsi: input.deskripsi ?? existing.deskripsi ?? null,
      kode: input.kode ?? existing.kode ?? null,
      urutan: input.urutan ?? existing.urutan ?? 0,
    };
    const nextRows = [...rows];
    nextRows[idx] = updated;
    writeMock({ ...state, [table]: nextRows });
    return updated;
  },
  async remove(table, key) {
    const state = readMock();
    const rows = state[table];
    if (!rows.some((r) => keyForRow(table, r) === key)) throw new Error('not_found');
    writeMock({
      ...state,
      [table]: rows.filter((r) => keyForRow(table, r) !== key),
    });
  },
  __resetMock() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
};

export const masterDataApi: MasterRpc = isTauri() ? tauriRpc : browserRpc;
