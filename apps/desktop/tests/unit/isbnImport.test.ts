import { describe, expect, it } from 'vitest';
import { bukuIsbnApi, metadataToImportItem, type IsbnMetadata } from '@/lib/buku';
import { parseIsbnList } from '@/features/buku/IsbnImportDialog';

describe('parseIsbnList (FEAT-20)', () => {
  it('splits on whitespace, commas and semicolons', () => {
    const out = parseIsbnList('9780140449136 9786020385945, 9780747532699; 9780451526342');
    expect(out).toEqual([
      '9780140449136',
      '9786020385945',
      '9780747532699',
      '9780451526342',
    ]);
  });

  it('splits on newlines and trims tokens', () => {
    const out = parseIsbnList('  9780140449136\n   9786020385945  \n\n');
    expect(out).toEqual(['9780140449136', '9786020385945']);
  });

  it('dedupes case-insensitively', () => {
    const out = parseIsbnList('978014044913X\n978014044913x\n9780140449136');
    expect(out).toEqual(['978014044913X', '9780140449136']);
  });

  it('returns an empty list for whitespace-only input', () => {
    expect(parseIsbnList('   \n\n , ;')).toEqual([]);
  });
});

describe('bukuIsbnApi (browser fallback)', () => {
  it('returns deterministic mock metadata for valid ISBNs', async () => {
    const result = await bukuIsbnApi.lookupBatch(['9780140449136']);
    expect(result).toHaveLength(1);
    expect(result[0]?.metadata?.judul).toContain('9780140449136');
    expect(result[0]?.error).toBeNull();
  });

  it('reports an error for an obviously invalid ISBN', async () => {
    const result = await bukuIsbnApi.lookupBatch(['not-an-isbn']);
    expect(result[0]?.metadata).toBeNull();
    expect(result[0]?.error).toMatch(/tidak valid/i);
  });
});

describe('metadataToImportItem (FEAT-20)', () => {
  const meta: IsbnMetadata = {
    isbn: '9780140449136',
    judul: 'War and Peace',
    pengarang: 'Leo Tolstoy',
    penerbit: 'Penguin Classics',
    tahunTerbit: 2007,
    kategori: null,
    bahasa: 'en',
    coverUrl: null,
    source: 'open_library',
  };

  it('builds a BukuImportItem with the supplied kodeBuku', () => {
    const item = metadataToImportItem(meta, 'B-12345');
    expect(item).not.toBeNull();
    expect(item?.kodeBuku).toBe('B-12345');
    expect(item?.judul).toBe('War and Peace');
    expect(item?.isbn).toBe('9780140449136');
    expect(item?.jumlahEksemplar).toBe(1);
  });

  it('returns null when judul is missing', () => {
    const item = metadataToImportItem({ ...meta, judul: '   ' }, 'B-X');
    expect(item).toBeNull();
  });

  it('trims kodeBuku before storing', () => {
    const item = metadataToImportItem(meta, '   B-99   ');
    expect(item?.kodeBuku).toBe('B-99');
  });
});
