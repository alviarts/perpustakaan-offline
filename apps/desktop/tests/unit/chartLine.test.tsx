import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartLine } from '@/components/shared/ChartLine';

describe('ChartLine', () => {
  it('renders one circle per data point', () => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      key: `day-${i}`,
      label: `D${i}`,
      value: i + 1,
    }));
    const { container } = render(<ChartLine data={data} />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(7);
  });

  it('decimates x-axis labels when there are more points than maxXTicks', () => {
    // 30 data points but maxXTicks=6 → expect at most 7 visible labels (6 picks + last).
    const data = Array.from({ length: 30 }, (_, i) => ({
      key: `d-${i}`,
      label: `${i}`,
      value: i,
    }));
    render(<ChartLine data={data} maxXTicks={6} />);
    const chart = screen.getByTestId('chart-line');
    const labels = chart.querySelectorAll('.text-\\[10px\\] > span');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels.length).toBeLessThanOrEqual(7);
  });

  it('renders an empty SVG without crashing on zero data points', () => {
    const { container } = render(<ChartLine data={[]} />);
    // No circles, no path — but the container is still present.
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('handles all-zero series gracefully (uses Math.max(maxValue, 1))', () => {
    const data = [
      { key: 'a', label: 'A', value: 0 },
      { key: 'b', label: 'B', value: 0 },
    ];
    const { container } = render(<ChartLine data={data} />);
    // Two circles even though all values are zero — the chart renders a flat
    // baseline rather than crashing on division by 0.
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});
