import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast-manager';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_MANUAL,
  type AkreditasiManual,
} from '@/lib/akreditasi';
import { formatTauriError } from '@/lib/errors';

const TAHUN = [1, 2, 3];

export function AkreditasiManualPage(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const { showToast } = useToast();
  const [draft, setDraft] = useState<AkreditasiManual>(DEFAULT_AKREDITASI_MANUAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    akreditasiApi
      .manualGet()
      .then((m) => {
        if (!cancel) setDraft(m);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const num = (key: keyof AkreditasiManual) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(v) ? v : 0 }));
  };

  const setAnggaran = (
    key: 'anggaranSekolah' | 'anggaranPerpus',
    idx: number,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setDraft((prev) => {
      const arr = [...prev[key]] as [number, number, number];
      arr[idx] = Number.isFinite(v) ? v : 0;
      return { ...prev, [key]: arr };
    });
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await akreditasiApi.manualSet(draft);
      setDraft(saved);
      showToast({
        title: t('akreditasi:manual.saveSuccess', { defaultValue: 'Data akreditasi tersimpan.' }),
      });
    } catch (e) {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:manual.saveError', { defaultValue: 'Gagal menyimpan data.' }),
        description: formatTauriError(e),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-manual">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:manual.tenaga', { defaultValue: 'Tenaga' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:manual.tenagaHelp', {
              defaultValue: 'Jumlah tenaga perpustakaan & kualifikasinya',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Field label={t('akreditasi:manual.pustakawan', { defaultValue: 'Pustakawan' })}>
            <Input type="number" min={0} value={draft.tenagaPustakawan} onChange={num('tenagaPustakawan')} />
          </Field>
          <Field label={t('akreditasi:manual.kualifikasi', { defaultValue: 'Berkualifikasi' })}>
            <Input type="number" min={0} value={draft.tenagaKualifikasi} onChange={num('tenagaKualifikasi')} />
          </Field>
          <Field label={t('akreditasi:manual.guru', { defaultValue: 'Guru' })}>
            <Input type="number" min={0} value={draft.jumlahGuru} onChange={num('jumlahGuru')} />
          </Field>
          <Field label={t('akreditasi:manual.tendik', { defaultValue: 'Tenaga kependidikan' })}>
            <Input type="number" min={0} value={draft.jumlahTendik} onChange={num('jumlahTendik')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:manual.sarpras', { defaultValue: 'Sarana & Prasarana' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 p-4">
          <Field label={t('akreditasi:manual.luas', { defaultValue: 'Luas ruang (m²)' })}>
            <Input type="number" min={0} value={draft.luasRuang} onChange={num('luasRuang')} />
          </Field>
          <Field label={t('akreditasi:manual.komputer', { defaultValue: 'Jumlah komputer' })}>
            <Input type="number" min={0} value={draft.jumlahKomputer} onChange={num('jumlahKomputer')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:manual.anggaran', { defaultValue: 'Anggaran 3 Tahun Terakhir' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:manual.anggaranHelp', {
              defaultValue: 'Di luar belanja pegawai & pemeliharaan gedung. Index 1 = tahun lalu.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            {TAHUN.map((n, i) => (
              <Field key={`s${n}`} label={`${t('akreditasi:manual.sekolah', { defaultValue: 'Sekolah' })} ${n}`}>
                <Input type="number" min={0} value={draft.anggaranSekolah[i]} onChange={setAnggaran('anggaranSekolah', i)} />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {TAHUN.map((n, i) => (
              <Field key={`p${n}`} label={`${t('akreditasi:manual.perpus', { defaultValue: 'Perpustakaan' })} ${n}`}>
                <Input type="number" min={0} value={draft.anggaranPerpus[i]} onChange={setAnggaran('anggaranPerpus', i)} />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Field label={t('akreditasi:manual.catatan', { defaultValue: 'Catatan' })}>
            <Textarea
              rows={2}
              value={draft.catatan}
              onChange={(e) => setDraft((prev) => ({ ...prev, catatan: e.target.value }))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} data-testid="akreditasi-manual-save">
          {saving ? '…' : t('akreditasi:manual.save', { defaultValue: 'Simpan' })}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
