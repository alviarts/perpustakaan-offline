/**
 * Webcam barcode scanner hook (FEAT-28 PR J).
 *
 * Wraps `@zxing/browser` to drive a `<video>` element and emit decoded
 * results into a callback. The hook keeps the controls handle around so it
 * can release the camera when the page unmounts or the user toggles
 * scanning off — leaking a MediaStream would prevent other apps (and Tauri
 * webview tabs) from accessing the webcam.
 *
 * v1.0.8 additions on top of the v1.0.6/v1.0.7 baseline:
 *
 * - Multi-format hint set widened to include Data Matrix (in addition
 *   to Code-128, Code-39, EAN-13, EAN-8, QR Code) — see
 *   `lib/scanner/decoder.ts`.
 * - Manual single-shot decode (`decodeOnce`) used by the
 *   "Scan Sekarang" button on `SirkulasiPage`. Crops the current
 *   video frame to the ROI overlay and runs up to 3 preprocess
 *   variants (normal → contrast → grayscale) before giving up.
 * - Torch toggle (`toggleTorch`, `torchSupported`, `torchOn`) for
 *   browsers/cameras that expose a `torch` track capability.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeRoi } from '@/lib/scanner/overlay';
import {
  createImageDataReader,
  decodeAnyWithRotations,
  decodeWithJsQR,
  decodeWithRetry,
  type DecodedResult,
  type Point2D,
} from '@/lib/scanner/decoder';
import {
  analyzeImageStats,
  CONTINUOUS_VARIANTS,
  MANUAL_RETRY_VARIANTS,
} from '@/lib/scanner/preprocess';

/**
 * Decode loop tick interval in milliseconds. 80 ms ≈ 12.5 fps decode
 * rate (v1.0.11, down from 100 ms). Cycling through the four
 * {@link CONTINUOUS_VARIANTS} now takes ~320 ms — still well under
 * the cooldown, so we never deliver the same barcode twice in one
 * steady hold, but each variant gets a fresh shot every cycle.
 */
const TICK_MS = 80;

/**
 * Below this mean luminance we treat the frame as effectively black
 * (camera covered, autoexposure not converged, lights out) and skip
 * the decode entirely. Saves the cost of running zxing + jsQR over
 * pure noise and prevents the decoder from raising spurious internal
 * exceptions on degenerate bitmaps.
 */
const DARK_FRAME_MEAN_THRESHOLD = 8;

export interface UseBarcodeScannerOptions {
  onDecode: (text: string) => void;
  /** Throttle: if the same value comes in within this window, ignore it. */
  cooldownMs?: number;
}

/**
 * Categorisation of camera-startup errors so the UI can render different
 * recovery hints. `'permission'` covers the case where the user (or a
 * stricter browser policy) denied camera access — that is the only one
 * where re-calling `start()` may not re-prompt and the user has to flip
 * a setting first.
 */
export type ScannerErrorKind =
  | 'permission'
  | 'no-device'
  | 'in-use'
  | 'unsupported'
  | 'other';

export interface UseBarcodeScannerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  active: boolean;
  /** True while waiting for `getUserMedia`/permission. */
  starting: boolean;
  error: string | null;
  /** Structured tag for the most recent error, mirrors `error` lifecycle. */
  errorKind: ScannerErrorKind | null;
  start: () => Promise<void>;
  stop: () => void;
  /** List of cameras the browser exposed, ordered as MediaDevices returns them. */
  devices: MediaDeviceInfo[];
  /** Currently selected `deviceId`. Falls back to the first device. */
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string) => void;
  /**
   * One-shot manual decode — capture the current frame, crop to ROI,
   * try up to 3 preprocess variants. Returns `null` if nothing decodes.
   *
   * Useful when continuous decode keeps missing under tricky lighting.
   * Triggered by the "Scan Sekarang" button on the Sirkulasi page.
   */
  decodeOnce: () => Promise<DecodedResult | null>;
  /** True if the current camera track exposes a `torch` capability. */
  torchSupported: boolean;
  /** True if the torch is currently on. */
  torchOn: boolean;
  /**
   * Toggle the camera torch. Resolves once the constraint has been
   * applied; rejects if the track no longer exists.
   */
  toggleTorch: () => Promise<void>;
  /**
   * Most recent decoded barcode location in ROI-pixel coordinates,
   * along with the pixel size of the ROI it was decoded against.
   * Drives the live tracking SVG overlay. Cleared automatically
   * after `LOCATION_FADE_MS` of no new detection.
   *
   * `null` when no detection is currently in flight.
   */
  lastDetection: ScannerDetection | null;
  /**
   * True for a brief moment after a successful decode triggers a
   * cooldown-emit. The overlay flashes yellow during this window.
   */
  decodeFlash: boolean;
}

/**
 * Snapshot of the most recent decoded barcode position, in the
 * coordinate system of the ROI crop the decoder ran against. The
 * rendering layer rescales these into CSS units using the ROI
 * percentages from {@link ROI_PERCENT}.
 */
export interface ScannerDetection {
  location: Point2D[];
  /** Pixel width of the ROI crop the location was measured in. */
  roiWidth: number;
  /** Pixel height of the ROI crop the location was measured in. */
  roiHeight: number;
  /** Format of the barcode (e.g. `'CODE_128'`, `'QR_CODE'`). */
  format: string;
  /** Source of the decode (`'zxing'` or `'jsqr'`). */
  source: 'zxing' | 'jsqr';
  /** Wall-clock timestamp (ms since epoch) when this detection landed. */
  at: number;
}

/**
 * Lifetime of a tracking polygon after the last successful detection.
 * Visible state lingers a few hundred ms so the overlay doesn't
 * flicker away the instant the operator's hand drifts and the next
 * tick misses.
 */
const LOCATION_FADE_MS = 600;

/**
 * Duration of the yellow "decode succeeded" flash on the overlay.
 */
const DECODE_FLASH_MS = 350;

/**
 * Map a `getUserMedia` failure to one of {@link ScannerErrorKind}.
 *
 * `getUserMedia` rejects with a `DOMException` whose `name` is set to the
 * spec-defined value (NotAllowedError, NotFoundError, etc.). We special-
 * case the ones that need different UX recovery hints and lump the rest
 * under `'other'`.
 */
export function classifyScannerError(e: unknown): ScannerErrorKind {
  if (e && typeof e === 'object' && 'name' in e) {
    const name = (e as { name: unknown }).name;
    if (typeof name === 'string') {
      switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
          return 'permission';
        case 'NotFoundError':
        case 'OverconstrainedError':
          return 'no-device';
        case 'NotReadableError':
        case 'TrackStartError':
          return 'in-use';
      }
    }
  }
  if (e instanceof Error && /getUserMedia/i.test(e.message)) {
    return 'unsupported';
  }
  return 'other';
}

/**
 * Detect the `torch` capability on a track. Spec-defined under
 * MediaTrackCapabilities but TypeScript's lib doesn't include it
 * (Chromium-only at time of writing), so we duck-type.
 */
function trackHasTorch(track: MediaStreamTrack): boolean {
  // `getCapabilities` is not supported on every browser — Safari before
  // 17 returns nothing, Firefox doesn't expose the torch hint at all.
  type Cap = { torch?: boolean };
  const caps =
    typeof (track as unknown as { getCapabilities?: () => Cap }).getCapabilities ===
    'function'
      ? ((track as unknown as { getCapabilities: () => Cap }).getCapabilities() ?? {})
      : {};
  return caps.torch === true;
}

export function useBarcodeScanner(
  options: UseBarcodeScannerOptions,
): UseBarcodeScannerResult {
  const { onDecode, cooldownMs = 1500 } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDecodedRef = useRef<{ text: string; at: number } | null>(null);
  // Always read the latest callback inside the decode handler so callers
  // don't have to memoise it on every render.
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ScannerErrorKind | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastDetection, setLastDetection] = useState<ScannerDetection | null>(null);
  const [decodeFlash, setDecodeFlash] = useState(false);
  const detectionFadeTimerRef = useRef<number | null>(null);
  const decodeFlashTimerRef = useRef<number | null>(null);

  /**
   * Record a fresh detection for the live tracking overlay and
   * schedule a fade-out if no further detection lands within
   * {@link LOCATION_FADE_MS}. Successive detections refresh the
   * timer, so a steady aim keeps the polygon visible.
   */
  const pushDetection = useCallback((detection: ScannerDetection) => {
    setLastDetection(detection);
    if (detectionFadeTimerRef.current !== null) {
      clearTimeout(detectionFadeTimerRef.current);
    }
    detectionFadeTimerRef.current = window.setTimeout(() => {
      setLastDetection(null);
      detectionFadeTimerRef.current = null;
    }, LOCATION_FADE_MS);
  }, []);

  /**
   * Briefly flash the overlay yellow to acknowledge a successful
   * decode. The flash is independent of the polygon fade so the
   * operator gets a clear "got it" signal even if the polygon was
   * already visible.
   */
  const triggerFlash = useCallback(() => {
    setDecodeFlash(true);
    if (decodeFlashTimerRef.current !== null) {
      clearTimeout(decodeFlashTimerRef.current);
    }
    decodeFlashTimerRef.current = window.setTimeout(() => {
      setDecodeFlash(false);
      decodeFlashTimerRef.current = null;
    }, DECODE_FLASH_MS);
  }, []);

  /** Stop and release the active camera, if any. */
  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Already stopped — ignore.
        }
      }
    }
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      try {
        video.pause();
      } catch {
        // Pause may throw on some browsers if the video already errored.
      }
    }
    setActive(false);
    setTorchSupported(false);
    setTorchOn(false);
    setLastDetection(null);
    setDecodeFlash(false);
    if (detectionFadeTimerRef.current !== null) {
      clearTimeout(detectionFadeTimerRef.current);
      detectionFadeTimerRef.current = null;
    }
    if (decodeFlashTimerRef.current !== null) {
      clearTimeout(decodeFlashTimerRef.current);
      decodeFlashTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera (getUserMedia tidak tersedia).');
      setErrorKind('unsupported');
      return;
    }
    setStarting(true);
    setError(null);
    setErrorKind(null);
    try {
      // List devices first so the UI can show a picker. Some browsers
      // populate the device labels only after the user grants permission,
      // so we re-query after starting.
      const initialDevices = await navigator.mediaDevices.enumerateDevices();
      const cams = initialDevices.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      const preferred =
        selectedDeviceId && cams.some((c) => c.deviceId === selectedDeviceId)
          ? selectedDeviceId
          : cams[0]?.deviceId ?? null;
      setSelectedDeviceId(preferred);

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element belum siap');
      }

      // Try 1080p first — the higher pixel budget pulls dense Code-128
      // labels into focus on cheap webcams. Fall back to 720p if the
      // device can't deliver 1080p (`OverconstrainedError`). zxing's
      // own default tops out around 480p which proved too coarse for
      // BUG-18 / BUG-22.
      const buildConstraints = (w: number, h: number): MediaTrackConstraints => {
        const base: MediaTrackConstraints = preferred
          ? { deviceId: { exact: preferred } }
          : { facingMode: { ideal: 'environment' } };
        return {
          ...base,
          width: { ideal: w },
          height: { ideal: h },
          frameRate: { ideal: 30 },
        };
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildConstraints(1920, 1080),
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: buildConstraints(1280, 720),
        });
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Autoplay policies may reject — the stream still works once a
        // user gesture toggles `video.play()`. Don't fail start().
      }

      // Ask the camera for continuous autofocus, white-balance, and
      // exposure where supported. These are advanced constraints —
      // most browsers silently ignore unknown ones, so the try/catch
      // is a belt-and-braces guard. Without continuous autofocus the
      // webcam locks on the first frame after permission, which on a
      // hand-held barcode is usually the empty desk before the book
      // arrives — hence the BUG-22 reports of "jelas tapi tidak baca".
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            advanced: [
              { focusMode: 'continuous' } as MediaTrackConstraintSet,
              { whiteBalanceMode: 'continuous' } as MediaTrackConstraintSet,
              { exposureMode: 'continuous' } as MediaTrackConstraintSet,
            ],
          } as MediaTrackConstraints);
        } catch {
          // Capability not supported on this camera/browser — ignore.
        }
        setTorchSupported(trackHasTorch(track));
      }
      setTorchOn(false);

      // Refresh device labels (often available only after permission).
      try {
        const afterDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(afterDevices.filter((d) => d.kind === 'videoinput'));
      } catch {
        // ignore secondary enumeration errors
      }

      // Reusable image-data reader — the same one re-used across every
      // tick to avoid alloc churn and to inherit zxing's binarizer
      // cache for adjacent frames.
      const imageReader = createImageDataReader();
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;

      stoppedRef.current = false;
      setActive(true);

      let lastTickAt = 0;
      let variantIdx = 0;
      const tick = (now: DOMHighResTimeStamp) => {
        if (stoppedRef.current) return;
        if (now - lastTickAt >= TICK_MS) {
          lastTickAt = now;
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w > 0 && h > 0 && video.readyState >= 2) {
            const roi = computeRoi(w, h);
            if (roi.width > 0 && roi.height > 0) {
              canvas.width = roi.width;
              canvas.height = roi.height;
              const ctx = canvas.getContext('2d', {
                willReadFrequently: true,
              });
              if (ctx) {
                try {
                  ctx.drawImage(
                    video,
                    roi.x,
                    roi.y,
                    roi.width,
                    roi.height,
                    0,
                    0,
                    roi.width,
                    roi.height,
                  );
                  const imageData = ctx.getImageData(0, 0, roi.width, roi.height);
                  // Skip pitch-black frames before paying for zxing
                  // + jsQR. Cheap luminance summary; bail-out keeps
                  // the loop responsive when the camera is covered
                  // or the room lights drop. (v1.0.11 BUG-22.)
                  const stats = analyzeImageStats(imageData);
                  if (stats.max < DARK_FRAME_MEAN_THRESHOLD) {
                    rafRef.current = requestAnimationFrame(tick);
                    return;
                  }
                  const variant = CONTINUOUS_VARIANTS[variantIdx] ?? 'normal';
                  variantIdx = (variantIdx + 1) % CONTINUOUS_VARIANTS.length;
                  // Try zxing first with the current variant; fall
                  // back to jsQR (QR-only, more tolerant of moiré)
                  // on every miss. jsQR is a single call per tick
                  // — it's already fast enough for the 80 ms budget.
                  let hit = decodeWithRetry(imageReader, imageData, [variant]);
                  if (!hit) {
                    hit = decodeWithJsQR(imageData);
                  }
                  if (hit) {
                    if (hit.location) {
                      pushDetection({
                        location: hit.location,
                        roiWidth: roi.width,
                        roiHeight: roi.height,
                        format: hit.format,
                        source: hit.source,
                        at: Date.now(),
                      });
                    }
                    const text = hit.text;
                    const at = performance.now();
                    const last = lastDecodedRef.current;
                    if (
                      !last ||
                      last.text !== text ||
                      at - last.at >= cooldownMs
                    ) {
                      lastDecodedRef.current = { text, at };
                      triggerFlash();
                      onDecodeRef.current(text);
                    }
                  }
                } catch {
                  // drawImage / getImageData can throw if the frame is
                  // not yet ready — skip the tick and try again.
                }
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setErrorKind(classifyScannerError(e));
      setActive(false);
    } finally {
      setStarting(false);
    }
  }, [selectedDeviceId, cooldownMs, pushDetection, triggerFlash]);

  // Restart the stream if the user picks a different camera while running.
  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (active) {
        stop();
        // Defer to next tick so React re-renders before re-acquiring
        // the camera with the new constraint.
        setTimeout(() => {
          void start();
        }, 0);
      }
    },
    [active, stop, start],
  );

  const decodeOnce = useCallback(async (): Promise<DecodedResult | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    // Crop to the same ROI rectangle the overlay renders. Decoding
    // only this region speeds the manual scan up (~4× fewer pixels)
    // and removes the cluttered background that otherwise confuses
    // zxing's binarizer. (v1.0.11) If the ROI pass misses, fall back
    // to the full frame — operators sometimes hold the barcode at
    // the edge of the viewport and the ROI crop excludes part of
    // the symbol; the full-frame retry catches those without
    // requiring a second click.
    const roi = computeRoi(w, h);
    if (roi.width <= 0 || roi.height <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = roi.width;
    canvas.height = roi.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      video,
      roi.x,
      roi.y,
      roi.width,
      roi.height,
      0,
      0,
      roi.width,
      roi.height,
    );
    const imageData = ctx.getImageData(0, 0, roi.width, roi.height);
    const reader = createImageDataReader();

    // Manual scan budget is generous (~500 ms), so we run the full
    // ROI variant chain *and* the rotation retry pipeline. The
    // rotation pipeline only kicks in if every variant on the
    // un-rotated ROI misses, which is exactly the v1.0.11 "phone-
    // screen Code-128 still wouldn't decode" failure mode.
    const roiHit = decodeAnyWithRotations(reader, imageData, MANUAL_RETRY_VARIANTS);
    if (roiHit) {
      if (roiHit.location) {
        pushDetection({
          location: roiHit.location,
          roiWidth: roi.width,
          roiHeight: roi.height,
          format: roiHit.format,
          source: roiHit.source,
          at: Date.now(),
        });
      }
      triggerFlash();
      return roiHit;
    }

    // Full-frame fallback. Reuse the same canvas at the larger size
    // so we don't pay for two allocations when the manual button
    // gets clicked rapidly.
    canvas.width = w;
    canvas.height = h;
    const ctxFull = canvas.getContext('2d');
    if (!ctxFull) return null;
    ctxFull.drawImage(video, 0, 0, w, h);
    const fullImage = ctxFull.getImageData(0, 0, w, h);
    const fullHit = decodeAnyWithRotations(
      reader,
      fullImage,
      MANUAL_RETRY_VARIANTS,
    );
    if (fullHit) {
      if (fullHit.location) {
        // Convert from full-frame coords back into ROI coords so the
        // overlay (which is positioned over the ROI) draws the
        // polygon in the right place. Out-of-ROI hits clamp to the
        // ROI edges so the overlay still shows the operator that
        // we caught the symbol — they can re-aim from there.
        const adjusted = fullHit.location.map((p) => ({
          x: Math.max(0, Math.min(roi.width, p.x - roi.x)),
          y: Math.max(0, Math.min(roi.height, p.y - roi.y)),
        }));
        pushDetection({
          location: adjusted,
          roiWidth: roi.width,
          roiHeight: roi.height,
          format: fullHit.format,
          source: fullHit.source,
          at: Date.now(),
        });
      }
      triggerFlash();
    }
    return fullHit;
  }, [pushDetection, triggerFlash]);

  const toggleTorch = useCallback(async (): Promise<void> => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    // Type the constraints loosely — `torch` is non-standard and not
    // present in the lib.dom MediaTrackConstraints definition.
    await track.applyConstraints({
      advanced: [{ torch: next } as MediaTrackConstraintSet],
    } as MediaTrackConstraints);
    setTorchOn(next);
  }, [torchOn]);

  // Always release on unmount.
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const stream = streamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // ignore
          }
        }
      }
      streamRef.current = null;
      if (detectionFadeTimerRef.current !== null) {
        clearTimeout(detectionFadeTimerRef.current);
        detectionFadeTimerRef.current = null;
      }
      if (decodeFlashTimerRef.current !== null) {
        clearTimeout(decodeFlashTimerRef.current);
        decodeFlashTimerRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    active,
    starting,
    error,
    errorKind,
    start,
    stop,
    devices,
    selectedDeviceId,
    selectDevice,
    decodeOnce,
    torchSupported,
    torchOn,
    toggleTorch,
    lastDetection,
    decodeFlash,
  };
}
