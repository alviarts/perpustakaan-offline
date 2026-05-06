import { beforeEach, describe, expect, it } from 'vitest';
import {
  expiredAtCountdownDays,
  reservasiApi,
  reservasiSlotLabel,
} from '@/lib/reservasi';

describe('reservasiApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a reservasi with urutan=1 for the first anggota', async () => {
    const row = await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    expect(row.urutan).toBe(1);
    expect(row.status).toBe('menunggu');
    expect(row.bukuId).toBe(10);
  });

  it('increments urutan for subsequent anggota on same buku', async () => {
    await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    const second = await reservasiApi.create({ anggotaId: 2, bukuId: 10 });
    const third = await reservasiApi.create({ anggotaId: 3, bukuId: 10 });
    expect(second.urutan).toBe(2);
    expect(third.urutan).toBe(3);
  });

  it('keeps urutan independent across different buku', async () => {
    const a = await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    const b = await reservasiApi.create({ anggotaId: 1, bukuId: 11 });
    expect(a.urutan).toBe(1);
    expect(b.urutan).toBe(1);
  });

  it('rejects duplicate active reservasi for same anggota+buku', async () => {
    await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    await expect(
      reservasiApi.create({ anggotaId: 1, bukuId: 10 }),
    ).rejects.toThrow();
  });

  it('cancel transitions menunggu → dibatalkan', async () => {
    const row = await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    await reservasiApi.cancel(row.id);
    const active = await reservasiApi.listActive();
    expect(active.find((r) => r.id === row.id)).toBeUndefined();
  });

  it('listActive returns only menunggu | siap_diambil', async () => {
    const a = await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    await reservasiApi.create({ anggotaId: 2, bukuId: 10 });
    await reservasiApi.cancel(a.id);
    const active = await reservasiApi.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.anggotaId).toBe(2);
  });

  it('listByAnggota returns reservasi for the anggota in newest-first order', async () => {
    await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    await reservasiApi.create({ anggotaId: 1, bukuId: 11 });
    const list = await reservasiApi.listByAnggota(1);
    expect(list).toHaveLength(2);
    expect(list[0]?.bukuId).toBe(11);
  });

  it('checkExpiredTick is idempotent on a fresh queue', async () => {
    await reservasiApi.create({ anggotaId: 1, bukuId: 10 });
    const first = await reservasiApi.checkExpiredTick();
    const second = await reservasiApi.checkExpiredTick();
    expect(first).toBe(0);
    expect(second).toBe(0);
  });
});

describe('expiredAtCountdownDays', () => {
  it('returns null when expiredAt is missing', () => {
    expect(expiredAtCountdownDays(null)).toBeNull();
    expect(expiredAtCountdownDays(undefined)).toBeNull();
  });

  it('returns 0 when expiredAt is today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(expiredAtCountdownDays(today)).toBe(0);
  });

  it('returns negative for past dates', () => {
    expect(expiredAtCountdownDays('2020-01-01')).toBeLessThan(0);
  });
});

describe('reservasiSlotLabel', () => {
  it('formats id as zero-padded R-NNNN slot', () => {
    expect(reservasiSlotLabel(1)).toBe('R-0001');
    expect(reservasiSlotLabel(42)).toBe('R-0042');
    expect(reservasiSlotLabel(9999)).toBe('R-9999');
  });
});
