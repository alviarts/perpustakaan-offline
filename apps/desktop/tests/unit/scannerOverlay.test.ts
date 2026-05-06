import { describe, expect, it } from 'vitest';
import {
  BRACKET_LENGTH_FRACTION,
  computeCornerBrackets,
  computeRoi,
  ROI_PERCENT,
} from '@/lib/scanner/overlay';

/**
 * The ROI math feeds two consumers — the React overlay div sizing and
 * the canvas crop coordinates handed to zxing. A subtle off-by-one
 * here produces a noticeable visual misalignment and a barely-noticeable
 * decode regression, so unit-test the pure math.
 */
describe('computeRoi', () => {
  it('produces a centered rectangle at 70% × 55% of the video frame', () => {
    const roi = computeRoi(1280, 720);
    expect(roi.width).toBe(896); // round(1280 * 0.7)
    expect(roi.height).toBe(396); // round(720 * 0.55)
    expect(roi.x).toBe(192); // round((1280 - 896) / 2)
    expect(roi.y).toBe(162); // round((720 - 396) / 2)
  });

  it('keeps the rectangle inside the video bounds at common resolutions', () => {
    for (const [w, h] of [
      [640, 480],
      [800, 600],
      [1280, 720],
      [1920, 1080],
      [320, 240],
    ] as const) {
      const roi = computeRoi(w, h);
      expect(roi.x).toBeGreaterThanOrEqual(0);
      expect(roi.y).toBeGreaterThanOrEqual(0);
      expect(roi.x + roi.width).toBeLessThanOrEqual(w);
      expect(roi.y + roi.height).toBeLessThanOrEqual(h);
    }
  });

  it('handles square frames without skewing the aspect', () => {
    const roi = computeRoi(500, 500);
    // width fraction (0.7) is still larger than height fraction (0.55)
    // — the box stays landscape even on square frames.
    expect(roi.width).toBeGreaterThan(roi.height);
  });

  it('returns a zero rectangle for non-positive dimensions instead of throwing', () => {
    expect(computeRoi(0, 720)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computeRoi(1280, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computeRoi(-100, 720)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(computeRoi(NaN, 720)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('exposes the percentage constants for the React overlay div', () => {
    expect(ROI_PERCENT.width).toBeCloseTo(0.7, 5);
    expect(ROI_PERCENT.height).toBeCloseTo(0.55, 5);
  });
});

describe('computeCornerBrackets', () => {
  it('emits 8 line segments — two arms per corner', () => {
    const segs = computeCornerBrackets({ x: 100, y: 50, width: 400, height: 200 });
    expect(segs).toHaveLength(8);
  });

  it('arm length is the bracket fraction of the shorter ROI side', () => {
    const segs = computeCornerBrackets({ x: 0, y: 0, width: 400, height: 200 });
    const expectedArm = 200 * BRACKET_LENGTH_FRACTION;
    // top-left horizontal arm: starts at (0,0), ends at (arm, 0).
    expect(segs[0]).toEqual({ x1: 0, y1: 0, x2: expectedArm, y2: 0 });
    // top-left vertical arm: starts at (0,0), ends at (0, arm).
    expect(segs[1]).toEqual({ x1: 0, y1: 0, x2: 0, y2: expectedArm });
  });

  it('top-right corner has arms pointing inward', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const segs = computeCornerBrackets(rect);
    const arm = 100 * BRACKET_LENGTH_FRACTION;
    // index 2 = top-right horizontal arm pointing left
    expect(segs[2]).toEqual({ x1: 100, y1: 0, x2: 100 - arm, y2: 0 });
    // index 3 = top-right vertical arm pointing down
    expect(segs[3]).toEqual({ x1: 100, y1: 0, x2: 100, y2: arm });
  });

  it('bottom-right and bottom-left corners point inward toward the centre', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const segs = computeCornerBrackets(rect);
    const arm = 100 * BRACKET_LENGTH_FRACTION;
    // bottom-right horizontal: arm points left
    expect(segs[4]).toEqual({ x1: 100, y1: 100, x2: 100 - arm, y2: 100 });
    // bottom-right vertical: arm points up
    expect(segs[5]).toEqual({ x1: 100, y1: 100, x2: 100, y2: 100 - arm });
    // bottom-left horizontal: arm points right
    expect(segs[6]).toEqual({ x1: 0, y1: 100, x2: arm, y2: 100 });
    // bottom-left vertical: arm points up
    expect(segs[7]).toEqual({ x1: 0, y1: 100, x2: 0, y2: 100 - arm });
  });

  it('arm length collapses to 0 for a zero-sized rect', () => {
    const segs = computeCornerBrackets({ x: 50, y: 50, width: 0, height: 0 });
    for (const seg of segs) {
      expect(seg.x1).toBe(50);
      expect(seg.y1).toBe(50);
      expect(seg.x2).toBe(50);
      expect(seg.y2).toBe(50);
    }
  });
});
