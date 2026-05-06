import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { ImportWizard } from '@/components/shared/ImportWizard';
import { anggotaApi, type AnggotaImportItem } from '@/lib/anggota';
import type { ImportWizardResult } from '@/components/shared/ImportWizard';
import type { ImportFieldDef } from '@/lib/importWizard';

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportWizardResult) => void;
}

export function ImportExcelDialog({ open, onOpenChange, onImported }: ImportExcelDialogProps) {
  const { t } = useTranslation(['anggota', 'common']);
  const [updateExisting, setUpdateExisting] = useState(false);

  const fields: ImportFieldDef<AnggotaImportItem>[] = [
    {
      key: 'kodeAnggota',
      label: t('anggota:fields.kodeAnggota', { defaultValue: 'Kode Anggota / NIS' }),
      required: true,
      aliases: ['kode_anggota', 'kodeanggota', 'kode', 'nis', 'member_code'],
      sample: 'A0001',
    },
    {
      key: 'nama',
      label: t('anggota:fields.nama', { defaultValue: 'Nama Lengkap' }),
      required: true,
      aliases: ['name', 'nama_lengkap'],
      sample: 'Budi Santoso',
    },
    {
      key: 'jenisKelamin',
      label: t('anggota:fields.jenisKelamin', { defaultValue: 'Jenis Kelamin' }),
      required: false,
      aliases: ['jenis_kelamin', 'jeniskelamin', 'gender', 'sex'],
      sample: 'L',
      validate: (v) => {
        const upper = v.toUpperCase();
        if (upper !== 'L' && upper !== 'P') return 'Hanya menerima L atau P';
        return null;
      },
    },
    {
      key: 'kelas',
      label: t('anggota:fields.kelas', { defaultValue: 'Kelas' }),
      required: false,
      aliases: ['class', 'tingkat'],
      sample: 'XI IPA 1',
    },
    {
      key: 'jurusan',
      label: t('anggota:fields.jurusan', { defaultValue: 'Jurusan' }),
      required: false,
      aliases: ['major'],
      sample: 'IPA',
    },
    {
      key: 'agama',
      label: t('anggota:fields.agama', { defaultValue: 'Agama' }),
      required: false,
      aliases: ['religion'],
      sample: 'Islam',
    },
    {
      key: 'noTelp',
      label: t('anggota:fields.noTelp', { defaultValue: 'No. Telepon' }),
      required: false,
      aliases: ['no_telp', 'notelp', 'no_telepon', 'telepon', 'phone', 'hp'],
      sample: '081234567890',
    },
    {
      key: 'email',
      label: t('anggota:fields.email', { defaultValue: 'Email' }),
      required: false,
      aliases: ['email', 'e_mail'],
      sample: 'budi@example.com',
      validate: (v) => {
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email tidak valid';
        return null;
      },
    },
  ];

  const rowParser = (raw: Record<string, string>): AnggotaImportItem => {
    const item: AnggotaImportItem = {
      kodeAnggota: (raw.kodeAnggota ?? '').trim(),
      nama: (raw.nama ?? '').trim(),
    };
    const jk = (raw.jenisKelamin ?? '').trim().toUpperCase();
    if (jk === 'L' || jk === 'P') item.jenisKelamin = jk;
    const kelas = (raw.kelas ?? '').trim();
    if (kelas) item.kelas = kelas;
    const jurusan = (raw.jurusan ?? '').trim();
    if (jurusan) item.jurusan = jurusan;
    const agama = (raw.agama ?? '').trim();
    if (agama) item.agama = agama;
    const noTelp = (raw.noTelp ?? '').trim();
    if (noTelp) item.noTelp = noTelp;
    const email = (raw.email ?? '').trim();
    if (email) item.email = email;
    return item;
  };

  const overwriteToggle = (
    <label className="flex items-start gap-3" data-testid="anggota-import-overwrite-toggle">
      <Checkbox
        checked={updateExisting}
        onCheckedChange={(v) => setUpdateExisting(v === true)}
      />
      <span className="space-y-1 text-sm leading-tight">
        <span className="block font-medium">
          {t('anggota:import.overwriteLabel', {
            defaultValue: 'Perbarui anggota yang sudah ada',
          })}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t('anggota:import.overwriteHelp', {
            defaultValue:
              'Jika kode anggota sudah ada di database, baris akan menimpa data lama (mode update). Default: dilewati.',
          })}
        </span>
      </span>
    </label>
  );

  return (
    <ImportWizard<AnggotaImportItem>
      open={open}
      onOpenChange={onOpenChange}
      title={t('anggota:import.title', { defaultValue: 'Impor Anggota dari Excel/CSV' })}
      description={t('anggota:import.description', {
        defaultValue:
          'Unggah file lalu cocokkan kolomnya dengan field aplikasi. Baris dengan error akan dilewati.',
      })}
      fields={fields}
      templateSheetName="Anggota"
      templateFilename="template-impor-anggota.xlsx"
      rowParser={rowParser}
      extras={overwriteToggle}
      onImport={async (items) => {
        const r = await anggotaApi.importBatch(items, { updateExisting });
        return {
          inserted: r.inserted,
          updated: r.updated,
          skipped: r.skipped,
          errors: r.errors.map((e) => ({
            row: e.row,
            message: e.kodeAnggota
              ? `${e.kodeAnggota}: ${e.message}`
              : e.message,
          })),
        };
      }}
      onImported={onImported}
    />
  );
}
