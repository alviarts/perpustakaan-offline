import * as React from 'react';
import { ArrowDownAZ, ArrowUpAZ, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Falls back to `String(value[key])` when omitted. */
  cell?: (row: T) => React.ReactNode;
  /** Server-side sortable. When set, clicking the header calls `onSortChange`. */
  sortable?: boolean;
  /** Tailwind class to apply to the `<th>` (e.g. width). */
  className?: string;
  /** Tailwind class to apply to each `<td>` in this column. */
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Stable React key per row. */
  rowKey: (row: T) => React.Key;
  isLoading?: boolean;
  empty?: React.ReactNode;
  /** Sort state — column key + direction, or null when unsorted. */
  sort?: { key: string; dir: 'asc' | 'desc' } | null;
  onSortChange?: (next: { key: string; dir: 'asc' | 'desc' } | null) => void;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Highlight the row whose key matches (e.g. for master/detail selection). */
  highlightedRowKey?: React.Key;
  /** `data-testid` for e2e tests on the surrounding container. */
  'data-testid'?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  empty,
  sort,
  onSortChange,
  onRowClick,
  className,
  highlightedRowKey,
  ...rest
}: DataTableProps<T>): React.ReactElement {
  const handleSort = (col: DataTableColumn<T>): void => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.key !== col.key) {
      onSortChange({ key: col.key, dir: 'asc' });
    } else if (sort.dir === 'asc') {
      onSortChange({ key: col.key, dir: 'desc' });
    } else {
      onSortChange(null);
    }
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-card text-card-foreground shadow-sm',
        className,
      )}
      data-testid={rest['data-testid']}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(col.className, col.sortable && 'cursor-pointer select-none')}
                onClick={col.sortable ? () => handleSort(col) : undefined}
                aria-sort={
                  sort?.key === col.key
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : col.sortable
                      ? 'none'
                      : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable &&
                    (sort?.key !== col.key ? (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    ) : sort.dir === 'asc' ? (
                      <ArrowUpAZ className="h-3 w-3" />
                    ) : (
                      <ArrowDownAZ className="h-3 w-3" />
                    ))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                Memuat…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                {empty ?? 'Tidak ada data'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const highlighted = highlightedRowKey != null && key === highlightedRowKey;
              return (
                <TableRow
                  key={key}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    highlighted && 'bg-muted/60 hover:bg-muted/60',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-state={highlighted ? 'selected' : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.cellClassName}>
                      {col.cell
                        ? col.cell(row)
                        : String((row as unknown as Record<string, unknown>)[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
