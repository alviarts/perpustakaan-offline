/**
 * Hand-scanner USB device detection hook (v1.0.12).
 *
 * USB barcode scanners (Symbol/Zebra, Honeywell, generic Chinese
 * hand-scanners) all behave the same way at the OS level: they
 * emulate an HID keyboard and "type" the scanned barcode payload
 * into whatever input is focused, then press Enter. The keystrokes
 * arrive in a tight burst — typically ≤ 10 ms between characters,
 * which is one to two orders of magnitude faster than a human can
 * type.
 *
 * This hook spies on global `keydown` events and uses that timing
 * heuristic to:
 *
 *   1. Detect that a hand-scanner has just been used (or, by
 *      extension, that one is plugged in and the user is scanning
 *      against the page).
 *   2. Optionally re-emit the captured payload via `onScan` even
 *      when the relevant text input is not focused — useful on
 *      pages that show a video preview and a scan field side by
 *      side. Without this fallback, a user who clicks into the
 *      video panel and then scans loses the keystrokes.
 *
 * The detection is non-destructive: when the focused element is
 * already an editable text input we let the keystrokes pass through
 * normally (the input handles them) and only record the timing for
 * the badge state. The auto-route fallback fires only when the
 * focused element is *not* a text input.
 *
 * Detection thresholds:
 *   - At least 3 characters in the buffer.
 *   - Maximum inter-key delay ≤ 35 ms throughout the burst.
 *   - Burst ended by Enter / Tab.
 *
 * 35 ms is the empirical floor we measured across a Symbol DS2208
 * and a generic ESky USB scanner — well above their actual ~5 ms
 * inter-key gap, well below human typing (~80–150 ms).
 *
 * The `isDetected` flag stays true for `detectionTimeoutMs` after
 * the last successful detection (default 30 s) so the UI badge does
 * not flicker between scans. Each successful burst extends the
 * timeout.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface HandScannerDetectorOptions {
  /**
   * Called with the captured payload when a hand-scanner burst is
   * detected and the focused element is *not* an editable input —
   * lets the page route the scan into a logical field even when the
   * user has clicked into the video panel or some other surface.
   *
   * If the focused element *is* an editable input, this callback is
   * not invoked because the input itself receives the keystrokes
   * naturally.
   */
  onScan?: (payload: string) => void;

  /**
   * Maximum inter-key delay (ms) below which a key burst is
   * considered hand-scanner output. Default `35`.
   */
  maxInterKeyDelayMs?: number;

  /**
   * Minimum payload length below which we ignore the burst. Helps
   * avoid mis-detecting two-key shortcut presses. Default `3`.
   */
  minPayloadLength?: number;

  /**
   * Time (ms) the `isDetected` flag stays `true` after the last
   * detected burst before clearing. Default `30000` (30 s).
   */
  detectionTimeoutMs?: number;
}

export interface HandScannerDetectionState {
  /** True when a hand-scanner has been used recently. Drives the badge. */
  isDetected: boolean;
  /** Timestamp (ms since epoch) of the most recent detected burst. */
  lastDetectedAt: number | null;
  /** Most recent decoded payload, for diagnostics. `null` initially. */
  lastPayload: string | null;
}

const DEFAULT_MAX_INTER_KEY_DELAY_MS = 35;
const DEFAULT_MIN_PAYLOAD_LENGTH = 3;
const DEFAULT_DETECTION_TIMEOUT_MS = 30_000;

/**
 * `true` if the focused element accepts text input. We don't want to
 * intercept those — the input itself handles the keystrokes, and we
 * only need the timing data for the `isDetected` state.
 */
function isFocusedOnEditableInput(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  if (tag === 'INPUT') {
    const inputType = (active as HTMLInputElement).type;
    // Buttons, checkboxes, etc. are HTMLInputElements but not text fields.
    return ['text', 'search', 'number', 'tel', 'url', 'email', 'password', ''].includes(inputType);
  }
  if (tag === 'TEXTAREA') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Single character produced by a `KeyboardEvent`, or `null` for
 * modifier / non-printable keys we don't care about.
 *
 * - `Enter` and `Tab` are returned as the special `'\n'` sentinel
 *   so the caller can use that as the burst terminator.
 * - Modifier keys (`Shift`, `Ctrl`, etc.) are filtered out so that
 *   `Ctrl+V` doesn't look like a 2-character "burst".
 */
function eventToChar(e: KeyboardEvent): string | null {
  if (e.key === 'Enter' || e.key === 'Tab') return '\n';
  if (e.key.length === 1) {
    // Filter out shortcut combinations — we don't want to treat
    // Ctrl+V or Cmd+A as scanner input.
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    return e.key;
  }
  return null;
}

/**
 * React hook implementing the detection logic above. Returns the
 * detection state object directly — the hook is safe to call inside
 * any component, the listener is registered once on the
 * document and torn down on unmount.
 *
 * `onScan` and the threshold options are read from a ref each tick,
 * so passing inline closures does not cause repeated re-binds.
 */
export function useHandScannerDetector(
  options: HandScannerDetectorOptions = {},
): HandScannerDetectionState {
  const optsRef = useRef(options);
  optsRef.current = options;

  const [state, setState] = useState<HandScannerDetectionState>({
    isDetected: false,
    lastDetectedAt: null,
    lastPayload: null,
  });

  // Mutable ring buffer kept off-state so React renders aren't
  // triggered on every keystroke.
  const bufferRef = useRef<{ chars: string[]; lastTs: number }>({
    chars: [],
    lastTs: 0,
  });
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finalizeBurst = useCallback(() => {
    const buf = bufferRef.current;
    const opts = optsRef.current;
    const minLen = opts.minPayloadLength ?? DEFAULT_MIN_PAYLOAD_LENGTH;
    const payload = buf.chars.join('');
    bufferRef.current = { chars: [], lastTs: 0 };
    if (payload.length < minLen) return;

    const now = Date.now();
    setState({ isDetected: true, lastDetectedAt: now, lastPayload: payload });

    // Reset the auto-clear timer so the badge stays up across
    // back-to-back scans without flicker.
    if (detectionTimerRef.current !== null) {
      clearTimeout(detectionTimerRef.current);
    }
    const timeoutMs = opts.detectionTimeoutMs ?? DEFAULT_DETECTION_TIMEOUT_MS;
    detectionTimerRef.current = setTimeout(() => {
      setState((s) => ({ ...s, isDetected: false }));
      detectionTimerRef.current = null;
    }, timeoutMs);

    // Auto-route to the page-level handler when the user is looking
    // at something other than the scan input.
    if (opts.onScan && !isFocusedOnEditableInput()) {
      opts.onScan(payload);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ch = eventToChar(e);
      if (ch === null) return;

      const now = performance.now();
      const buf = bufferRef.current;
      const opts = optsRef.current;
      const maxDelay = opts.maxInterKeyDelayMs ?? DEFAULT_MAX_INTER_KEY_DELAY_MS;

      if (ch === '\n') {
        finalizeBurst();
        return;
      }

      // Reset the buffer if too much time has passed (this is a
      // human keystroke, not part of a scanner burst).
      if (buf.lastTs > 0 && now - buf.lastTs > maxDelay) {
        buf.chars = [];
      }
      buf.chars.push(ch);
      buf.lastTs = now;
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (detectionTimerRef.current !== null) {
        clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
    };
  }, [finalizeBurst]);

  return state;
}
