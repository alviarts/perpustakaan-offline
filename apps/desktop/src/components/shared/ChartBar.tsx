import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

export interface ChartBarProps {
  data: BarDatum[];
  height?: number;
  className?: string;
  valueFormatter?: (v: number) => string;
}

export function ChartBar({
  data,
  height = 200,
  className,
  valueFormatter = (v) => String(v),
}: ChartBarProps): React.ReactElement {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="chart-bar">
      <div className="flex items-end gap-2" style={{ height }} role="img" aria-label="Bar chart">
        {data.map((d) => {
          const ratio = d.value / maxValue;
          const barHeight = Math.max(4, Math.round(ratio * (height - 30)));
          return (
            <div
              key={d.key}
              className="flex flex-1 flex-col items-center justify-end gap-1.5"
              title={`${d.label}: ${valueFormatter(d.value)}`}
            >
              <span className="text-xs font-medium tabular-nums text-foreground">
                {d.value > 0 ? d.value : ''}
              </span>
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-primary/60 to-primary"
                style={{ height: barHeight }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <div key={d.key} className="flex-1 truncate text-center text-[10px] text-muted-foreground">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
