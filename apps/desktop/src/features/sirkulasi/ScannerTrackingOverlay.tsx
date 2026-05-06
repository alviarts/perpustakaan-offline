/**
 * Live tracking overlay for the Sirkulasi webcam scanner (v1.0.11).
 *
 * Renders an SVG polygon over the `<video>` element that follows the
 * decoded barcode / QR location returned by the decoder. The polygon:
 *
 * - Is **green** while a recent detection is in flight (≤ ~600 ms ago).
 *   This is the "I see something useful in the frame" feedback —
 *   especially helpful for QR codes where the operator otherwise has
 *   no visual cue that they're aimed correctly.
 * - **Flashes yellow** for ~350 ms after a successful decode (i.e. when
 *   the cooldown gate emits the value to the consumer). This gives the
 *   operator the same kind of "got it" feedback as a physical hand-
 *   scanner's beep + LED.
 * - Fades out cleanly when detections stop landing — no flicker, no
 *   stuck ghost polygons.
 *
 * The polygon is purely decorative — none of the data flow depends on
 * it. If the decoder doesn't report a location (e.g. zxing on a 1-D
 * Code-128 in some library versions), the overlay simply renders
 * nothing and the rest of the UI keeps working.
 *
 * Coordinates: the overlay is positioned over the *ROI rectangle*
 * (the same one painted by {@link ScannerOverlay}). Detection
 * locations are reported in ROI-pixel space (the cropped canvas the
 * decoder ran against) so the SVG transform is just a percentage
 * rescale — no awareness of full-frame geometry needed.
 */
import { type Point2D } from '@/lib/scanner/decoder';
import { ROI_PERCENT } from '@/lib/scanner/overlay';

export interface ScannerTrackingOverlayProps {
  /**
   * Polygon vertices in ROI-pixel coordinates (origin top-left of
   * the ROI crop). Typically 4 points for QR / Data Matrix, 2 for
   * 1-D codes.
   */
  location: Point2D[];
  /** Pixel width of the ROI the location was measured against. */
  roiWidth: number;
  /** Pixel height of the ROI the location was measured against. */
  roiHeight: number;
  /**
   * When true, render the polygon in the "decode succeeded" yellow
   * flash colour rather than the default green. The caller is
   * responsible for clearing this back to `false` after the flash
   * window — typically managed by the scanner hook.
   */
  flash?: boolean;
}

/**
 * Build the SVG `points` attribute for a closed polygon. For 1-D
 * codes (2 points) we emit just the line segment so the overlay
 * shows a bar across the barcode; for 2-D codes (≥3 points) we close
 * the loop into a quad.
 */
function buildPointsAttr(points: Point2D[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export function ScannerTrackingOverlay({
  location,
  roiWidth,
  roiHeight,
  flash = false,
}: ScannerTrackingOverlayProps) {
  if (!location || location.length === 0 || roiWidth <= 0 || roiHeight <= 0) {
    return null;
  }
  // Position the overlay over the same ROI rectangle the
  // ScannerOverlay paints. Computing percentages here keeps the
  // tracking polygon in sync even if the operator resizes the window
  // — the SVG viewBox handles the pixel-to-CSS scaling automatically.
  const left = `${((1 - ROI_PERCENT.width) / 2) * 100}%`;
  const top = `${((1 - ROI_PERCENT.height) / 2) * 100}%`;
  const width = `${ROI_PERCENT.width * 100}%`;
  const height = `${ROI_PERCENT.height * 100}%`;

  // Stroke / fill style:
  // - flash=true → bright yellow + stronger fill (≈ shutter flash).
  // - flash=false → green; lower-opacity fill so the polygon reads as
  //   a "lock-on" outline rather than a solid mask.
  const stroke = flash ? '#facc15' : '#22c55e';
  const fillOpacity = flash ? 0.25 : 0.12;
  const isClosed = location.length >= 3;
  const pointsAttr = buildPointsAttr(location);

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left, top, width, height }}
      data-testid="scanner-tracking-overlay"
      data-flash={flash ? 'true' : 'false'}
    >
      <svg
        viewBox={`0 0 ${roiWidth} ${roiHeight}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        // SVG inherits CSS sizing from the wrapper `<div>` so the
        // polygon grows/shrinks with the video element. Tailwind's
        // `transition-colors` handles the green↔yellow tween.
      >
        {isClosed ? (
          <polygon
            points={pointsAttr}
            fill={stroke}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={Math.max(2, Math.min(roiWidth, roiHeight) * 0.006)}
            strokeLinejoin="round"
            style={{
              filter: flash
                ? 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.85))'
                : 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))',
              transition: 'fill 200ms ease, stroke 200ms ease',
            }}
          />
        ) : (
          <polyline
            points={pointsAttr}
            fill="none"
            stroke={stroke}
            strokeWidth={Math.max(2, Math.min(roiWidth, roiHeight) * 0.008)}
            strokeLinecap="round"
            style={{
              filter: flash
                ? 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.85))'
                : 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))',
              transition: 'stroke 200ms ease',
            }}
          />
        )}
        {/* Corner dots reinforce the lock-on cue at the polygon
            vertices — particularly helpful at small QR sizes where
            the polygon outline alone is hard to see. */}
        {location.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={Math.max(3, Math.min(roiWidth, roiHeight) * 0.012)}
            fill={stroke}
            opacity={0.95}
          />
        ))}
      </svg>
    </div>
  );
}
