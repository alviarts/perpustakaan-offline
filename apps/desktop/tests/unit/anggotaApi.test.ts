import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anggotaApi } from '@/lib/anggota';
import { masterDataApi } from '@/lib/masterData';

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
    expect(result.updated).toBe(0);
    expect(result.errors.length + result.skipped).toBeGreaterThanOrEqual(2);
  });

  it('FEAT-19: skips existing kode_anggota by default and reports them as errors', async () => {
    await anggotaApi.create({ kodeAnggota: 'OW1', nama: 'Original Name' });
    const result = await anggotaApi.importBatch([
      { kodeAnggota: 'OW1', nama: 'Replacement Name', kelas: '12 IPA 1' },
    ]);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]?.message).toMatch(/sudah ada/);
    const list = await anggotaApi.list({ query: 'OW1' });
    expect(list.items[0]?.nama).toBe('Original Name');
  });

  it('FEAT-19: updateExisting=true overwrites existing rows in place', async () => {
    await anggotaApi.create({
      kodeAnggota: 'OW2',
      nama: 'Original Name',
      kelas: '11 IPS 2',
      jurusan: 'IPS',
    });
    const result = await anggotaApi.importBatch(
      [{ kodeAnggota: 'OW2', nama: 'Replacement Name', kelas: '12 IPA 1' }],
      { updateExisting: true },
    );
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    const list = await anggotaApi.list({ query: 'OW2' });
    const row = list.items.find((it) => it.kodeAnggota === 'OW2');
    expect(row?.nama).toBe('Replacement Name');
    expect(row?.kelas).toBe('12 IPA 1');
    // Empty fields shouldn't blow away pre-existing values.
    expect(row?.jurusan).toBe('IPS');
  });

  it('FEAT-19: updateExisting still inserts new rows alongside updates', async () => {
    await anggotaApi.create({ kodeAnggota: 'OW3', nama: 'Existing' });
    const result = await anggotaApi.importBatch(
      [
        { kodeAnggota: 'OW3', nama: 'Updated' },
        { kodeAnggota: 'OW4', nama: 'Brand New' },
      ],
      { updateExisting: true },
    );
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
  });
});

describe('anggotaApi.loadFormOptions (BUG-003)', () => {
  beforeEach(() => {
    anggotaApi.__resetMock();
    masterDataApi.__resetMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    anggotaApi.__resetMock();
    masterDataApi.__resetMock();
  });

  it('exposes the seeded master kelas list on a fresh DB', async () => {
    // Fresh anggota mock has no rows, so anggota_distinct returns []. The
    // dropdown must still show the master-seeded kelas.
    anggotaApi.__resetMock();
    const opts = await anggotaApi.loadFormOptions();
    expect(opts.kelas.length).toBeGreaterThan(0);
    expect(opts.kelas).toContain('7A');
  });

  it('exposes the seeded master jurusan list on a fresh DB', async () => {
    anggotaApi.__resetMock();
    const opts = await anggotaApi.loadFormOptions();
    expect(opts.jurusan).toEqual(
      expect.arrayContaining(['IPA', 'IPS', 'Bahasa']),
    );
  });

  it('exposes the seeded master agama list on a fresh DB', async () => {
    anggotaApi.__resetMock();
    const opts = await anggotaApi.loadFormOptions();
    expect(opts.agama).toEqual(
      expect.arrayContaining(['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha']),
    );
  });

  it('merges existing free-text values from anggota_distinct on top of master', async () => {
    // Simulate a user who already saved an anggota with a custom non-master
    // kelas; that value must still appear in the dropdown.
    await anggotaApi.create({
      kodeAnggota: 'BUG3-1',
      nama: 'Legacy Member',
      kelas: 'Z9-CUSTOM',
      jurusan: 'CUSTOM-JUR',
    });
    const opts = await anggotaApi.loadFormOptions();
    expect(opts.kelas).toContain('Z9-CUSTOM');
    expect(opts.jurusan).toContain('CUSTOM-JUR');
    // Master entries are still present.
    expect(opts.kelas).toContain('7A');
  });

  it('reflects newly added master kelas immediately', async () => {
    await masterDataApi.create('kelas', { nama: '13-EXP' });
    const opts = await anggotaApi.loadFormOptions();
    expect(opts.kelas).toContain('13-EXP');
  });

  it('returns deduplicated, alphabetically sorted lists', async () => {
    // Save an anggota with a kelas that's already in master so we exercise
    // the dedupe path (master + distinct must collapse to a single entry).
    await anggotaApi.create({
      kodeAnggota: 'BUG3-DEDUPE',
      nama: 'Dedupe Member',
      kelas: '7A',
    });
    const opts = await anggotaApi.loadFormOptions();
    const occurrences = opts.kelas.filter((k) => k === '7A').length;
    expect(occurrences).toBe(1);
    const kelasSet = new Set(opts.kelas);
    expect(kelasSet.size).toBe(opts.kelas.length);
    const sorted = [...opts.kelas].sort((a, b) => a.localeCompare(b));
    expect(opts.kelas).toEqual(sorted);
  });
});
