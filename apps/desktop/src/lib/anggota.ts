import { isTauri } from '@/lib/auth';

export interface Anggota {
  id: number;
  kode_anggota: string;
  nama: string;
  jenis_kelamin: string | null;
  kelas: string | null;
  jurusan: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  no_telp: string | null;
  email: string | null;
  alamat: string | null;
  foto_path: string | null;
  agama: string | null;
  tanggal_daftar: string;
  aktif: boolean;
  catatan: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnggotaPayload {
  kode_anggota: string;
  nama: string;
  jenis_kelamin: string | null;
  kelas: string | null;
  jurusan: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  no_telp: string | null;
  email: string | null;
  alamat: string | null;
  foto_path: string | null;
  agama: string | null;
  catatan: string | null;
  aktif: boolean;
}

export interface ListParams {
  query?: string;
  kelas?: string;
  jurusan?: string;
  aktif_only?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface ListResult {
  items: Anggota[];
  total: number;
  limit: number;
  offset: number;
}

export interface DistinctValues {
  kelas: string[];
  jurusan: string[];
  agama: string[];
}

// ---------- mock storage (browser dev / e2e fallback) ----------

const MOCK_KEY = 'po:mock:anggota';

function loadMock(): Anggota[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(MOCK_KEY);
  if (!raw) {
    const seed = mockSeed();
    localStorage.setItem(MOCK_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw) as Anggota[];
  } catch {
    return [];
  }
}

function saveMock(list: Anggota[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_KEY, JSON.stringify(list));
}

function mockSeed(): Anggota[] {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return [
    {
      id: 1,
      kode_anggota: 'A001',
      nama: 'Budi Santoso',
      jenis_kelamin: 'L',
      kelas: 'XII IPA 1',
      jurusan: 'IPA',
      tempat_lahir: 'Jakarta',
      tanggal_lahir: '2007-05-12',
      no_telp: '08123456789',
      email: 'budi@example.com',
      alamat: 'Jl. Mawar No. 1',
      foto_path: null,
      agama: 'Islam',
      tanggal_daftar: today,
      aktif: true,
      catatan: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      kode_anggota: 'A002',
      nama: 'Citra Dewi',
      jenis_kelamin: 'P',
      kelas: 'XII IPA 1',
      jurusan: 'IPA',
      tempat_lahir: 'Bandung',
      tanggal_lahir: '2007-08-20',
      no_telp: '08234567890',
      email: 'citra@example.com',
      alamat: 'Jl. Melati No. 5',
      foto_path: null,
      agama: 'Kristen',
      tanggal_daftar: today,
      aktif: true,
      catatan: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      kode_anggota: 'A003',
      nama: 'Dimas Pratama',
      jenis_kelamin: 'L',
      kelas: 'XI IPS 2',
      jurusan: 'IPS',
      tempat_lahir: 'Surabaya',
      tanggal_lahir: '2008-01-15',
      no_telp: null,
      email: null,
      alamat: null,
      foto_path: null,
      agama: 'Islam',
      tanggal_daftar: today,
      aktif: true,
      catatan: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

function applyFilters(items: Anggota[], params: ListParams): Anggota[] {
  let filtered = items.slice();
  const q = params.query?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (a) =>
        a.nama.toLowerCase().includes(q) ||
        a.kode_anggota.toLowerCase().includes(q) ||
        (a.kelas ?? '').toLowerCase().includes(q) ||
        (a.jurusan ?? '').toLowerCase().includes(q),
    );
  }
  if (params.kelas) filtered = filtered.filter((a) => a.kelas === params.kelas);
  if (params.jurusan) filtered = filtered.filter((a) => a.jurusan === params.jurusan);
  if (params.aktif_only) filtered = filtered.filter((a) => a.aktif);

  const sortKey = (params.sort_by ?? 'nama') as keyof Anggota;
  const dir = params.sort_dir === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return filtered;
}

// ---------- API ----------

export async function listAnggota(params: ListParams = {}): Promise<ListResult> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ListResult>('anggota_list', { params });
  }
  const all = loadMock();
  const filtered = applyFilters(all, params);
  const limit = params.limit ?? 25;
  const offset = params.offset ?? 0;
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}

export async function getAnggota(id: number): Promise<Anggota> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_get', { id });
  }
  const found = loadMock().find((a) => a.id === id);
  if (!found) throw new Error('not_found');
  return found;
}

export async function createAnggota(payload: AnggotaPayload): Promise<Anggota> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_create', { payload });
  }
  const list = loadMock();
  if (list.some((a) => a.kode_anggota === payload.kode_anggota)) {
    throw new Error(`conflict: kode_anggota '${payload.kode_anggota}' sudah dipakai`);
  }
  const id = Math.max(0, ...list.map((a) => a.id)) + 1;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const created: Anggota = {
    id,
    ...payload,
    tanggal_daftar: today,
    created_at: now,
    updated_at: now,
  };
  list.push(created);
  saveMock(list);
  return created;
}

export async function updateAnggota(id: number, payload: AnggotaPayload): Promise<Anggota> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota>('anggota_update', { id, payload });
  }
  const list = loadMock();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('not_found');
  if (list.some((a) => a.kode_anggota === payload.kode_anggota && a.id !== id)) {
    throw new Error(`conflict: kode_anggota '${payload.kode_anggota}' sudah dipakai`);
  }
  const existing = list[idx];
  if (!existing) throw new Error('not_found');
  const updated: Anggota = {
    id: existing.id,
    tanggal_daftar: existing.tanggal_daftar,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
    ...payload,
  };
  list[idx] = updated;
  saveMock(list);
  return updated;
}

export async function deleteAnggota(id: number): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('anggota_delete', { id });
    return;
  }
  const list = loadMock();
  const filtered = list.filter((a) => a.id !== id);
  if (filtered.length === list.length) throw new Error('not_found');
  saveMock(filtered);
}

export async function searchAnggota(query: string): Promise<Anggota[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<Anggota[]>('anggota_search', { query });
  }
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return loadMock()
    .filter(
      (a) =>
        a.aktif &&
        (a.nama.toLowerCase().includes(q) || a.kode_anggota.toLowerCase().includes(q)),
    )
    .slice(0, 10);
}

export async function getDistinctValues(): Promise<DistinctValues> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<DistinctValues>('anggota_distinct_values');
  }
  const list = loadMock();
  const distinct = (key: keyof Anggota): string[] => {
    const set = new Set<string>();
    for (const a of list) {
      const v = a[key];
      if (typeof v === 'string' && v) set.add(v);
    }
    return Array.from(set).sort();
  };
  return {
    kelas: distinct('kelas'),
    jurusan: distinct('jurusan'),
    agama: distinct('agama'),
  };
}
