/**
 * Image fit math + canvas helpers — used by KTA PDF / Cetak / Preview to
 * preserve aspect ratio of foto / TTD slots instead of stretching to the
 * raw rectangle size.
 *
 * BUG-19 — `jsPDF.addImage(data, 'AUTO', x, y, w, h)` always stretches the
 * source to the exact `w × h` rectangle; the `'AUTO'` format flag controls
 * codec auto-detection, NOT aspect-ratio preservation. The print HTML and
 * the live preview already use `object-fit: cover` for foto and
 * `object-fit: contain` for TTD, so the visual divergence between
 * "Cetak" / "Preview" and "Export PDF" was glaring.
 *
 * The functions here are framework-agnostic and pure (deterministic
 * input → output), which makes them trivial to unit-test without a DOM.
 * The canvas helpers (`coverCropToDataUrl`, `containInsetToDataUrl`)
 * wrap the pure helpers with a minimal browser-side render path so PDF
 * code can keep using `addImage` with a pre-cropped data URL.
 */
export interface FitRect {
  /** Destination x offset, in destination units (mm or px). */
  dx: number;
  /** Destination y offset. */
  dy: number;
  /** Destination width. */
  dw: number;
  /** Destination height. */
  dh: number;
}

export interface CoverCrop {
  /** Source crop x offset, in source pixels. */
  sx: number;
  /** Source crop y offset, in source pixels. */
  sy: number;
  /** Source crop width, in source pixels. */
  sw: number;
  /** Source crop height, in source pixels. */
  sh: number;
}

/**
 * Compute the source rectangle (in source pixels) to crop from a
 * `srcW × srcH` image so the result, scaled to fill `dstW × dstH`,
 * preserves the source aspect ratio with center-cropped overflow —
 * the CSS `object-fit: cover` / `background-size: cover` semantics.
 *
 * The destination rect is always `{ dx: 0, dy: 0, dw: dstW, dh: dstH }`
 * because the cropped source IS the new output rectangle. Pair the
 * returned crop with a canvas `drawImage(img, sx, sy, sw, sh, 0, 0,
 * dstW, dstH)` call to render.
 */
export function computeCoverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverCrop {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(srcW, 0), sh: Math.max(srcH, 0) };
  }
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    // Source is "wider than destination" — crop horizontal overflow.
    const sh = srcH;
    const sw = sh * dstRatio;
    const sx = (srcW - sw) / 2;
    return { sx, sy: 0, sw, sh };
  }
  // Source is "taller than destination" (or equal) — crop vertical overflow.
  const sw = srcW;
  const sh = sw / dstRatio;
  const sy = (srcH - sh) / 2;
  return { sx: 0, sy, sw, sh };
}

/**
 * Compute the inset destination rectangle for a `srcW × srcH` image
 * placed inside a `dstW × dstH` slot using `object-fit: contain`
 * semantics — preserve aspect ratio, fit fully inside the slot,
 * center the result, leave letter-/pillar-box margins. The returned
 * `dx/dy` are offsets relative to the slot's top-left.
 *
 * This is the right shape for TTD signatures: never crop, leave
 * blank space at the edges if the slot's aspect doesn't match.
 */
export function computeContainFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): FitRect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { dx: 0, dy: 0, dw: Math.max(dstW, 0), dh: Math.max(dstH, 0) };
  }
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    // Source wider — fit width, pillarbox top/bottom.
    const dw = dstW;
    const dh = dw / srcRatio;
    const dy = (dstH - dh) / 2;
    return { dx: 0, dy, dw, dh };
  }
  // Source taller (or equal) — fit height, letterbox left/right.
  const dh = dstH;
  const dw = dh * srcRatio;
  const dx = (dstW - dw) / 2;
  return { dx, dy: 0, dw, dh };
}

/**
 * Load an image from a URL (file://, data:, blob:, or http(s)) and
 * resolve to an `HTMLImageElement` once it has decoded. Rejects on
 * decode error so callers can fall back to a placeholder.
 *
 * `crossOrigin = 'anonymous'` is set so canvas reads stay un-tainted
 * for `data:` URLs; same-origin / data URLs are unaffected.
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${url.slice(0, 64)}…`));
    img.src = url;
  });
}

/**
 * Default DPI used when sizing the offscreen canvas. 300 dpi is the
 * standard high-quality print density; jsPDF renders at 1mm = 1 unit
 * regardless, so the canvas oversampling controls visual sharpness
 * once the PDF is opened in a reader.
 */
const DEFAULT_DPI = 300;
const MM_PER_INCH = 25.4;

function dpiToPxPerMm(dpi: number): number {
  return dpi / MM_PER_INCH;
}

/**
 * Render a cover-cropped version of `srcUrl` into a PNG `data:` URL
 * sized to `dstWMm × dstHMm` at `dpi` (default 300). The output is
 * suitable for `jsPDF.addImage(data, 'PNG', x, y, dstWMm, dstHMm)`
 * — the cropping has already happened, so jsPDF's stretch-to-rect
 * behaviour is harmless.
 */
export async function coverCropToDataUrl(
  srcUrl: string,
  dstWMm: number,
  dstHMm: number,
  dpi: number = DEFAULT_DPI,
): Promise<string> {
  const img = await loadImageElement(srcUrl);
  const pxPerMm = dpiToPxPerMm(dpi);
  const dstWPx = Math.max(1, Math.round(dstWMm * pxPerMm));
  const dstHPx = Math.max(1, Math.round(dstHMm * pxPerMm));
  const crop = computeCoverCrop(img.naturalWidth, img.naturalHeight, dstWPx, dstHPx);

  const canvas = document.createElement('canvas');
  canvas.width = dstWPx;
  canvas.height = dstHPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dstWPx, dstHPx);
  return canvas.toDataURL('image/png');
}
