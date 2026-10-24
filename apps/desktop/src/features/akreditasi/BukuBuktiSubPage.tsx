import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_MANUAL,
  DEFAULT_AKREDITASI_PROFIL,
  type AkreditasiBuktiRow,
  type AkreditasiManual,
  type AkreditasiProfil,
  type ButirJawaban,
} from '@/lib/akreditasi';
import { getInstrumen } from '@shared/instrumen';
import { getJenjang } from '@perpustakaan/shared';
import { computeSkor } from './skor';
import { buildBukuBuktiHtml, buildBukuBuktiSnapshot, type BukuBuktiContext } from './bukuBukti';
import { printHtml } from '@/features/laporan/utils';
import { buildKop } from '@/features/laporan/kop';
import { useIdentityStore } from '@/stores/identityStore';

export function AkreditasiBukuBukti(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const [profil, setProfil] = useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);
  const [manual, setManual] = useState<AkreditasiManual>(DEFAULT_AKREDITASI_MANUAL);
  const [bukti, setBukti] = useState<AkreditasiBuktiRow[]>([]);
  const [butir, setButir] = useState<ButirJawaban[]>([]);
  const [penandatangan, setPenandatangan] = useState('');
  const [jabatan, setJabatan] = useState('Kepala Sekolah');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const p = await akreditasiApi.profilGet();
        const [m, b, r] = await Promise.all([
          akreditasiApi.manualGet(),
          akreditasiApi.buktiList(),
          akreditasiApi.butirList(p.jenjang),
        ]);
        if (cancel) return;
        setProfil(p);
        setManual(m);
        setBukti(b);
        setButir(r);
        setPenandatangan(identity.kepalaSekolah || '');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [identity.kepalaSekolah]);

  const instrumen = useMemo(() => getInstrumen(profil.jenjang), [profil.jenjang]);
  const hasil = useMemo(
    () => (instrumen ? computeSkor(instrumen, butir) : null),
    [instrumen, butir],
  );

  function context(): BukuBuktiContext | null {
    if (!instrumen || !hasil) return null;
    const { identitas, ttd } = buildKop(identity, profil, new Date().toLocaleDateString('id-ID'));
    return {
      identitas,
      ttd: { ...ttd, nama: penandatangan || ttd.nama, jabatan },
      profil,
      manual,
      bukti,
      butir,
      instrumen,
      hasil,
    };
  }

  function handlePrint(): void {
    const ctx = context();
    if (!ctx) return;
    printHtml(buildBukuBuktiHtml(ctx));
  }

  async function handleArchive(): Promise<void> {
    const ctx = context();
    if (!ctx) return;
    try {
      await akreditasiApi.arsipSave({
        jenis: 'buku-bukti',
        jenjang: profil.jenjang,
        periode: getJenjang(profil.jenjang)?.label ?? profil.jenjang,
        nilai: hasil?.nilai ?? null,
        predikat: hasil?.predikat ?? null,
        kontenJson: buildBukuBuktiSnapshot(ctx),
        penandatangan: penandatangan || null,
        jabatan,
      });
      showToast({
        title: t('akreditasi:bukuBukti.arsipDone', { defaultValue: 'Laporan disahkan & diarsipkan.' }),
      });
    } catch (e) {
      showToast({
        variant: 'destructive',
        title: t('akreditasi:bukuBukti.arsipError', { defaultValue: 'Gagal mengarsipkan.' }),
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (loading) return <Skeleton className="h-[300px] w-full" />;
  if (!instrumen || !hasil) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('akreditasi:butirPenilaian.noInstrumen', {
            defaultValue: 'Instrumen untuk jenjang ini belum tersedia.',
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-buku-bukti">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:bukuBukti.title', { defaultValue: 'Buku Bukti Akreditasi' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:bukuBukti.subtitle', {
              defaultValue:
                'Dokumen lengkap: profil, skor per komponen, butir penilaian, dan bukti fisik.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('akreditasi:skor.nilaiAkhir', { defaultValue: 'Nilai akhir' })} value={hasil.nilai.toFixed(2)} />
            <Stat label={t('akreditasi:skor.predikat', { defaultValue: 'Predikat' })} value={hasil.predikat} />
            <Stat label={t('akreditasi:skor.progress', { defaultValue: 'Terjawab' })} value={`${hasil.answered}/${hasil.total}`} />
            <Stat label={t('akreditasi:ringkasan.bukti', { defaultValue: 'Bukti' })} value={`${bukti.filter((b) => b.ada).length}`} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('akreditasi:bukuBukti.penandatangan', { defaultValue: 'Penandatangan' })}
              </label>
              <Input value={penandatangan} onChange={(e) => setPenandatangan(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('akreditasi:bukuBukti.jabatan', { defaultValue: 'Jabatan' })}
              </label>
              <Input value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              {t('akreditasi:bukuBukti.print', { defaultValue: 'Cetak / PDF' })}
            </Button>
            <Button onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              {t('akreditasi:bukuBukti.archive', { defaultValue: 'Sahkan & Arsipkan' })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}
