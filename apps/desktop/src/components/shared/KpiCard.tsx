import * as React from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: number | null;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: 'primary' | 'sky' | 'emerald' | 'amber';
  loading?: boolean;
  hint?: string;
}

const TONE: Record<NonNullable<KpiCardProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

export function KpiCard({
  label,
  value,
  delta,
  Icon,
  tone = 'primary',
  loading = false,
  hint,
}: KpiCardProps): React.ReactElement {
  const showDelta = typeof delta === 'number' && Number.isFinite(delta);
  const trendUp = showDelta && delta > 0.5;
  const trendDown = showDelta && delta < -0.5;
  const TrendIcon = trendUp ? ArrowUp : trendDown ? ArrowDown : Minus;
  const trendColor = trendUp
    ? 'text-emerald-600 dark:text-emerald-400'
    : trendDown
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-muted-foreground';

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="kpi-card">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TONE[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      )}

      <div className="flex items-center gap-1 text-xs">
        {showDelta ? (
          <>
            <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
            <span className={cn('font-medium', trendColor)}>{formatDelta(delta)}</span>
            <span className="text-muted-foreground">{hint ?? 'vs bulan lalu'}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{hint ?? '—'}</span>
        )}
      </div>
    </Card>
  );
}
