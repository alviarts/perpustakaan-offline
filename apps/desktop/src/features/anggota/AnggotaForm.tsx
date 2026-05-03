import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Autocomplete, type AutocompleteOption } from '@/components/shared/Autocomplete';
import { anggotaFormSchema, type AnggotaFormValues } from './schema';
import type { Anggota } from '@/lib/anggota';
import { cn } from '@/lib/utils';

interface AnggotaFormProps {
  initial?: Anggota | null;
  onSubmit: (values: AnggotaFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  submitLabel: string;
  /** Distinct values surfaced as autocomplete options. */
  kelasOptions: string[];
  jurusanOptions: string[];
  agamaOptions: string[];
}

const FALLBACK_AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];

function toFormValues(initial: Anggota | null | undefined): AnggotaFormValues {
  const jk = initial?.jenisKelamin;
  return {
    kodeAnggota: initial?.kodeAnggota ?? '',
    nama: initial?.nama ?? '',
    jenisKelamin: jk === 'L' || jk === 'P' ? jk : '',
    kelas: initial?.kelas ?? '',
    jurusan: initial?.jurusan ?? '',
    agama: initial?.agama ?? '',
    tempatLahir: initial?.tempatLahir ?? '',
    tanggalLahir: initial?.tanggalLahir ?? '',
    noTelp: initial?.noTelp ?? '',
    email: initial?.email ?? '',
    alamat: initial?.alamat ?? '',
    fotoPath: initial?.fotoPath ?? '',
    tanggalDaftar: initial?.tanggalDaftar ?? '',
    aktif: initial?.aktif ?? true,
    catatan: initial?.catatan ?? '',
  };
}

function toAutocomplete(values: string[], extra?: string[]): AutocompleteOption[] {
  const merged = new Set<string>();
  for (const v of values) merged.add(v);
  for (const v of extra ?? []) merged.add(v);
  return [...merged]
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));
}

export function AnggotaForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
  kelasOptions,
  jurusanOptions,
  agamaOptions,
}: AnggotaFormProps) {
  const { t } = useTranslation(['anggota', 'common']);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AnggotaFormValues>({
    resolver: zodResolver(anggotaFormSchema),
    defaultValues: toFormValues(initial),
  });

  useEffect(() => {
    reset(toFormValues(initial));
  }, [initial, reset]);

  const kelasAutoOptions = useMemo(() => toAutocomplete(kelasOptions), [kelasOptions]);
  const jurusanAutoOptions = useMemo(() => toAutocomplete(jurusanOptions), [jurusanOptions]);
  const agamaAutoOptions = useMemo(
    () => toAutocomplete(agamaOptions, FALLBACK_AGAMA),
    [agamaOptions],
  );

  const renderError = (key: string | undefined): string | null => {
    if (!key) return null;
    const i18nKey = `anggota:validation.${key}`;
    const value = t(i18nKey);
    return value === i18nKey ? key : value;
  };

  return (
    <form
      data-testid="anggota-form"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('anggota:form.newTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label={t('anggota:fields.kodeAnggota')}
            error={renderError(errors.kodeAnggota?.message as string | undefined)}
            required
          >
            <Input
              data-testid="field-kodeAnggota"
              placeholder={t('anggota:fields.kodeAnggotaPlaceholder')}
              autoFocus={!initial}
              {...register('kodeAnggota')}
            />
          </Field>
          <Field
            label={t('anggota:fields.nama')}
            error={renderError(errors.nama?.message as string | undefined)}
            required
          >
            <Input
              data-testid="field-nama"
              placeholder={t('anggota:fields.namaPlaceholder')}
              {...register('nama')}
            />
          </Field>
          <Field label={t('anggota:fields.jenisKelamin')}>
            <Controller
              control={control}
              name="jenisKelamin"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v as 'L' | 'P' | '')}
                >
                  <SelectTrigger data-testid="field-jenisKelamin">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">{t('anggota:fields.jenisKelaminL')}</SelectItem>
                    <SelectItem value="P">{t('anggota:fields.jenisKelaminP')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={t('anggota:fields.tanggalLahir')}>
            <Input type="date" {...register('tanggalLahir')} />
          </Field>
          <Field label={t('anggota:fields.kelas')}>
            <Controller
              control={control}
              name="kelas"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-kelas"
                  options={kelasAutoOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('anggota:fields.kelasPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('anggota:fields.jurusan')}>
            <Controller
              control={control}
              name="jurusan"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-jurusan"
                  options={jurusanAutoOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('anggota:fields.jurusanPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('anggota:fields.agama')}>
            <Controller
              control={control}
              name="agama"
              render={({ field }) => (
                <Autocomplete
                  data-testid="field-agama"
                  options={agamaAutoOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('anggota:fields.agamaPlaceholder')}
                  allowCustomValue
                />
              )}
            />
          </Field>
          <Field label={t('anggota:fields.tempatLahir')}>
            <Input {...register('tempatLahir')} />
          </Field>
          <Field label={t('anggota:fields.noTelp')}>
            <Input type="tel" {...register('noTelp')} />
          </Field>
          <Field
            label={t('anggota:fields.email')}
            error={renderError(errors.email?.message as string | undefined)}
          >
            <Input type="email" {...register('email')} />
          </Field>
          <Field label={t('anggota:fields.alamat')} className="md:col-span-2">
            <Input {...register('alamat')} />
          </Field>
          <Field label={t('anggota:fields.tanggalDaftar')}>
            <Input type="date" {...register('tanggalDaftar')} />
          </Field>
          <Field label={t('anggota:fields.aktif')} hint={t('anggota:fields.aktifHint')}>
            <Controller
              control={control}
              name="aktif"
              render={({ field }) => (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid="field-aktif"
                    checked={field.value ?? true}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>{field.value ? t('anggota:list.filterActive') : t('anggota:list.filterInactive')}</span>
                </label>
              )}
            />
          </Field>
          <Field label={t('anggota:fields.fotoPath')} hint={t('anggota:fields.fotoPathHint')}>
            <Input {...register('fotoPath')} />
          </Field>
          <Field label={t('anggota:fields.catatan')} className="md:col-span-2">
            <Input {...register('catatan')} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting || (!isDirty && !!initial)} data-testid="form-submit">
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
            {t('anggota:form.deleteButton')}
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
      <Label className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
