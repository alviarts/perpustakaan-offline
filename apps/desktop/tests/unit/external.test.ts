import { describe, expect, it } from 'vitest';
import { buildCoverSearchUrl } from '@/lib/external';

describe('buildCoverSearchUrl', () => {
  it('builds a Google Images search URL with title, author and ISBN', () => {
    const url = buildCoverSearchUrl({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      isbn: '9789793062792',
    });
    expect(url.startsWith('https://www.google.com/search?tbm=isch&q=')).toBe(true);
    const q = decodeURIComponent(url.split('&q=')[1] ?? '');
    expect(q).toContain('book cover');
    expect(q).toContain('"Laskar Pelangi"');
    expect(q).toContain('Andrea Hirata');
    expect(q).toContain('9789793062792');
  });

  it('works with only a title', () => {
    const url = buildCoverSearchUrl({ judul: 'Bumi Manusia' });
    const q = decodeURIComponent(url.split('&q=')[1] ?? '');
    expect(q).toBe('book cover "Bumi Manusia"');
  });

  it('encodes special characters', () => {
    const url = buildCoverSearchUrl({ judul: 'A & B: C++' });
    expect(url).not.toContain(' ');
    expect(url).not.toContain('"A & B');
  });
});
