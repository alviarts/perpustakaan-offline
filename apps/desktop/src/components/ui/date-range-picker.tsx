import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function startOfYear(): string {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

const TODAY = () => new Date().toISOString().slice(0, 10);

const PRESETS: { id: string; key: string; from: () => string; to: () => string }[] = [
  { id: 'last7', key: 'last7days', from: () => shiftDate(-6), to: TODAY },
  { id: 'last30', key: 'last30days', from: () => shiftDate(-29), to: TODAY },
  { id: 'thisMonth', key: 'thisMonth', from: startOfMonth, to: TODAY },
  { id: 'thisYear', key: 'thisYear', from: startOfYear, to: TODAY },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation('common');
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('datepicker.from', { defaultValue: 'Dari' })}
          </label>
          <DatePicker
            value={value.from}
            max={value.to}
            onChange={(from) => onChange({ ...value, from })}
            showToday={false}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('datepicker.to', { defaultValue: 'Sampai' })}
          </label>
          <DatePicker
            value={value.to}
            min={value.from}
            onChange={(to) => onChange({ ...value, to })}
            showToday={false}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ from: p.from(), to: p.to() })}
          >
            {t(`datepicker.preset.${p.key}`, { defaultValue: p.id })}
          </Button>
        ))}
      </div>
    </div>
  );
}
