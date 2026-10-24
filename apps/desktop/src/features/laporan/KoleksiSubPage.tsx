import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartBar } from '@/components/shared/ChartBar';
import { useToast } from '@/components/ui/toast-manager';
import {
  laporanApi,
  toCsv,
  type KoleksiDdcRow,
  type KoleksiDimensi,
  type KoleksiDimensiRow,
  type RasioKoleksi,
  type SebaranEksemplarRow,
} from '@/lib/laporan';
import { formatTauriError } from '@/lib/errors';
import { buildLaporanPdfHtml, downloadText, printHtml } from './utils';
import { buildKop } from './kop';
import { useIdentityStore } from '@/stores/identityStore';
import { akreditasiApi, DEFAULT_AKREDITASI_PROFIL, type AkreditasiProfil } from '@/lib/akreditasi';
import { exportXlsx } from '@/lib/exportExcel';

const DIMENSI: KoleksiDimensi[] = ['kategori', 'bahasa', 'sumber', 'material'];

export function LaporanKoleksi(): JSX.Element {
  const { t } = useTranslation(['laporan', 'akreditasi']);
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const [profil, setProfil] = useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);

  const [ddc, setDdc] = useState<KoleksiDdcRow[]>([]);
  const [rasio, setRasio] = useState<RasioKoleksi | null>(null);
  const [sebaran, setSebaran] = useState<SebaranEksemplarRow[]>([]);
  const [dimensi, setDimensi] = useState<KoleksiDimensi>('kategori');
  const [dimensiRows, setDimensiRows] = useState<KoleksiDimensiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void akreditasiApi
      .profilGet()
      .then(setProfil)
      .catch(() => setProfil(DEFAULT_AKREDITASI_PROFIL));
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      laporanApi.koleksiDdc(),
      laporanApi.rasioKoleksi(),
      laporanApi.sebaranEksemplar(),
    ])
      .then(([d, r, s]) => {
        if (cancel) return;
        setDdc(d);
        setRasio(r);
        setSebaran(s);
      })
      .catch((err) => {
        if (cancel) return;
        showToast({
          variant: 'destructive',
          title: t('laporan:error.load', { defaultValue: 'Gagal memuat data' }),
          description: formatTauriError(err),
        });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [showToast, t]);

  useEffect(() => {
    let cancel = false;
    laporanApi
      .koleksiDimensi(dimensi)
      .then((rows) => {
        if (!cancel) setDimensiRows(rows);
      })
      .catch(() => {
        if (!cancel) setDimensiRows([]);
      });
    return () => {
      cancel = true;
    };
  }, [dimensi]);

  const totalJudul = useMemo(() => ddc.reduce((a, r) => a + r.judul, 0), [ddc]);
  const ddcHeaders = useMemo(
    () => [
      t('laporan:koleksi.ddc.kode', { defaultValue: 'DDC' }),
      t('laporan:koleksi.ddc.klas', { defaultValue: 'Kelas' }),
      t('laporan:koleksi.ddc.judul', { defaultValue: 'Judul' }),
      t('laporan:koleksi.ddc.eksemplar', { defaultValue: 'Eksemplar' }),
      t('laporan:koleksi.ddc.persen', { defaultValue: '%' }),
    ],
    [t],
  );
  const ddcRows = useMemo(
    () =>
      ddc.map((r) => [
        r.kode,
        r.deskripsi ?? (r.kode === 'belum' ? t('laporan:koleksi.belumDdc', { defaultValue: 'Belum ber-DDC' }) : '—'),
        r.judul,
        r.eksemplar,
        totalJudul > 0 ? `${((r.judul / totalJudul) * 100).toFixed(1)}%` : '0%',
      ]),
    [ddc, totalJudul, t],
  );

  function kopTt() {
    return buildKop(identity, profil, new Date().toLocaleDateString('id-ID'));
  }

  function handleExportCsv(): void {
    downloadText(
      toCsv(ddcHeaders, ddcRows),
      `komposisi-ddc-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv',
    );
  }

  async function handleExportExcel(): Promise<void> {
    await exportXlsx({
      filename: `komposisi-ddc-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Komposisi DDC',
      headers: ddcHeaders,
      rows: ddcRows,
    });
  }

  function handleExportPdf(): void {
    const { identitas, ttd } = kopTt();
    printHtml(
      buildLaporanPdfHtml({
        title: t('laporan:koleksi.ddc.title', { defaultValue: 'Komposisi Koleksi per DDC' }),
        periode: `${t('laporan:koleksi.periode', { defaultValue: 'Sampai' })} ${new Date().toLocaleDateString('id-ID')}`,
        identitas,
        ttd,
        table: { headers: ddcHeaders, rows: ddcRows },
      }),
    );
  }

  const perSiswa = rasio && rasio.siswaAktif > 0 ? rasio.totalEksemplar / rasio.siswaAktif : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-koleksi">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={loading}>
          <Download className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:koleksi.rasio.title', { defaultValue: 'Rasio Koleksi' })}
              </CardTitle>
              <CardDescription>
                {t('laporan:koleksi.rasio.subtitle', {
                  defaultValue: 'Perbandingan jumlah koleksi terhadap warga perpustakaan',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Stat
                label={t('laporan:koleksi.rasio.judul', { defaultValue: 'Judul' })}
                value={rasio?.totalJudul ?? 0}
              />
              <Stat
                label={t('laporan:koleksi.rasio.eksemplar', { defaultValue: 'Eksemplar' })}
                value={rasio?.totalEksemplar ?? 0}
              />
              <Stat
                label={t('laporan:koleksi.rasio.siswa', { defaultValue: 'Siswa aktif' })}
                value={rasio?.siswaAktif ?? 0}
              />
              <Stat
                label={t('laporan:koleksi.rasio.perSiswa', { defaultValue: 'Eksemplar / siswa' })}
                value={perSiswa.toFixed(2)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:koleksi.ddc.title', { defaultValue: 'Komposisi Koleksi per DDC' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4">
              {ddc.length === 0 ? (
                <Empty t={t} />
              ) : (
                <>
                  <ChartBar
                    data={ddc.map((r) => ({ key: r.kode, label: r.kode, value: r.judul }))}
                    height={200}
                  />
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm" data-testid="koleksi-ddc-table">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          {ddcHeaders.map((h) => (
                            <th key={h} className="px-3 py-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ddc.map((r) => (
                          <tr key={r.kode} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{r.kode}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.deskripsi ?? '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.judul}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.eksemplar}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {totalJudul > 0 ? ((r.judul / totalJudul) * 100).toFixed(1) : '0.0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base">
                  {t('laporan:koleksi.dimensi.title', { defaultValue: 'Komposisi per Dimensi' })}
                </CardTitle>
              </div>
              <Select value={dimensi} onValueChange={(v) => setDimensi(v as KoleksiDimensi)}>
                <SelectTrigger className="h-9 w-[180px]" data-testid="koleksi-dimensi-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSI.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`laporan:koleksi.dimensi.${d}`, { defaultValue: d })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm" data-testid="koleksi-dimensi-table">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">{t('laporan:column.nama', { defaultValue: 'Nama' })}</th>
                      <th className="px-3 py-2 text-right">
                        {t('laporan:koleksi.ddc.judul', { defaultValue: 'Judul' })}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t('laporan:koleksi.ddc.eksemplar', { defaultValue: 'Eksemplar' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensiRows.map((r) => (
                      <tr key={r.label} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">{r.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.judul}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.eksemplar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:koleksi.sebaran.title', { defaultValue: 'Sebaran Jumlah Eksemplar' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">
                        {t('laporan:koleksi.sebaran.bucket', { defaultValue: 'Eksemplar / judul' })}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t('laporan:koleksi.ddc.judul', { defaultValue: 'Judul' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sebaran.map((r) => (
                      <tr key={r.bucket} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{r.bucket}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.judul}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Empty({ t }: { t: (k: string, o?: { defaultValue?: string }) => string }): JSX.Element {
  return (
    <p className="py-8 text-center text-sm italic text-muted-foreground">
      {t('laporan:empty', { defaultValue: 'Belum ada data pada rentang ini' })}
    </p>
  );
}
