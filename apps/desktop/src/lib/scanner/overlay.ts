/**
 * Scanner overlay geometry helpers (FEAT-28 PR J).
 *
 * The webcam feed in Sirkulasi paints a rectangular "aiming guide" on
 * top of the `<video>` element so the operator knows where to place the
 * barcode. The same rectangle is also used to crop the video frame
 * before passing pixels to the decoder, which both speeds up decode
 * (~4× fewer pixels) and reduces background noise from the room behind
 * the book.
 *
 * Two coordinate systems matter here:
 *
 * - **Percentages** (`ROI_PERCENT`): independent of the camera
 *   resolution. Used by the React component to position the overlay
 *   `<div>` via inline `top/left/width/height` styles. The overlay is
 *   purely cosmetic so percentages are perfect.
 *
 * - **Pixels** ({@link computeRoi}): tied to the video's intrinsic
 *   `videoWidth` / `videoHeight`. Used at decode time to call
 *   `getImageData(x, y, w, h)` on a hidden canvas — that one needs
 *   absolute integer coordinates.
 *
 * Both halves are derived from the same constants so they always stay
 * in sync.
 */

/**
 * ROI rectangle as a fraction of the video frame.
 *
 * - 70% width × 55% height (v1.0.11) — wider than the v1.0.10
 *   70% × 30% rectangle so square QR codes (and Data Matrix) fit
 *   comfortably alongside landscape Code-128 / EAN labels. The
 *   55% height is a compromise: tall enough that a centered QR at
 *   normal arm's-length distance fills most of the box, short enough
 *   that the operator still sees their hands and the surroundings
 *   for context.
 * - Centered (left/top = (1 - size)/2). Easier for operators than
 *   off-center alignment and matches every other phone-camera
 *   scanner UI in the wild.
 */
export const ROI_PERCENT = {
  width: 0.7,
  height: 0.55,
} as const;

export interface RoiRect {
  /** Pixel offset from the left edge of the video frame. */
  x: number;
  /** Pixel offset from the top edge of the video frame. */
  y: number;
  /** Width of the ROI in pixels. */
  width: number;
  /** Height of the ROI in pixels. */
  height: number;
}

/**
 * Compute the pixel-aligned ROI rectangle for a given video frame size.
 *
 * Returns integer pixel coordinates because Canvas `getImageData`
 * silently truncates fractions and we'd rather control the rounding
 * than have it bias one side by half a pixel each frame.
 *
 * Falls back to a zero-sized rect (centered at `videoWidth/2`,
 * `videoHeight/2`) if either dimension is non-positive — the decoder
 * is expected to short-circuit on a 0×0 region rather than throwing.
 */
export function computeRoi(videoWidth: number, videoHeight: number): RoiRect {
  if (
    !Number.isFinite(videoWidth) ||
    !Number.isFinite(videoHeight) ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const width = Math.round(videoWidth * ROI_PERCENT.width);
  const height = Math.round(videoHeight * ROI_PERCENT.height);
  const x = Math.round((videoWidth - width) / 2);
  const y = Math.round((videoHeight - height) / 2);
  return { x, y, width, height };
}

/**
 * Length of the bracket "elbow" drawn at each corner of the overlay,
 * as a fraction of the *shorter* dimension of the ROI.
 *
 * 12% gives an elbow that's clearly visible at common video sizes
 * (480p–1080p) without overpowering the rectangle. The bracket arms
 * are the same length on both axes, computed from the shorter side, so
 * a wide-and-short ROI doesn't end up with stretched-looking elbows.
 */
export const BRACKET_LENGTH_FRACTION = 0.12;

export interface BracketSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Compute the 8 line segments that form the corner bracket overlay.
 *
 * Each corner is two perpendicular line segments (one horizontal, one
 * vertical) starting from the corner point and extending inward by
 * `armLength`. The order is: top-left H, top-left V, top-right H,
 * top-right V, bottom-right H, bottom-right V, bottom-left H,
 * bottom-left V.
 *
 * Coordinates are in the same space as the input rectangle — typically
 * pixels for a Canvas overlay or a normalised 0..1 range for SVG.
 */
export function computeCornerBrackets(rect: RoiRect): BracketSegment[] {
  const arm = Math.max(0, Math.min(rect.width, rect.height) * BRACKET_LENGTH_FRACTION);
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return [
    // top-left: horizontal arm pointing right, vertical arm pointing down
    { x1: left, y1: top, x2: left + arm, y2: top },
    { x1: left, y1: top, x2: left, y2: top + arm },
    // top-right: horizontal arm pointing left, vertical arm pointing down
    { x1: right, y1: top, x2: right - arm, y2: top },
    { x1: right, y1: top, x2: right, y2: top + arm },
    // bottom-right: horizontal arm pointing left, vertical arm pointing up
    { x1: right, y1: bottom, x2: right - arm, y2: bottom },
    { x1: right, y1: bottom, x2: right, y2: bottom - arm },
    // bottom-left: horizontal arm pointing right, vertical arm pointing up
    { x1: left, y1: bottom, x2: left + arm, y2: bottom },
    { x1: left, y1: bottom, x2: left, y2: bottom - arm },
  ];
}
