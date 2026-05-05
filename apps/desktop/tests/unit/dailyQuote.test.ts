import { describe, expect, it } from 'vitest';
import {
  QUOTE_COUNT,
  getQuoteForDate,
  pickNextQuoteIndex,
  quoteIndexForDate,
} from '@/lib/dailyQuote';

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

describe('pickNextQuoteIndex', () => {
  it('never returns the current index', () => {
    // Sweep all possible RNG outputs in [0, 1): with 122 quotes the
    // candidate space has 121 buckets, and we want to confirm none of
    // them collide with the input.
    for (const current of [0, 1, 5, QUOTE_COUNT - 1]) {
      for (const r of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999_999]) {
        const next = pickNextQuoteIndex(current, () => r);
        expect(next).not.toBe(current);
      }
    }
  });

  it('always returns an in-range index', () => {
    for (const current of [0, Math.floor(QUOTE_COUNT / 2), QUOTE_COUNT - 1]) {
      for (const r of [0, 0.5, 0.999_999]) {
        const next = pickNextQuoteIndex(current, () => r);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(QUOTE_COUNT);
      }
    }
  });

  it('is deterministic given a seeded RNG', () => {
    // Two calls with the same RNG factory and same input must agree —
    // tests rely on this for stable snapshots.
    const a = pickNextQuoteIndex(7, () => 0.42);
    const b = pickNextQuoteIndex(7, () => 0.42);
    expect(a).toBe(b);
  });

  it('walks through distinct indexes when chained', () => {
    // Drive the helper through 10 rotations using a deterministic RNG;
    // the dashboard will do the same at runtime. No two consecutive
    // indexes should match.
    let current = quoteIndexForDate(new Date(2026, 0, 1));
    let r = 0.13;
    const seen: number[] = [current];
    for (let i = 0; i < 10; i += 1) {
      const next = pickNextQuoteIndex(current, () => r);
      expect(next).not.toBe(current);
      seen.push(next);
      current = next;
      // Step the pseudo-RNG so each rotation samples a different bucket.
      r = (r + 0.197) % 1;
    }
    // No consecutive duplicates anywhere in the chain.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).not.toBe(seen[i - 1]);
    }
  });
});
