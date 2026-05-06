import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heatmap } from '@/components/shared/Heatmap';

const ID_DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

describe('Heatmap', () => {
  it('renders 168 cells covering 7 days × 24 hours', () => {
    render(<Heatmap data={[]} dayLabels={ID_DOW} />);
    // 7 × 24 = 168 grid cells. Hour-axis labels and dow-axis labels are
    // separate elements; we filter via data-testid prefix.
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        expect(
          screen.getByTestId(`heatmap-cell-${dow}-${hour}`),
        ).toBeInTheDocument();
      }
    }
  });

  it('annotates each cell with its count via data-count', () => {
    const data = [
      { dow: 1, hour: 9, count: 5 },
      { dow: 3, hour: 15, count: 12 },
    ];
    render(<Heatmap data={data} dayLabels={ID_DOW} />);
    expect(screen.getByTestId('heatmap-cell-1-9')).toHaveAttribute(
      'data-count',
      '5',
    );
    expect(screen.getByTestId('heatmap-cell-3-15')).toHaveAttribute(
      'data-count',
      '12',
    );
    // Untouched cell defaults to 0.
    expect(screen.getByTestId('heatmap-cell-0-0')).toHaveAttribute(
      'data-count',
      '0',
    );
  });

  it('uses the provided localised day labels in the row headers', () => {
    render(<Heatmap data={[]} dayLabels={ID_DOW} />);
    expect(screen.getByTestId('heatmap-dow-0')).toHaveTextContent('Min');
    expect(screen.getByTestId('heatmap-dow-6')).toHaveTextContent('Sab');
  });

  it('formats tooltips via the formatTooltip override when provided', () => {
    const data = [{ dow: 2, hour: 10, count: 7 }];
    render(
      <Heatmap
        data={data}
        dayLabels={ID_DOW}
        formatTooltip={(c, dayLabel) => `[${dayLabel}] ${c.hour}h = ${c.count}`}
      />,
    );
    expect(screen.getByTestId('heatmap-cell-2-10')).toHaveAttribute(
      'title',
      '[Sel] 10h = 7',
    );
  });

  it('shows hour labels every 4 hours at the top axis', () => {
    render(<Heatmap data={[]} dayLabels={ID_DOW} />);
    // Hour 0/4/8/12/16/20 must show their numeric label; the rest are blank
    // strings (rendered but empty) so layout stays stable.
    for (const h of [0, 4, 8, 12, 16, 20]) {
      expect(screen.getByTestId(`heatmap-hour-${h}`)).toHaveTextContent(
        String(h),
      );
    }
    expect(screen.getByTestId('heatmap-hour-1')).toHaveTextContent('');
  });
});
