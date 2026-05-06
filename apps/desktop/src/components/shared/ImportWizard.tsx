import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { cn } from '@/lib/utils';
import { formatTauriError } from '@/lib/errors';
import {
  autoMap,
  buildErrorReportCsv,
  buildMappedRows,
  buildTemplateBytes,
  parseFile,
  triggerDownload,
  type ImportFieldDef,
  type Mapping,
  type MappedRow,
  type ParsedFile,
} from '@/lib/importWizard';

export interface ImportWizardImportError {
  row: number;
  message: string;
}

export interface ImportWizardResult {
  inserted: number;
  /**
   * Optional count of rows that updated an existing record (e.g. anggota
   * import overwrite mode). Backends that don't support overwrite simply
   * omit this field.
   */
  updated?: number;
  skipped: number;
  errors: ImportWizardImportError[];
}

export interface ImportWizardProps<TItem> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title shown in the dialog header (translated). */
  title: string;
  /** Description shown under the title (translated). */
  description: string;
  /** Field definitions used for mapping + validation + template. */
  fields: ImportFieldDef<TItem>[];
  /** Sheet name used in the downloadable template. */
  templateSheetName: string;
  /** File name used when downloading the template. */
  templateFilename: string;
  /** Convert raw mapped strings into the typed item shape. */
  rowParser: (rawByKey: Record<string, string>) => TItem;
  /** Submit only items that have no validation errors. */
  onImport: (items: TItem[]) => Promise<ImportWizardResult>;
  /** Called once submission completes successfully. */
  onImported: (result: ImportWizardResult) => void;
  /**
   * Optional extra controls rendered above the preview submit row, e.g.
   * an "update existing rows" toggle for the anggota import.
   */
  extras?: ReactNode;
}

type Step = 'upload' | 'map' | 'preview' | 'result';

export function ImportWizard<TItem>(
  props: ImportWizardProps<TItem>,
) {
  const {
    open,
    onOpenChange,
    title,
    description,
    fields,
    templateSheetName,
    templateFilename,
    rowParser,
    onImport,
    onImported,
    extras,
  } = props;

  const { t } = useTranslation(['common']);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportWizardResult | null>(null);

  const reset = (): void => {
    setStep('upload');
    setParsed(null);
    setParseError(null);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const handleFile = async (file: File): Promise<void> => {
    setParseError(null);
    try {
      const p = await parseFile(file);
      setParsed(p);
      const m = autoMap(fields, p.headers);
      setMapping(m);
      setStep('map');
    } catch (err) {
      setParseError(formatTauriError(err));
    }
  };

  const handleDownloadTemplate = (): void => {
    const bytes = buildTemplateBytes(fields, templateSheetName);
    triggerDownload(
      templateFilename,
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  };

  const requiredFields = fields.filter((f) => f.required);
  const mappedTargets = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = requiredFields.filter((f) => !mappedTargets.has(f.key));

  const mappedRows: MappedRow<TItem>[] = useMemo(() => {
    if (!parsed) return [];
    return buildMappedRows(fields, parsed, mapping, rowParser);
  }, [parsed, fields, mapping, rowParser]);

  const validRows = mappedRows.filter((r) => r.errors.length === 0);
  const invalidRows = mappedRows.filter((r) => r.errors.length > 0);

  const handleSubmit = async (): Promise<void> => {
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const items = validRows.map((r) => r.item);
      const r = await onImport(items);
      // Re-base the row numbers reported by backend so they refer to the
      // original spreadsheet row (header is row 1, first data is row 2).
      const rebased: ImportWizardResult = {
        inserted: r.inserted,
        updated: r.updated,
        skipped: r.skipped + invalidRows.length,
        errors: [
          ...invalidRows.map((row) => ({
            row: row.rowNumber,
            message: row.errors.join('; '),
          })),
          ...r.errors.map((e) => ({
            row: validRows[e.row - 1]?.rowNumber ?? e.row,
            message: e.message,
          })),
        ].sort((a, b) => a.row - b.row),
      };
      setResult(rebased);
      setStep('result');
      onImported(rebased);
      showToast({
        title: t('common:importWizard.toastDone', {
          defaultValue: 'Selesai impor',
        }),
        description: t('common:importWizard.toastSummary', {
          defaultValue: '{{inserted}} ditambahkan, {{skipped}} dilewati',
          inserted: rebased.inserted,
          skipped: rebased.skipped,
        }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('common:importWizard.toastFailed', {
          defaultValue: 'Gagal impor',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadErrors = (): void => {
    if (!result || result.errors.length === 0) return;
    const csv = buildErrorReportCsv(result.errors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(`import-errors-${Date.now()}.csv`, blob);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {step === 'upload' && (
          <UploadStep
            fileRef={fileRef}
            onPick={(file) => void handleFile(file)}
            parseError={parseError}
            onDownloadTemplate={handleDownloadTemplate}
          />
        )}

        {step === 'map' && parsed && (
          <MappingStep
            parsed={parsed}
            fields={fields}
            mapping={mapping}
            onMappingChange={setMapping}
            missingRequired={missingRequired}
          />
        )}

        {step === 'preview' && parsed && (
          <PreviewStep
            mappedRows={mappedRows}
            fields={fields}
            mapping={mapping}
            invalidCount={invalidRows.length}
            validCount={validRows.length}
            extras={extras}
          />
        )}

        {step === 'result' && result && (
          <ResultStep result={result} onDownloadErrors={handleDownloadErrors} />
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'upload' && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common:actions.cancel', 'Batal')}
            </Button>
          )}
          {step === 'map' && (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')} disabled={busy}>
                {t('common:actions.back', 'Kembali')}
              </Button>
              <Button
                disabled={missingRequired.length > 0}
                onClick={() => setStep('preview')}
                data-testid="import-wizard-next-preview"
              >
                {t('common:actions.next', 'Lanjut')}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('map')} disabled={busy}>
                {t('common:actions.back', 'Kembali')}
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={busy || validRows.length === 0}
                data-testid="import-wizard-submit"
              >
                {busy
                  ? t('common:states.loading', 'Memuat…')
                  : t('common:importWizard.submit', {
                      defaultValue: 'Impor {{count}} baris',
                      count: validRows.length,
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

function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation(['common']);
  const steps: Array<{ id: Step; label: string }> = [
    { id: 'upload', label: t('common:importWizard.step.upload', 'Unggah') },
    { id: 'map', label: t('common:importWizard.step.map', 'Mapping') },
    { id: 'preview', label: t('common:importWizard.step.preview', 'Preview') },
    { id: 'result', label: t('common:importWizard.step.result', 'Hasil') },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="mb-2 grid grid-cols-4 gap-2">
      {steps.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li
            key={s.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              active && 'border-primary bg-primary/5 text-primary',
              done && 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
              !active && !done && 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                active && 'border-primary bg-primary text-primary-foreground',
                done && 'border-emerald-500 bg-emerald-500 text-white',
              )}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </span>
            <span className="truncate font-medium">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

interface UploadStepProps {
  fileRef: React.RefObject<HTMLInputElement>;
  onPick: (file: File) => void;
  parseError: string | null;
  onDownloadTemplate: () => void;
}

function UploadStep({ fileRef, onPick, parseError, onDownloadTemplate }: UploadStepProps) {
  const { t } = useTranslation(['common']);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed p-6 text-center">
        <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm">
          {t('common:importWizard.upload.help', {
            defaultValue: 'Pilih file .xlsx, .xls, atau .csv. Header di baris pertama.',
          })}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          data-testid="import-wizard-file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()} data-testid="import-wizard-pick">
            <Upload className="mr-2 h-4 w-4" />
            {t('common:importWizard.upload.pick', 'Pilih file')}
          </Button>
          <Button variant="outline" onClick={onDownloadTemplate} data-testid="import-wizard-template">
            <Download className="mr-2 h-4 w-4" />
            {t('common:importWizard.upload.template', 'Unduh template')}
          </Button>
        </div>
      </div>
      {parseError && (
        <p className="text-sm text-destructive">{parseError}</p>
      )}
    </div>
  );
}

interface MappingStepProps<TItem> {
  parsed: ParsedFile;
  fields: ImportFieldDef<TItem>[];
  mapping: Mapping;
  onMappingChange: (m: Mapping) => void;
  missingRequired: ImportFieldDef<TItem>[];
}

function MappingStep<TItem>({
  parsed,
  fields,
  mapping,
  onMappingChange,
  missingRequired,
}: MappingStepProps<TItem>) {
  const { t } = useTranslation(['common']);
  const setOne = (header: string, target: string): void => {
    const next: Mapping = { ...mapping, [header]: target };
    // Avoid mapping two source headers to the same target field.
    if (target) {
      for (const h of parsed.headers) {
        if (h !== header && next[h] === target) next[h] = '';
      }
    }
    onMappingChange(next);
  };

  const NONE = '__none__';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('common:importWizard.map.help', {
          defaultValue:
            'Cocokkan kolom file dengan field aplikasi. Kolom yang tidak dipakai bisa dibiarkan kosong.',
        })}
      </p>
      <div className="rounded-md border">
        <div className="max-h-[40vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:importWizard.map.colSource', 'Kolom file')}</TableHead>
                <TableHead>{t('common:importWizard.map.colSample', 'Contoh nilai')}</TableHead>
                <TableHead>{t('common:importWizard.map.colTarget', 'Field aplikasi')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.headers.filter(Boolean).map((h) => {
                const sample = parsed.rows[0]?.[h] ?? '';
                return (
                  <TableRow key={h}>
                    <TableCell className="font-mono text-xs">{h}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {sample || '—'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping[h] || NONE}
                        onValueChange={(v) => setOne(h, v === NONE ? '' : v)}
                      >
                        <SelectTrigger className="h-8 w-64">
                          <SelectValue
                            placeholder={t('common:importWizard.map.skip', 'Lewati')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>
                            {t('common:importWizard.map.skip', 'Lewati')}
                          </SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? ' *' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">
              {t('common:importWizard.map.missingTitle', 'Field wajib belum terpetakan')}
            </p>
            <p>{missingRequired.map((f) => f.label).join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface PreviewStepProps<TItem> {
  mappedRows: MappedRow<TItem>[];
  fields: ImportFieldDef<TItem>[];
  mapping: Mapping;
  validCount: number;
  invalidCount: number;
  extras?: ReactNode;
}

function PreviewStep<TItem>({
  mappedRows,
  fields,
  validCount,
  invalidCount,
  extras,
}: PreviewStepProps<TItem>) {
  const { t } = useTranslation(['common']);
  const visibleFields = fields.slice(0, 5);
  const PREVIEW_LIMIT = 50;
  const limited = mappedRows.slice(0, PREVIEW_LIMIT);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          {t('common:importWizard.preview.valid', {
            defaultValue: '{{count}} baris siap',
            count: validCount,
          })}
        </Badge>
        {invalidCount > 0 && (
          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {t('common:importWizard.preview.invalid', {
              defaultValue: '{{count}} baris dilewati (error)',
              count: invalidCount,
            })}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {t('common:importWizard.preview.limit', {
            defaultValue: 'Menampilkan {{shown}} / {{total}} baris pertama',
            shown: Math.min(mappedRows.length, PREVIEW_LIMIT),
            total: mappedRows.length,
          })}
        </span>
      </div>
      {extras && <div className="rounded-md border bg-muted/30 p-3">{extras}</div>}
      <div className="rounded-md border">
        <div className="max-h-[40vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                {visibleFields.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead>{t('common:importWizard.preview.colError', 'Error')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limited.map((row) => (
                <TableRow
                  key={row.rowNumber}
                  className={cn(
                    row.errors.length > 0 &&
                      'bg-destructive/10 hover:bg-destructive/15',
                  )}
                >
                  <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                  {visibleFields.map((f) => {
                    const value = (row.item as Record<string, unknown>)[f.key];
                    return (
                      <TableCell key={f.key} className="text-xs">
                        {String(value ?? '') || '—'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-xs text-destructive">
                    {row.errors.join('; ') || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

interface ResultStepProps {
  result: ImportWizardResult;
  onDownloadErrors: () => void;
}

function ResultStep({ result, onDownloadErrors }: ResultStepProps) {
  const { t } = useTranslation(['common']);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="text-xs uppercase tracking-wide">
            {t('common:importWizard.result.inserted', 'Ditambahkan')}
          </p>
          <p className="text-2xl font-semibold">{result.inserted}</p>
        </div>
        {result.updated != null && (
          <div className="rounded-md border bg-sky-50 p-3 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
            <p className="text-xs uppercase tracking-wide">
              {t('common:importWizard.result.updated', 'Diperbarui')}
            </p>
            <p className="text-2xl font-semibold">{result.updated}</p>
          </div>
        )}
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('common:importWizard.result.skipped', 'Dilewati')}
          </p>
          <p className="text-2xl font-semibold">{result.skipped}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('common:importWizard.result.errors', 'Error')}
          </p>
          <p className="text-2xl font-semibold">{result.errors.length}</p>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {t('common:importWizard.result.errorListTitle', 'Daftar error')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadErrors}
              data-testid="import-wizard-download-errors"
            >
              <Download className="mr-2 h-4 w-4" />
              {t('common:importWizard.result.downloadErrors', 'Unduh CSV error')}
            </Button>
          </div>
          <div className="max-h-[30vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>
                    {t('common:importWizard.result.message', 'Pesan')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.slice(0, 100).map((e, i) => (
                  <TableRow key={`${e.row}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">{e.row}</TableCell>
                    <TableCell className="text-xs">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
