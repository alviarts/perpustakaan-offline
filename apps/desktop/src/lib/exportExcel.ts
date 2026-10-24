import { utils, write } from 'xlsx';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

import { isTauri } from '@/lib/auth';

export type XlsxCell = string | number | null | undefined;

export interface XlsxExportArgs {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: XlsxCell[][];
}

/** Build an in-memory XLSX workbook (single sheet) as raw bytes. */
export function buildXlsxBytes(
  headers: string[],
  rows: XlsxCell[][],
  sheetName: string = 'Laporan',
): Uint8Array {
  const aoa: XlsxCell[][] = [headers, ...rows.map((r) => r.map((c) => (c == null ? '' : c)))];
  const sheet = utils.aoa_to_sheet(aoa);
  const widths = headers.map((h, i) => {
    const maxData = rows.reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 0);
    return { wch: Math.min(60, Math.max(h.length + 2, maxData + 2, 10)) };
  });
  sheet['!cols'] = widths;
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, sheetName.slice(0, 31));
  const out = write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

/**
 * Export a report table to `.xlsx`. Picks a save destination via the Tauri
 * dialog and writes with `export_write_bytes`; falls back to a browser download
 * in non-Tauri (Vitest / web) mode. Returns the written path, or null when the
 * user cancels the dialog.
 */
export async function exportXlsx(args: XlsxExportArgs): Promise<string | null> {
  const bytes = buildXlsxBytes(args.headers, args.rows, args.sheetName);

  if (isTauri()) {
    const picked = await saveDialog({
      defaultPath: args.filename,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      title: 'Ekspor ke Excel',
    });
    if (!picked) return null;
    await invoke<number>('export_write_bytes', {
      destPath: picked,
      bytes: Array.from(bytes),
    });
    return picked;
  }

  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([ab], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = args.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return args.filename;
}
