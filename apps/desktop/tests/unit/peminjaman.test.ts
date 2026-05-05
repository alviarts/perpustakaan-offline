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

  it('initializes kaliPerpanjangan=0 on create', async () => {
    const detail = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    expect(detail.header.kaliPerpanjangan).toBe(0);
    expect(detail.header.tanggalPerpanjanganTerakhir ?? null).toBeNull();
  });

  it('extends tanggalJatuhTempo by N days and increments kaliPerpanjangan', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    const oldJt = created.header.tanggalJatuhTempo;
    const result = await peminjamanApi.perpanjang({
      peminjamanId: created.header.id,
      days: 5,
    });
    expect(result.kaliPerpanjangan).toBe(1);
    expect(result.tanggalJatuhTempoLama).toBe(oldJt);
    expect(result.tanggalJatuhTempoBaru).not.toBe(oldJt);
    const oldT = new Date(oldJt + 'T00:00:00Z').getTime();
    const newT = new Date(result.tanggalJatuhTempoBaru + 'T00:00:00Z').getTime();
    expect((newT - oldT) / 86_400_000).toBe(5);
    expect(result.header.kaliPerpanjangan).toBe(1);
  });

  it('rejects perpanjang once max reached', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    await peminjamanApi.perpanjang({ peminjamanId: created.header.id });
    await expect(
      peminjamanApi.perpanjang({ peminjamanId: created.header.id }),
    ).rejects.toThrow(/maksimum/i);
  });

  it('rejects perpanjang for already-returned peminjaman', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    await peminjamanApi.kembalikan({
      peminjamanId: created.header.id,
      itemIds: created.items.map((i) => i.id),
    });
    await expect(
      peminjamanApi.perpanjang({ peminjamanId: created.header.id }),
    ).rejects.toThrow();
  });

  it('return result includes empty reservasiPromoted by default', async () => {
    const created = await peminjamanApi.create({ anggotaId: 1, bukuIds: [10] });
    const result = await peminjamanApi.kembalikan({
      peminjamanId: created.header.id,
      itemIds: created.items.map((i) => i.id),
    });
    expect(result.reservasiPromoted).toEqual([]);
  });
});
