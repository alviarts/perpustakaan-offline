import * as React from 'react';
import { cn } from '@/lib/utils';

export interface HeatmapDatum {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  hour: number;
  count: number;
}

export interface HeatmapProps {
  data: HeatmapDatum[];
  className?: string;
  /**
   * Localised day-of-week labels, length 7, indexed by `dow`. The component
   * is locale-agnostic; the parent supplies labels via i18n.
   */
  dayLabels: readonly string[];
  /**
   * Localised tooltip text builder. We can't `useTranslation` here without
   * binding the component to a single i18n context, so the parent owns
   * formatting. Default returns "{dow} · {hour}:00 — {count}".
   */
  formatTooltip?: (cell: HeatmapDatum, dayLabel: string) => string;
}

/**
 * 7×24 activity heatmap (FEAT-25). Renders a fixed grid where each cell's
 * background opacity scales with `count / max`. Pure CSS — no canvas. Empty
 * datasets render a fully-faded grid (no special-cased "empty state" so the
 * surrounding card doesn't need to special-case it either).
 *
 * Visually inspired by GitHub's contributions calendar.
 */
export function Heatmap({
  data,
  className,
  dayLabels,
  formatTooltip,
}: HeatmapProps): React.ReactElement {
  // Index by (dow, hour) so we can look up cells in O(1). Missing cells are
  // rendered as zero — robust to truncated inputs.
  const cellByKey = new Map<string, HeatmapDatum>();
  let max = 0;
  for (const cell of data) {
    cellByKey.set(`${cell.dow}-${cell.hour}`, cell);
    if (cell.count > max) max = cell.count;
  }
  const safeMax = Math.max(max, 1);

  const fmt =
    formatTooltip ?? ((c, dayLabel) => `${dayLabel} · ${String(c.hour).padStart(2, '0')}:00 — ${c.count}`);

  // Show every 4th hour on the x-axis label row to avoid clutter (0, 4, 8, …, 20).
  const hourTickStride = 4;

  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid="heatmap">
      <div className="grid grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-0.5">
        {/* x-axis (top) hour labels */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`hour-${h}`}
            className="text-center text-[9px] text-muted-foreground"
            data-testid={`heatmap-hour-${h}`}
          >
            {h % hourTickStride === 0 ? h : ''}
          </div>
        ))}
        {/* 7 rows × 24 cols */}
        {Array.from({ length: 7 }, (_, dow) => (
          <React.Fragment key={`row-${dow}`}>
            <div
              className="pr-1 text-right text-[10px] text-muted-foreground"
              data-testid={`heatmap-dow-${dow}`}
            >
              {dayLabels[dow] ?? dow}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = cellByKey.get(`${dow}-${hour}`) ?? { dow, hour, count: 0 };
              const intensity = cell.count / safeMax; // 0..1
              const dayLabel = dayLabels[dow] ?? String(dow);
              return (
                <div
                  key={`cell-${dow}-${hour}`}
                  className="aspect-square rounded-[2px] border border-border/40"
                  style={{
                    backgroundColor: `hsl(217 91% 60% / ${0.04 + intensity * 0.85})`,
                  }}
                  title={fmt(cell, dayLabel)}
                  data-testid={`heatmap-cell-${dow}-${hour}`}
                  data-count={cell.count}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>0</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((step) => (
            <div
              key={step}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: `hsl(217 91% 60% / ${0.04 + step * 0.85})` }}
            />
          ))}
        </div>
        <span>{max}</span>
      </div>
    </div>
  );
}
