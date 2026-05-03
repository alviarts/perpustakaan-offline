import { forwardRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  /** Render an inline "Hari Ini" button next to the input. Defaults to true. */
  showToday?: boolean;
  id?: string;
  name?: string;
  /** ARIA label for screen readers; visible label sits in form layout. */
  ariaLabel?: string;
}

/**
 * Native <input type="date"> wrapped with a "Today" shortcut and locale-friendly
 * styling. Browsers handle locale rendering automatically based on the user's
 * preferred language; for Tauri the system locale (Indonesian) drives format.
 *
 * Reusable across Peminjaman, Pengembalian, Reports, dan filter Kunjungan.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(props, ref) {
    const {
      value,
      onChange,
      min,
      max,
      disabled,
      className,
      showToday = true,
      id,
      name,
      ariaLabel,
    } = props;
    const { t } = useTranslation('common');
    const reactId = useId();
    const inputId = id ?? reactId;

    const today = new Date().toISOString().slice(0, 10);

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative flex-1">
          <Calendar
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="date"
            value={value ?? ''}
            min={min}
            max={max}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm',
              'ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        </div>
        {showToday && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(today)}
            aria-label={t('datepicker.today', { defaultValue: 'Hari Ini' })}
          >
            {t('datepicker.today', { defaultValue: 'Hari Ini' })}
          </Button>
        )}
      </div>
    );
  },
);
