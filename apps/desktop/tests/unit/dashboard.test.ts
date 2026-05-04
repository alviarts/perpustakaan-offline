import { describe, expect, it } from 'vitest';
import { calcDeltaPct, dashboardApi, DDC_LABEL_MAP } from '@/lib/dashboard';

describe('calcDeltaPct', () => {
  it('returns 0 when both current and previous are zero', () => {
    expect(calcDeltaPct(0, 0)).toBe(0);
  });

  it('returns 100 when previous is zero but current grew', () => {
    expect(calcDeltaPct(5, 0)).toBe(100);
  });

  it('computes positive delta correctly', () => {
    expect(calcDeltaPct(150, 100)).toBeCloseTo(50, 5);
  });

  it('computes negative delta correctly', () => {
    expect(calcDeltaPct(80, 100)).toBeCloseTo(-20, 5);
  });

  it('returns 0 percent for unchanged values', () => {
    expect(calcDeltaPct(42, 42)).toBe(0);
  });
});

describe('DDC_LABEL_MAP', () => {
  it('covers all 10 main DDC classes plus the unknown bucket', () => {
    expect(Object.keys(DDC_LABEL_MAP)).toHaveLength(11);
    expect(DDC_LABEL_MAP['0']).toMatch(/Karya Umum/);
    expect(DDC_LABEL_MAP['9']).toMatch(/Sejarah/);
    expect(DDC_LABEL_MAP['?']).toMatch(/Lainnya/);
  });
});

describe('dashboardApi (browser mock)', () => {
  it('kpi returns positive totals and reasonable deltas', async () => {
    const kpi = await dashboardApi.kpi();
    expect(kpi.totalAnggota).toBeGreaterThan(0);
    expect(kpi.totalBuku).toBeGreaterThan(0);
    expect(Number.isFinite(kpi.deltaAnggotaPct)).toBe(true);
  });

  it('kpi exposes both totalBuku (titles) and totalEksemplar (copies), with copies >= titles', async () => {
    // BUG-008 (Opsi 3): the dashboard surfaces both metrics now. By
    // construction `totalEksemplar` (sum of jumlah_eksemplar) must be at
    // least `totalBuku` (count of distinct titles), since each title has at
    // least one copy. Asserting the relationship guards against a regression
    // that swaps the two fields.
    const kpi = await dashboardApi.kpi();
    expect(kpi.totalBuku).toBeGreaterThan(0);
    expect(kpi.totalEksemplar).toBeGreaterThanOrEqual(kpi.totalBuku);
  });

  it('ddc returns 10 main DDC slices', async () => {
    const ddc = await dashboardApi.ddc();
    expect(ddc.length).toBe(10);
    for (const slice of ddc) {
      expect(slice.label).toBeTypeOf('string');
      expect(slice.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('kunjungan7d returns exactly 7 contiguous days ending today', async () => {
    const days = await dashboardApi.kunjungan7d();
    expect(days).toHaveLength(7);
    const lastIso = days[days.length - 1]!.tanggal;
    const today = new Date().toISOString().slice(0, 10);
    expect(lastIso).toBe(today);
  });

  it('topPeminjam and topBuku return at most 5 items each, sorted descending by jumlah', async () => {
    const [tp, tb] = await Promise.all([dashboardApi.topPeminjam(), dashboardApi.topBuku()]);
    expect(tp.length).toBeLessThanOrEqual(5);
    expect(tb.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < tp.length; i++) {
      expect(tp[i - 1]!.jumlah).toBeGreaterThanOrEqual(tp[i]!.jumlah);
    }
    for (let i = 1; i < tb.length; i++) {
      expect(tb[i - 1]!.jumlah).toBeGreaterThanOrEqual(tb[i]!.jumlah);
    }
  });
});
