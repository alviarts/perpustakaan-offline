import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { masterDataApi } from '@/lib/masterData';

describe('masterDataApi (browser mock)', () => {
  beforeEach(() => {
    masterDataApi.__resetMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    masterDataApi.__resetMock();
  });

  it('seeds default DDC entries on first list', async () => {
    const items = await masterDataApi.list('ddc');
    expect(items.length).toBeGreaterThan(0);
    const ratusan = items.find((it) => it.kode === '000');
    expect(ratusan).toBeDefined();
  });

  it('seeds bahasa with ISO 639 codes', async () => {
    const items = await masterDataApi.list('bahasa');
    expect(items.find((it) => it.kode === 'id')).toBeDefined();
    expect(items.find((it) => it.kode === 'en')).toBeDefined();
  });

  it('filters list by query (LIKE nama or kode)', async () => {
    const all = await masterDataApi.list('kategori');
    const filtered = await masterDataApi.list('kategori', 'fiksi');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    expect(filtered.every((it) => /fiksi/i.test(it.nama))).toBe(true);
  });

  it('creates a kategori entry (numeric id auto-assigned)', async () => {
    const created = await masterDataApi.create('kategori', {
      nama: 'TestKategori',
      deskripsi: 'desc',
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.nama).toBe('TestKategori');
  });

  it('creates a bahasa entry with kode as primary key', async () => {
    const created = await masterDataApi.create('bahasa', {
      kode: 'xx',
      nama: 'Xtra',
    });
    expect(created.kode).toBe('xx');
  });

  it('rejects duplicate nama on create (case-insensitive)', async () => {
    await masterDataApi.create('jurusan', { nama: 'UniqueOne' });
    await expect(
      masterDataApi.create('jurusan', { nama: 'uniqueone' }),
    ).rejects.toThrow();
  });

  it('rejects bahasa create without kode', async () => {
    await expect(
      masterDataApi.create('bahasa', { nama: 'NoCode' }),
    ).rejects.toThrow();
  });

  it('updates and deletes a kategori', async () => {
    const created = await masterDataApi.create('kategori', { nama: 'WillUpdate' });
    const updated = await masterDataApi.update('kategori', String(created.id), {
      nama: 'WasUpdated',
    });
    expect(updated.nama).toBe('WasUpdated');

    await masterDataApi.remove('kategori', String(created.id));
    const list = await masterDataApi.list('kategori');
    expect(list.find((it) => it.id === created.id)).toBeUndefined();
  });

  it('updates and deletes a bahasa by kode', async () => {
    const created = await masterDataApi.create('bahasa', {
      kode: 'zz',
      nama: 'Zoolang',
    });
    const updated = await masterDataApi.update('bahasa', created.kode!, {
      nama: 'ZoolangUpdated',
    });
    expect(updated.nama).toBe('ZoolangUpdated');

    await masterDataApi.remove('bahasa', 'zz');
    const list = await masterDataApi.list('bahasa');
    expect(list.find((it) => it.kode === 'zz')).toBeUndefined();
  });
});
