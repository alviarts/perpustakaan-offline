import { describe, expect, it } from 'vitest';
import {
  analyzeImageStats,
  applyAdaptiveThreshold,
  applyContrast,
  applyGamma,
  applyInvert,
  applyPreprocess,
  CONTINUOUS_VARIANTS,
  MANUAL_RETRY_VARIANTS,
  toGrayscale,
} from '@/lib/scanner/preprocess';

/**
 * Build a tiny RGBA `ImageData` from per-pixel quadruplets.
 *
 * Avoids depending on the Canvas API in tests — the preprocess
 * functions only ever read `.data`, `.width`, `.height` so a duck-
 * typed object is sufficient.
 */
function makeImageData(
  width: number,
  height: number,
  pixels: Array<[number, number, number, number]>,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const px = pixels[i];
    if (!px) continue;
    const [r, g, b, a] = px;
    data[i * 4 + 0] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { data, width, height } as ImageData;
}

describe('toGrayscale', () => {
  it('replaces RGB with the BT.601 luminance value', () => {
    // Pure red, pure green, pure blue, white.
    const src = makeImageData(4, 1, [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ]);
    const out = toGrayscale(src);
    // BT.601: 0.299*255 = 76.245 → round 76
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([76, 76, 76]);
    // 0.587*255 = 149.685 → round 150
    expect([out.data[4], out.data[5], out.data[6]]).toEqual([150, 150, 150]);
    // 0.114*255 = 29.07 → round 29
    expect([out.data[8], out.data[9], out.data[10]]).toEqual([29, 29, 29]);
    // White stays at 255 (sum of coefficients = 1.0).
    expect([out.data[12], out.data[13], out.data[14]]).toEqual([255, 255, 255]);
  });

  it('preserves alpha verbatim', () => {
    const src = makeImageData(2, 1, [
      [200, 100, 50, 128],
      [10, 20, 30, 0],
    ]);
    const out = toGrayscale(src);
    expect(out.data[3]).toBe(128);
    expect(out.data[7]).toBe(0);
  });

  it('does not mutate the input buffer', () => {
    const src = makeImageData(1, 1, [[100, 150, 200, 255]]);
    const snapshot = Array.from(src.data);
    toGrayscale(src);
    expect(Array.from(src.data)).toEqual(snapshot);
  });
});

describe('applyContrast', () => {
  it('factor 1.0 is the identity transform', () => {
    const src = makeImageData(2, 1, [
      [50, 100, 150, 255],
      [200, 25, 75, 200],
    ]);
    const out = applyContrast(src, 1.0);
    for (let i = 0; i < src.data.length; i++) {
      expect(out.data[i]).toBe(src.data[i]);
    }
  });

  it('factor 1.3 stretches values away from 128', () => {
    const src = makeImageData(2, 1, [
      [128, 128, 128, 255], // mid-grey: stays at 128
      [200, 50, 100, 255], //  ↑       ↓     ↓
    ]);
    const out = applyContrast(src, 1.3);
    // mid-grey is the contrast pivot — should not move.
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([128, 128, 128]);
    // Above-pivot brightens, below-pivot darkens.
    // 200 → (200-128)*1.3 + 128 = 221.6 → clamp 222
    expect(out.data[4]).toBe(222);
    //  50 → ( 50-128)*1.3 + 128 =  26.6 → clamp 27
    expect(out.data[5]).toBe(27);
    // 100 → (100-128)*1.3 + 128 =  91.6 → clamp 92
    expect(out.data[6]).toBe(92);
  });

  it('clamps over- and under-shoot to 0..255', () => {
    const src = makeImageData(2, 1, [
      [255, 0, 128, 255],
      [240, 10, 130, 255],
    ]);
    const out = applyContrast(src, 3.0);
    // 255 with factor 3 → way over → clamp 255
    expect(out.data[0]).toBe(255);
    // 0 with factor 3 → way under → clamp 0
    expect(out.data[1]).toBe(0);
    // 128 → unchanged (pivot)
    expect(out.data[2]).toBe(128);
  });

  it('preserves alpha', () => {
    const src = makeImageData(1, 1, [[100, 100, 100, 50]]);
    const out = applyContrast(src, 1.5);
    expect(out.data[3]).toBe(50);
  });
});

describe('applyPreprocess', () => {
  const src = makeImageData(1, 1, [[120, 90, 60, 255]]);

  it("'normal' returns the source unchanged (identity reference)", () => {
    expect(applyPreprocess(src, 'normal')).toBe(src);
  });

  it("'grayscale' delegates to toGrayscale", () => {
    const out = applyPreprocess(src, 'grayscale');
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
  });

  it("'contrast' boosts away from 128", () => {
    const out = applyPreprocess(src, 'contrast');
    // 120 < 128 should darken, 60 < 128 should darken further.
    expect(out.data[0]).toBeLessThan(120);
    expect(out.data[2]).toBeLessThan(60);
  });
});

describe('MANUAL_RETRY_VARIANTS', () => {
  it('starts with the no-op pass before mutating preprocesses', () => {
    expect(MANUAL_RETRY_VARIANTS[0]).toBe('normal');
  });

  it('includes the v1.0.10 contrast + grayscale fallbacks', () => {
    expect(MANUAL_RETRY_VARIANTS).toContain('contrast');
    expect(MANUAL_RETRY_VARIANTS).toContain('grayscale');
  });

  it('includes the v1.0.11 lighting fallbacks for tricky scans', () => {
    // These four cover dark-mode QR (inverted), under-/over-exposed
    // (brighten/darken), and uneven lighting (adaptive threshold).
    expect(MANUAL_RETRY_VARIANTS).toContain('inverted');
    expect(MANUAL_RETRY_VARIANTS).toContain('brighten');
    expect(MANUAL_RETRY_VARIANTS).toContain('darken');
    expect(MANUAL_RETRY_VARIANTS).toContain('adaptiveThreshold');
  });

  it('orders the v1.0.10 variants before the heavier v1.0.11 ones', () => {
    const idx = (v: string) => MANUAL_RETRY_VARIANTS.indexOf(v as never);
    expect(idx('normal')).toBeLessThan(idx('inverted'));
    expect(idx('contrast')).toBeLessThan(idx('inverted'));
    expect(idx('grayscale')).toBeLessThan(idx('inverted'));
    // Adaptive threshold is the heaviest preprocess and runs last.
    expect(idx('adaptiveThreshold')).toBe(MANUAL_RETRY_VARIANTS.length - 1);
  });
});

describe('CONTINUOUS_VARIANTS', () => {
  it('is a strict subset of the manual retry list', () => {
    for (const v of CONTINUOUS_VARIANTS) {
      expect(MANUAL_RETRY_VARIANTS).toContain(v);
    }
  });

  it('includes inverted so dark-mode QR is caught in continuous mode', () => {
    expect(CONTINUOUS_VARIANTS).toContain('inverted');
  });

  it('is short enough to cycle within the cooldown window (≤4 variants)', () => {
    expect(CONTINUOUS_VARIANTS.length).toBeLessThanOrEqual(4);
  });
});

describe('applyInvert', () => {
  it('flips each RGB channel via 255 − v', () => {
    const src = makeImageData(2, 1, [
      [0, 128, 255, 255],
      [50, 100, 200, 200],
    ]);
    const out = applyInvert(src);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([255, 127, 0]);
    expect([out.data[4], out.data[5], out.data[6]]).toEqual([205, 155, 55]);
  });

  it('preserves alpha verbatim', () => {
    const src = makeImageData(1, 1, [[10, 20, 30, 128]]);
    expect(applyInvert(src).data[3]).toBe(128);
  });

  it('is its own inverse on every channel', () => {
    const src = makeImageData(1, 1, [[37, 91, 200, 255]]);
    const round = applyInvert(applyInvert(src));
    for (let i = 0; i < 3; i++) {
      expect(round.data[i]).toBe(src.data[i]);
    }
  });
});

describe('applyGamma', () => {
  it('gamma 1.0 is the identity transform', () => {
    const src = makeImageData(2, 1, [
      [10, 100, 200, 255],
      [255, 0, 128, 255],
    ]);
    const out = applyGamma(src, 1.0);
    for (let i = 0; i < src.data.length; i++) {
      expect(out.data[i]).toBe(src.data[i]);
    }
  });

  it('gamma < 1 brightens midtones (rescues dim frames)', () => {
    const src = makeImageData(1, 1, [[60, 60, 60, 255]]);
    const out = applyGamma(src, 0.5);
    // 0.5 brings the mid-low value way up.
    expect(out.data[0]).toBeGreaterThan(120);
  });

  it('gamma > 1 darkens midtones (tames glare)', () => {
    const src = makeImageData(1, 1, [[200, 200, 200, 255]]);
    const out = applyGamma(src, 1.6);
    // High value pulls toward black.
    expect(out.data[0]).toBeLessThan(180);
  });

  it('clamps endpoints exactly to 0 and 255', () => {
    const src = makeImageData(2, 1, [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    const out = applyGamma(src, 0.4);
    expect(out.data[0]).toBe(0);
    expect(out.data[4]).toBe(255);
  });
});

describe('applyAdaptiveThreshold', () => {
  it('binarises a uniform mid-grey image to all-white (no contrast)', () => {
    // Uniform grey: every pixel equals its block mean → all bright.
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 16 * 16; i++) {
      px.push([128, 128, 128, 255]);
    }
    const src = makeImageData(16, 16, px);
    const out = applyAdaptiveThreshold(src);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255);
    }
  });

  it('produces a 2-tone output (only 0 or 255 in RGB channels)', () => {
    // Half-dark, half-light vertical strip.
    const px: Array<[number, number, number, number]> = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = x < 8 ? 50 : 200;
        px.push([v, v, v, 255]);
      }
    }
    const src = makeImageData(16, 16, px);
    const out = applyAdaptiveThreshold(src);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeOneOf([0, 255]);
      expect(out.data[i + 1]).toBe(out.data[i]);
      expect(out.data[i + 2]).toBe(out.data[i]);
    }
  });

  it('does not mutate the input buffer', () => {
    const src = makeImageData(2, 2, [
      [50, 50, 50, 255],
      [200, 200, 200, 255],
      [10, 10, 10, 255],
      [240, 240, 240, 255],
    ]);
    const snapshot = Array.from(src.data);
    applyAdaptiveThreshold(src);
    expect(Array.from(src.data)).toEqual(snapshot);
  });

  it('handles zero-sized inputs without throwing', () => {
    const src = { data: new Uint8ClampedArray(0), width: 0, height: 0 } as ImageData;
    expect(() => applyAdaptiveThreshold(src)).not.toThrow();
  });
});

describe('analyzeImageStats', () => {
  it('reports zeros for an empty buffer', () => {
    const src = { data: new Uint8ClampedArray(0), width: 0, height: 0 } as ImageData;
    expect(analyzeImageStats(src)).toEqual({ mean: 0, min: 0, max: 0 });
  });

  it('captures min, max, mean of a 2-pixel image', () => {
    const src = makeImageData(2, 1, [
      [255, 255, 255, 255],
      [0, 0, 0, 255],
    ]);
    const stats = analyzeImageStats(src);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(255);
    // mean of (255, 0) = 127.5
    expect(stats.mean).toBeCloseTo(127.5, 5);
  });

  it('flags a pitch-black frame (max ≈ 0) for the dark-frame guard', () => {
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 100; i++) {
      px.push([0, 0, 0, 255]);
    }
    const src = makeImageData(10, 10, px);
    const stats = analyzeImageStats(src);
    expect(stats.max).toBeLessThan(10);
    expect(stats.mean).toBeLessThan(10);
  });

  it('flags a uniformly bright frame (min ≈ 255) so glare-detection can react', () => {
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 100; i++) {
      px.push([250, 250, 250, 255]);
    }
    const src = makeImageData(10, 10, px);
    const stats = analyzeImageStats(src);
    expect(stats.min).toBeGreaterThan(240);
    expect(stats.max).toBeLessThanOrEqual(255);
  });
});

describe('applyPreprocess (v1.0.11 variants)', () => {
  const src = makeImageData(1, 1, [[120, 90, 60, 255]]);

  it("'inverted' delegates to applyInvert", () => {
    const out = applyPreprocess(src, 'inverted');
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([135, 165, 195]);
  });

  it("'brighten' applies a sub-1 gamma (raises midtones)", () => {
    const out = applyPreprocess(src, 'brighten');
    // All three channels should brighten.
    expect(out.data[0]).toBeGreaterThan(120);
  });

  it("'darken' applies a >1 gamma (lowers midtones)", () => {
    const out = applyPreprocess(src, 'darken');
    expect(out.data[0]).toBeLessThan(120);
  });

  it("'adaptiveThreshold' returns a 2-tone image", () => {
    // Use a small but realistic sample so the threshold produces both
    // 0 and 255 outputs depending on local mean.
    const px: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 64; i++) {
      const v = i % 2 === 0 ? 30 : 210;
      px.push([v, v, v, 255]);
    }
    const big = makeImageData(8, 8, px);
    const out = applyPreprocess(big, 'adaptiveThreshold');
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBeOneOf([0, 255]);
    }
  });
});
