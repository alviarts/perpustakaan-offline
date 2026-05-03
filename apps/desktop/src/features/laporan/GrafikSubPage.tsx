import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBar } from '@/components/shared/ChartBar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { laporanApi, toCsv, type GrafikBucket, type Granularity } from '@/lib/laporan';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { buildLaporanPdfHtml, downloadText, printHtml } from './utils';

export function LaporanGrafik() {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [data, setData] = useState<GrafikBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    laporanApi
      .grafik(range.from, range.to, granularity)
      .then((res) => {
        if (!cancel) setData(res);
      })
      .catch((err) => {
        if (cancel) return;
        showToast({
          variant: 'destructive',
          title: t('laporan:error.load', { defaultValue: 'Gagal memuat data' }),
          description: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [range, granularity, showToast, t]);

  const totalKunjungan = useMemo(() => data.reduce((acc, d) => acc + d.kunjungan, 0), [data]);
  const totalPeminjaman = useMemo(() => data.reduce((acc, d) => acc + d.peminjaman, 0), [data]);

  function handleExportCsv(): void {
    const csv = toCsv(
      ['Periode', 'Kunjungan', 'Peminjaman'],
      data.map((d) => [d.bucket, d.kunjungan, d.peminjaman]),
    );
    downloadText(csv, `laporan-grafik-${range.from}_${range.to}.csv`, 'text/csv');
  }

  function handleExportPdf(): void {
    const html = buildLaporanPdfHtml({
      title: t('laporan:grafik.title', { defaultValue: 'Grafik Aktivitas' }),
      periode: `${range.from} → ${range.to}`,
      table: {
        headers: ['Periode', 'Kunjungan', 'Peminjaman'],
        rows: data.map((d) => [d.bucket, d.kunjungan, d.peminjaman]),
      },
      summary: [
        { label: 'Total Kunjungan', value: String(totalKunjungan) },
        { label: 'Total Peminjaman', value: String(totalPeminjaman) },
      ],
    });
    printHtml(html);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-grafik">
      <RangeToolbar
        range={range}
        onRangeChange={setRange}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        exportDisabled={data.length === 0}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t('laporan:grafik.granularity', { defaultValue: 'Resolusi' })}
        </span>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-[160px]" data-testid="grafik-granularity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Harian</SelectItem>
            <SelectItem value="month">Bulanan</SelectItem>
            <SelectItem value="year">Tahunan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('laporan:grafik.title', { defaultValue: 'Grafik Aktivitas' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:grafik.subtitle', {
              defaultValue: 'Kunjungan vs peminjaman per periode',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : data.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              {t('laporan:empty', { defaultValue: 'Belum ada data pada rentang ini' })}
            </p>
          ) : (
            <ChartBar
              data={data.map((d) => ({
                key: d.bucket,
                label: d.bucket.slice(-5),
                value: d.kunjungan,
              }))}
              height={220}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCell label={t('laporan:grafik.totalKunjungan', { defaultValue: 'Total Kunjungan' })} value={totalKunjungan} />
        <SummaryCell label={t('laporan:grafik.totalPeminjaman', { defaultValue: 'Total Peminjaman' })} value={totalPeminjaman} />
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString('id-ID')}</span>
      </CardContent>
    </Card>
  );
}
