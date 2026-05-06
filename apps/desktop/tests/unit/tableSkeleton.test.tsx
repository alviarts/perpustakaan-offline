import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton } from '@/components/shared/TableSkeleton';

describe('TableSkeleton (A2-SkeletonScreens)', () => {
  it('renders the requested number of rows × columns', () => {
    render(<TableSkeleton columns={4} rows={3} />);
    const cells = document.querySelectorAll('td');
    expect(cells.length).toBe(4 * 3);
  });

  it('falls back to 8 rows when rows prop is omitted', () => {
    render(<TableSkeleton columns={2} />);
    const tds = document.querySelectorAll('td');
    expect(tds.length).toBe(2 * 8);
  });

  it('honors per-column width hints', () => {
    render(<TableSkeleton columns={3} rows={1} widths={['w-12', 'w-24', 'w-48']} />);
    const skeletons = document.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons[0]?.className).toContain('w-12');
    expect(skeletons[1]?.className).toContain('w-24');
    expect(skeletons[2]?.className).toContain('w-48');
  });

  it('marks the container as aria-busy for screen readers', () => {
    render(<TableSkeleton columns={1} />);
    const container = screen.getByTestId('table-skeleton');
    expect(container).toHaveAttribute('aria-busy', 'true');
    expect(container).toHaveAttribute('role', 'status');
  });

  it('disables the pulse under prefers-reduced-motion via tailwind utility', () => {
    render(<TableSkeleton columns={2} rows={1} />);
    const skeletons = document.querySelectorAll('[data-testid="skeleton"]');
    for (const s of Array.from(skeletons)) {
      expect(s.className).toContain('motion-reduce:animate-none');
    }
  });
});
