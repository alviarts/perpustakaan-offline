import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anggotaApi } from '@/lib/anggota';

describe('anggotaApi (browser mock)', () => {
  beforeEach(() => {
    anggotaApi.__resetMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    anggotaApi.__resetMock();
  });

  it('seeds initial data on first list call', async () => {
    const res = await anggotaApi.list({});
    expect(res.total).toBeGreaterThan(0);
    expect(res.items[0]).toHaveProperty('kodeAnggota');
  });

  it('filters by query across nama and kode', async () => {
    const res = await anggotaApi.list({ query: 'andini' });
    expect(res.items.every((it) => /andini/i.test(it.nama))).toBe(true);
  });

  it('creates an anggota and surfaces it on subsequent list', async () => {
    const created = await anggotaApi.create({
      kodeAnggota: 'A9999',
      nama: 'Test Member',
      kelas: '12 IPA 3',
    });
    expect(created.id).toBeDefined();
    const list = await anggotaApi.list({ query: 'A9999' });
    expect(list.items[0]?.kodeAnggota).toBe('A9999');
  });

  it('rejects duplicate kode_anggota on create', async () => {
    await anggotaApi.create({ kodeAnggota: 'DUP', nama: 'First' });
    await expect(anggotaApi.create({ kodeAnggota: 'DUP', nama: 'Second' })).rejects.toThrow(
      /sudah dipakai|validation/i,
    );
  });

  it('updates and deletes an anggota', async () => {
    const created = await anggotaApi.create({ kodeAnggota: 'UPD1', nama: 'Original Name' });
    const updated = await anggotaApi.update(created.id, {
      kodeAnggota: 'UPD1',
      nama: 'Updated Name',
      aktif: false,
    });
    expect(updated.nama).toBe('Updated Name');
    expect(updated.aktif).toBe(false);

    await anggotaApi.remove(created.id);
    await expect(anggotaApi.get(created.id)).rejects.toThrow();
  });

  it('imports a batch and reports errors for invalid rows', async () => {
    const result = await anggotaApi.importBatch([
      { kodeAnggota: 'IMP1', nama: 'Imported 1' },
      { kodeAnggota: '', nama: 'Missing kode' },
      { kodeAnggota: 'IMP1', nama: 'Duplicate within batch' },
    ]);
    expect(result.inserted).toBe(1);
    expect(result.errors.length + result.skipped).toBeGreaterThanOrEqual(2);
  });
});
