import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LineDatum {
  key: string;
  label: string;
  value: number;
}

export interface ChartLineProps {
  data: LineDatum[];
  height?: number;
  className?: string;
  valueFormatter?: (v: number) => string;
  /**
   * Maximum number of x-axis tick labels to render. The chart still draws
   * one circle per data point; only the labels are decimated. We default
   * to 6 so the 30-day and year views don't pile up overlapping text.
   */
  maxXTicks?: number;
}

/**
 * Lightweight SVG line chart used by the dashboard trend toggle (FEAT-25).
 * Pure-CSS / pure-SVG; no charting library so the bundle stays small. The
 * X-axis spans `data.length` points evenly; the Y-axis auto-scales to the
 * largest value, with `Math.max(maxValue, 1)` so an all-zero series still
 * renders a flat baseline.
 */
export function ChartLine({
  data,
  height = 200,
  className,
  valueFormatter = (v) => String(v),
  maxXTicks = 6,
}: ChartLineProps): React.ReactElement {
  const width = 480;
  const padX = 28;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = data.length;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Map each datum to (x, y) in chart coordinates. With n=1 we centre it.
  const points = data.map((d, i) => {
    const x = n <= 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
    const y = padY + innerH - (d.value / maxValue) * innerH;
    return { ...d, x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Area-fill path under the line: same line, then two segments back to the
  // baseline so the SVG fill paints a solid trapezoid-ish shape.
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(1) ?? padX} ${padY + innerH} L ${points[0]?.x.toFixed(1) ?? padX} ${padY + innerH} Z`;

  // Decimate x-axis labels so 30 / 365 daily points don't overlap. We pick a
  // stride that yields at most `maxXTicks` labels, always including the last
  // point so the user sees the latest bucket.
  const tickStride = Math.max(1, Math.ceil(n / maxXTicks));
  const xTicks = points.filter((_, i) => i % tickStride === 0 || i === n - 1);

  // Three horizontal gridlines at 0%, 50%, 100% of maxValue.
  const yGuides = [0, 0.5, 1];

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="chart-line">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Line chart"
      >
        {yGuides.map((g) => {
          const y = padY + innerH - g * innerH;
          return (
            <g key={g}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <text
                x={padX - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px]"
              >
                {valueFormatter(Math.round(g * maxValue))}
              </text>
            </g>
          );
        })}
        {n >= 1 && (
          <>
            <path
              d={areaPath}
              fill="hsl(217 91% 60%)"
              fillOpacity={0.1}
              stroke="none"
            />
            <path
              d={linePath}
              fill="none"
              stroke="hsl(217 91% 60%)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p) => (
              <circle
                key={p.key}
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill="hsl(217 91% 60%)"
              >
                <title>{`${p.label}: ${valueFormatter(p.value)}`}</title>
              </circle>
            ))}
          </>
        )}
      </svg>
      <div className="flex justify-between gap-1 px-7 text-[10px] text-muted-foreground">
        {xTicks.map((t) => (
          <span key={t.key} className="truncate">
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
