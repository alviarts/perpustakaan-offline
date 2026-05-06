import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  QUOTE_LEAVE_MS,
  QUOTE_ROTATE_MS,
  useQuoteRotation,
} from '@/features/dashboard/useQuoteRotation';
import { quoteIndexForDate } from '@/lib/dailyQuote';

describe('useQuoteRotation (FEAT-Dashboard-Quotes-2min)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the 2-minute rotation interval and 300 ms leave duration', () => {
    expect(QUOTE_ROTATE_MS).toBe(2 * 60 * 1000);
    expect(QUOTE_LEAVE_MS).toBe(300);
  });

  it('initializes with the deterministic per-day index', () => {
    const fixedDate = new Date(2026, 4, 6); // arbitrary fixed day
    const { result } = renderHook(() => useQuoteRotation(fixedDate));
    expect(result.current.quoteIndex).toBe(quoteIndexForDate(fixedDate));
    expect(result.current.quoteLeaving).toBe(false);
  });

  it('auto-advances after QUOTE_ROTATE_MS via the leave-then-swap animation', () => {
    const fixedDate = new Date(2026, 4, 6);
    const { result } = renderHook(() => useQuoteRotation(fixedDate));
    const initialIndex = result.current.quoteIndex;

    // Just before the rotate timer fires the quote is still showing.
    act(() => {
      vi.advanceTimersByTime(QUOTE_ROTATE_MS - 1);
    });
    expect(result.current.quoteIndex).toBe(initialIndex);
    expect(result.current.quoteLeaving).toBe(false);

    // Rotate timer fires → leave phase begins, index unchanged yet.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.quoteLeaving).toBe(true);
    expect(result.current.quoteIndex).toBe(initialIndex);

    // After the leave-duration the index swaps and leaving flag resets.
    act(() => {
      vi.advanceTimersByTime(QUOTE_LEAVE_MS);
    });
    expect(result.current.quoteLeaving).toBe(false);
    expect(result.current.quoteIndex).not.toBe(initialIndex);
  });

  it('manual advance() runs the same leave-then-swap animation', () => {
    const fixedDate = new Date(2026, 4, 6);
    const { result } = renderHook(() => useQuoteRotation(fixedDate));
    const initialIndex = result.current.quoteIndex;

    act(() => {
      result.current.advance();
    });
    expect(result.current.quoteLeaving).toBe(true);
    expect(result.current.quoteIndex).toBe(initialIndex);

    act(() => {
      vi.advanceTimersByTime(QUOTE_LEAVE_MS);
    });
    expect(result.current.quoteLeaving).toBe(false);
    expect(result.current.quoteIndex).not.toBe(initialIndex);
  });

  it('ignores re-entrant advance() calls during an in-flight leave animation', () => {
    const fixedDate = new Date(2026, 4, 6);
    const { result } = renderHook(() => useQuoteRotation(fixedDate));

    act(() => {
      result.current.advance();
      // Second click within the leave window must NOT stack timeouts —
      // otherwise the index would jump twice for a single user gesture.
      result.current.advance();
      result.current.advance();
    });
    expect(result.current.quoteLeaving).toBe(true);

    act(() => {
      vi.advanceTimersByTime(QUOTE_LEAVE_MS);
    });
    expect(result.current.quoteLeaving).toBe(false);
    // Only one swap happened.
    const afterFirst = result.current.quoteIndex;

    // No further timers pending → advancing the clock does not change state.
    act(() => {
      vi.advanceTimersByTime(QUOTE_LEAVE_MS);
    });
    expect(result.current.quoteIndex).toBe(afterFirst);
    expect(result.current.quoteLeaving).toBe(false);
  });

  it('clears pending timers on unmount so no leaks survive route changes', () => {
    const fixedDate = new Date(2026, 4, 6);
    const { result, unmount } = renderHook(() => useQuoteRotation(fixedDate));
    act(() => {
      result.current.advance();
    });
    expect(result.current.quoteLeaving).toBe(true);
    unmount();
    // Vitest will report unhandled timers on test teardown if cleanup
    // missed them; advancing the clock should be a no-op.
    expect(() => {
      vi.advanceTimersByTime(QUOTE_LEAVE_MS + QUOTE_ROTATE_MS);
    }).not.toThrow();
  });
});
