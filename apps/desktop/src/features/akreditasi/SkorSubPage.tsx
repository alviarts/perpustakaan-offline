import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  akreditasiApi,
  DEFAULT_AKREDITASI_PROFIL,
  type AkreditasiProfil,
  type ButirJawaban,
} from '@/lib/akreditasi';
import { getJenjang } from '@perpustakaan/shared';
import { getInstrumen } from '@shared/instrumen';
import { computeSkor } from './skor';
import { buildLaporanPdfHtml, printHtml } from '@/features/laporan/utils';
import { buildKop } from '@/features/laporan/kop';
import { useIdentityStore } from '@/stores/identityStore';

const PREDIKAT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  A: 'default',
  B: 'secondary',
  C: 'outline',
  TidakTerakreditasi: 'destructive',
};

export function AkreditasiSkor(): JSX.Element {
  const { t } = useTranslation(['akreditasi']);
  const identity = useIdentityStore((s) => s.identity);
  const [profil, setProfil] = useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);
  const [rows, setRows] = useState<ButirJawaban[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const p = await akreditasiApi.profilGet();
        const list = await akreditasiApi.butirList(p.jenjang);
        if (cancel) return;
        setProfil(p);
        setRows(list);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const instrumen = useMemo(() => getInstrumen(profil.jenjang), [profil.jenjang]);
  const hasil = useMemo(
    () => (instrumen ? computeSkor(instrumen, rows) : null),
    [instrumen, rows],
  );

  function handleExport(): void {
    if (!hasil) return;
    const jenjang = getJenjang(profil.jenjang);
    const { identitas, ttd } = buildKop(identity, profil, new Date().toLocaleDateString('id-ID'));
    const headers = [
      t('akreditasi:skor.table.komponen', { defaultValue: 'Komponen' }),
      t('akreditasi:skor.table.skor', { defaultValue: 'Skor' }),
      t('akreditasi:skor.table.bobot', { defaultValue: 'Bobot' }),
      t('akreditasi:skor.table.nilai', { defaultValue: 'Nilai' }),
    ];
    printHtml(
      buildLaporanPdfHtml({
        title: t('akreditasi:skor.title', { defaultValue: 'Skor Proyeksi Akreditasi' }),
        periode: `${jenjang?.label ?? profil.jenjang} · ${jenjang?.standarRef ?? ''}`,
        identitas,
        ttd,
        table: {
          headers,
          rows: hasil.komponen.map((k) => [
            `${k.no}. ${k.judul}`,
            `${k.skor}/${k.skorMaks}`,
            k.bobot,
            k.nilai.toFixed(2),
          ]),
        },
        summary: [
          {
            label: t('akreditasi:skor.nilaiAkhir', { defaultValue: 'Nilai akhir' }),
            value: `${hasil.nilai.toFixed(2)} (${hasil.predikat})`,
          },
          {
            label: t('akreditasi:skor.progress', { defaultValue: 'Terjawab' }),
            value: `${hasil.answered}/${hasil.total}`,
          },
        ],
      }),
    );
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

  const jenjang = getJenjang(profil.jenjang);

  return (
    <div className="flex flex-col gap-4" data-testid="akreditasi-skor">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t('akreditasi:skor.nilaiAkhir', { defaultValue: 'Nilai akhir' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tabular-nums">{hasil.nilai.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t('akreditasi:skor.predikat', { defaultValue: 'Predikat (proyeksi)' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Badge variant={PREDIKAT_VARIANT[hasil.predikat] ?? 'secondary'} className="text-base">
              {hasil.predikat === 'TidakTerakreditasi'
                ? t('akreditasi:skor.tidak', { defaultValue: 'Belum terakreditasi' })
                : hasil.predikat}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('akreditasi:skor.predikatHelp', {
                defaultValue: 'Proyeksi, bukan predikat resmi SiPAPI.',
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t('akreditasi:skor.progress', { defaultValue: 'Terjawab' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-bold tabular-nums">
              {hasil.answered}
              <span className="text-lg text-muted-foreground">/{hasil.total}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:skor.title', { defaultValue: 'Skor Proyeksi Akreditasi' })}
          </CardTitle>
          <CardDescription>{jenjang?.keputusanRef}</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm" data-testid="akreditasi-skor-table">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t('akreditasi:skor.table.komponen', { defaultValue: 'Komponen' })}</th>
                  <th className="px-3 py-2 text-right">{t('akreditasi:skor.table.skor', { defaultValue: 'Skor' })}</th>
                  <th className="px-3 py-2 text-right">{t('akreditasi:skor.table.bobot', { defaultValue: 'Bobot' })}</th>
                  <th className="px-3 py-2 text-right">{t('akreditasi:skor.table.nilai', { defaultValue: 'Nilai' })}</th>
                  <th className="px-3 py-2 text-right">{t('akreditasi:skor.table.terjawab', { defaultValue: 'Terjawab' })}</th>
                </tr>
              </thead>
              <tbody>
                {hasil.komponen.map((k) => (
                  <tr key={k.no} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      {k.no}. {k.judul}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {k.skor}/{k.skorMaks}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{k.bobot}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{k.nilai.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {k.answered}/{k.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    {t('akreditasi:skor.nilaiAkhir', { defaultValue: 'Nilai akhir' })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{hasil.nilai.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('akreditasi:skor.gap', { defaultValue: 'Prioritas Perbaikan' })}
          </CardTitle>
          <CardDescription>
            {t('akreditasi:skor.gapHelp', {
              defaultValue: 'Komponen dengan poin hilang terbesar',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4">
          {hasil.gap.slice(0, 3).map((k) => (
            <div key={k.no} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                {k.no}. {k.judul}
              </span>
              <span className="text-muted-foreground">
                {t('akreditasi:skor.lost', { defaultValue: 'Poin hilang' })}:{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {(k.bobot - k.nilai).toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
