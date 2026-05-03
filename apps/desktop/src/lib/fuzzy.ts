/**
 * Lightweight fuzzy matcher for autocomplete (revisi #20). Returns a score in
 * `[0, 1]` where 1 is an exact substring match and 0 means no match. Designed
 * to be cheap enough for live filtering of a few hundred items per keystroke.
 */
export function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 1;
  if (h.startsWith(n)) return 0.95;
  const idx = h.indexOf(n);
  if (idx >= 0) {
    return 0.8 - (idx / Math.max(h.length, 1)) * 0.2;
  }

  // Subsequence match: each needle char must appear in order in haystack.
  let hi = 0;
  let matched = 0;
  for (let ni = 0; ni < n.length; ni += 1) {
    while (hi < h.length && h[hi] !== n[ni]) hi += 1;
    if (hi >= h.length) return 0;
    matched += 1;
    hi += 1;
  }
  if (matched === n.length) {
    return 0.4 + (matched / Math.max(h.length, 1)) * 0.3;
  }
  return 0;
}

export interface FuzzySearchInput<T> {
  items: readonly T[];
  query: string;
  /** Fields used to compute the score. Best score across fields wins. */
  fields: readonly ((item: T) => string | null | undefined)[];
  /** Minimum score required to keep an item. Defaults to 0.001. */
  threshold?: number;
  /** Cap on the number of results. Defaults to 50. */
  limit?: number;
}

export function fuzzySearch<T>({
  items,
  query,
  fields,
  threshold = 0.001,
  limit = 50,
}: FuzzySearchInput<T>): T[] {
  if (!query.trim()) return items.slice(0, limit);
  const scored = items
    .map((item) => {
      let best = 0;
      for (const get of fields) {
        const value = get(item);
        if (!value) continue;
        const s = fuzzyScore(value, query);
        if (s > best) best = s;
      }
      return { item, score: best };
    })
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
  return scored;
}
