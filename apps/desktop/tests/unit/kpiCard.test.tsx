import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';

vi.mock('@tanstack/react-router', () => ({
  // KpiCard / InsightCard render `<Link to={href}>...</Link>`; in tests we
  // don't have a router context so swap the Link for a plain anchor that
  // still exposes `href` and `aria-label` to the rendered DOM.
  Link: ({
    to,
    children,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel} data-testid={testId}>
      {children}
    </a>
  ),
}));

import { KpiCard } from '@/components/shared/KpiCard';

describe('KpiCard with href (FEAT-Dashboard-Clickable-KPI)', () => {
  it('wraps the card in a navigable Link when href is provided and not loading', () => {
    render(<KpiCard label="Total Anggota" value={42} Icon={Users} href="/anggota" />);
    const link = screen.getByTestId('kpi-card-link');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/anggota');
    expect(link).toHaveAttribute('aria-label', 'Total Anggota');
    // Card should still render inside the link with the interactive flag set.
    const card = screen.getByTestId('kpi-card');
    expect(card).toHaveAttribute('data-interactive', 'true');
  });

  it('does NOT render the link wrapper while loading=true (skeleton stays inert)', () => {
    render(
      <KpiCard label="Total Buku" value="—" Icon={Users} loading href="/buku" />,
    );
    expect(screen.queryByTestId('kpi-card-link')).not.toBeInTheDocument();
    const card = screen.getByTestId('kpi-card');
    expect(card).not.toHaveAttribute('data-interactive');
  });

  it('does NOT render the link wrapper when href is omitted', () => {
    render(<KpiCard label="Rata-rata" value="3.4" Icon={Users} />);
    expect(screen.queryByTestId('kpi-card-link')).not.toBeInTheDocument();
    const card = screen.getByTestId('kpi-card');
    expect(card).not.toHaveAttribute('data-interactive');
  });

  it('uses the label as the aria-label so the link is accessible', () => {
    render(
      <KpiCard label="Buku Dipinjam" value={7} Icon={Users} href="/peminjaman" />,
    );
    const link = screen.getByLabelText('Buku Dipinjam');
    expect(link).toHaveAttribute('href', '/peminjaman');
  });
});
