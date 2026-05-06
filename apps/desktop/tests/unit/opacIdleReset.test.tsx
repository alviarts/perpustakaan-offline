import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  useOpacIdleReset,
} from '@/features/opac/useOpacIdleReset';

interface ProbeProps {
  onIdle: () => void;
  enabled?: boolean;
  timeoutMs?: number;
}

function Probe({ onIdle, enabled, timeoutMs }: ProbeProps): JSX.Element {
  useOpacIdleReset(onIdle, { enabled, timeoutMs });
  return <div data-testid="probe" />;
}

describe('useOpacIdleReset (FEAT-27)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a 2-minute default timeout', () => {
    expect(DEFAULT_IDLE_TIMEOUT_MS).toBe(2 * 60 * 1000);
  });

  it('fires onIdle after the timeout when no input arrives', () => {
    const onIdle = vi.fn();
    render(<Probe onIdle={onIdle} timeoutMs={500} />);
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('resets the timer when the user moves the mouse', () => {
    const onIdle = vi.fn();
    render(<Probe onIdle={onIdle} timeoutMs={500} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onIdle).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('resets the timer when a key is pressed', () => {
    const onIdle = vi.fn();
    render(<Probe onIdle={onIdle} timeoutMs={500} />);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('does not arm the timer when enabled=false', () => {
    const onIdle = vi.fn();
    render(<Probe onIdle={onIdle} timeoutMs={500} enabled={false} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('cleans up listeners on unmount', () => {
    const onIdle = vi.fn();
    const { unmount } = render(<Probe onIdle={onIdle} timeoutMs={500} />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(onIdle).not.toHaveBeenCalled();
  });
});
