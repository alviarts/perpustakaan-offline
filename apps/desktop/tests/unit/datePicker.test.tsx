import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { DatePicker } from '@/components/ui/date-picker';

i18n.init({
  lng: 'id',
  fallbackLng: 'id',
  resources: { id: { common: { datepicker: { today: 'Hari Ini' } } } },
  interpolation: { escapeValue: false },
});

function renderDp(props: Parameters<typeof DatePicker>[0]) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DatePicker {...props} />
    </I18nextProvider>,
  );
}

describe('DatePicker', () => {
  it('renders the supplied value', () => {
    renderDp({ value: '2026-05-03', onChange: vi.fn() });
    const input = screen.getByDisplayValue('2026-05-03');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange when input changes', () => {
    const onChange = vi.fn();
    renderDp({ value: '2026-05-01', onChange });
    const input = screen.getByDisplayValue('2026-05-01');
    fireEvent.change(input, { target: { value: '2026-05-10' } });
    expect(onChange).toHaveBeenCalledWith('2026-05-10');
  });

  it('Today button populates value with current ISO date', () => {
    const onChange = vi.fn();
    renderDp({ value: '', onChange });
    const today = new Date().toISOString().slice(0, 10);
    fireEvent.click(screen.getByRole('button', { name: /hari ini/i }));
    expect(onChange).toHaveBeenCalledWith(today);
  });

  it('hides today button when showToday=false', () => {
    renderDp({ value: '', onChange: vi.fn(), showToday: false });
    expect(screen.queryByRole('button', { name: /hari ini/i })).toBeNull();
  });
});
