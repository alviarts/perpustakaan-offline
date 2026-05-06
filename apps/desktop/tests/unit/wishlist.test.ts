import { beforeEach, describe, expect, it } from 'vitest';

import {
  canTransition,
  WISHLIST_STATUSES,
  wishlistApi,
  type WishlistStatus,
} from '@/lib/wishlist';

describe('wishlist canTransition', () => {
  const allowed: Array<[WishlistStatus, WishlistStatus]> = [
    ['pending', 'disetujui'],
    ['pending', 'ditolak'],
    ['pending', 'dibatalkan'],
    ['disetujui', 'sudah_diadakan'],
    ['disetujui', 'dibatalkan'],
    ['ditolak', 'pending'],
    ['dibatalkan', 'pending'],
  ];

  for (const [from, to] of allowed) {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }

  const forbidden: Array<[WishlistStatus, WishlistStatus]> = [
    ['pending', 'sudah_diadakan'],
    ['ditolak', 'disetujui'],
    ['ditolak', 'sudah_diadakan'],
    ['sudah_diadakan', 'pending'],
    ['sudah_diadakan', 'disetujui'],
    ['sudah_diadakan', 'ditolak'],
  ];

  for (const [from, to] of forbidden) {
    it(`forbids ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  }

  it('treats every status as idempotent (self → self allowed)', () => {
    for (const s of WISHLIST_STATUSES) {
      expect(canTransition(s, s)).toBe(true);
    }
  });
});

describe('wishlistApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a row with status=pending and upvoteCount=1', async () => {
    const row = await wishlistApi.create({
      anggotaId: 7,
      judul: 'Atomic Habits',
      pengarang: 'James Clear',
    });
    expect(row.status).toBe('pending');
    expect(row.upvoteCount).toBe(1);
    expect(row.judul).toBe('Atomic Habits');
    expect(row.pengarang).toBe('James Clear');
    expect(row.anggotaId).toBe(7);
  });

  it('lists rows ordered by upvoteCount desc, id desc', async () => {
    const a = await wishlistApi.create({ anggotaId: 1, judul: 'A' });
    const b = await wishlistApi.create({ anggotaId: 1, judul: 'B' });
    await wishlistApi.upvote(a.id);
    await wishlistApi.upvote(a.id);
    const list = await wishlistApi.list();
    expect(list.map((r) => r.judul)).toEqual(['A', 'B']);
    expect(list[0]?.upvoteCount).toBe(3);
    expect(list[1]?.id).toBe(b.id);
  });

  it('filters list by status', async () => {
    const a = await wishlistApi.create({ anggotaId: 1, judul: 'A' });
    await wishlistApi.create({ anggotaId: 1, judul: 'B' });
    await wishlistApi.updateStatus({ id: a.id, status: 'disetujui' });
    const pending = await wishlistApi.list({ status: 'pending' });
    expect(pending.map((r) => r.judul)).toEqual(['B']);
    const approved = await wishlistApi.list({ status: 'disetujui' });
    expect(approved.map((r) => r.judul)).toEqual(['A']);
  });

  it('rejects forbidden status transitions', async () => {
    const row = await wishlistApi.create({ anggotaId: 1, judul: 'A' });
    await expect(
      wishlistApi.updateStatus({ id: row.id, status: 'sudah_diadakan' }),
    ).rejects.toThrow(/transisi/);
  });

  it('upvote increments and delete removes the row', async () => {
    const row = await wishlistApi.create({ anggotaId: 1, judul: 'A' });
    const after = await wishlistApi.upvote(row.id);
    expect(after.upvoteCount).toBe(2);
    await wishlistApi.delete(row.id);
    const list = await wishlistApi.list();
    expect(list).toEqual([]);
  });
});
