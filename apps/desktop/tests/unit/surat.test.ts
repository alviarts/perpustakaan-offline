import { beforeEach, describe, expect, it } from 'vitest';

import { fillSuratTemplate, previewNomor, suratApi } from '@/lib/surat';

describe('previewNomor', () => {
  it('substitutes tahun, bulan, and zero-padded nomor', () => {
    expect(previewNomor('{tahun}/{bulan}/SBP-{nomor:04d}', 2026, 5, 12)).toBe(
      '2026/05/SBP-0012',
    );
  });

  it('supports unpadded {nomor} placeholder', () => {
    expect(previewNomor('SBP-{nomor}', 2026, 5, 7)).toBe('SBP-7');
  });

  it('pads month to 2 digits', () => {
    expect(previewNomor('{tahun}-{bulan}', 2026, 1, 1)).toBe('2026-01');
  });
});

describe('fillSuratTemplate', () => {
  it('replaces placeholders with values', () => {
    const out = fillSuratTemplate(
      'Nama: {nama}\nKelas: {kelas}\nTanggal: {tanggal}',
      { nama: 'Adi', kelas: 'XII-A', tanggal: '2026-05-06' },
    );
    expect(out).toBe('Nama: Adi\nKelas: XII-A\nTanggal: 2026-05-06');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(fillSuratTemplate('Hello {missing}', {})).toBe('Hello {missing}');
  });
});

describe('suratApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('always reports eligible in the mock', async () => {
    const elig = await suratApi.checkEligibility(42);
    expect(elig.eligible).toBe(true);
    expect(elig.anggotaId).toBe(42);
    expect(elig.activeLoans).toBe(0);
    expect(elig.outstandingDenda).toBe(0);
  });

  it('generates sequential nomor surat across calls', async () => {
    const first = await suratApi.generate(1);
    const second = await suratApi.generate(1);
    expect(first.nomorSurat).toMatch(/SBP-0001$/);
    expect(second.nomorSurat).toMatch(/SBP-0002$/);
    expect(second.nomorTerakhir).toBe(2);
  });

  it('logList returns rows in reverse-chronological order and respects limit', async () => {
    await suratApi.generate(1);
    await suratApi.generate(2);
    await suratApi.generate(3);
    const all = await suratApi.logList();
    expect(all.map((r) => r.anggotaId)).toEqual([3, 2, 1]);
    const limited = await suratApi.logList({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('logList filters by anggotaId', async () => {
    await suratApi.generate(10);
    await suratApi.generate(20);
    await suratApi.generate(10);
    const filtered = await suratApi.logList({ anggotaId: 10 });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.anggotaId === 10)).toBe(true);
  });
});
