import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bukuApi } from '@/lib/buku';

describe('bukuApi (browser mock)', () => {
  beforeEach(() => {
    bukuApi.__resetMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    bukuApi.__resetMock();
  });

  it('seeds initial data on first list call', async () => {
    const res = await bukuApi.list({});
    expect(res.total).toBeGreaterThan(0);
    expect(res.items[0]).toHaveProperty('kodeBuku');
    expect(res.items[0]).toHaveProperty('judul');
  });

  it('filters by query across judul, kode, pengarang, isbn', async () => {
    const res = await bukuApi.list({ query: 'sapiens' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((it) => /sapiens/i.test(it.judul))).toBe(true);
  });

  it('filters by kategori', async () => {
    const res = await bukuApi.list({ kategori: 'Fiksi' });
    expect(res.items.every((it) => it.kategori === 'Fiksi')).toBe(true);
  });

  it('creates a buku with correct eksemplar count', async () => {
    const created = await bukuApi.create({
      kodeBuku: 'B9999',
      judul: 'Test Book',
      jumlahEksemplar: 3,
    });
    expect(created.id).toBeDefined();
    expect(created.jumlahEksemplar).toBe(3);
    expect(created.jumlahTersedia).toBe(3);
  });

  it('rejects duplicate kodeBuku on create', async () => {
    await bukuApi.create({ kodeBuku: 'DUP', judul: 'First' });
    await expect(bukuApi.create({ kodeBuku: 'DUP', judul: 'Second' })).rejects.toThrow();
  });

  it('rejects empty kodeBuku or judul', async () => {
    await expect(bukuApi.create({ kodeBuku: '', judul: 'No Code' })).rejects.toThrow();
    await expect(bukuApi.create({ kodeBuku: 'X', judul: '' })).rejects.toThrow();
  });

  it('updates and deletes a buku', async () => {
    const created = await bukuApi.create({ kodeBuku: 'UPD1', judul: 'Original' });
    const updated = await bukuApi.update(created.id, {
      kodeBuku: 'UPD1',
      judul: 'Updated Title',
    });
    expect(updated.judul).toBe('Updated Title');

    await bukuApi.remove(created.id);
    await expect(bukuApi.get(created.id)).rejects.toThrow();
  });

  it('returns detail with eksemplar list', async () => {
    const created = await bukuApi.create({
      kodeBuku: 'EKS1',
      judul: 'With Eksemplar',
      jumlahEksemplar: 2,
    });
    const detail = await bukuApi.get(created.id);
    expect(detail.buku.id).toBe(created.id);
    expect(Array.isArray(detail.eksemplar)).toBe(true);
    expect(detail.eksemplar.length).toBe(2);
  });

  it('imports a batch and reports per-row errors', async () => {
    const result = await bukuApi.importBatch([
      { kodeBuku: 'IMP1', judul: 'Imported 1' },
      { kodeBuku: '', judul: 'Missing kode' },
      { kodeBuku: 'IMP1', judul: 'Duplicate within batch' },
    ]);
    expect(result.inserted).toBe(1);
    expect(result.errors.length + result.skipped).toBeGreaterThanOrEqual(2);
  });
});
