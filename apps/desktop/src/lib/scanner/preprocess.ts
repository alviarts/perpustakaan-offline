/**
 * Image preprocessing for barcode decode (FEAT-28 PR J).
 *
 * The continuous-decode path runs the raw RGBA frame through zxing as
 * fast as it can. That works for high-contrast labels in good light,
 * but the user reports that real classroom lighting (fluorescent,
 * window glare, low-CRI LEDs) regularly trips up the decoder even
 * after BUG-18's resolution bump.
 *
 * The manual "Scan Sekarang" button trades latency for accuracy by
 * running up to three decode passes per click — each pass uses a
 * different preprocessing variant. {@link applyPreprocess} produces
 * the variant; the decoder picks the first one that returns a hit.
 *
 * All transforms here are pure functions over `ImageData`. They are
 * intentionally easy to test in isolation: pass in a synthetic
 * 4×4 ImageData, assert the per-pixel output. No DOM, no Canvas,
 * no async.
 */

export type PreprocessVariant = 'normal' | 'grayscale' | 'contrast';

/**
 * Build a fresh ImageData buffer the same size as the source. Used by
 * every transform so the input is never mutated. We allocate a
 * `Uint8ClampedArray` directly (rather than `new ImageData(w, h)`)
 * because some test environments (jsdom) don't expose the ImageData
 * constructor, and the canvas helpers we call later only ever read
 * `.data`, `.width`, `.height`.
 */
function cloneShape(src: ImageData): ImageData {
  const data = new Uint8ClampedArray(src.data.length);
  // Tests ran fine with this minimal shim, but if the runtime offers
  // a real ImageData constructor we use it so consumers that rely on
  // `instanceof ImageData` keep working.
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(data, src.width, src.height);
    } catch {
      // fall through to the duck-typed version below
    }
  }
  return { data, width: src.width, height: src.height } as ImageData;
}

/**
 * Convert each pixel to its luminance, written back across all three
 * RGB channels (so the result is still RGBA but visually monochrome).
 *
 * Uses the BT.601 coefficients (0.299 R + 0.587 G + 0.114 B). zxing
 * internally does its own grayscale conversion, but giving it an
 * already-grayscale image (a) saves a tiny bit of CPU and (b) avoids
 * the small bias colour-cast adds when one channel saturates earlier
 * than the others — important under warm-tinted classroom lights
 * where the red channel of an EAN barcode can clip.
 */
export function toGrayscale(src: ImageData): ImageData {
  const out = cloneShape(src);
  const s = src.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    // Indices are bounded by `s.length` so the `?? 0` defaults exist
    // only to satisfy `noUncheckedIndexedAccess`. They are never hit
    // at runtime for a well-formed RGBA buffer.
    const r = s[i] ?? 0;
    const g = s[i + 1] ?? 0;
    const b = s[i + 2] ?? 0;
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    d[i] = y;
    d[i + 1] = y;
    d[i + 2] = y;
    d[i + 3] = s[i + 3] ?? 255;
  }
  return out;
}

/**
 * Adjust contrast around the 128 mid-grey by a multiplicative factor.
 *
 * `factor = 1.0` is a no-op. `factor = 1.3` boosts contrast by ~30%
 * (the spec's recommended default for the second decode pass). The
 * formula is the standard `(v - 128) * f + 128` clamped to 0..255 —
 * matches the GIMP / Photoshop "Contrast" slider behaviour.
 *
 * Alpha is left untouched so the image stays opaque after the boost.
 */
export function applyContrast(src: ImageData, factor: number): ImageData {
  const out = cloneShape(src);
  const s = src.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const sample = s[i + c] ?? 0;
      const v = (sample - 128) * factor + 128;
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    d[i + 3] = s[i + 3] ?? 255;
  }
  return out;
}

/**
 * Pick the preprocessing variant requested by the caller.
 *
 * The decoder tries variants in this order:
 *   1. `'normal'`   — pass-through (still useful as a baseline pass).
 *   2. `'contrast'` — +30% contrast boost (most common decode rescue).
 *   3. `'grayscale'`— pure luminance (last resort: handles colour cast).
 *
 * We expose them as discrete variants rather than as a single
 * configurable pipeline because the manual scan button benefits from
 * a fixed retry order — easier to reason about, easier to test.
 */
export function applyPreprocess(src: ImageData, variant: PreprocessVariant): ImageData {
  switch (variant) {
    case 'normal':
      return src;
    case 'grayscale':
      return toGrayscale(src);
    case 'contrast':
      return applyContrast(src, 1.3);
    default: {
      // Exhaustiveness guard. Compile-time `never` ensures all cases
      // are handled; the runtime fallback returns the source unchanged.
      const _exhaustive: never = variant;
      void _exhaustive;
      return src;
    }
  }
}

/**
 * Default retry order for the manual scan button.
 *
 * The order is designed for the median classroom case: most decodes
 * miss because of low contrast (under-lit barcodes on white paper),
 * so contrast boost is tried *before* grayscale. Grayscale is kept
 * last as the safety net for colour-cast failures.
 */
export const MANUAL_RETRY_VARIANTS: PreprocessVariant[] = [
  'normal',
  'contrast',
  'grayscale',
];
