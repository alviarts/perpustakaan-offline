/**
 * End-to-end barcode decode scenarios for v1.0.11.
 *
 * The user explicitly asked for the scanner to be tested with dark,
 * low-contrast, total-darkness, and inverted barcodes — not just unit
 * tests of individual transforms. This file generates real QR codes
 * with the `qrcode` library, renders them into ImageData buffers
 * under various adverse lighting conditions, and asserts that:
 *
 * 1. The full decode pipeline (zxing retry chain + jsQR fallback)
 *    reads them back.
 * 2. The dark-frame guard short-circuits on pitch-black inputs
 *    without throwing.
 * 3. Each preprocess variant produces output the decoder can act on
 *    (i.e. the scanner stays responsive under classroom lighting).
 *
 * The intent is to reproduce the failure modes the user reported in
 * v1.0.10 (QR codes that are clearly visible to the eye but that the
 * decoder misses) and to confirm v1.0.11 fixes them. Each scenario
 * is named in plain language so a regression makes the failure
 * obvious without deep-diving into the test code.
 */
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import {
  createImageDataReader,
  decodeAny,
  decodeWithJsQR,
  decodeWithRetry,
} from '@/lib/scanner/decoder';
import {
  analyzeImageStats,
  applyGamma,
  applyInvert,
  CONTINUOUS_VARIANTS,
} from '@/lib/scanner/preprocess';

interface QrImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Render a synthetic QR code into an `ImageData`-shaped buffer at a
 * configurable scale + with optional horizontal padding so jsQR /
 * zxing have a real "quiet zone" around the symbol.
 *
 * - `text`: payload to encode.
 * - `scale`: pixels per QR module. Real cameras typically deliver
 *   3–6 px/module; we default to 6 for crisp tests and step down
 *   in low-resolution scenarios.
 * - `quietZone`: extra modules of white border. The QR spec mandates
 *   ≥4. Skipping the quiet zone is the most common reason zxing
 *   misses an otherwise-clear QR.
 * - `darkColor` / `lightColor`: rendered "ink" intensities. Adjust
 *   to simulate low contrast (`darkColor` close to `lightColor`).
 * - `invert`: swap dark and light to simulate dark-mode QR codes
 *   on phone screens.
 */
function renderQR(
  text: string,
  options: {
    scale?: number;
    quietZone?: number;
    darkColor?: number;
    lightColor?: number;
    invert?: boolean;
  } = {},
): QrImage {
  const scale = options.scale ?? 6;
  const quietZone = options.quietZone ?? 4;
  const darkColor = options.darkColor ?? 0;
  const lightColor = options.lightColor ?? 255;
  const matrix = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const moduleSize = matrix.modules.size;
  const modules = matrix.modules.data;
  const sideModules = moduleSize + quietZone * 2;
  const sidePixels = sideModules * scale;
  const data = new Uint8ClampedArray(sidePixels * sidePixels * 4);
  for (let py = 0; py < sidePixels; py++) {
    for (let px = 0; px < sidePixels; px++) {
      const mx = Math.floor(px / scale) - quietZone;
      const my = Math.floor(py / scale) - quietZone;
      let isDark = false;
      if (mx >= 0 && mx < moduleSize && my >= 0 && my < moduleSize) {
        isDark = modules[my * moduleSize + mx] === 1;
      }
      const dark = options.invert ? !isDark : isDark;
      const v = dark ? darkColor : lightColor;
      const i = (py * sidePixels + px) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: sidePixels, height: sidePixels };
}

/** Dim every channel by a fixed multiplier (simulates underexposure). */
function darken(img: QrImage, factor: number): QrImage {
  const data = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    data[i] = Math.round((img.data[i] ?? 0) * factor);
    data[i + 1] = Math.round((img.data[i + 1] ?? 0) * factor);
    data[i + 2] = Math.round((img.data[i + 2] ?? 0) * factor);
    data[i + 3] = img.data[i + 3] ?? 255;
  }
  return { data, width: img.width, height: img.height };
}

describe('Scanner scenarios — bright / well-lit (baseline)', () => {
  it('decodes a high-contrast QR via jsQR path', () => {
    const img = renderQR('SCAN-OK-001', { scale: 6 });
    const result = decodeWithJsQR(img as ImageData);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('SCAN-OK-001');
    // Location polygon present so the live tracking overlay can render.
    expect(result!.location).not.toBeNull();
    expect(result!.location!.length).toBe(4);
    expect(result!.source).toBe('jsqr');
  });

  it('decodes via the combined zxing+jsQR pipeline', () => {
    const reader = createImageDataReader();
    const img = renderQR('SCAN-OK-002', { scale: 6 });
    const result = decodeAny(reader, img as ImageData, ['normal']);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('SCAN-OK-002');
  });
});

describe('Scanner scenarios — dark / underexposed', () => {
  it('decodes a 25%-brightness QR (reportedly the user complaint case)', () => {
    const bright = renderQR('DARK-25PCT', { scale: 6 });
    const dim = darken(bright, 0.25);
    const stats = analyzeImageStats(dim as ImageData);
    expect(stats.mean).toBeLessThan(80);
    // jsQR alone may struggle; the brighten variant rescues it.
    const reader = createImageDataReader();
    const result = decodeAny(reader, dim as ImageData, [
      'normal',
      'brighten',
      'contrast',
    ]);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('DARK-25PCT');
  });

  it('decodes a really dim QR (≈10% brightness) after gamma rescue', () => {
    const bright = renderQR('VERY-DIM-QR', { scale: 6 });
    const dim = darken(bright, 0.1);
    const stats = analyzeImageStats(dim as ImageData);
    expect(stats.mean).toBeLessThan(40);
    // Apply the brighten variant manually so we directly test that
    // the gamma curve recovers a usable bitmap.
    const recovered = applyGamma(dim as ImageData, 0.4);
    const result = decodeWithJsQR(recovered);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('VERY-DIM-QR');
  });

  it('returns null cleanly on a pitch-black frame (dark-frame guard scenario)', () => {
    // Empty pixels → mean ≈ 0. The decoder must not crash and must
    // not return a phantom result.
    const black: QrImage = {
      data: new Uint8ClampedArray(64 * 64 * 4),
      width: 64,
      height: 64,
    };
    const stats = analyzeImageStats(black as ImageData);
    expect(stats.max).toBeLessThan(10);
    const reader = createImageDataReader();
    expect(() =>
      decodeAny(reader, black as ImageData, ['normal', 'brighten']),
    ).not.toThrow();
    expect(decodeWithJsQR(black as ImageData)).toBeNull();
  });
});

describe('Scanner scenarios — low contrast', () => {
  it('decodes a moderately low-contrast QR via the contrast variant', () => {
    // Inks compressed into a 90-200 range — flat-but-still-decodable.
    // This is the realistic ceiling for what the decoder can handle
    // without an explicit adaptive-threshold pass.
    const img = renderQR('LOW-CONTRAST', {
      scale: 6,
      darkColor: 90,
      lightColor: 200,
    });
    const stats = analyzeImageStats(img as ImageData);
    expect(stats.max - stats.min).toBeLessThan(130);
    const reader = createImageDataReader();
    const result = decodeAny(reader, img as ImageData, [
      'normal',
      'contrast',
      'adaptiveThreshold',
    ]);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('LOW-CONTRAST');
  });

  it('survives an extreme low-contrast frame (≤40 range) without throwing', () => {
    // Both inks compressed into a 110-150 range. zxing + jsQR may
    // both miss this — the important property is that no decoder
    // throws and the dark-frame guard does not fire (max ≥ 10).
    const img = renderQR('EXTREME-LOW-CONTRAST', {
      scale: 6,
      darkColor: 110,
      lightColor: 150,
    });
    const stats = analyzeImageStats(img as ImageData);
    expect(stats.max).toBeGreaterThan(10);
    const reader = createImageDataReader();
    expect(() =>
      decodeAny(reader, img as ImageData, [
        'normal',
        'contrast',
        'brighten',
        'adaptiveThreshold',
      ]),
    ).not.toThrow();
  });
});

describe('Scanner scenarios — inverted (dark-mode phone screen)', () => {
  it('decodes a white-on-black QR via jsQR attemptBoth', () => {
    // White QR on black background — common when the user sticks a
    // phone in dark mode against a webcam. jsQR's `attemptBoth`
    // mode handles this without any preprocess, which is exactly
    // why we plumb jsQR in as a fallback.
    const inverted = renderQR('DARK-MODE-QR', { scale: 6, invert: true });
    const direct = decodeWithJsQR(inverted as ImageData);
    expect(direct).not.toBeNull();
    expect(direct!.text).toBe('DARK-MODE-QR');
  });

  it('decodeAny() catches dark-mode QR via the jsQR fallback even when zxing misses', () => {
    // Reproduces the user-reported v1.0.10 failure: a dark-mode QR
    // that zxing's binarizer rejects as not-a-finder-pattern. The
    // combined pipeline must still hand back a decode.
    const inverted = renderQR('FALLBACK-QR', { scale: 6, invert: true });
    const reader = createImageDataReader();
    const result = decodeAny(reader, inverted as ImageData, ['normal']);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('FALLBACK-QR');
  });

  it('the inverted preprocess variant flips bits cleanly (255 − v)', () => {
    // Verify the variant itself: a re-inverted dark-mode QR should
    // be byte-equivalent to the original light-mode QR (modulo
    // alpha). Used by the manual scan retry chain.
    const inverted = renderQR('INV-CHECK', { scale: 6, invert: true });
    const reInverted = applyInvert(inverted as ImageData);
    // Background of original was black (0); after re-inversion it's
    // 255 (white) again.
    expect(reInverted.data[0]).toBe(255);
    expect(reInverted.data[1]).toBe(255);
    expect(reInverted.data[2]).toBe(255);
  });
});

describe('Scanner scenarios — glare / overexposed', () => {
  it('decodes a near-saturated QR after darken variant', () => {
    // Compress the dynamic range up against the highlights:
    // dark = 130, light = 250. Mean is way above 200.
    const glare = renderQR('GLARE-QR', {
      scale: 6,
      darkColor: 130,
      lightColor: 250,
    });
    const stats = analyzeImageStats(glare as ImageData);
    expect(stats.mean).toBeGreaterThan(180);
    const reader = createImageDataReader();
    const result = decodeAny(reader, glare as ImageData, [
      'normal',
      'darken',
      'contrast',
    ]);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('GLARE-QR');
  });
});

describe('Scanner scenarios — small / low-res QR', () => {
  it('decodes a 3 px / module QR (about the smallest jsQR can read)', () => {
    const small = renderQR('SMALL-QR', { scale: 3 });
    const result = decodeWithJsQR(small as ImageData);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('SMALL-QR');
  });
});

describe('Scanner scenarios — continuous variant cycle', () => {
  it('every continuous variant survives a moderate-contrast frame without throwing', () => {
    // Same QR rendered with tighter contrast so each variant has a
    // chance to "fail safely" without erroring.
    const img = renderQR('CYCLE-QR', {
      scale: 5,
      darkColor: 60,
      lightColor: 200,
    });
    const reader = createImageDataReader();
    for (const variant of CONTINUOUS_VARIANTS) {
      // Each variant should at minimum return either a Result or
      // null — never throw.
      expect(() => decodeWithRetry(reader, img as ImageData, [variant])).not.toThrow();
    }
  });
});
