import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Autocomplete, type AutocompleteOption } from '@/components/shared/Autocomplete';
import { FilePickerInput } from '@/components/shared/FilePickerInput';
import { bukuFormSchema, type BukuFormValues } from './schema';
import type { Buku } from '@/lib/buku';
import type { MasterItem } from '@/lib/masterData';
import { cn } from '@/lib/utils';

interface BukuFormProps {
  initial?: Buku | null;
  onSubmit: (values: BukuFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  submitLabel: string;
  ddcOptions: MasterItem[];
  kategoriOptions: MasterItem[];
  bahasaOptions: MasterItem[];
}

function toFormValues(initial: Buku | null | undefined): BukuFormValues {
  return {
    kodeBuku: initial?.kodeBuku ?? '',
    judul: initial?.judul ?? '',
    pengarang: initial?.pengarang ?? '',
    penerbit: initial?.penerbit ?? '',
    tahunTerbit: initial?.tahunTerbit ? String(initial.tahunTerbit) : '',
    kodeDdc: initial?.kodeDdc ?? '',
    kategori: initial?.kategori ?? '',
    isbn: initial?.isbn ?? '',
    jumlahEksemplar: initial?.jumlahEksemplar ? String(initial.jumlahEksemplar) : '1',
    sumber: initial?.sumber ?? '',
    harga: initial?.harga ? String(initial.harga) : '',
    bahasa: initial?.bahasa ?? '',
    deskripsi: initial?.deskripsi ?? '',
    rak: initial?.rak ?? '',
    coverPath: initial?.coverPath ?? '',
  };
}

function masterToOptions(items: MasterItem[]): AutocompleteOption[] {
  return items
    .map((m) => ({
      value: m.kode ?? m.nama,
      label: m.kode ? `${m.kode} — ${m.nama}` : m.nama,
      hint: m.kode && m.kode !== m.nama ? m.nama : undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function BukuForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
  ddcOptions,
  kategoriOptions,
  bahasaOptions,
}: BukuFormProps) {
  const { t } = useTranslation(['buku', 'common']);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BukuFormValues>({
    resolver: zodResolver(bukuFormSchema),
    defaultValues: toFormValues(initial),
  });

  useEffect(() => {
    reset(toFormValues(initial));
  }, [initial, reset]);

  const ddcAuto = useMemo(() => masterToOptions(ddcOptions), [ddcOptions]);
  const kategoriAuto = useMemo(
    () =>
      kategoriOptions
        .map((m) => ({ value: m.nama, label: m.nama }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [kategoriOptions],
  );
  const bahasaAuto = useMemo(
    () =>
      bahasaOptions
        .map((m) => ({
          value: m.kode ?? m.nama,
          label: `${m.kode ?? '?'} — ${m.nama}`,
          hint: m.nama,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [bahasaOptions],
  );

  const renderError = (key: string | undefined): string | null => {
    if (!key) return null;
    const i18nKey = `buku:validation.${key}`;
    const value = t(i18nKey);
    return value === i18nKey ? key : value;
  };

  return (
    <form
      data-testid="buku-form"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('buku:form.newTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label={t('buku:fields.kodeBuku')}
            error={renderError(errors.kodeBuku?.message as string | undefined)}
            required
          >
            <Input
              data-testid="field-kodeBuku"
              placeholder={t('buku:fields.kodeBukuPlaceholder')}
              autoFocus={!initial}
              {...register('kodeBuku')}
            />
          </Field>
          <Field
            label={t('buku:fields.judul')}
            error={renderError(errors.judul?.message as string | undefined)}
            required
          >
            <Input
              data-testid="field-judul"
              placeholder={t('buku:fields.judulPlaceholder')}
              {...register('judul')}
            />
          </Field>
          <Field label={t('buku:fields.pengarang')}>
            <Input data-testid="field-pengarang" {...register('pengarang')} />
          </Field>
          <Field label={t('buku:fields.penerbit')}>
            <Input {...register('penerbit')} />
          </Field>
          <Field label={t('buku:fields.tahunTerbit')}>
            <Input type="number" min={1900} max={2100} {...register('tahunTerbit')} />
          </Field>
          <Field label={t('buku:fields.isbn')}>
            <Input {...register('isbn')} />
          </Field>
          <Field label={t('buku:fields.kodeDdc')}>
            <Controller
              control={control}
              name="kodeDdc"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-kodeDdc"
                  options={ddcAuto}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('buku:fields.kodeDdcPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('buku:fields.kategori')}>
            <Controller
              control={control}
              name="kategori"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-kategori"
                  options={kategoriAuto}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('buku:fields.kategoriPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('buku:fields.bahasa')}>
            <Controller
              control={control}
              name="bahasa"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-bahasa"
                  options={bahasaAuto}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('buku:fields.bahasaPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('buku:fields.jumlahEksemplar')}>
            <Input
              type="number"
              min={0}
              data-testid="field-jumlahEksemplar"
              {...register('jumlahEksemplar')}
            />
          </Field>
          <Field label={t('buku:fields.sumber')}>
            <Input {...register('sumber')} />
          </Field>
          <Field label={t('buku:fields.harga')}>
            <Input type="number" min={0} {...register('harga')} />
          </Field>
          <Field label={t('buku:fields.rak')}>
            <Input {...register('rak')} />
          </Field>
          <Field label={t('buku:fields.deskripsi')} className="md:col-span-2">
            <Input {...register('deskripsi')} />
          </Field>
          <Field
            label={t('buku:fields.coverPath')}
            hint={t('buku:fields.coverPathHint')}
            className="md:col-span-2"
          >
            <Controller
              control={control}
              name="coverPath"
              render={({ field }) => (
                <FilePickerInput
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  category="buku"
                  pickLabel={t('buku:fields.coverPick', {
                    defaultValue: 'Pilih cover…',
                  })}
                  clearLabel={t('buku:fields.coverClear', {
                    defaultValue: 'Hapus cover',
                  })}
                  previewSize={120}
                  testId="field-coverPath"
                />
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || (!isDirty && !!initial)}
          data-testid="form-submit"
        >
          {isSubmitting ? t('common:states.loading') : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          {t('common:actions.cancel')}
        </Button>
        {onDelete && initial && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            className="ml-auto"
            data-testid="form-delete"
          >
            {t('buku:form.deleteButton')}
          </Button>
        )}
      </div>
    </form>
  );
}

interface FieldProps {
  label: React.ReactNode;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

function Field({ label, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
