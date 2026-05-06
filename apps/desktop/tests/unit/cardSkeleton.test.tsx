import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardSkeleton } from '@/components/shared/CardSkeleton';

describe('CardSkeleton (A2-SkeletonScreens)', () => {
  it('renders the requested number of cards', () => {
    render(<CardSkeleton count={6} />);
    expect(screen.getAllByTestId('card-skeleton-item')).toHaveLength(6);
  });

  it('defaults to 12 cards when count omitted', () => {
    render(<CardSkeleton />);
    expect(screen.getAllByTestId('card-skeleton-item')).toHaveLength(12);
  });

  it('marks the container as aria-busy for screen readers', () => {
    render(<CardSkeleton count={1} />);
    const container = screen.getByTestId('card-skeleton');
    expect(container).toHaveAttribute('aria-busy', 'true');
    expect(container).toHaveAttribute('role', 'status');
  });

  it('respects an override grid className', () => {
    render(<CardSkeleton count={1} gridClassName="grid grid-cols-1" />);
    const container = screen.getByTestId('card-skeleton');
    expect(container.className).toContain('grid-cols-1');
  });
});
