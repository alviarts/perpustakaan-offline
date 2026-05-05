import { useEffect, useState } from 'react';

interface LiveClockProps {
  /** BCP-47 locale used for `Intl.DateTimeFormat`. Defaults to `id-ID`. */
  locale?: string;
  /** Tick interval in milliseconds. Defaults to 1000. Lower for tests. */
  tickMs?: number;
  className?: string;
}

const TIME_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
const DATE_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = TIME_FMT_CACHE.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    TIME_FMT_CACHE.set(locale, fmt);
  }
  return fmt;
}

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = DATE_FMT_CACHE.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    DATE_FMT_CACHE.set(locale, fmt);
  }
  return fmt;
}

/**
 * Locale-aware live clock + date pill rendered as two stacked spans. Ticks
 * once per second using a single `setInterval` shared per mount; we keep
 * the formatter instances cached at module level to avoid re-allocating
 * on every tick (the date string only changes once per day but the time
 * string changes every second, so caching the Intl objects materially
 * matters for low-power devices).
 */
export function LiveClock({
  locale = 'id-ID',
  tickMs = 1000,
  className,
}: LiveClockProps): JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const time = timeFormatter(locale).format(now);
  const date = dateFormatter(locale).format(now);

  return (
    <div
      className={
        className ??
        'flex flex-col items-end gap-0.5 rounded-md border bg-card px-3 py-1.5 text-right tabular-nums shadow-sm'
      }
      data-testid="live-clock"
      aria-label={`${date}, ${time}`}
    >
      <span className="font-mono text-sm font-semibold tracking-tight">{time}</span>
      <span className="text-[0.7rem] text-muted-foreground">{date}</span>
    </div>
  );
}
