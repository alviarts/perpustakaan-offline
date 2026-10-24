import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_MANUAL,
  DEFAULT_AKREDITASI_PROFIL,
  type AkreditasiBuktiRow,
  type AkreditasiManual,
  type AkreditasiProfil,
} from '@/lib/akreditasi';
import { BUKTI_WAJIB, getJenjang } from '@perpustakaan/shared';

export function AkreditasiRingkasan(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const [profil, setProfil] = useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);
  const [manual, setManual] = useState<AkreditasiManual>(DEFAULT_AKREDITASI_MANUAL);
  const [bukti, setBukti] = useState<AkreditasiBuktiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([akreditasiApi.profilGet(), akreditasiApi.manualGet(), akreditasiApi.buktiList()])
      .then(([p, m, b]) => {
        if (cancel) return;
        setProfil(p);
        setManual(m);
        setBukti(b);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const jenjang = getJenjang(profil.jenjang);
  const adaSet = new Set(bukti.filter((b) => b.ada).map((b) => b.kode));
  const totalBukti = BUKTI_WAJIB.length;
  const doneBukti = BUKTI_WAJIB.filter((b) => adaSet.has(b.kode)).length;
  const wajibDone = BUKTI_WAJIB.filter((b) => b.wajib && adaSet.has(b.kode)).length;
  const wajibTotal = BUKTI_WAJIB.filter((b) => b.wajib).length;

  const tenagaTotal = manual.tenagaPustakawan + manual.jumlahGuru + manual.jumlahTendik;

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-ringkasan">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base">
              {t('akreditasi:ringkasan.profil', { defaultValue: 'Profil Perpustakaan' })}
            </CardTitle>
            <CardDescription>
              {jenjang ? jenjang.label : t('akreditasi:ringkasan.belumDiatur', { defaultValue: 'Jenjang belum diatur' })}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/akreditasi">
              <Settings2 className="mr-2 h-4 w-4" />
              {t('akreditasi:ringkasan.atur', { defaultValue: 'Atur di Pengaturan' })}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="NPP" value={profil.npp || '—'} />
          <Stat label={t('akreditasi:ringkasan.sk', { defaultValue: 'SK Pendirian' })} value={profil.skPendirian || '—'} />
          <Stat
            label={t('akreditasi:ringkasan.standar', { defaultValue: 'Standar' })}
            value={jenjang ? jenjang.standarRef : '—'}
          />
          <Stat
            label={t('akreditasi:ringkasan.butir', { defaultValue: 'Jumlah butir' })}
            value={jenjang ? String(jenjang.jumlahButir) : '—'}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('akreditasi:ringkasan.bukti', { defaultValue: 'Bukti Fisik' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-3xl font-semibold tabular-nums">
              {doneBukti}/{totalBukti}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('akreditasi:ringkasan.buktiWajib', { defaultValue: 'Wajib' })}: {wajibDone}/{wajibTotal}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('akreditasi:ringkasan.tenaga', { defaultValue: 'Tenaga & Sarana' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-4">
            <Stat label={t('akreditasi:ringkasan.totalTenaga', { defaultValue: 'Total tenaga' })} value={tenagaTotal} />
            <Stat label={t('akreditasi:ringkasan.komputer', { defaultValue: 'Komputer' })} value={manual.jumlahKomputer} />
          </CardContent>
        </Card>
      </div>
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
