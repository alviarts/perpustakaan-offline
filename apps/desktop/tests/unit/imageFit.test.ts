import { describe, expect, it } from 'vitest';
import { computeContainFit, computeCoverCrop } from '@/lib/imageFit';

describe('computeCoverCrop', () => {
  it('crops horizontal overflow when source is wider than destination', () => {
    // 1280x720 source (16:9) into a 100x100 slot (1:1) → crop sides.
    const crop = computeCoverCrop(1280, 720, 100, 100);
    expect(crop.sw).toBeCloseTo(720, 5);
    expect(crop.sh).toBeCloseTo(720, 5);
    expect(crop.sy).toBe(0);
    expect(crop.sx).toBeCloseTo((1280 - 720) / 2, 5);
  });

  it('crops vertical overflow when source is taller than destination', () => {
    // 600x1200 source (1:2) into a 100x100 slot (1:1) → crop top/bottom.
    const crop = computeCoverCrop(600, 1200, 100, 100);
    expect(crop.sw).toBe(600);
    expect(crop.sh).toBeCloseTo(600, 5);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBeCloseTo(300, 5);
  });

  it('returns the full source rect when source matches destination ratio', () => {
    const crop = computeCoverCrop(800, 600, 200, 150);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBe(0);
    expect(crop.sw).toBe(800);
    expect(crop.sh).toBe(600);
  });

  it('crops a portrait source for a portrait slot when ratios diverge', () => {
    // 600x1000 source (3:5) into a 60x80 slot (3:4) → crop a bit off
    // the top + bottom so the visible area becomes 600×800 (3:4).
    const crop = computeCoverCrop(600, 1000, 60, 80);
    expect(crop.sw).toBe(600);
    expect(crop.sh).toBeCloseTo(800, 5);
    expect(crop.sy).toBeCloseTo(100, 5);
  });

  it('handles degenerate inputs without throwing', () => {
    const crop = computeCoverCrop(0, 100, 50, 50);
    expect(crop.sx).toBe(0);
    expect(crop.sy).toBe(0);
    expect(crop.sw).toBe(0);
    expect(crop.sh).toBe(100);
  });
});

describe('computeContainFit', () => {
  it('letterboxes when source is wider than slot', () => {
    // 1280x720 source (16:9) into a 100x100 slot → fit width, top/bottom margin.
    const fit = computeContainFit(1280, 720, 100, 100);
    expect(fit.dw).toBeCloseTo(100, 5);
    expect(fit.dh).toBeCloseTo(56.25, 4);
    expect(fit.dx).toBe(0);
    expect(fit.dy).toBeCloseTo((100 - 56.25) / 2, 4);
  });

  it('pillarboxes when source is taller than slot', () => {
    // 600x1200 source (1:2) into a 100x100 slot → fit height, side margin.
    const fit = computeContainFit(600, 1200, 100, 100);
    expect(fit.dw).toBeCloseTo(50, 4);
    expect(fit.dh).toBe(100);
    expect(fit.dx).toBeCloseTo(25, 4);
    expect(fit.dy).toBe(0);
  });

  it('fills the slot exactly when source ratio matches destination ratio', () => {
    const fit = computeContainFit(800, 600, 200, 150);
    expect(fit.dx).toBeCloseTo(0, 5);
    expect(fit.dy).toBeCloseTo(0, 5);
    expect(fit.dw).toBeCloseTo(200, 5);
    expect(fit.dh).toBeCloseTo(150, 5);
  });

  it('returns a degenerate full-slot fit on invalid input', () => {
    const fit = computeContainFit(0, 0, 100, 50);
    expect(fit.dx).toBe(0);
    expect(fit.dy).toBe(0);
    expect(fit.dw).toBe(100);
    expect(fit.dh).toBe(50);
  });
});
