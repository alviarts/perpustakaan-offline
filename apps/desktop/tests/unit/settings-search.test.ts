import { describe, expect, it } from 'vitest';
import { SECTIONS, filterSections, type SectionWithLabel } from '../../src/features/settings/sections';

const labelled: SectionWithLabel[] = SECTIONS.map((s) => ({
  ...s,
  // Use the curated keywords as the label/summary for unit testing so the test
  // doesn't depend on the i18n bundle being initialized.
  label: s.id,
  summary: s.keywords.join(' '),
}));

describe('settings search filter', () => {
  it('returns all sections when query is empty', () => {
    expect(filterSections(labelled, '')).toHaveLength(labelled.length);
    expect(filterSections(labelled, '   ')).toHaveLength(labelled.length);
  });

  it('matches "denda" only against Aturan Peminjaman', () => {
    const result = filterSections(labelled, 'denda').map((s) => s.id);
    expect(result).toEqual(['aturan-peminjaman']);
  });

  it('matches "ddc" only against Master Data', () => {
    const result = filterSections(labelled, 'ddc').map((s) => s.id);
    expect(result).toEqual(['master-data']);
  });

  it('case-insensitive: "TEMA" matches Tampilan', () => {
    const result = filterSections(labelled, 'TEMA').map((s) => s.id);
    expect(result).toContain('tampilan');
  });

  it('"sync" matches Sinkronisasi', () => {
    const result = filterSections(labelled, 'sync').map((s) => s.id);
    expect(result).toEqual(['sinkronisasi']);
  });

  it('"manual" matches Tentang', () => {
    const result = filterSections(labelled, 'manual').map((s) => s.id);
    expect(result).toEqual(['tentang']);
  });

  it('returns empty list for nonsense', () => {
    expect(filterSections(labelled, 'qqqzzz123')).toEqual([]);
  });

  it('preserves original order', () => {
    const result = filterSections(labelled, '').map((s) => s.id);
    expect(result).toEqual(labelled.map((s) => s.id));
  });
});
