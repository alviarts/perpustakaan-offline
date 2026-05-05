/**
 * Webcam barcode scanner hook (v1.0.6 #19).
 *
 * Wraps `@zxing/browser` to drive a `<video>` element and emit decoded
 * results into a callback. The hook keeps the controls handle around so it
 * can release the camera when the page unmounts or the user toggles
 * scanning off — leaking a MediaStream would prevent other apps (and Tauri
 * webview tabs) from accessing the webcam.
 *
 * Decoder format hints are intentionally narrow: the app only emits
 * Code-128 barcodes for `kode_eksemplar`/`kode_anggota` (see
 * `apps/desktop/src/features/label-buku/print.ts` and the KTA renderer)
 * and QR codes for some KTA presets, so we tell zxing to skip every other
 * format. Skipping unused formats noticeably reduces CPU usage on the
 * hot decode path that runs every frame.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, type Result } from '@zxing/library';

export interface UseBarcodeScannerOptions {
  onDecode: (text: string) => void;
  /** Throttle: if the same value comes in within this window, ignore it. */
  cooldownMs?: number;
}

export interface UseBarcodeScannerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  active: boolean;
  /** True while waiting for `getUserMedia`/permission. */
  starting: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** List of cameras the browser exposed, ordered as MediaDevices returns them. */
  devices: MediaDeviceInfo[];
  /** Currently selected `deviceId`. Falls back to the first device. */
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string) => void;
}

const HINTS = (() => {
  const m = new Map<DecodeHintType, unknown>();
  m.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.QR_CODE,
  ]);
  m.set(DecodeHintType.TRY_HARDER, true);
  return m;
})();

export function useBarcodeScanner(
  options: UseBarcodeScannerOptions,
): UseBarcodeScannerResult {
  const { onDecode, cooldownMs = 1500 } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  /** Stop and release the active camera, if any. */
  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung akses kamera (getUserMedia tidak tersedia).');
      return;
    }
    setStarting(true);
    setError(null);
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
        readerRef.current = new BrowserMultiFormatReader(HINTS);
      }
      const reader = readerRef.current;
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element belum siap');
      }

      controlsRef.current = await reader.decodeFromVideoDevice(
        preferred ?? undefined,
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

      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
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
    start,
    stop,
    devices,
    selectedDeviceId,
    selectDevice,
  };
}
