import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import {
  bukuApi,
  bukuIsbnApi,
  metadataToImportItem,
  type BukuImportItem,
  type IsbnLookupResult,
  type IsbnMetadata,
} from '@/lib/buku';

interface IsbnImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = 'input' | 'preview' | 'result';

interface PreviewRow {
  /** ISBN as typed by the user, kept verbatim for the row label. */
  raw: string;
  /** Result returned by the backend; null while still loading. */
  result: IsbnLookupResult | null;
  /** User-editable kodeBuku (auto-suggested but overridable). */
  kodeBuku: string;
  /**
   * `true` when the row should be inserted on submit. Defaults to true when
   * the lookup found metadata, false when nothing was found or the lookup
   * errored.
   */
  selected: boolean;
}

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/**
 * Suggest a kodeBuku based on the ISBN. Format: `B-<last 5 digits>` so admins
 * see a deterministic, short, mnemonic prefix that they can override.
 */
function suggestKode(isbn: string): string {
  const digits = isbn.replace(/[^0-9]/g, '');
  const tail = digits.slice(-5).padStart(5, '0');
  return `B-${tail}`;
}

/**
 * Split a free-form textarea into individual ISBN candidates. Splits on
 * whitespace, commas, semicolons, and newlines; trims and dedupes.
 */
export function parseIsbnList(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of input.split(/[\s,;]+/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const key = trimmed.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function IsbnImportDialog({ open, onOpenChange, onImported }: IsbnImportDialogProps) {
  const { t } = useTranslation(['buku', 'common']);
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('input');
      setText('');
      setRows([]);
      setBusy(false);
      setSummary(null);
    }
  }, [open]);

  const isbns = useMemo(() => parseIsbnList(text), [text]);

  const handleLookup = async (): Promise<void> => {
    if (isbns.length === 0) return;
    setBusy(true);
    try {
      const results = await bukuIsbnApi.lookupBatch(isbns);
      const next: PreviewRow[] = results.map((r) => ({
        raw: r.isbn,
        result: r,
        kodeBuku: suggestKode(r.metadata?.isbn ?? r.isbn),
        selected: r.metadata != null,
      }));
      setRows(next);
      setStep('preview');
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:isbnImport.lookupFailedTitle', {
          defaultValue: 'Gagal mengambil metadata ISBN',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<PreviewRow>): void => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const handleSubmit = async (): Promise<void> => {
    const items: BukuImportItem[] = [];
    const skippedReasons: { row: number; message: string }[] = [];
    rows.forEach((row, idx) => {
      const rowNo = idx + 1;
      if (!row.selected) {
        skippedReasons.push({
          row: rowNo,
          message: t('buku:isbnImport.skipUnselected', {
            defaultValue: 'Tidak dipilih',
          }),
        });
        return;
      }
      const meta: IsbnMetadata | null = row.result?.metadata ?? null;
      if (!meta) {
        skippedReasons.push({
          row: rowNo,
          message:
            row.result?.error ??
            t('buku:isbnImport.notFound', {
              defaultValue: 'Tidak ada metadata',
            }),
        });
        return;
      }
      const item = metadataToImportItem(meta, row.kodeBuku);
      if (!item) {
        skippedReasons.push({
          row: rowNo,
          message: t('buku:isbnImport.missingJudul', {
            defaultValue: 'Judul tidak tersedia',
          }),
        });
        return;
      }
      items.push(item);
    });

    if (items.length === 0) {
      showToast({
        variant: 'destructive',
        title: t('buku:isbnImport.nothingToImport', {
          defaultValue: 'Tidak ada baris yang siap diimpor',
        }),
      });
      return;
    }

    setBusy(true);
    try {
      const r = await bukuApi.importBatch(items);
      setSummary({
        inserted: r.inserted,
        skipped: r.skipped + skippedReasons.length,
        errors: [
          ...skippedReasons,
          ...r.errors.map((e) => ({ row: e.row, message: e.message })),
        ].sort((a, b) => a.row - b.row),
      });
      setStep('result');
      onImported();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:isbnImport.importFailedTitle', {
          defaultValue: 'Gagal menyimpan buku',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('buku:isbnImport.title', { defaultValue: 'Impor Buku via ISBN' })}
          </DialogTitle>
          <DialogDescription>
            {t('buku:isbnImport.description', {
              defaultValue:
                'Tempel daftar ISBN (satu per baris atau dipisah koma). Aplikasi akan mencari metadata di Open Library lalu Google Books.',
            })}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-3">
            <textarea
              data-testid="isbn-import-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="h-48 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="9786020385945&#10;978-602-03-1234-5&#10;0140449132"
            />
            <p className="text-xs text-muted-foreground">
              {t('buku:isbnImport.parsedHint', {
                defaultValue: '{{count}} ISBN siap dicari',
                count: isbns.length,
              })}
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {t('buku:isbnImport.previewFound', {
                  defaultValue: '{{count}} metadata ditemukan',
                  count: rows.filter((r) => r.result?.metadata).length,
                })}
              </Badge>
              {rows.some((r) => !r.result?.metadata) && (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {t('buku:isbnImport.previewMissing', {
                    defaultValue: '{{count}} tidak ditemukan',
                    count: rows.filter((r) => !r.result?.metadata).length,
                  })}
                </Badge>
              )}
            </div>
            <div className="rounded-md border">
              <div className="max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-10" />
                      <TableHead>ISBN</TableHead>
                      <TableHead>{t('buku:isbnImport.colKode', { defaultValue: 'Kode Buku' })}</TableHead>
                      <TableHead>{t('buku:fields.judul', { defaultValue: 'Judul' })}</TableHead>
                      <TableHead>{t('buku:fields.pengarang', { defaultValue: 'Pengarang' })}</TableHead>
                      <TableHead>{t('buku:isbnImport.colSource', { defaultValue: 'Sumber' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const meta = row.result?.metadata;
                      const err = row.result?.error;
                      return (
                        <TableRow
                          key={`${row.raw}-${idx}`}
                          className={!meta ? 'bg-destructive/10 hover:bg-destructive/15' : ''}
                        >
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <input
                              type="checkbox"
                              data-testid={`isbn-import-row-${idx}-selected`}
                              checked={row.selected}
                              disabled={!meta}
                              onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.raw}</TableCell>
                          <TableCell>
                            <Input
                              data-testid={`isbn-import-row-${idx}-kode`}
                              value={row.kodeBuku}
                              onChange={(e) => updateRow(idx, { kodeBuku: e.target.value })}
                              className="h-8 w-32 font-mono text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {meta?.judul ?? (
                              <span className="text-destructive">
                                {err ??
                                  t('buku:isbnImport.notFound', {
                                    defaultValue: 'Tidak ada metadata',
                                  })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{meta?.pengarang ?? '—'}</TableCell>
                          <TableCell className="text-xs uppercase text-muted-foreground">
                            {meta?.source ?? '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                <p className="text-xs uppercase tracking-wide">
                  {t('common:importWizard.result.inserted', 'Ditambahkan')}
                </p>
                <p className="text-2xl font-semibold">{summary.inserted}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('common:importWizard.result.skipped', 'Dilewati')}
                </p>
                <p className="text-2xl font-semibold">{summary.skipped}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('common:importWizard.result.errors', 'Error')}
                </p>
                <p className="text-2xl font-semibold">{summary.errors.length}</p>
              </div>
            </div>
            {summary.errors.length > 0 && (
              <div className="rounded-md border">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t('common:importWizard.preview.colError', 'Error')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.errors.map((e) => (
                        <TableRow key={`${e.row}-${e.message}`}>
                          <TableCell className="text-xs text-muted-foreground">{e.row}</TableCell>
                          <TableCell className="text-xs text-destructive">{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'input' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('common:actions.cancel', 'Batal')}
              </Button>
              <Button
                onClick={() => void handleLookup()}
                disabled={busy || isbns.length === 0}
                data-testid="isbn-import-lookup"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {t('buku:isbnImport.lookup', { defaultValue: 'Cari Metadata' })}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('input')} disabled={busy}>
                {t('common:actions.back', 'Kembali')}
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={busy || rows.every((r) => !r.selected)}
                data-testid="isbn-import-submit"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t('buku:isbnImport.import', {
                  defaultValue: 'Impor {{count}} buku',
                  count: rows.filter((r) => r.selected).length,
                })}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>
              {t('common:actions.close', 'Tutup')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
