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
 * Look up a bundled quote by its position in the pool. Used by the
 * dashboard rotation (FEAT-11) which holds the index in component state
 * and re-renders whenever it changes.
 */
export function getQuoteByIndex(index: number): Quote {
  // Same modulo guard as quoteIndexForDate so out-of-range arguments
  // never throw — the rotation should be best-effort, not crash-prone.
  const safe = ((index % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[safe] as Quote;
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

/**
 * Pick the next quote index for the dashboard rotation, biased so the
 * result is never equal to `currentIndex`. Used by `DashboardPage` to
 * rotate the quote-of-the-day card every 5 minutes (FEAT-11).
 *
 * `rng` is the random source — defaults to `Math.random` but injected by
 * tests for determinism. The returned index is always in `[0, QUOTE_COUNT)`.
 *
 * Edge case: when `QUOTE_COUNT === 1` we have nothing to rotate to, so we
 * return that single index regardless of `currentIndex`. The bundle ships
 * 122 quotes so this branch never trips in practice, but it guards against
 * future refactors that might prune the list.
 */
export function pickNextQuoteIndex(
  currentIndex: number,
  rng: () => number = Math.random,
): number {
  if (QUOTES.length <= 1) return 0;
  // Sample uniformly from the (length-1) candidate indexes that aren't the
  // current one; mapping `pick >= currentIndex → pick + 1` skips it without
  // a rejection loop, so the function always terminates in O(1).
  const pick = Math.floor(rng() * (QUOTES.length - 1));
  return pick >= currentIndex ? pick + 1 : pick;
}
