import { describe, expect, it } from 'vitest';
import { __makeMockBukuPilihanApi, MAX_ACTIVE_PINS } from '@/lib/bukuPilihan';

describe('bukuPilihanApi (mock)', () => {
  it('listActive filters out expired pins', async () => {
    const api = __makeMockBukuPilihanApi();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await api.pin({ bukuId: 1, expiresAt: past });
    await api.pin({ bukuId: 2, expiresAt: future });
    await api.pin({ bukuId: 3, expiresAt: null });

    const active = await api.listActive();
    const ids = active.map((s) => s.bukuId).sort();
    expect(ids).toEqual([2, 3]);
  });

  it(`pin rejects when ${MAX_ACTIVE_PINS} pins are already active`, async () => {
    const api = __makeMockBukuPilihanApi();
    for (let i = 1; i <= MAX_ACTIVE_PINS; i++) {
      await api.pin({ bukuId: i });
    }
    await expect(api.pin({ bukuId: 99 })).rejects.toThrow(
      /Maksimum.*aktif/i,
    );
  });

  it('reorder updates positions deterministically', async () => {
    const api = __makeMockBukuPilihanApi();
    const a = await api.pin({ bukuId: 1 });
    const b = await api.pin({ bukuId: 2 });
    const c = await api.pin({ bukuId: 3 });
    await api.reorder([c.id, a.id, b.id]);
    const list = await api.listActive();
    expect(list.map((s) => s.bukuId)).toEqual([3, 1, 2]);
  });

  it('unpin removes the slide and frees the cap slot', async () => {
    const api = __makeMockBukuPilihanApi();
    for (let i = 1; i <= MAX_ACTIVE_PINS; i++) {
      await api.pin({ bukuId: i });
    }
    const list = await api.listActive();
    expect(list[0]).toBeDefined();
    await api.unpin(list[0]!.id);
    // Now we should be able to pin again.
    await expect(api.pin({ bukuId: 99 })).resolves.toBeDefined();
  });
});
