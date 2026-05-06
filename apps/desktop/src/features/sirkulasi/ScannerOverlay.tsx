/**
 * Visual aiming overlay for the Sirkulasi webcam scanner (FEAT-28).
 *
 * Renders absolutely-positioned guides on top of the `<video>` element
 * so the operator knows where to place the barcode. Pure presentational
 * component — the actual decoder pipeline crops frames to the same
 * region using `computeRoi(...)` from `lib/scanner/overlay`.
 *
 * Layout breakdown:
 *
 * - Outer dim mask: a single absolute box sized to the ROI with a huge
 *   `box-shadow` spread that paints the surrounding pixels at 50%
 *   black. Cheaper than 4 separate edge boxes and resizes naturally
 *   when the video aspect ratio changes.
 * - Corner brackets: 4 absolute boxes at the rectangle corners, each
 *   with two visible borders (e.g. top-left = top + left). Pure CSS,
 *   no SVG, scales with the container.
 * - Scanning line: thin red horizontal bar animated up-and-down via
 *   the `animate-scanner-line` Tailwind keyframe.
 * - Hint label: short instruction text floats just above the box.
 */
import { ROI_PERCENT } from '@/lib/scanner/overlay';

export interface ScannerOverlayProps {
  /** Hint text shown just above the rectangle. */
  label: string;
  /**
   * When true, the small "Memindai…" badge is shown next to the label.
   * Used during a manual scan attempt for feedback.
   */
  busy?: boolean;
  /** Optional badge text shown alongside the label (e.g. busy spinner). */
  busyLabel?: string;
}

export function ScannerOverlay({
  label,
  busy = false,
  busyLabel,
}: ScannerOverlayProps) {
  // Convert 0..1 fractions to CSS percentages so the overlay stays in
  // sync with the decoder's pixel-space ROI even when the video
  // element is resized by Tailwind's responsive utilities.
  const left = `${((1 - ROI_PERCENT.width) / 2) * 100}%`;
  const top = `${((1 - ROI_PERCENT.height) / 2) * 100}%`;
  const width = `${ROI_PERCENT.width * 100}%`;
  const height = `${ROI_PERCENT.height * 100}%`;

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="scanner-overlay">
      {/* Dim mask outside the ROI rectangle. */}
      <div
        className="absolute"
        style={{
          left,
          top,
          width,
          height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
        }}
      />
      {/* ROI frame holding the corner brackets and scanning line. */}
      <div className="absolute" style={{ left, top, width, height }}>
        {/* Corner brackets — two perpendicular borders per corner. */}
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-white/85" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-white/85" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white/85" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-white/85" />
        {/* Animated scanning line — purely cosmetic, signals "active". */}
        <span className="absolute inset-x-3 top-1/2 h-0.5 animate-scanner-line bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
      </div>
      {/* Hint label above the rectangle. */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{ top: `calc(${top} - 1.75rem)` }}
      >
        <span className="rounded bg-black/60 px-2 py-1 text-xs text-white">
          {label}
          {busy && busyLabel ? (
            <span className="ml-2 inline-flex items-center text-white/80">{busyLabel}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
