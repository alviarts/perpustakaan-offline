import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isTerminal,
  progressPercent,
  stocktakeApi,
  type StocktakeSessionRow,
} from '@/lib/stocktake';

const STORAGE_KEY = 'stocktake.mock.v1';

describe('stocktakeApi (browser mock)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('starts a session and seeds belum_scan items for every eksemplar in the pool', async () => {
    const session = await stocktakeApi.start({ nama: 'Opname Awal' });
    expect(session.status).toBe('berlangsung');
    expect(session.total).toBe(3);
    expect(session.ditemukan).toBe(0);
    expect(session.missing).toBe(3);

    const items = await stocktakeApi.itemList({ sessionId: session.id });
    expect(items).toHaveLength(3);
    for (const i of items) {
      expect(i.status).toBe('belum_scan');
      expect(i.tanggalScan).toBeFalsy();
    }
  });

  it('list orders newest sessions first', async () => {
    const a = await stocktakeApi.start({ nama: 'First' });
    const b = await stocktakeApi.start({ nama: 'Second' });
    const sessions = await stocktakeApi.sessionList();
    expect(sessions[0]?.id).toBe(b.id);
    expect(sessions[1]?.id).toBe(a.id);
  });

  it('scan flips belum_scan -> ditemukan and updates session counters', async () => {
    const session = await stocktakeApi.start({});
    const result = await stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' });
    expect(result.alreadyScanned).toBe(false);
    expect(result.item.status).toBe('ditemukan');
    expect(result.session.ditemukan).toBe(1);
    expect(result.session.missing).toBe(2);
  });

  it('scan twice returns alreadyScanned=true and does not double-count', async () => {
    const session = await stocktakeApi.start({});
    await stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' });
    const second = await stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' });
    expect(second.alreadyScanned).toBe(true);
    expect(second.session.ditemukan).toBe(1);
  });

  it('scan rejects unknown kode', async () => {
    const session = await stocktakeApi.start({});
    await expect(
      stocktakeApi.scan({ sessionId: session.id, kode: 'TIDAK-ADA' }),
    ).rejects.toThrow(/tidak ditemukan/i);
  });

  it('scan rejects empty kode', async () => {
    const session = await stocktakeApi.start({});
    await expect(stocktakeApi.scan({ sessionId: session.id, kode: '   ' })).rejects.toThrow(
      /kosong/i,
    );
  });

  it('scan blocked once session is finished', async () => {
    const session = await stocktakeApi.start({});
    await stocktakeApi.finish({ sessionId: session.id, status: 'selesai' });
    await expect(
      stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' }),
    ).rejects.toThrow(/tidak bisa scan/i);
  });

  it('finish flips remaining belum_scan rows to tidak_ditemukan', async () => {
    const session = await stocktakeApi.start({});
    await stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' });
    const finished = await stocktakeApi.finish({ sessionId: session.id, status: 'selesai' });
    expect(finished.status).toBe('selesai');
    expect(finished.tanggalSelesai).toBeTruthy();

    const missing = await stocktakeApi.itemList({
      sessionId: session.id,
      status: 'tidak_ditemukan',
    });
    expect(missing).toHaveLength(2);
  });

  it('cancel keeps already-scanned items but does not flip remaining', async () => {
    const session = await stocktakeApi.start({});
    await stocktakeApi.scan({ sessionId: session.id, kode: 'B0001-01' });
    await stocktakeApi.finish({ sessionId: session.id, status: 'dibatalkan' });
    const stillBelum = await stocktakeApi.itemList({
      sessionId: session.id,
      status: 'belum_scan',
    });
    expect(stillBelum).toHaveLength(2);
    const ditemukan = await stocktakeApi.itemList({
      sessionId: session.id,
      status: 'ditemukan',
    });
    expect(ditemukan).toHaveLength(1);
  });

  it('itemList filters by query across kode and judul', async () => {
    const session = await stocktakeApi.start({});
    const byKode = await stocktakeApi.itemList({ sessionId: session.id, query: 'B0001' });
    expect(byKode.every((i) => i.eksemplarKode.includes('B0001'))).toBe(true);
    const byJudul = await stocktakeApi.itemList({ sessionId: session.id, query: 'bumi' });
    expect(byJudul).toHaveLength(1);
    expect(byJudul[0]?.bukuJudul.toLowerCase()).toContain('bumi');
  });

  it('delete cascades — items removed alongside the session', async () => {
    const a = await stocktakeApi.start({});
    const b = await stocktakeApi.start({});
    await stocktakeApi.delete(a.id);
    const remaining = await stocktakeApi.sessionList();
    expect(remaining.map((s) => s.id)).toEqual([b.id]);
    const items = await stocktakeApi.itemList({ sessionId: a.id });
    expect(items).toHaveLength(0);
  });

  it('parallel sessions are isolated', async () => {
    const a = await stocktakeApi.start({});
    const b = await stocktakeApi.start({});
    await stocktakeApi.scan({ sessionId: a.id, kode: 'B0001-01' });
    const aRow = await stocktakeApi.sessionGet(a.id);
    const bRow = await stocktakeApi.sessionGet(b.id);
    expect(aRow.ditemukan).toBe(1);
    expect(bRow.ditemukan).toBe(0);
  });
});

describe('stocktake helpers', () => {
  it('progressPercent returns 0 when total is zero', () => {
    const session: Pick<StocktakeSessionRow, 'total' | 'ditemukan'> = {
      total: 0,
      ditemukan: 0,
    };
    expect(progressPercent(session)).toBe(0);
  });

  it('progressPercent rounds to nearest integer', () => {
    expect(progressPercent({ total: 3, ditemukan: 1 })).toBe(33);
    expect(progressPercent({ total: 3, ditemukan: 2 })).toBe(67);
    expect(progressPercent({ total: 4, ditemukan: 4 })).toBe(100);
  });

  it('isTerminal recognises selesai + dibatalkan', () => {
    expect(isTerminal('berlangsung')).toBe(false);
    expect(isTerminal('selesai')).toBe(true);
    expect(isTerminal('dibatalkan')).toBe(true);
  });
});
