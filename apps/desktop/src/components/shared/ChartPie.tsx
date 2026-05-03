import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PieSlice {
  key: string;
  label: string;
  value: number;
}

export interface ChartPieProps {
  data: PieSlice[];
  size?: number;
  innerRatio?: number;
  className?: string;
}

const PALETTE = [
  'hsl(217 91% 60%)', // sky-500
  'hsl(142 71% 45%)', // emerald-500
  'hsl(38 92% 50%)',  // amber-500
  'hsl(330 81% 60%)', // pink-500
  'hsl(258 90% 66%)', // violet-500
  'hsl(187 92% 38%)', // teal-500
  'hsl(0 72% 51%)',   // rose-500
  'hsl(168 76% 36%)', // emerald-600
  'hsl(45 93% 47%)',  // yellow-500
  'hsl(206 89% 50%)', // blue-500
  'hsl(220 9% 46%)',  // muted
];

function describeArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polar(cx, cy, rOuter, endAngle);
  const end = polar(cx, cy, rOuter, startAngle);
  const innerStart = polar(cx, cy, rInner, startAngle);
  const innerEnd = polar(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  };
}

export function ChartPie({
  data,
  size = 220,
  innerRatio = 0.6,
  className,
}: ChartPieProps): React.ReactElement {
  const total = data.reduce((acc, s) => acc + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter * innerRatio;

  let cursor = 0;
  const slices = data
    .filter((s) => s.value > 0)
    .map((slice, i) => {
      const fraction = total === 0 ? 0 : slice.value / total;
      const start = cursor;
      const end = cursor + fraction * Math.PI * 2;
      cursor = end;
      const color = PALETTE[i % PALETTE.length];
      return {
        ...slice,
        start,
        end,
        color,
        fraction,
      };
    });

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Donut chart"
        data-testid="chart-pie"
        className="shrink-0"
      >
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={rOuter} className="fill-muted/40" />
        ) : (
          slices.map((s) => (
            <path
              key={s.key}
              d={describeArc(cx, cy, rOuter, rInner, s.start, s.end)}
              fill={s.color}
              stroke="hsl(var(--background))"
              strokeWidth={1}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </path>
          ))
        )}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-foreground text-2xl font-semibold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          className="fill-muted-foreground text-xs uppercase tracking-wider"
        >
          Total
        </text>
      </svg>

      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round(s.fraction * 100)}%
            </span>
          </li>
        ))}
        {slices.length === 0 && (
          <li className="text-sm italic text-muted-foreground">Tidak ada data</li>
        )}
      </ul>
    </div>
  );
}
