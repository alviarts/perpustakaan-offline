import { useEffect, useRef } from 'react';

export const DEFAULT_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Calls `onIdle` after `timeoutMs` of no user input (mouse / keyboard / touch).
 * Resets on every interaction. Used by the OPAC kiosk to drop a member's
 * session and return to the home screen after they walk away.
 *
 * Pure React/DOM — no Tauri dependency, so it works in jsdom tests.
 */
export function useOpacIdleReset(
  onIdle: () => void,
  options: { enabled?: boolean; timeoutMs?: number } = {},
): void {
  const enabled = options.enabled ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const callbackRef = useRef(onIdle);
  callbackRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        callbackRef.current();
      }, timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'wheel',
      'scroll',
    ];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [enabled, timeoutMs]);
}
