import { describe, expect, it } from 'vitest';
import { QUOTE_COUNT, getQuoteForDate, quoteIndexForDate } from '@/lib/dailyQuote';

describe('dailyQuote', () => {
  it('bundles a non-trivial number of quotes', () => {
    expect(QUOTE_COUNT).toBeGreaterThanOrEqual(60);
  });

  it('returns the same quote for the same date', () => {
    const a = getQuoteForDate(new Date(2026, 4, 4));
    const b = getQuoteForDate(new Date(2026, 4, 4, 23, 59, 59));
    expect(a).toEqual(b);
  });

  it('returns a different quote on the next day in most cases', () => {
    // QUOTES.length is small enough that consecutive days are statistically
    // very unlikely to collide; the seed shifts by exactly 1 each day so a
    // collision would require QUOTES.length === 1, which we already
    // assert is false above.
    const today = getQuoteForDate(new Date(2026, 4, 4));
    const tomorrow = getQuoteForDate(new Date(2026, 4, 5));
    expect(today).not.toEqual(tomorrow);
  });

  it('returns a quote with non-empty text and author', () => {
    const q = getQuoteForDate(new Date(2026, 0, 1));
    expect(q.text.length).toBeGreaterThan(0);
    expect(q.author.length).toBeGreaterThan(0);
  });

  it('handles year boundary deterministically', () => {
    const dec31 = quoteIndexForDate(new Date(2026, 11, 31));
    const jan1 = quoteIndexForDate(new Date(2027, 0, 1));
    expect(dec31).toBeGreaterThanOrEqual(0);
    expect(jan1).toBeGreaterThanOrEqual(0);
    expect(dec31).toBeLessThan(QUOTE_COUNT);
    expect(jan1).toBeLessThan(QUOTE_COUNT);
  });

  it('rotates across years for the same calendar day', () => {
    // Different years should generally produce different indexes for the
    // same dayOfYear, because the seed factors in the year.
    const a = quoteIndexForDate(new Date(2026, 5, 15));
    const b = quoteIndexForDate(new Date(2027, 5, 15));
    // Not strictly guaranteed if 367 % QUOTE_COUNT === 0, so guard against it.
    if (367 % QUOTE_COUNT !== 0) {
      expect(a).not.toEqual(b);
    }
  });
});
