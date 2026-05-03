import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { read, utils, type WorkBook } from 'xlsx';
import { Button } from '@/components/ui/button';
import { formatTauriError } from '@/lib/errors';
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
import { bukuApi, type BukuImportItem, type BukuImportResult } from '@/lib/buku';
import { useToast } from '@/components/ui/toast-manager';

interface ImportBukuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: BukuImportResult) => void;
}

const HEADER_MAP: Record<string, keyof BukuImportItem> = {
  kode_buku: 'kodeBuku',
  kodebuku: 'kodeBuku',
  kode: 'kodeBuku',
  judul: 'judul',
  title: 'judul',
  pengarang: 'pengarang',
  author: 'pengarang',
  penerbit: 'penerbit',
  publisher: 'penerbit',
  tahun: 'tahunTerbit',
  tahun_terbit: 'tahunTerbit',
  year: 'tahunTerbit',
  ddc: 'kodeDdc',
  kode_ddc: 'kodeDdc',
  kategori: 'kategori',
  category: 'kategori',
  isbn: 'isbn',
  jumlah: 'jumlahEksemplar',
  jumlah_eksemplar: 'jumlahEksemplar',
  copies: 'jumlahEksemplar',
  bahasa: 'bahasa',
  language: 'bahasa',
};

function normalizeHeader(raw: string): keyof BukuImportItem | null {
  const cleaned = raw.toLowerCase().trim().replace(/[\s./-]+/g, '_');
  return HEADER_MAP[cleaned] ?? null;
}

function rowsFromWorkbook(wb: WorkBook): BukuImportItem[] {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const raw = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  return raw
    .map((rawRow) => {
      const item: BukuImportItem = { kodeBuku: '', judul: '' };
      for (const [key, value] of Object.entries(rawRow)) {
        const mapped = normalizeHeader(key);
        if (!mapped) continue;
        const str =
          typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
        if (mapped === 'kodeBuku' || mapped === 'judul') {
          item[mapped] = str;
        } else if (mapped === 'tahunTerbit' || mapped === 'jumlahEksemplar') {
          const n = Number(str);
          item[mapped] = Number.isFinite(n) ? Math.trunc(n) : null;
        } else {
          item[mapped] = str.length > 0 ? str : null;
        }
      }
      return item;
    })
    .filter((item) => item.kodeBuku || item.judul);
}

export function ImportBukuDialog({ open, onOpenChange, onImported }: ImportBukuDialogProps) {
  const { t } = useTranslation(['buku', 'common']);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<BukuImportItem[]>([]);
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
      setParseError(formatTauriError(err));
      setRows([]);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const result = await bukuApi.importBatch(rows);
      onImported(result);
      showToast({
        title: t('buku:feedback.importSuccess', { inserted: result.inserted }),
        description: t('buku:import.summary', {
          inserted: result.inserted,
          skipped: result.skipped,
        }),
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:feedback.importSuccess', { inserted: 0 }),
        description: formatTauriError(err),
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
          <DialogTitle>{t('buku:import.title')}</DialogTitle>
          <DialogDescription>{t('buku:import.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              data-testid="buku-import-file-input"
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
              data-testid="buku-import-pick-file"
            >
              {t('buku:import.pickFile')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {filename
                ? t('buku:import.filename', { name: filename })
                : t('buku:import.noFile')}
            </span>
          </div>

          {parseError && (
            <p className="text-sm text-destructive">
              {t('buku:import.parseError', { message: parseError })}
            </p>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-medium">
                  {t('buku:import.previewTitle', { count: rows.length })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('buku:import.previewSubtitle')}
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('buku:columns.kode')}</TableHead>
                      <TableHead>{t('buku:columns.judul')}</TableHead>
                      <TableHead>{t('buku:columns.kategori')}</TableHead>
                      <TableHead>{t('buku:columns.ddc')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row, idx) => (
                      <TableRow key={`${row.kodeBuku}-${idx}`}>
                        <TableCell className="text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.kodeBuku}</TableCell>
                        <TableCell>{row.judul}</TableCell>
                        <TableCell>{row.kategori ?? '—'}</TableCell>
                        <TableCell>{row.kodeDdc ?? '—'}</TableCell>
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
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={busy || rows.length === 0} data-testid="buku-import-submit">
            {busy
              ? t('common:states.loading')
              : t('buku:import.submit', { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
