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
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { type Result } from '@zxing/library';
import { computeRoi } from '@/lib/scanner/overlay';
import {
  buildDecodeHints,
  createImageDataReader,
  decodeWithRetry,
  type DecodedResult,
} from '@/lib/scanner/decoder';

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
}

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
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  /** Stop and release the active camera, if any. */
  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    // controls.stop() releases the tracks zxing owns, but if we held a
    // separate reference (for torch) clear it so React doesn't think
    // torch is still controllable on a dead track.
    streamRef.current = null;
    setActive(false);
    setTorchSupported(false);
    setTorchOn(false);
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

      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader(buildDecodeHints());
      }
      const reader = readerRef.current;
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element belum siap');
      }

      // Ask the browser for a higher-resolution stream than the zxing
      // default (which falls back to roughly 640×480 on most webcams).
      // Code-128 barcodes printed at A4-label scale are too small for
      // 480p to decode reliably (BUG-18). 1280×720 doubles the linear
      // pixel budget. The browser is free to fall back to the next-best
      // size if 720p is not available — `ideal` is a soft constraint.
      const videoConstraints: MediaTrackConstraints = preferred
        ? {
            deviceId: { exact: preferred },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

      controlsRef.current = await reader.decodeFromConstraints(
        { audio: false, video: videoConstraints },
        video,
        (result: Result | undefined, err) => {
          if (result) {
            const text = result.getText();
            const now = performance.now();
            const last = lastDecodedRef.current;
            if (last && last.text === text && now - last.at < cooldownMs) {
              return;
            }
            lastDecodedRef.current = { text, at: now };
            onDecodeRef.current(text);
            return;
          }
          // zxing fires a NotFoundException on every frame without a
          // detection. Filtering it keeps the console quiet.
          if (err && err.name !== 'NotFoundException') {
            // Surface fatal errors only.
          }
        },
      );

      // Refresh device labels (often available only after permission).
      try {
        const afterDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(afterDevices.filter((d) => d.kind === 'videoinput'));
      } catch {
        // ignore secondary enumeration errors
      }

      // After zxing has wired the stream into the video element, the
      // `srcObject` is the live MediaStream — use it to detect torch
      // capability and to apply the torch constraint when the user
      // toggles it.
      const stream = (video.srcObject as MediaStream | null) ?? null;
      streamRef.current = stream;
      const track = stream?.getVideoTracks()[0];
      setTorchSupported(track ? trackHasTorch(track) : false);
      setTorchOn(false);

      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setErrorKind(classifyScannerError(e));
      setActive(false);
    } finally {
      setStarting(false);
    }
  }, [selectedDeviceId, cooldownMs]);

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
    // zxing's binarizer.
    const roi = computeRoi(w, h);
    if (roi.width <= 0 || roi.height <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = roi.width;
    canvas.height = roi.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
    const imageData = ctx.getImageData(0, 0, roi.width, roi.height);

    const reader = createImageDataReader();
    return decodeWithRetry(reader, imageData);
  }, []);

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
      controlsRef.current?.stop();
      controlsRef.current = null;
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
  };
}
