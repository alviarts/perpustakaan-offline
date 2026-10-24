import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { rangeForPreset } from '@/lib/kunjungan';
import { academicRange } from '@/lib/akreditasi';

export interface RangeToolbarProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exportDisabled?: boolean;
  /** When set (1..=12), render Semester Ganjil/Genap/Tahun Ajaran presets. */
  awalBulanTahunAjaran?: number;
}

export function RangeToolbar({
  range,
  onRangeChange,
  onExportCsv,
  onExportPdf,
  onExportExcel,
  exportDisabled,
  awalBulanTahunAjaran,
}: RangeToolbarProps) {
  const { t } = useTranslation(['laporan', 'common']);
  return (
    <div className="flex flex-col gap-3">
      <DateRangePicker value={range} onChange={onRangeChange} />

      {awalBulanTahunAjaran != null && (
        <div className="flex flex-wrap gap-2">
          {(['ganjil', 'genap', 'tahunAjaran'] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRangeChange(academicRange(p, awalBulanTahunAjaran))}
              data-testid={`laporan-preset-${p}`}
            >
              {t(`laporan:preset.${p}`, {
                defaultValue:
                  p === 'ganjil' ? 'Semester Ganjil' : p === 'genap' ? 'Semester Genap' : 'Tahun Ajaran',
              })}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
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
        {onExportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            disabled={exportDisabled}
            data-testid="laporan-export-excel"
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
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
