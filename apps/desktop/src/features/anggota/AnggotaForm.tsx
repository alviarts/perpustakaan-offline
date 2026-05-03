import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Anggota, AnggotaPayload } from '@/lib/anggota';

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'] as const;

const NULLABLE_STRING = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' ? null : v));

const formSchema = z.object({
  kode_anggota: z.string().min(1, 'kodeAnggotaRequired'),
  nama: z.string().min(1, 'namaRequired'),
  jenis_kelamin: z
    .enum(['L', 'P'])
    .or(z.literal(''))
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  kelas: NULLABLE_STRING,
  jurusan: NULLABLE_STRING,
  tempat_lahir: NULLABLE_STRING,
  tanggal_lahir: NULLABLE_STRING,
  no_telp: NULLABLE_STRING,
  email: NULLABLE_STRING,
  alamat: NULLABLE_STRING,
  foto_path: NULLABLE_STRING,
  agama: NULLABLE_STRING,
  catatan: NULLABLE_STRING,
  aktif: z.boolean().default(true),
});

type FormValues = z.input<typeof formSchema>;

export interface AnggotaFormProps {
  defaultValues?: Anggota | null;
  onSubmit: (payload: AnggotaPayload) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

const NONE_VALUE = '__none__';

function formDefaults(d: Anggota | null | undefined): FormValues {
  return {
    kode_anggota: d?.kode_anggota ?? '',
    nama: d?.nama ?? '',
    jenis_kelamin: (d?.jenis_kelamin as 'L' | 'P' | null) ?? '',
    kelas: d?.kelas ?? '',
    jurusan: d?.jurusan ?? '',
    tempat_lahir: d?.tempat_lahir ?? '',
    tanggal_lahir: d?.tanggal_lahir ?? '',
    no_telp: d?.no_telp ?? '',
    email: d?.email ?? '',
    alamat: d?.alamat ?? '',
    foto_path: d?.foto_path ?? '',
    agama: d?.agama ?? '',
    catatan: d?.catatan ?? '',
    aktif: d?.aktif ?? true,
  };
}

export function AnggotaForm({ defaultValues, onSubmit, onCancel, submitting }: AnggotaFormProps) {
  const { t } = useTranslation(['anggota', 'common']);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: formDefaults(defaultValues),
  });

  useEffect(() => {
    reset(formDefaults(defaultValues));
  }, [defaultValues, reset]);

  const submit = handleSubmit(async (values) => {
    // values is already the zod *output* (transforms applied) thanks to zodResolver.
    const payload = values as unknown as AnggotaPayload;
    await onSubmit({
      ...payload,
      jenis_kelamin: payload.jenis_kelamin ?? null,
    });
  });

  return (
    <form onSubmit={submit} className="grid gap-4" data-testid="anggota-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="kode_anggota">
            {t('anggota:fields.kodeAnggota')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="kode_anggota"
            data-testid="field-kode-anggota"
            {...register('kode_anggota')}
            placeholder="A001"
          />
          <p className="text-xs text-muted-foreground">{t('anggota:fields.kodeAnggotaHint')}</p>
          {errors.kode_anggota && (
            <p className="text-xs text-destructive">
              {t(`anggota:errors.${errors.kode_anggota.message ?? 'kodeAnggotaRequired'}`)}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nama">
            {t('anggota:fields.nama')} <span className="text-destructive">*</span>
          </Label>
          <Input id="nama" data-testid="field-nama" {...register('nama')} />
          {errors.nama && (
            <p className="text-xs text-destructive">
              {t(`anggota:errors.${errors.nama.message ?? 'namaRequired'}`)}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="jenis_kelamin"
          render={({ field }) => (
            <div className="grid gap-1.5">
              <Label>{t('anggota:fields.jenisKelamin')}</Label>
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger data-testid="field-jenis-kelamin">
                  <SelectValue placeholder={t('anggota:gender.unspecified')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{t('anggota:gender.unspecified')}</SelectItem>
                  <SelectItem value="L">{t('anggota:gender.L')}</SelectItem>
                  <SelectItem value="P">{t('anggota:gender.P')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <Controller
          control={control}
          name="agama"
          render={({ field }) => (
            <div className="grid gap-1.5">
              <Label>{t('anggota:fields.agama')}</Label>
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger data-testid="field-agama">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>—</SelectItem>
                  {AGAMA_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`anggota:agamaOptions.${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="kelas">{t('anggota:fields.kelas')}</Label>
          <Input id="kelas" data-testid="field-kelas" {...register('kelas')} placeholder="XII IPA 1" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="jurusan">{t('anggota:fields.jurusan')}</Label>
          <Input id="jurusan" data-testid="field-jurusan" {...register('jurusan')} placeholder="IPA" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tempat_lahir">{t('anggota:fields.tempatLahir')}</Label>
          <Input id="tempat_lahir" {...register('tempat_lahir')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tanggal_lahir">{t('anggota:fields.tanggalLahir')}</Label>
          <Input id="tanggal_lahir" type="date" {...register('tanggal_lahir')} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="no_telp">{t('anggota:fields.noTelp')}</Label>
          <Input id="no_telp" {...register('no_telp')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('anggota:fields.email')}</Label>
          <Input id="email" type="email" {...register('email')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="alamat">{t('anggota:fields.alamat')}</Label>
        <Input id="alamat" {...register('alamat')} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="catatan">{t('anggota:fields.catatan')}</Label>
        <Input id="catatan" {...register('catatan')} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={submitting} data-testid="submit-anggota">
          {t('common:actions.save')}
        </Button>
      </div>
    </form>
  );
}
