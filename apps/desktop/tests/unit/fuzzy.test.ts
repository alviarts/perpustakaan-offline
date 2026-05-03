import { describe, expect, it } from 'vitest';
import { fuzzyScore, fuzzySearch } from '@/lib/fuzzy';

describe('fuzzyScore', () => {
  it('returns 1 for empty query', () => {
    expect(fuzzyScore('Andini', '')).toBe(1);
  });

  it('returns 1 for an exact match', () => {
    expect(fuzzyScore('Andini', 'Andini')).toBe(1);
  });

  it('scores prefix matches highest', () => {
    expect(fuzzyScore('Andini Putri', 'and')).toBeGreaterThan(
      fuzzyScore('Bagas Andini', 'and'),
    );
  });

  it('returns 0 when nothing matches', () => {
    expect(fuzzyScore('Andini', 'xyz')).toBe(0);
  });

  it('still matches non-contiguous subsequences', () => {
    expect(fuzzyScore('Bagas Pratama', 'bpr')).toBeGreaterThan(0);
  });
});

describe('fuzzySearch', () => {
  const items = [
    { nama: 'Andini Putri', kode: 'A0001' },
    { nama: 'Bagas Pratama', kode: 'A0002' },
    { nama: 'Citra Lestari', kode: 'A0003' },
  ];

  it('returns all items when query is empty', () => {
    const result = fuzzySearch({
      items,
      query: '',
      fields: [(it) => it.nama],
    });
    expect(result).toHaveLength(3);
  });

  it('ranks the best match first', () => {
    const result = fuzzySearch({
      items,
      query: 'and',
      fields: [(it) => it.nama, (it) => it.kode],
    });
    expect(result[0]?.nama).toBe('Andini Putri');
  });

  it('matches by secondary field (kode)', () => {
    const result = fuzzySearch({
      items,
      query: 'A0002',
      fields: [(it) => it.nama, (it) => it.kode],
    });
    expect(result[0]?.kode).toBe('A0002');
  });

  it('returns empty list when nothing matches', () => {
    const result = fuzzySearch({
      items,
      query: 'zzz',
      fields: [(it) => it.nama],
    });
    expect(result).toEqual([]);
  });
});
