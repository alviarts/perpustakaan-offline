/**
 * Table-shaped skeleton loader (A2-SkeletonScreens, v1.1.0).
 *
 * Renders a `<table>` with the same column/row structure as the eventual
 * data so the user perceives the page as "loaded" much faster than a
 * centered spinner. Honors `prefers-reduced-motion` by suppressing the
 * pulse animation when the OS asks us to.
 */
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface TableSkeletonProps {
  /** Number of `<td>` per row. Required so the placeholder shape matches. */
  columns: number;
  /** Number of placeholder rows to render. Defaults to 8. */
  rows?: number;
  /** Optional Tailwind width hints, one per column (cycled if shorter). */
  widths?: ReadonlyArray<string>;
  /** Optional class on the wrapping container. */
  className?: string;
  /** Override the test id. */
  'data-testid'?: string;
}

const DEFAULT_WIDTHS: readonly string[] = [
  'w-32',
  'w-48',
  'w-24',
  'w-40',
  'w-20',
];

export function TableSkeleton({
  columns,
  rows = 8,
  widths,
  className,
  'data-testid': testId = 'table-skeleton',
}: TableSkeletonProps): React.ReactElement {
  const widthFor = (col: number): string => {
    const list = widths && widths.length > 0 ? widths : DEFAULT_WIDTHS;
    return list[col % list.length] ?? 'w-32';
  };
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid={testId}
      className={cn('w-full', className)}
    >
      <table className="w-full border-collapse">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-border/40 last:border-b-0">
              {Array.from({ length: columns }).map((__, c) => (
                <td key={c} className="px-3 py-3">
                  <Skeleton className={cn('h-4 motion-reduce:animate-none', widthFor(c))} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
