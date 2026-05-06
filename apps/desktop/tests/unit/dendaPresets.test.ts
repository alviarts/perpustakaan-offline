import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DENDA_FIXED_PRESETS,
  DEFAULT_DENDA_QUICK_MULTIPLIERS,
  dendaQuickPresets,
} from '../../src/lib/dendaPresets';

describe('dendaQuickPresets', () => {
  it('collapses overlap when multipliers fully shadow fixed presets', () => {
    // dendaPerHari = 5000, multipliers [1,2,3] → [5000, 10000, 15000]
    // Fixed presets [5000, 10000, 15000] are fully shadowed.
    const buttons = dendaQuickPresets(5000);
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.value)).toEqual([5000, 10000, 15000]);
    expect(buttons.every((b) => b.kind === 'mult')).toBe(true);
  });

  it('renders all six unique buttons when multipliers and fixed presets do not collide', () => {
    // dendaPerHari = 2000, multipliers [1,2,3] → [2000, 4000, 6000]
    // Fixed [5000, 10000, 15000] all unique; expect 6 buttons.
    const buttons = dendaQuickPresets(2000);
    expect(buttons).toHaveLength(6);
    expect(buttons.map((b) => b.value)).toEqual([
      2000,
      4000,
      6000,
      5000,
      10000,
      15000,
    ]);
    expect(buttons.slice(0, 3).every((b) => b.kind === 'mult')).toBe(true);
    expect(buttons.slice(3).every((b) => b.kind === 'fixed')).toBe(true);
  });

  it('hides multiplier section entirely when dendaPerHari is 0', () => {
    // Denda disabled in settings → only fixed presets render.
    const buttons = dendaQuickPresets(0);
    expect(buttons).toHaveLength(3);
    expect(buttons.every((b) => b.kind === 'fixed')).toBe(true);
    expect(buttons.map((b) => b.value)).toEqual([5000, 10000, 15000]);
  });

  it('handles partial overlap (some multipliers collide with fixed presets)', () => {
    // dendaPerHari = 2500, multipliers [1,2,3] → [2500, 5000, 7500]
    // 5000 is shared with fixed presets; expect [2500, 5000, 7500, 10000, 15000].
    const buttons = dendaQuickPresets(2500);
    expect(buttons.map((b) => b.value)).toEqual([2500, 5000, 7500, 10000, 15000]);
    expect(buttons.filter((b) => b.kind === 'mult')).toHaveLength(3);
    expect(buttons.filter((b) => b.kind === 'fixed')).toHaveLength(2);
  });

  it('drops zero/negative multiplier values without leaking fixed presets', () => {
    // dendaPerHari = -100 (defensive). All multiplier values are negative,
    // so they're dropped; the fixed presets fill in.
    const buttons = dendaQuickPresets(-100);
    expect(buttons).toHaveLength(3);
    expect(buttons.every((b) => b.kind === 'fixed')).toBe(true);
  });

  it('respects custom multiplier and fixed-preset arguments', () => {
    const buttons = dendaQuickPresets(1000, [1, 5, 10], [1000, 5000]);
    expect(buttons.map((b) => b.value)).toEqual([1000, 5000, 10000]);
    expect(buttons.map((b) => b.kind)).toEqual(['mult', 'mult', 'mult']);
  });

  it('exposes the documented default constants', () => {
    expect(DEFAULT_DENDA_QUICK_MULTIPLIERS).toEqual([1, 2, 3]);
    expect(DEFAULT_DENDA_FIXED_PRESETS).toEqual([5000, 10000, 15000]);
  });
});
