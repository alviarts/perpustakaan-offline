import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyPreprocess,
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

  it('includes contrast and grayscale fallbacks', () => {
    expect(MANUAL_RETRY_VARIANTS).toContain('contrast');
    expect(MANUAL_RETRY_VARIANTS).toContain('grayscale');
  });

  it('is exactly 3 variants — caller assumes a fixed budget', () => {
    expect(MANUAL_RETRY_VARIANTS).toHaveLength(3);
  });
});
