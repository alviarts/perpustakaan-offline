import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import { useIdentityStore } from '@/stores/identityStore';
import { settingsApi, DEFAULT_IDENTITY } from '@/lib/settings';
import { FilePickerInput } from '@/components/shared/FilePickerInput';
import { FieldRow, SettingsSection } from './SettingsSection';

export function IdentitasPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const setIdentity = useIdentityStore((s) => s.setIdentity);
  const loadIdentity = useIdentityStore((s) => s.loadIdentity);
  const [draft, setDraft] = React.useState(identity);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(identity);
  }, [identity]);

  const onChange =
    (key: keyof typeof identity) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setDraft((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await settingsApi.saveIdentity(draft);
      setIdentity(saved);
      await loadIdentity();
      showToast({
        title: t('sections.identitas.saveSuccess', {
          defaultValue: 'Identitas berhasil disimpan.',
        }),
      });
    } catch (e) {
      showToast({
        title: t('sections.identitas.saveError', { defaultValue: 'Gagal menyimpan identitas.' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    setDraft(DEFAULT_IDENTITY);
    const next = await settingsApi.resetIdentity();
    setIdentity(next);
    await loadIdentity();
  };

  return (
    <SettingsSection i18nKey="identitas" onSave={handleSave} onReset={handleReset} saving={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow
          label={t('sections.identitas.fields.nama', { defaultValue: 'Nama Perpustakaan' })}
          htmlFor="identitas-nama"
        >
          <Input
            id="identitas-nama"
            value={draft.nama}
            onChange={onChange('nama')}
            data-testid="identitas-nama"
          />
        </FieldRow>
        <FieldRow
          label={t('sections.identitas.fields.kepala', { defaultValue: 'Kepala Perpustakaan' })}
          htmlFor="identitas-kepala"
        >
          <Input id="identitas-kepala" value={draft.kepala} onChange={onChange('kepala')} />
        </FieldRow>
        <FieldRow
          label={t('sections.identitas.fields.npsn', { defaultValue: 'NPSN' })}
          htmlFor="identitas-npsn"
        >
          <Input id="identitas-npsn" value={draft.npsn} onChange={onChange('npsn')} />
        </FieldRow>
        <FieldRow
          label={t('sections.identitas.fields.tahunAjaran', { defaultValue: 'Tahun Ajaran' })}
          htmlFor="identitas-tahun"
        >
          <Input
            id="identitas-tahun"
            value={draft.tahunAjaran}
            onChange={onChange('tahunAjaran')}
          />
        </FieldRow>
        <FieldRow
          label={t('sections.identitas.fields.kontak', { defaultValue: 'Kontak' })}
          htmlFor="identitas-kontak"
        >
          <Input id="identitas-kontak" value={draft.kontak} onChange={onChange('kontak')} />
        </FieldRow>
        <FieldRow
          label={t('sections.identitas.fields.logoPath', { defaultValue: 'Logo Perpustakaan' })}
          htmlFor="identitas-logo"
          help={t('sections.identitas.fields.logoPathHint')}
        >
          <FilePickerInput
            value={draft.logoPath || null}
            onChange={(rel) => setDraft((prev) => ({ ...prev, logoPath: rel ?? '' }))}
            category="identitas"
            pickLabel={t('sections.identitas.fields.logoPick')}
            clearLabel={t('sections.identitas.fields.logoClear')}
            previewSize={96}
            testId="identitas-logo"
          />
        </FieldRow>
      </div>
      <FieldRow
        label={t('sections.identitas.fields.alamat', { defaultValue: 'Alamat' })}
        htmlFor="identitas-alamat"
      >
        <Input id="identitas-alamat" value={draft.alamat} onChange={onChange('alamat')} />
      </FieldRow>
    </SettingsSection>
  );
}
