import { Download } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { exportXlsx, type XlsxCell } from '@/lib/exportExcel';

export interface ExportExcelButtonProps<T> extends Omit<ButtonProps, 'onClick'> {
  /** Nama file default (tanpa ekstensi juga boleh). */
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: T[];
  /** Ubah satu baris data menjadi sel-sel Excel. */
  toRow: (item: T) => XlsxCell[];
  label?: string;
}

/**
 * Tombol "Ekspor Excel" siap pakai untuk tabel/daftar. Memakai helper
 * `exportXlsx` yang otomatis memilih dialog simpan Tauri di desktop dan
 * anchor download di browser dev.
 */
export function ExportExcelButton<T>({
  filename,
  sheetName = 'Data',
  headers,
  rows,
  toRow,
  label = 'Ekspor Excel',
  disabled,
  ...props
}: ExportExcelButtonProps<T>) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || rows.length === 0}
      onClick={() => {
        void exportXlsx({
          filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
          sheetName,
          headers,
          rows: rows.map(toRow),
        });
      }}
      {...props}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
