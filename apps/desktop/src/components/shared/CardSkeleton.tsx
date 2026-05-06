/**
 * Card-grid skeleton loader (A2-SkeletonScreens, v1.1.0).
 *
 * Renders a responsive grid of card-shaped placeholders matching the OPAC
 * book grid layout. Honors `prefers-reduced-motion` by suppressing the
 * pulse animation when the OS asks us to.
 */
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface CardSkeletonProps {
  /** Number of placeholder cards to render. Defaults to 12. */
  count?: number;
  /** Optional Tailwind classes for the grid container. Override layout. */
  gridClassName?: string;
  /** Optional Tailwind classes for each card. */
  cardClassName?: string;
  /** Override the test id. */
  'data-testid'?: string;
}

const DEFAULT_GRID =
  'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';

export function CardSkeleton({
  count = 12,
  gridClassName,
  cardClassName,
  'data-testid': testId = 'card-skeleton',
}: CardSkeletonProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid={testId}
      className={cn(gridClassName ?? DEFAULT_GRID)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="card-skeleton-item"
          className={cn(
            'flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3 shadow-sm',
            cardClassName,
          )}
        >
          <Skeleton className="aspect-[3/4] w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
