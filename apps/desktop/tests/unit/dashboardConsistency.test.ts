import { beforeEach, describe, expect, it } from 'vitest';
import { anggotaApi } from '@/lib/anggota';
import { bukuApi } from '@/lib/buku';
import { dashboardApi } from '@/lib/dashboard';

describe('dashboard KPI consistency (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.removeItem('po:anggota-mock');
    window.localStorage.removeItem('po:buku-mock');
    window.localStorage.removeItem('po:peminjaman-mock');
  });

  it('total anggota follows the actual anggota list, not a hardcoded demo number', async () => {
    // Backend KPI menghitung anggota aktif (aktif = 1), bukan semua baris.
    const list = await anggotaApi.list({ aktif: true });
    const kpi = await dashboardApi.kpi();
    expect(kpi.totalAnggota).toBe(list.total);
    expect(kpi.totalAnggota).not.toBe(128);
  });

  it('total anggota increases when a member is added', async () => {
    const before = await dashboardApi.kpi();
    await anggotaApi.create({ kodeAnggota: 'KPI-1', nama: 'Anggota KPI', aktif: true });
    const after = await dashboardApi.kpi();
    expect(after.totalAnggota).toBe(before.totalAnggota + 1);
  });

  it('total buku and eksemplar follow the actual buku list', async () => {
    const list = await bukuApi.list({ limit: 10_000 });
    const kpi = await dashboardApi.kpi();
    expect(kpi.totalBuku).toBe(list.total);
    expect(kpi.totalEksemplar).toBe(
      list.items.reduce((sum, b) => sum + (b.jumlahEksemplar ?? 0), 0),
    );
  });
});
