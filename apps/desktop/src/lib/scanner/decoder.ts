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
 * We deliberately keep the same library family the app already
 * shipped (zxing) — switching to quagga2 would have meant a fresh
 * audit of decode rates, license, and bundle size. zxing already
 * supports every format we need; the v1.0.7 hint list just didn't
 * include Data Matrix.
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
} from '@zxing/library';
import {
  applyPreprocess,
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
 * `TRY_HARDER` enables the slower-but-more-thorough decode path. The
 * frame budget on a manual click is generous (~500ms) so the perf
 * cost is fine, and it noticeably improves the catch rate on
 * partially-occluded or skewed barcodes.
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
 * Convert an RGBA {@link ImageData} to a zxing {@link BinaryBitmap}.
 *
 * Steps:
 *   1. Build an `RGBLuminanceSource` directly from the RGBA bytes.
 *      zxing provides a constructor for this exact shape.
 *   2. Wrap it in a `HybridBinarizer` (best general-purpose
 *      binarizer for the 1-D + 2-D format mix we support).
 *   3. Wrap that in a `BinaryBitmap` for the reader.
 */
export function imageDataToBitmap(image: ImageData): BinaryBitmap {
  const luminance = new RGBLuminanceSource(image.data, image.width, image.height);
  return new BinaryBitmap(new HybridBinarizer(luminance));
}

export interface DecodedResult {
  /** Decoded payload text. */
  text: string;
  /** Which preprocessing variant produced the hit (for diagnostics). */
  variant: PreprocessVariant;
  /** Which barcode format matched, e.g. `'CODE_128'`. */
  format: string;
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
      format: BarcodeFormat[result.getBarcodeFormat()] ?? String(result.getBarcodeFormat()),
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
 * → grayscale, tuned for Indonesian classroom lighting.
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
