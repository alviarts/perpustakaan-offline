import { useCallback, useEffect, useRef, useState } from 'react';
import { pickNextQuoteIndex, quoteIndexForDate } from '@/lib/dailyQuote';

/**
 * How long the dashboard quote-of-the-day stays on screen before rotating
 * to a new pick (FEAT-Dashboard-Quotes-2min). 2 minutes is short enough
 * that operators see new quotes during a single counter session, but long
 * enough that the screen does not feel restless.
 *
 * Lowered from the original 5 minutes per user feedback ("interval 2 menit
 * langsung slide up atau animasi lain").
 */
export const QUOTE_ROTATE_MS = 2 * 60 * 1000;

/**
 * Duration of the slide-up + fade-out exit animation before the new quote
 * mounts. Must stay in sync with the Tailwind transition classes on the
 * leaving element (`transition-all duration-300`).
 */
export const QUOTE_LEAVE_MS = 300;

export interface QuoteRotationState {
  /** Current quote index into the QUOTES array. */
  quoteIndex: number;
  /** Whether the current quote is in its leave-animation phase. */
  quoteLeaving: boolean;
  /**
   * Manually advance to the next quote with the same animation flow used
   * by the auto-rotate timer. Re-entrant calls during the leave phase are
   * ignored so the animation never glitches.
   */
  advance: () => void;
}

/**
 * Self-contained quote rotation state for the dashboard "Daily Quote"
 * card. Owns:
 *
 * - the deterministic per-day initial index (so the first quote of a
 *   given calendar day is the same across reloads / timezones),
 * - a `setInterval` that advances the quote every `QUOTE_ROTATE_MS`,
 * - a `setTimeout` chain that flips `quoteLeaving=true`, swaps the
 *   index after `QUOTE_LEAVE_MS`, then clears the leave flag so the
 *   new mount plays the slide-up enter animation.
 *
 * The returned `advance` lets the UI expose a "next quote" button that
 * runs through the same animation phases as the auto-timer.
 */
export function useQuoteRotation(now: Date = new Date()): QuoteRotationState {
  const [quoteIndex, setQuoteIndex] = useState(() => quoteIndexForDate(now));
  const [quoteLeaving, setQuoteLeaving] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback((): void => {
    // Re-entrant guard: while the leave animation is mid-flight, ignore
    // additional triggers so a fast double-click on the manual next
    // button (or a timer firing during a click) cannot stack timeouts.
    if (leaveTimerRef.current !== null) return;
    setQuoteLeaving(true);
    leaveTimerRef.current = setTimeout(() => {
      setQuoteIndex((prev) => pickNextQuoteIndex(prev));
      setQuoteLeaving(false);
      leaveTimerRef.current = null;
    }, QUOTE_LEAVE_MS);
  }, []);

  useEffect(() => {
    const rotateTimer = setInterval(advance, QUOTE_ROTATE_MS);
    return () => {
      clearInterval(rotateTimer);
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    };
  }, [advance]);

  return { quoteIndex, quoteLeaving, advance };
}
