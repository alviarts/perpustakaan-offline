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
 * running multiple decode passes per click — each pass uses a
 * different preprocessing variant. {@link applyPreprocess} produces
 * the variant; the decoder picks the first one that returns a hit.
 *
 * v1.0.11 expanded the variant set to handle:
 * - **Inverted** (white-on-black labels, dark-mode QR on phone screens).
 * - **Brighten** (gamma < 1) for under-exposed frames in dim rooms.
 * - **Darken** (gamma > 1) for blown-out highlights and glare.
 * - **Adaptive threshold** for very uneven lighting (window-side glare
 *   that washes out one half of the barcode).
 *
 * All transforms here are pure functions over `ImageData`. They are
 * intentionally easy to test in isolation: pass in a synthetic
 * 4×4 ImageData, assert the per-pixel output. No DOM, no Canvas,
 * no async.
 */

export type PreprocessVariant =
  | 'normal'
  | 'grayscale'
  | 'contrast'
  | 'inverted'
  | 'brighten'
  | 'darken'
  | 'adaptiveThreshold';

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
 * Invert each colour channel (255 - v). Useful for white-on-dark
 * barcodes — phone-screen QR codes in dark mode are the canonical
 * case, but laser-engraved labels on dark plastic also show up that
 * way after binarisation. zxing's `ALSO_INVERTED` hint covers many of
 * these natively, but the explicit pre-inverted pass gives jsQR a
 * second chance too.
 *
 * Alpha is preserved.
 */
export function applyInvert(src: ImageData): ImageData {
  const out = cloneShape(src);
  const s = src.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = 255 - (s[i] ?? 0);
    d[i + 1] = 255 - (s[i + 1] ?? 0);
    d[i + 2] = 255 - (s[i + 2] ?? 0);
    d[i + 3] = s[i + 3] ?? 255;
  }
  return out;
}

/**
 * Apply a per-channel gamma curve. `gamma < 1` brightens midtones
 * (rescues under-exposed frames in dim classrooms); `gamma > 1`
 * darkens midtones (tames blown-out highlights from sunlight glare).
 *
 * Implementation uses a 256-entry lookup table for the per-channel
 * map — much faster than calling `Math.pow` per pixel on a 1080p
 * crop. Alpha is left untouched.
 */
export function applyGamma(src: ImageData, gamma: number): ImageData {
  const out = cloneShape(src);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
  }
  const s = src.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = lut[s[i] ?? 0] ?? 0;
    d[i + 1] = lut[s[i + 1] ?? 0] ?? 0;
    d[i + 2] = lut[s[i + 2] ?? 0] ?? 0;
    d[i + 3] = s[i + 3] ?? 255;
  }
  return out;
}

/**
 * Block-mean adaptive threshold. For each pixel, compute the mean
 * luminance over a square block centered on it; binarise to black
 * or white based on whether the pixel is below or above
 * `(blockMean - bias)`.
 *
 * A small constant `bias` (default 8) suppresses noise in flat
 * regions — without it, an evenly-lit white page ends up speckled
 * because every pixel sits arbitrarily close to its own block mean.
 *
 * This is a stripped-down version of Bradley/Sauvola adaptive
 * thresholding tuned for our use case (binarising the ROI before
 * handing it to zxing). It rescues the "half the page is in shadow"
 * case where global contrast boosts can't push everything into the
 * same dynamic range.
 *
 * Block size defaults to ~1/16 of the image's shorter side, capped
 * to odd integers in `[3, 51]`. Larger blocks smooth more aggressively
 * (good for text-heavy pages) but slow the decode down.
 *
 * Implementation note: we use an integral-image (summed-area table)
 * so each block lookup is O(1) regardless of block size — total cost
 * is O(N) for an N-pixel image rather than O(N · blockSize²).
 */
export function applyAdaptiveThreshold(
  src: ImageData,
  options: { blockSize?: number; bias?: number } = {},
): ImageData {
  const w = src.width;
  const h = src.height;
  const out = cloneShape(src);
  if (w <= 0 || h <= 0) {
    return out;
  }
  const minDim = Math.min(w, h);
  const requestedBlock = options.blockSize ?? Math.max(15, Math.round(minDim / 16));
  // Force odd, clamp to a reasonable range — large blocks hurt perf
  // disproportionately because of the integral-image edge handling.
  let blockSize = requestedBlock;
  if (blockSize < 3) blockSize = 3;
  if (blockSize > 51) blockSize = 51;
  if (blockSize % 2 === 0) blockSize += 1;
  const half = (blockSize - 1) >> 1;
  const bias = options.bias ?? 8;

  // Integral image of the per-pixel luminance. Width/height are +1
  // larger so the (-1)-indexed boundary case becomes a free 0 row.
  const iw = w + 1;
  const ih = h + 1;
  const integral = new Float64Array(iw * ih);
  const s = src.data;
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = s[i] ?? 0;
      const g = s[i + 1] ?? 0;
      const b = s[i + 2] ?? 0;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      rowSum += lum;
      integral[(y + 1) * iw + (x + 1)] = (integral[y * iw + (x + 1)] ?? 0) + rowSum;
    }
  }

  const d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const x0 = Math.max(0, x - half);
      const y0 = Math.max(0, y - half);
      const x1 = Math.min(w - 1, x + half);
      const y1 = Math.min(h - 1, y + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        (integral[(y1 + 1) * iw + (x1 + 1)] ?? 0) -
        (integral[y0 * iw + (x1 + 1)] ?? 0) -
        (integral[(y1 + 1) * iw + x0] ?? 0) +
        (integral[y0 * iw + x0] ?? 0);
      const mean = sum / area;
      const r = s[i] ?? 0;
      const g = s[i + 1] ?? 0;
      const b = s[i + 2] ?? 0;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = lum < mean - bias ? 0 : 255;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = s[i + 3] ?? 255;
    }
  }
  return out;
}

export interface ImageStats {
  /** Average luminance over all pixels (0..255). */
  mean: number;
  /** Minimum per-pixel luminance encountered. */
  min: number;
  /** Maximum per-pixel luminance encountered. */
  max: number;
}

/**
 * Cheap one-pass luminance histogram summary. Used by the decoder
 * to:
 *
 * - Skip pitch-black frames (e.g. camera covered, autoexposure not
 *   converged yet). `max < 10` → no point feeding zxing anything,
 *   it's all noise.
 * - Pick which preprocess variants to try first. A frame whose mean
 *   sits below 70 is much more likely to decode after a brighten
 *   pass than a contrast pass; a frame with mean above 200 wants
 *   darken first; a frame with `max - min < 40` wants the adaptive
 *   threshold first because it has almost no global contrast.
 *
 * Only samples luminance — colour cast is handled separately by the
 * grayscale variant.
 */
export function analyzeImageStats(src: ImageData): ImageStats {
  const s = src.data;
  if (s.length < 4) {
    return { mean: 0, min: 0, max: 0 };
  }
  let total = 0;
  let count = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < s.length; i += 4) {
    const r = s[i] ?? 0;
    const g = s[i + 1] ?? 0;
    const b = s[i + 2] ?? 0;
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    total += y;
    count += 1;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return {
    mean: count > 0 ? total / count : 0,
    min: count > 0 ? min : 0,
    max: count > 0 ? max : 0,
  };
}

/**
 * Pick the preprocessing variant requested by the caller.
 *
 * The decoder tries variants in this order:
 *   1. `'normal'`              — pass-through (still useful as a baseline pass).
 *   2. `'contrast'`            — +30% contrast boost (most common decode rescue).
 *   3. `'grayscale'`           — pure luminance (handles colour cast).
 *   4. `'inverted'`            — flip black/white (white-on-dark labels, dark-mode QR).
 *   5. `'brighten'`            — gamma 0.5 (rescues under-exposed frames).
 *   6. `'darken'`              — gamma 1.6 (tames overexposed glare).
 *   7. `'adaptiveThreshold'`   — local mean binarisation (uneven lighting / shadow).
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
    case 'inverted':
      return applyInvert(src);
    case 'brighten':
      return applyGamma(src, 0.5);
    case 'darken':
      return applyGamma(src, 1.6);
    case 'adaptiveThreshold':
      return applyAdaptiveThreshold(src);
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
 * Default retry order for the manual scan button. Ordered by how
 * often each variant rescues a missed decode in practice — `'normal'`
 * first because most frames are fine, then progressively heavier
 * preprocesses.
 *
 * The full ordered list trades latency (~50 ms per variant on a 1080p
 * ROI) for catch-rate. Manual scan's budget is generous; continuous
 * decode picks a smaller subset {@link CONTINUOUS_VARIANTS}.
 */
export const MANUAL_RETRY_VARIANTS: PreprocessVariant[] = [
  'normal',
  'contrast',
  'grayscale',
  'inverted',
  'brighten',
  'darken',
  'adaptiveThreshold',
];

/**
 * Variant subset cycled by the continuous-decode loop, one per tick.
 *
 * Smaller than the manual list (continuous mode runs ~12.5 fps and
 * each tick must finish well within the 80 ms budget) but covers the
 * lighting cases that most often trip up real classroom scans:
 *
 * - `normal` — the easy case, hit immediately when conditions are good.
 * - `contrast` — rescues mild under-/over-exposure.
 * - `inverted` — dark-mode phone QR.
 * - `grayscale` — colour-cast under warm LEDs.
 *
 * The remaining heavy variants (brighten/darken/adaptiveThreshold)
 * are only tried by the manual button.
 */
export const CONTINUOUS_VARIANTS: PreprocessVariant[] = [
  'normal',
  'contrast',
  'inverted',
  'grayscale',
];
