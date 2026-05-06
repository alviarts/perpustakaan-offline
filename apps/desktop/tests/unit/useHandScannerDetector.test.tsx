/**
 * Unit tests for the v1.0.12 hand-scanner detection hook.
 *
 * These exercise the timing heuristic at the centre of the hook:
 *
 *   - Tightly-spaced keystrokes (≤ 35 ms apart) followed by Enter
 *     should be classified as a hand-scanner burst.
 *   - Slow keystrokes (≥ 80 ms apart) should *not* trigger detection
 *     even when followed by Enter.
 *   - The auto-route `onScan` callback fires only when the focused
 *     element is not an editable input (so the scan input itself
 *     receives the keystrokes naturally without duplication).
 *   - The detection flag clears after `detectionTimeoutMs` so the
 *     "Hand-scanner USB terdeteksi" badge does not get stuck on
 *     forever.
 */
import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HandScannerBadge } from '@/features/sirkulasi/HandScannerBadge';
import { useHandScannerDetector } from '@/lib/scanner/useHandScannerDetector';

/**
 * Synthesise a `keydown` event timeline. Each character is dispatched
 * `delayMs` after the previous one using fake timers, so the hook
 * sees a deterministic burst regardless of the real wall clock.
 *
 * The implementation uses `performance.now()` internally; vitest's
 * `vi.useFakeTimers()` patches that as well, so the math lines up.
 */
function dispatchBurst(text: string, delayMs: number): void {
  for (const ch of text) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: ch, bubbles: true }),
    );
    vi.advanceTimersByTime(delayMs);
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('useHandScannerDetector', () => {
  it('detects a tight keystroke burst followed by Enter', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { result } = renderHook(() => useHandScannerDetector({ onScan }));
      // Fast burst → 5 ms inter-key. Enter at the end.
      act(() => {
        dispatchBurst('B-46945-01', 5);
      });
      expect(result.current.isDetected).toBe(true);
      expect(result.current.lastPayload).toBe('B-46945-01');
      // Document.body is the focused element by default in jsdom, so
      // the auto-route fallback fires.
      expect(onScan).toHaveBeenCalledWith('B-46945-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a slow human keystroke pattern even if Enter follows', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { result } = renderHook(() => useHandScannerDetector({ onScan }));
      // 120 ms inter-key — well above the 35 ms threshold.
      act(() => {
        dispatchBurst('123ABC', 120);
      });
      expect(result.current.isDetected).toBe(false);
      expect(onScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-route into onScan when an editable input is focused', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();
      const { result } = renderHook(() => useHandScannerDetector({ onScan }));
      act(() => {
        dispatchBurst('LIB-12345', 5);
      });
      // Detection state still flips on (the badge should appear) but
      // the auto-route fallback does not fire because the keystrokes
      // already went into the input naturally.
      expect(result.current.isDetected).toBe(true);
      expect(onScan).not.toHaveBeenCalled();
      input.blur();
      input.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it('respects a custom inter-key threshold', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { result } = renderHook(() =>
        useHandScannerDetector({ onScan, maxInterKeyDelayMs: 100 }),
      );
      // 60 ms inter-key — fast for a human, but acceptable under a
      // 100 ms scanner threshold (e.g. an old Bluetooth scanner).
      act(() => {
        dispatchBurst('SLOWSCAN', 60);
      });
      expect(result.current.isDetected).toBe(true);
      expect(onScan).toHaveBeenCalledWith('SLOWSCAN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears isDetected after the configured detection timeout', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useHandScannerDetector({ detectionTimeoutMs: 500 }),
      );
      act(() => {
        dispatchBurst('TIMEOUT-1', 5);
      });
      expect(result.current.isDetected).toBe(true);
      // The 500 ms timer must elapse for the auto-clear to fire.
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(result.current.isDetected).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores modifier-key combos (Ctrl+V is not a 2-char burst)', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { result } = renderHook(() => useHandScannerDetector({ onScan }));
      // A Ctrl+V keystroke pair: looks rapid-fire but it's a paste.
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }),
        );
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
      });
      expect(result.current.isDetected).toBe(false);
      expect(onScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not blow up when payload is too short', () => {
    vi.useFakeTimers();
    try {
      const onScan = vi.fn();
      const { result } = renderHook(() =>
        useHandScannerDetector({ onScan, minPayloadLength: 5 }),
      );
      act(() => {
        dispatchBurst('AB', 5);
      });
      expect(result.current.isDetected).toBe(false);
      expect(onScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('HandScannerBadge', () => {
  it('renders nothing when not detected', () => {
    const { container } = render(<HandScannerBadge isDetected={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the indonesian copy when detected', () => {
    const { getByTestId } = render(<HandScannerBadge isDetected={true} />);
    const badge = getByTestId('hand-scanner-badge');
    // i18next test setup falls back to a translation key when no
    // backend is available; either the resolved string or the key
    // itself counts as "rendered".
    expect(badge.textContent ?? '').toMatch(/Hand-scanner|hand-scanner|scanner\.handScannerDetected/);
  });
});
