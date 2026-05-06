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
  | 'adaptiveThreshold'
  | 'blur'
  | 'unsharp'
  | 'upsample';

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
 * Separable box blur (horizontal pass + vertical pass).
 *
 * v1.0.12: this is the killer rescue for **Code-128 barcodes shot
 * off a phone screen**. The webcam picks up the phone's pixel raster
 * as a high-frequency moiré pattern, which zxing's edge detector
 * sees as extra spurious bars between the real bars and rejects the
 * frame. A small box blur (radius 1, i.e. 3×3 kernel) smudges the
 * raster into a flat mid-grey while leaving the much-larger barcode
 * bars and gaps essentially untouched, after which zxing decodes the
 * frame cleanly.
 *
 * Implemented as two 1-D passes for cache-friendliness; the 1-D box
 * filter at radius `r` is just a moving average of `2r + 1` samples
 * which we maintain incrementally so the cost is O(N) regardless of
 * radius.
 *
 * Default radius 1 (3-pixel kernel) is the smallest that suppresses
 * a typical 1080p phone-screen capture's moiré fringes. Larger radii
 * smudge real barcode edges and *hurt* decode rate.
 */
export function applyBoxBlur(src: ImageData, radius: number = 1): ImageData {
  const w = src.width;
  const h = src.height;
  const out = cloneShape(src);
  if (w <= 0 || h <= 0 || radius <= 0) {
    out.data.set(src.data);
    return out;
  }
  const r = Math.max(1, Math.floor(radius));
  const s = src.data;
  // Intermediate buffer holds the result of the horizontal pass
  // before the vertical pass reads it.
  const tmp = new Uint8ClampedArray(s.length);
  // Horizontal pass.
  for (let y = 0; y < h; y++) {
    const rowStart = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      let count = 0;
      // Prime the moving-average window for x=0.
      for (let k = -r; k <= r; k++) {
        const sx = k < 0 ? 0 : k >= w ? w - 1 : k;
        sum += s[rowStart + sx * 4 + c] ?? 0;
        count++;
      }
      tmp[rowStart + 0 * 4 + c] = Math.round(sum / count);
      // Slide the window across the row.
      for (let x = 1; x < w; x++) {
        const xOut = x - r - 1;
        const xIn = x + r;
        const sxOut = xOut < 0 ? 0 : xOut >= w ? w - 1 : xOut;
        const sxIn = xIn < 0 ? 0 : xIn >= w ? w - 1 : xIn;
        sum += (s[rowStart + sxIn * 4 + c] ?? 0) - (s[rowStart + sxOut * 4 + c] ?? 0);
        tmp[rowStart + x * 4 + c] = Math.round(sum / count);
      }
    }
  }
  // Vertical pass over `tmp` into `out.data`.
  const d = out.data;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      let count = 0;
      for (let k = -r; k <= r; k++) {
        const sy = k < 0 ? 0 : k >= h ? h - 1 : k;
        sum += tmp[(sy * w + x) * 4 + c] ?? 0;
        count++;
      }
      d[(0 * w + x) * 4 + c] = Math.round(sum / count);
      for (let y = 1; y < h; y++) {
        const yOut = y - r - 1;
        const yIn = y + r;
        const syOut = yOut < 0 ? 0 : yOut >= h ? h - 1 : yOut;
        const syIn = yIn < 0 ? 0 : yIn >= h ? h - 1 : yIn;
        sum +=
          (tmp[(syIn * w + x) * 4 + c] ?? 0) - (tmp[(syOut * w + x) * 4 + c] ?? 0);
        d[(y * w + x) * 4 + c] = Math.round(sum / count);
      }
    }
  }
  // Preserve alpha exactly — a blurred alpha channel makes the image
  // appear to have soft edges when used downstream, but zxing only
  // reads RGB.
  for (let i = 3; i < s.length; i += 4) {
    d[i] = s[i] ?? 255;
  }
  return out;
}

/**
 * Unsharp mask: `out = clamp(src + amount * (src - blurred))`.
 *
 * The intuition is the inverse of {@link applyBoxBlur}: take what
 * the blur removed (the high-frequency detail) and *add it back*.
 * Useful when a frame is genuinely soft — webcam autofocus that
 * landed slightly behind the barcode plane, motion blur from an
 * unsteady hand, or compression artefacts on a screen-shared frame.
 *
 * `amount` controls strength; `0` is a no-op, `1.0` is mild, `2.0` is
 * aggressive. Defaults to `1.0` which doubles the local edge
 * contrast without going over the top — stronger settings start
 * introducing ringing artefacts that bias zxing's edge detector
 * the wrong way.
 */
export function applyUnsharp(
  src: ImageData,
  options: { amount?: number; radius?: number } = {},
): ImageData {
  const amount = options.amount ?? 1.0;
  const radius = options.radius ?? 1;
  const blurred = applyBoxBlur(src, radius);
  const out = cloneShape(src);
  const s = src.data;
  const b = blurred.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const sv = s[i + c] ?? 0;
      const bv = b[i + c] ?? 0;
      const v = sv + amount * (sv - bv);
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    d[i + 3] = s[i + 3] ?? 255;
  }
  return out;
}

/**
 * 2× nearest-neighbour upsample (returns a fresh `ImageData` with
 * doubled width and height).
 *
 * Use case: very small / distant barcodes where the 1-D bars are
 * only a few pixels wide. zxing's `RGBLuminanceSource` does no
 * scaling internally and the binarizer needs at least ≈10× the bar
 * width per sample to find a stable edge. A 2× upsample doubles the
 * effective resolution at zero quality cost (nearest-neighbour
 * preserves the binary edges that the decoder cares about).
 *
 * Does not interpolate — deliberately. Bilinear upsampling would
 * round bar edges and make some Code-128 modules ambiguous; nearest
 * keeps every pixel a faithful copy of its source.
 */
export function applyUpsample(src: ImageData, scale: number = 2): ImageData {
  const w = src.width;
  const h = src.height;
  if (w <= 0 || h <= 0 || scale < 1) {
    return cloneShape(src);
  }
  const k = Math.max(1, Math.floor(scale));
  const w2 = w * k;
  const h2 = h * k;
  const data = new Uint8ClampedArray(w2 * h2 * 4);
  const s = src.data;
  for (let y = 0; y < h2; y++) {
    const sy = Math.floor(y / k);
    for (let x = 0; x < w2; x++) {
      const sx = Math.floor(x / k);
      const si = (sy * w + sx) * 4;
      const di = (y * w2 + x) * 4;
      data[di] = s[si] ?? 0;
      data[di + 1] = s[si + 1] ?? 0;
      data[di + 2] = s[si + 2] ?? 0;
      data[di + 3] = s[si + 3] ?? 255;
    }
  }
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(data, w2, h2);
    } catch {
      // fall through
    }
  }
  return { data, width: w2, height: h2 } as ImageData;
}

/**
 * Rotate by 0 / 90 / 180 / 270 degrees clockwise. Returns a fresh
 * `ImageData` (dimensions swap for 90 / 270). Used by the manual
 * scan retry pipeline when every angle-0 variant misses — a barcode
 * shot sideways or upside-down still decodes, just at the cost of an
 * extra retry round.
 *
 * Continuous decode does not rotate, because the rotation would
 * desync the live tracking overlay's coordinates relative to the
 * unrotated camera preview.
 */
export function applyRotation(
  src: ImageData,
  degrees: 0 | 90 | 180 | 270,
): ImageData {
  const w = src.width;
  const h = src.height;
  if (degrees === 0 || w <= 0 || h <= 0) {
    const out = cloneShape(src);
    out.data.set(src.data);
    return out;
  }
  const s = src.data;
  const w2 = degrees === 180 ? w : h;
  const h2 = degrees === 180 ? h : w;
  const data = new Uint8ClampedArray(w2 * h2 * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number, ny: number;
      if (degrees === 90) {
        nx = h - 1 - y;
        ny = x;
      } else if (degrees === 180) {
        nx = w - 1 - x;
        ny = h - 1 - y;
      } else {
        nx = y;
        ny = w - 1 - x;
      }
      const si = (y * w + x) * 4;
      const di = (ny * w2 + nx) * 4;
      data[di] = s[si] ?? 0;
      data[di + 1] = s[si + 1] ?? 0;
      data[di + 2] = s[si + 2] ?? 0;
      data[di + 3] = s[si + 3] ?? 255;
    }
  }
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(data, w2, h2);
    } catch {
      // fall through
    }
  }
  return { data, width: w2, height: h2 } as ImageData;
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
 *   8. `'blur'`                — 3×3 box blur (suppresses moiré from phone screens).
 *   9. `'unsharp'`             — unsharp mask (recovers soft / out-of-focus frames).
 *  10. `'upsample'`            — 2× nearest-neighbour scale (small barcodes far away).
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
    case 'blur':
      return applyBoxBlur(src, 1);
    case 'unsharp':
      return applyUnsharp(src, { amount: 1.0, radius: 1 });
    case 'upsample':
      return applyUpsample(src, 2);
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
  'blur',
  'unsharp',
  'inverted',
  'brighten',
  'darken',
  'adaptiveThreshold',
  'upsample',
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
  'blur',
  'inverted',
  'grayscale',
];
