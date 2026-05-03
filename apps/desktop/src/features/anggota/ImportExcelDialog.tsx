import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { read, utils, type WorkBook } from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { anggotaApi, type AnggotaImportItem, type AnggotaImportResult } from '@/lib/anggota';
import { useToast } from '@/components/ui/toast-manager';

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: AnggotaImportResult) => void;
}

const HEADER_MAP: Record<string, keyof AnggotaImportItem> = {
  kode_anggota: 'kodeAnggota',
  kodeanggota: 'kodeAnggota',
  kode: 'kodeAnggota',
  nis: 'kodeAnggota',
  nama: 'nama',
  name: 'nama',
  kelas: 'kelas',
  class: 'kelas',
  jurusan: 'jurusan',
  major: 'jurusan',
  agama: 'agama',
  religion: 'agama',
  jenis_kelamin: 'jenisKelamin',
  jeniskelamin: 'jenisKelamin',
  gender: 'jenisKelamin',
  no_telp: 'noTelp',
  notelp: 'noTelp',
  no_telepon: 'noTelp',
  telepon: 'noTelp',
  phone: 'noTelp',
  email: 'email',
};

function normalizeHeader(raw: string): keyof AnggotaImportItem | null {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[\s./-]+/g, '_');
  return HEADER_MAP[cleaned] ?? null;
}

function rowsFromWorkbook(wb: WorkBook): AnggotaImportItem[] {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return raw
    .map((rawRow) => {
      const item: AnggotaImportItem = { kodeAnggota: '', nama: '' };
      for (const [key, value] of Object.entries(rawRow)) {
        const mapped = normalizeHeader(key);
        if (!mapped) continue;
        const str = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
        if (mapped === 'kodeAnggota' || mapped === 'nama') {
          item[mapped] = str;
        } else if (mapped === 'jenisKelamin') {
          const upper = str.toUpperCase();
          item.jenisKelamin = upper === 'L' || upper === 'P' ? upper : null;
        } else {
          item[mapped] = str.length > 0 ? str : null;
        }
      }
      return item;
    })
    .filter((item) => item.kodeAnggota || item.nama);
}

export function ImportExcelDialog({ open, onOpenChange, onImported }: ImportExcelDialogProps) {
  const { t } = useTranslation(['anggota', 'common']);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<AnggotaImportItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = (): void => {
    setFilename(null);
    setRows([]);
    setParseError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File): Promise<void> => {
    try {
      setParseError(null);
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array' });
      const parsed = rowsFromWorkbook(wb);
      setFilename(file.name);
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      setRows([]);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const result = await anggotaApi.importBatch(rows);
      onImported(result);
      showToast({
        title: t('anggota:feedback.importSuccess', { inserted: result.inserted }),
        description: t('anggota:import.summary', {
          inserted: result.inserted,
          skipped: result.skipped,
        }),
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('anggota:feedback.importSuccess', { inserted: 0 }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('anggota:import.title')}</DialogTitle>
          <DialogDescription>{t('anggota:import.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              data-testid="import-file-input"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleFile(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              data-testid="import-pick-file"
            >
              {t('anggota:import.pickFile')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {filename ? t('anggota:import.filename', { name: filename }) : t('anggota:import.noFile')}
            </span>
          </div>

          {parseError && (
            <p className="text-sm text-destructive">
              {t('anggota:import.parseError', { message: parseError })}
            </p>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-medium">
                  {t('anggota:import.previewTitle', { count: rows.length })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('anggota:import.previewSubtitle')}
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('anggota:columns.kode')}</TableHead>
                      <TableHead>{t('anggota:columns.nama')}</TableHead>
                      <TableHead>{t('anggota:columns.kelas')}</TableHead>
                      <TableHead>{t('anggota:columns.jurusan')}</TableHead>
                      <TableHead>{t('anggota:columns.agama')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, idx) => (
                      <TableRow key={`${row.kodeAnggota}-${idx}`}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{row.kodeAnggota}</TableCell>
                        <TableCell>{row.nama}</TableCell>
                        <TableCell>{row.kelas ?? '—'}</TableCell>
                        <TableCell>{row.jurusan ?? '—'}</TableCell>
                        <TableCell>{row.agama ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('anggota:import.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rows.length === 0 || busy}
            data-testid="import-submit"
          >
            {busy
              ? t('common:states.loading')
              : t('anggota:import.submit', { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
