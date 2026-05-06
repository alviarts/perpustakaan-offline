/**
 * Multi-format barcode decoder wrapper (FEAT-28 PR J).
 *
 * Wraps `@zxing/browser`'s {@link BrowserMultiFormatReader} and
 * `@zxing/library`'s low-level {@link MultiFormatReader} so the rest
 * of the app can decode either:
 *
 * - A continuous video stream (legacy use case, kept for
 *   `useBarcodeScanner`).
 * - A single Canvas / `ImageData` snapshot — used by the manual
 *   "Scan Sekarang" button which wants to crop to the ROI overlay
 *   and try multiple preprocessing variants before giving up.
 *
 * Format coverage matches the FEAT-28 acceptance:
 *   EAN-13, EAN-8, Code-128, Code-39, QR Code, Data Matrix.
 *
 * v1.0.11 additions:
 * - Dedicated `'inverted'` preprocess variant in
 *   {@link MANUAL_RETRY_VARIANTS} (zxing 0.21 doesn't expose the
 *   `ALSO_INVERTED` hint, so we invert the bitmap ourselves before
 *   handing it to the binarizer). Handles dark-mode QR codes and
 *   white-on-black labels.
 * - {@link decodeWithJsQR} fallback for QR codes — jsQR is much more
 *   tolerant of moiré (phone screen × webcam) and small / low-res QR
 *   than zxing's QR reader. It runs only after zxing misses to keep
 *   the happy path fast.
 * - {@link DecodedResult.location} polygon (4 corners + finder
 *   patterns when available) for the live tracking overlay.
 *
 * We deliberately keep the same library family the app already
 * shipped (zxing) — switching to quagga2 would have meant a fresh
 * audit of decode rates, license, and bundle size. zxing already
 * supports every format we need; jsQR is added strictly as a
 * focused QR-only fallback.
 */
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
  type Result,
  type ResultPoint,
} from '@zxing/library';
import jsQR from 'jsqr';
import {
  applyPreprocess,
  applyRotation,
  MANUAL_RETRY_VARIANTS,
  type PreprocessVariant,
} from './preprocess';

/**
 * Formats the FEAT-28 acceptance requires the scanner to recognise.
 *
 * Order matters slightly: zxing tries them roughly in declaration
 * order on each frame, so the format most likely to be present in our
 * use case (Code-128 — every label printed by the app) goes first.
 */
export const SUPPORTED_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

/**
 * Build the {@link DecodeHintType} map handed to every reader. zxing's
 * `Map<DecodeHintType, unknown>` is non-trivial to type-check across
 * versions so we encapsulate the construction in one place.
 *
 * - `TRY_HARDER` enables the slower-but-more-thorough decode path.
 *   The frame budget on a manual click is generous (~500 ms) so the
 *   perf cost is fine, and it noticeably improves the catch rate on
 *   partially-occluded or skewed barcodes.
 *
 * Note: the `ALSO_INVERTED` hint (newer ZXing builds) is not present
 * in @zxing/library 0.21, so the equivalent behaviour is provided by
 * the `'inverted'` preprocess variant in
 * {@link MANUAL_RETRY_VARIANTS} (and jsQR's `attemptBoth` mode for
 * the QR fallback path).
 */
export function buildDecodeHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

/**
 * Construct a fresh {@link BrowserMultiFormatReader} configured for
 * the FEAT-28 format set. The browser reader handles continuous video
 * decode (`decodeFromConstraints`, `decodeFromVideoElement`).
 */
export function createBrowserReader(): BrowserMultiFormatReader {
  return new BrowserMultiFormatReader(buildDecodeHints());
}

/**
 * Construct a fresh low-level {@link MultiFormatReader} for one-shot
 * decodes against an `ImageData` (canvas snapshot). The browser
 * reader can do this too via `decodeFromCanvas`, but going through
 * the lower-level API lets us pre-build the `BinaryBitmap` ourselves
 * which is a few percent faster on the manual scan hot path.
 */
export function createImageDataReader(): MultiFormatReader {
  const reader = new MultiFormatReader();
  reader.setHints(buildDecodeHints());
  return reader;
}

/**
 * Convert an RGBA `ImageData.data` buffer (4 bytes per pixel) to a
 * grayscale luminance buffer (1 byte per pixel) using YIQ/Rec.601
 * weights — the same conversion `@zxing/browser`'s
 * `HTMLCanvasElementLuminanceSource` performs.
 *
 * This step is **mandatory** for zxing decoding: `RGBLuminanceSource`
 * with a `Uint8ClampedArray` input treats each byte as a luminance
 * pixel directly. Feeding it raw RGBA produces a scrambled bitmap
 * that misses essentially every barcode.
 *
 * Fully-transparent pixels (alpha === 0) are forced to white (0xFF)
 * because they're typically used as the "paper" background of a
 * rendered barcode.
 */
function rgbaToLuminance(image: ImageData): Uint8ClampedArray {
  const { data, width, height } = image;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    const alpha = data[i + 3] ?? 0;
    if (alpha === 0) {
      out[j] = 0xff;
      continue;
    }
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    // 0.299·R + 0.587·G + 0.114·B (Rec.601). Bit-shifted form
    // (306·R + 601·G + 117·B + 0x200) >> 10 matches zxing's reference
    // browser source byte-for-byte.
    out[j] = (306 * r + 601 * g + 117 * b + 0x200) >> 10;
  }
  return out;
}

/**
 * Convert an RGBA {@link ImageData} to a zxing {@link BinaryBitmap}.
 *
 * Steps:
 *   1. Reduce RGBA → 1-byte-per-pixel luminance.
 *   2. Build an `RGBLuminanceSource` over that buffer.
 *   3. Wrap it in a `HybridBinarizer` (best general-purpose
 *      binarizer for the 1-D + 2-D format mix we support).
 *   4. Wrap that in a `BinaryBitmap` for the reader.
 *
 * Step 1 was missing prior to v1.0.12: the RGBA buffer was passed
 * straight in, which made `RGBLuminanceSource` interpret every fourth
 * byte (the alpha channel) as a real pixel and shifted every row.
 * That single bug explained why Code-128 book labels — and most
 * non-trivial QR codes — failed to decode in v1.0.10 / v1.0.11.
 */
export function imageDataToBitmap(image: ImageData): BinaryBitmap {
  const lum = rgbaToLuminance(image);
  const luminance = new RGBLuminanceSource(lum, image.width, image.height);
  return new BinaryBitmap(new HybridBinarizer(luminance));
}

/**
 * 2-D point in image coordinates (origin top-left). Used by both the
 * decoder location output and the SVG tracking overlay.
 */
export interface Point2D {
  x: number;
  y: number;
}

export interface DecodedResult {
  /** Decoded payload text. */
  text: string;
  /** Which preprocessing variant produced the hit (for diagnostics). */
  variant: PreprocessVariant;
  /** Which barcode format matched, e.g. `'CODE_128'`. */
  format: string;
  /**
   * Polygon outlining the decoded barcode in input-image coordinates
   * (typically the ROI crop, occasionally the full frame). 2 points
   * for 1-D barcodes (start + end of the bar pattern), 4 points for
   * QR / Data Matrix (the corners). Always present when the decoder
   * exposes location info; `null` when no location was returned.
   *
   * The live tracking overlay transforms these from ROI-pixel space
   * to overlay-CSS space at render time.
   */
  location: Point2D[] | null;
  /** Which decoder produced the hit. `'zxing'` or `'jsqr'`. */
  source: 'zxing' | 'jsqr';
}

/**
 * Convert zxing's `ResultPoint[]` into our portable `Point2D[]`.
 * Returns `null` when the result has no points (rare — `getResultPoints`
 * may return an empty array on malformed bitmaps).
 */
function extractZxingLocation(result: Result): Point2D[] | null {
  const points = result.getResultPoints();
  if (!points || points.length === 0) return null;
  const out: Point2D[] = [];
  for (const p of points as ResultPoint[]) {
    if (!p) continue;
    out.push({ x: p.getX(), y: p.getY() });
  }
  return out.length > 0 ? out : null;
}

/**
 * Single decode pass — apply the variant, build the bitmap, run the
 * reader. Returns `null` on a clean `NotFoundException`. Any other
 * error is rethrown so the caller can surface it (it would indicate
 * a deeper bug — bad ImageData, broken zxing build, etc.).
 *
 * The reader is reset between calls because zxing's stateful
 * binarizer cache otherwise carries over between unrelated frames
 * and can return stale results during retry passes.
 */
function decodeOnce(
  reader: MultiFormatReader,
  image: ImageData,
  variant: PreprocessVariant,
): DecodedResult | null {
  const processed = applyPreprocess(image, variant);
  const bitmap = imageDataToBitmap(processed);
  try {
    const result: Result = reader.decode(bitmap);
    return {
      text: result.getText(),
      variant,
      format:
        BarcodeFormat[result.getBarcodeFormat()] ?? String(result.getBarcodeFormat()),
      location: extractZxingLocation(result),
      source: 'zxing',
    };
  } catch (e) {
    if (e instanceof NotFoundException) {
      return null;
    }
    throw e;
  } finally {
    reader.reset();
  }
}

/**
 * Manual-scan retry pipeline. Tries each variant in order; returns
 * the first successful decode, or `null` if all variants miss.
 *
 * Default order is {@link MANUAL_RETRY_VARIANTS}: normal → contrast
 * → grayscale → inverted → brighten → darken → adaptiveThreshold.
 * Tuned for Indonesian classroom lighting + phone-screen QR mix.
 */
export function decodeWithRetry(
  reader: MultiFormatReader,
  image: ImageData,
  variants: PreprocessVariant[] = MANUAL_RETRY_VARIANTS,
): DecodedResult | null {
  for (const variant of variants) {
    const hit = decodeOnce(reader, image, variant);
    if (hit) {
      return hit;
    }
  }
  return null;
}

/**
 * jsQR adapter — focused QR-only decoder used as a fallback after
 * zxing misses. jsQR's binarizer (a custom one tuned for camera-grade
 * QR codes) outperforms zxing on:
 *
 * - Phone-screen QR codes (moiré pattern between the screen raster
 *   and the webcam raster).
 * - Low-resolution QR (zxing wants ≥ ~80 px per side; jsQR holds up
 *   to ~50 px).
 * - QR codes near the viewport edge that zxing's "centred" finder
 *   pattern search rejects.
 *
 * Returns the same {@link DecodedResult} shape as zxing for a
 * uniform consumer experience. The location polygon comes straight
 * from jsQR's `location` (4 corners) — finder patterns are dropped
 * because the overlay only needs the outer rectangle.
 *
 * `inversionAttempts` defaults to `'attemptBoth'` so jsQR also tries
 * the inverted image (matches our zxing `ALSO_INVERTED` hint and
 * makes dark-mode QR codes a one-call decode).
 */
export function decodeWithJsQR(image: ImageData): DecodedResult | null {
  if (image.width <= 0 || image.height <= 0) return null;
  const result = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (!result) return null;
  const loc = result.location;
  // jsQR's location object always has the 4 corner fields populated,
  // but we still defend against unexpected shapes since it's a
  // run-time input from a third-party library.
  const corners: Point2D[] = [
    loc.topLeftCorner,
    loc.topRightCorner,
    loc.bottomRightCorner,
    loc.bottomLeftCorner,
  ]
    .filter((p): p is { x: number; y: number } => !!p && typeof p.x === 'number')
    .map((p) => ({ x: p.x, y: p.y }));
  return {
    text: result.data,
    variant: 'normal',
    format: 'QR_CODE',
    location: corners.length > 0 ? corners : null,
    source: 'jsqr',
  };
}

/**
 * Combined decoder used by both the continuous loop and the manual
 * scan button. Tries zxing first (covers Code-128, Code-39, EAN-13/8,
 * QR, Data Matrix) and falls back to jsQR on a miss for the QR-only
 * cases zxing's QR reader rejects.
 *
 * The fallback runs strictly after zxing because:
 * - zxing is faster on average across our format mix.
 * - jsQR returns spurious matches on tightly-packed Code-128 labels
 *   (their guard bars sometimes look like a QR finder pattern under
 *   certain crops). Running jsQR only when zxing misses sidesteps
 *   this.
 *
 * `variants` controls how many zxing preprocess passes to run before
 * trying jsQR. Continuous decode passes `[currentVariant]` (one
 * variant per tick), manual decode passes the full
 * {@link MANUAL_RETRY_VARIANTS}.
 */
export function decodeAny(
  reader: MultiFormatReader,
  image: ImageData,
  variants: PreprocessVariant[] = MANUAL_RETRY_VARIANTS,
): DecodedResult | null {
  const zxingHit = decodeWithRetry(reader, image, variants);
  if (zxingHit) return zxingHit;
  return decodeWithJsQR(image);
}

/**
 * Rotation angles tried by {@link decodeAnyWithRotations} after the
 * unrotated frame fails. 0 first (matches the manual-scan happy
 * path), then 180° (most common case for upside-down books on a
 * desk), then 90/270° (sideways labels — less common but does happen
 * when stocktake operators tilt a book on its spine).
 */
const ROTATION_RETRY_ANGLES: ReadonlyArray<0 | 90 | 180 | 270> = [0, 180, 90, 270];

/**
 * Manual-scan retry pipeline with **angle rotation** fallback.
 *
 * Used by the "Scan Sekarang" button after every preprocess variant
 * misses. We rotate the ROI 180°/90°/270° and re-run a small subset
 * of the variants on each rotated copy. This rescues:
 *
 * - Books / phones held upside-down at the camera (180°).
 * - Barcodes oriented vertically because the operator turned a
 *   book on its spine (90° / 270°).
 * - Code-128 labels printed in the "wrong" direction on a card
 *   (rare but happens with imported textbooks).
 *
 * Per-rotation variant subset is intentionally small (`['normal',
 * 'contrast', 'blur']`) because (a) rotation already costs O(N)
 * pixels of allocation and (b) most lighting/exposure variants are
 * orientation-independent so we don't need to re-try them.
 *
 * Returns the first decoded hit. The returned `location` is in the
 * ROTATED image's coordinate space — the caller is responsible for
 * un-rotating it back to ROI space if it wants the live tracking
 * overlay to follow the result. Continuous decode does not invoke
 * this function for that exact reason.
 */
export function decodeAnyWithRotations(
  reader: MultiFormatReader,
  image: ImageData,
  variants: PreprocessVariant[] = MANUAL_RETRY_VARIANTS,
  rotationVariants: PreprocessVariant[] = ['normal', 'contrast', 'blur'],
): DecodedResult | null {
  for (const angle of ROTATION_RETRY_ANGLES) {
    const rotated = angle === 0 ? image : applyRotation(image, angle);
    const hitVariants = angle === 0 ? variants : rotationVariants;
    const hit = decodeAny(reader, rotated, hitVariants);
    if (hit) {
      return hit;
    }
  }
  return null;
}
