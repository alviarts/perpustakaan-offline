import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnggota,
  deleteAnggota,
  getAnggota,
  getDistinctValues,
  listAnggota,
  searchAnggota,
  updateAnggota,
  type AnggotaPayload,
} from '@/lib/anggota';

const MOCK_KEY = 'po:mock:anggota';

const basePayload: AnggotaPayload = {
  kode_anggota: 'X001',
  nama: 'Test User',
  jenis_kelamin: 'L',
  kelas: '12',
  jurusan: 'IPA',
  tempat_lahir: null,
  tanggal_lahir: null,
  no_telp: null,
  email: null,
  alamat: null,
  foto_path: null,
  agama: 'Islam',
  catatan: null,
  aktif: true,
};

describe('anggota mock API (browser-mode)', () => {
  beforeEach(() => {
    localStorage.removeItem(MOCK_KEY);
  });

  it('lists seed members with pagination metadata', async () => {
    const result = await listAnggota({ limit: 10, offset: 0 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.limit).toBe(10);
  });

  it('creates and retrieves a member', async () => {
    const created = await createAnggota(basePayload);
    expect(created.id).toBeGreaterThan(0);
    const fetched = await getAnggota(created.id);
    expect(fetched.kode_anggota).toBe('X001');
    expect(fetched.nama).toBe('Test User');
  });

  it('rejects duplicate kode_anggota on create', async () => {
    await createAnggota(basePayload);
    await expect(createAnggota(basePayload)).rejects.toThrow(/conflict/);
  });

  it('updates a member and prevents conflicting kode on update', async () => {
    const a = await createAnggota({ ...basePayload, kode_anggota: 'X100' });
    const b = await createAnggota({ ...basePayload, kode_anggota: 'X200', nama: 'B' });
    const updated = await updateAnggota(a.id, { ...basePayload, kode_anggota: 'X100', nama: 'A new' });
    expect(updated.nama).toBe('A new');
    await expect(
      updateAnggota(a.id, { ...basePayload, kode_anggota: b.kode_anggota }),
    ).rejects.toThrow(/conflict/);
  });

  it('deletes a member', async () => {
    const created = await createAnggota({ ...basePayload, kode_anggota: 'DEL1' });
    await deleteAnggota(created.id);
    await expect(getAnggota(created.id)).rejects.toThrow();
  });

  it('filters list by search query', async () => {
    await createAnggota({ ...basePayload, kode_anggota: 'Q001', nama: 'Anak Cantik' });
    const r = await listAnggota({ query: 'Cantik' });
    expect(r.items.some((a) => a.nama === 'Anak Cantik')).toBe(true);
  });

  it('searchAnggota returns empty for empty query and matches by name/code', async () => {
    expect(await searchAnggota('')).toEqual([]);
    await createAnggota({ ...basePayload, kode_anggota: 'S100', nama: 'Search Me' });
    const found = await searchAnggota('Search');
    expect(found.length).toBeGreaterThan(0);
  });

  it('returns distinct values for kelas/jurusan/agama', async () => {
    const distinct = await getDistinctValues();
    expect(Array.isArray(distinct.kelas)).toBe(true);
    expect(Array.isArray(distinct.jurusan)).toBe(true);
    expect(Array.isArray(distinct.agama)).toBe(true);
  });
});
