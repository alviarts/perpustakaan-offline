import { beforeEach, describe, expect, it } from 'vitest';
import { kunjunganApi, kunjunganDayDiff, rangeForPreset } from '@/lib/kunjungan';

describe('rangeForPreset', () => {
  it('today returns from === to', () => {
    const r = rangeForPreset('today');
    expect(r.from).toBe(r.to);
  });

  it('week returns 7-day window ending today', () => {
    const r = rangeForPreset('week');
    expect(kunjunganDayDiff(r.to, r.from)).toBe(6);
  });

  it('month range starts at day 01 of current month', () => {
    const r = rangeForPreset('month');
    expect(r.from.endsWith('-01')).toBe(true);
  });

  it('year range starts at January 1st', () => {
    const r = rangeForPreset('year');
    expect(r.from.endsWith('-01-01')).toBe(true);
  });
});

describe('kunjunganApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty and increments after create', async () => {
    const before = await kunjunganApi.list({});
    expect(before.total).toBe(0);

    await kunjunganApi.create({ keperluan: 'Membaca' });
    const after = await kunjunganApi.list({});
    expect(after.total).toBe(1);
    expect(after.items[0]?.sumber).toBe('manual');
  });

  it('quickStats reflects today + total', async () => {
    await kunjunganApi.create({ keperluan: 'Membaca' });
    await kunjunganApi.create({ anggotaId: 1, keperluan: 'Pinjam Buku' });
    const stats = await kunjunganApi.quickStats();
    expect(stats.hariIni).toBe(2);
    expect(stats.total).toBe(2);
  });

  it('search filters by query', async () => {
    await kunjunganApi.create({ anggotaId: 7, keperluan: 'Tugas' });
    await kunjunganApi.create({ anggotaId: 8, keperluan: 'Membaca' });
    const matches = await kunjunganApi.list({ query: 'tugas' });
    expect(matches.total).toBe(1);
    expect(matches.items[0]?.keperluan).toBe('Tugas');
  });

  it('remove deletes a row', async () => {
    const created = await kunjunganApi.create({ keperluan: 'Membaca' });
    await kunjunganApi.remove(created.id);
    const after = await kunjunganApi.list({});
    expect(after.total).toBe(0);
  });
});
