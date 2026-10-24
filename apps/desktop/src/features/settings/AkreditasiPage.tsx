import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast-manager';
import { FieldRow, SettingsSection } from './SettingsSection';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_PROFIL,
  type AkreditasiProfil,
} from '@/lib/akreditasi';
import { JENJANG_LIST, getJenjang, KOMPONEN_ORDER } from '@perpustakaan/shared';
import { getInstrumen } from '@shared/instrumen';

const BULAN = Array.from({ length: 12 }, (_, i) => i + 1);

function bulanLabel(m: number): string {
  return new Date(2000, m - 1, 1).toLocaleDateString('id-ID', { month: 'long' });
}

export function AkreditasiPage(): JSX.Element {
  const { t } = useTranslation(['settings', 'akreditasi']);
  const { showToast } = useToast();
  const [draft, setDraft] = React.useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await akreditasiApi.profilGet();
        if (!cancelled) setDraft(current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof AkreditasiProfil>(key: K, value: AkreditasiProfil[K]): void =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await akreditasiApi.profilSet(draft);
      setDraft(saved);
      showToast({
        title: t('akreditasi:profil.saveSuccess', { defaultValue: 'Profil akreditasi tersimpan.' }),
      });
    } catch (e) {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:profil.saveError', { defaultValue: 'Gagal menyimpan profil.' }),
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const jenjang = getJenjang(draft.jenjang);
  const instrumen = getInstrumen(draft.jenjang);
  const komponenList = instrumen
    ? instrumen.komponen.map((k) => ({ label: k.judul, butir: k.butir, bobot: k.bobot }))
    : jenjang
      ? KOMPONEN_ORDER.flatMap((key) => {
          const k = jenjang.komponen.find((c) => c.key === key);
          return k
            ? [{ label: t(`akreditasi:komponen.${key}`, { defaultValue: key }), butir: k.butir, bobot: k.bobot }]
            : [];
        })
      : [];

  return (
    <SettingsSection
      i18nKey="akreditasi"
      onSave={handleSave}
      saving={saving || loading}
      testId="settings-section-akreditasi"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow
          label={t('akreditasi:profil.jenjang', { defaultValue: 'Jenjang / Jenis Perpustakaan' })}
          help={t('akreditasi:profil.jenjangHelp', {
            defaultValue: 'Menentukan standar (SNP) & instrumen akreditasi yang berlaku.',
          })}
          htmlFor="akreditasi-jenjang"
        >
          <Select value={draft.jenjang} onValueChange={(v) => set('jenjang', v)} disabled={loading}>
            <SelectTrigger id="akreditasi-jenjang" data-testid="akreditasi-jenjang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JENJANG_LIST.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow
          label={t('akreditasi:profil.tahunAjaranAwal', { defaultValue: 'Bulan Awal Tahun Ajaran' })}
          help={t('akreditasi:profil.tahunAjaranAwalHelp', {
            defaultValue: 'Dipakai untuk preset periode laporan (Semester Ganjil/Genap/Tahun Ajaran).',
          })}
          htmlFor="akreditasi-tahun-ajaran"
        >
          <Select
            value={String(draft.tahunAjaranAwal)}
            onValueChange={(v) => set('tahunAjaranAwal', Number(v))}
            disabled={loading}
          >
            <SelectTrigger id="akreditasi-tahun-ajaran" data-testid="akreditasi-tahun-ajaran">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BULAN.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {bulanLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow
          label={t('akreditasi:profil.npp', { defaultValue: 'Nomor Pokok Perpustakaan (NPP)' })}
          help={t('akreditasi:profil.nppHelp', {
            defaultValue: 'Wajib untuk pendaftaran akreditasi. Contoh: NPP 3507xxxx.',
          })}
          htmlFor="akreditasi-npp"
        >
          <Input
            id="akreditasi-npp"
            value={draft.npp}
            onChange={(e) => set('npp', e.target.value)}
            disabled={loading}
            data-testid="akreditasi-npp"
          />
        </FieldRow>

        <FieldRow
          label={t('akreditasi:profil.skPendirian', { defaultValue: 'SK Pendirian' })}
          help={t('akreditasi:profil.skPendirianHelp', {
            defaultValue: 'Nomor/tanggal SK pendirian perpustakaan atau sekolah.',
          })}
          htmlFor="akreditasi-sk"
        >
          <Input
            id="akreditasi-sk"
            value={draft.skPendirian}
            onChange={(e) => set('skPendirian', e.target.value)}
            disabled={loading}
            data-testid="akreditasi-sk"
          />
        </FieldRow>
      </div>

      <FieldRow
        label={t('akreditasi:profil.catatan', { defaultValue: 'Catatan' })}
        htmlFor="akreditasi-catatan"
      >
        <Textarea
          id="akreditasi-catatan"
          value={draft.catatan}
          onChange={(e) => set('catatan', e.target.value)}
          disabled={loading}
          rows={2}
        />
      </FieldRow>

      {jenjang && (
        <div
          className="rounded-md border bg-muted/40 p-3 text-xs"
          data-testid="akreditasi-jenjang-info"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{jenjang.label}</Badge>
            <span className="text-muted-foreground">{jenjang.standarRef}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {instrumen?.butir.length ?? jenjang.jumlahButir}{' '}
              {t('akreditasi:profil.butir', { defaultValue: 'butir' })}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {t('akreditasi:profil.skorMaks', { defaultValue: 'Skor maks' })}{' '}
              {instrumen
                ? instrumen.komponen.reduce((a, k) => a + k.skorMaks, 0)
                : jenjang.skorMaks}
            </span>
            {!instrumen && !jenjang.komponenVerified && (
              <Badge variant="outline" className="text-amber-600">
                {t('akreditasi:profil.provisional', { defaultValue: 'bobot provisional' })}
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground">{jenjang.keputusanRef}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {komponenList.map((k) => (
              <span key={k.label}>
                {k.label}: {k.butir} {t('akreditasi:profil.butir', { defaultValue: 'butir' })} (
                {k.bobot}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
