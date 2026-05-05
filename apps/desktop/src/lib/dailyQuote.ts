import quotesData from '@/content/quotes.json';

export interface Quote {
  text: string;
  author: string;
}

const QUOTES: readonly Quote[] = quotesData;

/** Number of bundled quotes. Exposed so tests can assert "≥ 1". */
export const QUOTE_COUNT = QUOTES.length;

/**
 * Pure deterministic quote selector. Two callers passing the same local date
 * always receive the same quote (modulo `QUOTES.length`), so every operator
 * sees identical text on a given day regardless of network state — that's
 * the whole point of bundling the JSON instead of fetching it.
 *
 * The seed is `(year * 367 + dayOfYear)` rather than just dayOfYear so the
 * quote rotates across years too: same calendar day in different years still
 * produces a different index.
 */
export function quoteIndexForDate(date: Date): number {
  const dayOfYear = computeDayOfYear(date);
  const seed = date.getFullYear() * 367 + dayOfYear;
  // `% QUOTES.length` is safe because QUOTES is non-empty by construction.
  return ((seed % QUOTES.length) + QUOTES.length) % QUOTES.length;
}

export function getQuoteForDate(date: Date): Quote {
  // Cast: `Array.prototype[index]` is `T | undefined`, but the modulo above
  // guarantees a valid index whenever QUOTES is non-empty.
  return QUOTES[quoteIndexForDate(date)] as Quote;
}

/**
 * 1-indexed day-of-year in the date's local calendar (Asia/Jakarta in our
 * deployment). Calculated by walking the local day boundaries — Date.UTC
 * would mis-bucket the last day of the year for users east of UTC.
 */
function computeDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffMs = date.getTime() - start.getTime();
  // Round-trip the diff through 24-hour buckets; DST is irrelevant in
  // Indonesia (no DST) but the rounding is robust against future relocations.
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor(diffMs / dayMs) + 1;
}
