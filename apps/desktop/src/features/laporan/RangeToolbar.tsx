import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { rangeForPreset } from '@/lib/kunjungan';

export interface RangeToolbarProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exportDisabled?: boolean;
}

export function RangeToolbar({
  range,
  onRangeChange,
  onExportCsv,
  onExportPdf,
  exportDisabled,
}: RangeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <DateRangePicker value={range} onChange={onRangeChange} />
      <div className="flex flex-wrap gap-2">
        {onExportCsv && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            disabled={exportDisabled}
            data-testid="laporan-export-csv"
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        )}
        {onExportPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            disabled={exportDisabled}
            data-testid="laporan-export-pdf"
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        )}
      </div>
    </div>
  );
}

export const presetRangeMonth = (): DateRange => rangeForPreset('month');
