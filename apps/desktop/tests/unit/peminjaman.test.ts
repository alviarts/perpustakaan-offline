import { beforeEach, describe, expect, it } from 'vitest';
import { calculateDenda, peminjamanApi } from '@/lib/peminjaman';

describe('calculateDenda', () => {
  it('returns 0 when returned on or before due date', () => {
    expect(calculateDenda('2026-05-10', '2026-05-10')).toEqual({ hariTerlambat: 0, denda: 0 });
    expect(calculateDenda('2026-05-10', '2026-05-08')).toEqual({ hariTerlambat: 0, denda: 0 });
  });

  it('charges per day late at default Rp 500', () => {
    expect(calculateDenda('2026-05-10', '2026-05-13')).toEqual({ hariTerlambat: 3, denda: 1500 });
    expect(calculateDenda('2026-05-10', '2026-05-20')).toEqual({ hariTerlambat: 10, denda: 5000 });
  });

  it('respects custom denda per hari', () => {
    expect(calculateDenda('2026-05-10', '2026-05-15', 1000)).toEqual({
      hariTerlambat: 5,
      denda: 5000,
    });
  });
});

describe('peminjamanApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a peminjaman and surfaces it on list', async () => {
    const detail = await peminjamanApi.create({
      anggotaId: 1,
      bukuIds: [10, 20],
    });
    expect(detail.header.id).toBeDefined();
    expect(detail.items).toHaveLength(2);
    expect(detail.header.status).toBe('dipinjam');

    const list = await peminjamanApi.list({});
    expect(list.total).toBe(1);
    expect(list.items[0]?.anggotaId).toBe(1);
  });

  it('returns items and updates status to dikembalikan when all returned', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10, 20] });
    const result = await peminjamanApi.kembalikan({
      peminjamanId: created.header.id,
      itemIds: created.items.map((i) => i.id),
    });
    expect(result.statusHeader).toBe('dikembalikan');
    expect(result.items.every((i) => i.status === 'dikembalikan')).toBe(true);
  });

  it('flips status to sebagian when partial return', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10, 20] });
    const firstId = created.items[0]?.id;
    if (firstId === undefined) throw new Error('expected at least 1 item');
    const result = await peminjamanApi.kembalikan({
      peminjamanId: created.header.id,
      itemIds: [firstId],
    });
    expect(result.statusHeader).toBe('sebagian');
  });

  it('search returns only active loans', async () => {
    const a = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    const b = await peminjamanApi.create({ anggotaId: 2, bukuIds: [20] });
    await peminjamanApi.kembalikan({
      peminjamanId: a.header.id,
      itemIds: a.items.map((i) => i.id),
    });
    const results = await peminjamanApi.search('');
    expect(results.map((r) => r.id)).toContain(b.header.id);
    expect(results.map((r) => r.id)).not.toContain(a.header.id);
  });

  it('quick stats reflect created loans', async () => {
    await peminjamanApi.create({ anggotaId: 1, bukuIds: [10, 20] });
    const stats = await peminjamanApi.quickStats();
    expect(stats.aktifHariIni).toBeGreaterThanOrEqual(1);
    expect(stats.totalAktif).toBe(2);
  });
});
