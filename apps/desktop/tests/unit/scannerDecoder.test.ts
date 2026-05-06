import { describe, expect, it, vi } from 'vitest';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import {
  buildDecodeHints,
  createImageDataReader,
  decodeWithRetry,
  imageDataToBitmap,
  SUPPORTED_FORMATS,
} from '@/lib/scanner/decoder';
import { MANUAL_RETRY_VARIANTS } from '@/lib/scanner/preprocess';

/**
 * Minimal RGBA `ImageData` factory shared with the preprocess tests —
 * we don't need a real Canvas because zxing only ever reads `.data`,
 * `.width`, `.height` from the input.
 */
function blankImage(width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  } as ImageData;
}

describe('buildDecodeHints', () => {
  it('declares the FEAT-28 format set including Data Matrix', () => {
    const hints = buildDecodeHints();
    const formats = hints.get(DecodeHintType.POSSIBLE_FORMATS) as BarcodeFormat[];
    expect(formats).toContain(BarcodeFormat.CODE_128);
    expect(formats).toContain(BarcodeFormat.CODE_39);
    expect(formats).toContain(BarcodeFormat.EAN_13);
    expect(formats).toContain(BarcodeFormat.EAN_8);
    expect(formats).toContain(BarcodeFormat.QR_CODE);
    // Data Matrix is the new addition vs v1.0.7's narrower hint list.
    expect(formats).toContain(BarcodeFormat.DATA_MATRIX);
  });

  it('enables TRY_HARDER for the slower-but-thorough decode path', () => {
    const hints = buildDecodeHints();
    expect(hints.get(DecodeHintType.TRY_HARDER)).toBe(true);
  });

  it('SUPPORTED_FORMATS is the same list (single source of truth)', () => {
    const hints = buildDecodeHints();
    expect(hints.get(DecodeHintType.POSSIBLE_FORMATS)).toEqual(SUPPORTED_FORMATS);
  });
});

describe('imageDataToBitmap', () => {
  it('builds a BinaryBitmap with the same dimensions as the source', () => {
    const img = blankImage(80, 40);
    const bitmap = imageDataToBitmap(img);
    expect(bitmap.getWidth()).toBe(80);
    expect(bitmap.getHeight()).toBe(40);
  });
});

describe('createImageDataReader', () => {
  it('produces a fresh MultiFormatReader instance', () => {
    const a = createImageDataReader();
    const b = createImageDataReader();
    expect(a).not.toBe(b);
  });
});

describe('decodeWithRetry', () => {
  /**
   * Build a stub reader whose `decode()` returns a NotFoundException
   * for every call until the configured number of attempts is reached,
   * at which point it returns a fake `Result`-like object.
   *
   * `failTimes` controls how many variants should miss before the
   * stub starts returning hits. The order of variant calls is
   * inferred from the order the stub is invoked — the stub records
   * each call so the test can assert on it.
   */
  function stubReader(failTimes: number, hitText = 'OK', hitFormat = BarcodeFormat.CODE_128) {
    let calls = 0;
    const decode = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls <= failTimes) {
        throw new NotFoundException();
      }
      return {
        getText: () => hitText,
        getBarcodeFormat: () => hitFormat,
        // Provide an empty result-point list so the v1.0.11 location
        // extractor short-circuits to `null` instead of throwing.
        getResultPoints: () => [],
      };
    });
    const reset = vi.fn();
    return { decode, reset, getCalls: () => calls } as unknown as ReturnType<
      typeof createImageDataReader
    > & { getCalls: () => number };
  }

  it('returns null when every variant misses', () => {
    const reader = stubReader(99);
    const result = decodeWithRetry(reader, blankImage(10, 10));
    expect(result).toBeNull();
    // Exactly one decode pass per default variant.
    expect(
      (reader as unknown as { decode: { mock: { calls: unknown[] } } }).decode.mock.calls
        .length,
    ).toBe(MANUAL_RETRY_VARIANTS.length);
  });

  it('returns the first successful hit and stops trying further variants', () => {
    // Stub fails 1 attempt, hits on the 2nd → "contrast" pass.
    const reader = stubReader(1, 'EAN-13-PAYLOAD', BarcodeFormat.EAN_13);
    const result = decodeWithRetry(reader, blankImage(10, 10));
    expect(result).not.toBeNull();
    expect(result!.text).toBe('EAN-13-PAYLOAD');
    expect(result!.variant).toBe('contrast');
    expect(result!.format).toBe('EAN_13');
    expect((reader as unknown as { decode: { mock: { calls: unknown[] } } }).decode.mock.calls.length).toBe(2);
  });

  it("returns variant 'normal' when the first pass already hits", () => {
    const reader = stubReader(0, 'CODE-128-OK', BarcodeFormat.CODE_128);
    const result = decodeWithRetry(reader, blankImage(10, 10));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('normal');
    expect(result!.format).toBe('CODE_128');
    expect((reader as unknown as { decode: { mock: { calls: unknown[] } } }).decode.mock.calls.length).toBe(1);
  });

  it('honors a caller-supplied variant order', () => {
    // Reader hits on the 1st call regardless. Use a single-variant
    // override to assert the override is respected.
    const reader = stubReader(0, 'X', BarcodeFormat.QR_CODE);
    const result = decodeWithRetry(reader, blankImage(10, 10), ['grayscale']);
    expect(result!.variant).toBe('grayscale');
    expect(result!.format).toBe('QR_CODE');
  });

  it('rethrows non-NotFoundException errors so the caller can surface them', () => {
    const decode = vi.fn().mockImplementation(() => {
      throw new Error('zxing internal');
    });
    const reset = vi.fn();
    const reader = { decode, reset } as unknown as ReturnType<typeof createImageDataReader>;
    expect(() => decodeWithRetry(reader, blankImage(10, 10))).toThrow('zxing internal');
  });
});
