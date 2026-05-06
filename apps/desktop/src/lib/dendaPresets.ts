/**
 * Quick-pick "Bayar Denda" preset buttons shared between Pengembalian
 * (full-return flow) and Peminjaman detail (partial inline payment).
 *
 * Two preset sources are merged:
 *
 * 1. Multipliers of the configurable `dendaPerHari` setting (e.g. with
 *    `dendaPerHari = 1500` and multipliers `[1, 2, 3]` the buttons show
 *    `Rp 1.500 / Rp 3.000 / Rp 4.500`).
 * 2. Fixed-rupiah presets (`Rp 5.000 / Rp 10.000 / Rp 15.000`).
 *
 * Without deduplication, the common case `dendaPerHari = 5000` renders
 * the same three values twice (BUG-Pengembalian-DendaDup). This helper
 * collapses overlap and skips zero/negative values so callers can render
 * the result with a single map.
 */

export const DEFAULT_DENDA_QUICK_MULTIPLIERS: readonly number[] = [1, 2, 3];
export const DEFAULT_DENDA_FIXED_PRESETS: readonly number[] = [5000, 10000, 15000];

export type DendaQuickPreset =
  | { kind: 'mult'; mult: number; value: number }
  | { kind: 'fixed'; value: number };

/**
 * Build the deduplicated list of denda quick-pick buttons in render order.
 *
 * - Multiplier buttons come first, in input order; each contributes
 *   `dendaPerHari × multiplier` and is dropped if the value is `<= 0`
 *   (e.g. when `dendaPerHari = 0` because denda is disabled in settings)
 *   or already produced by an earlier multiplier.
 * - Fixed-preset buttons come after; each is dropped if its value is
 *   already covered by a multiplier (or another fixed preset).
 */
export function dendaQuickPresets(
  dendaPerHari: number,
  multipliers: readonly number[] = DEFAULT_DENDA_QUICK_MULTIPLIERS,
  fixed: readonly number[] = DEFAULT_DENDA_FIXED_PRESETS,
): DendaQuickPreset[] {
  const seen = new Set<number>();
  const out: DendaQuickPreset[] = [];
  for (const mult of multipliers) {
    const value = dendaPerHari * mult;
    if (value <= 0 || seen.has(value)) continue;
    seen.add(value);
    out.push({ kind: 'mult', mult, value });
  }
  for (const value of fixed) {
    if (value <= 0 || seen.has(value)) continue;
    seen.add(value);
    out.push({ kind: 'fixed', value });
  }
  return out;
}
