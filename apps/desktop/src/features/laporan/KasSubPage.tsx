import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartPie } from '@/components/shared/ChartPie';
import { useToast } from '@/components/ui/toast-manager';
import { laporanApi, toCsv, type KasSummary } from '@/lib/laporan';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { buildLaporanPdfHtml, downloadText, printHtml } from './utils';

const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function LaporanKas() {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [data, setData] = useState<KasSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    laporanApi
      .kas(range.from, range.to)
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
  }, [range, showToast, t]);

  function handleExportCsv(): void {
    if (!data) return;
    const csv = toCsv(
      ['Tanggal', 'Keterangan', 'Jenis', 'Sumber', 'Nominal'],
      data.rows.map((r) => [r.tanggal, r.keterangan, r.jenis, r.sumber, r.nominal]),
    );
    downloadText(csv, `laporan-kas-${range.from}_${range.to}.csv`, 'text/csv');
  }

  function handleExportPdf(): void {
    if (!data) return;
    const html = buildLaporanPdfHtml({
      title: t('laporan:kas.title', { defaultValue: 'Laporan Kas' }),
      periode: `${range.from} → ${range.to}`,
      summary: [
        { label: 'Total Masuk', value: RUPIAH.format(data.totalMasuk) },
        { label: 'Total Keluar', value: RUPIAH.format(data.totalKeluar) },
        { label: 'Saldo Akhir', value: RUPIAH.format(data.saldoAkhir) },
      ],
      table: {
        headers: ['Tanggal', 'Keterangan', 'Jenis', 'Sumber', 'Nominal'],
        rows: data.rows.map((r) => [r.tanggal, r.keterangan, r.jenis, r.sumber, RUPIAH.format(r.nominal)]),
      },
    });
    printHtml(html);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-kas">
      <RangeToolbar
        range={range}
        onRangeChange={setRange}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        exportDisabled={!data || data.rows.length === 0}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCell tone="emerald" label={t('laporan:kas.masuk', { defaultValue: 'Total Masuk' })} value={data?.totalMasuk ?? 0} loading={loading} />
        <SummaryCell tone="rose" label={t('laporan:kas.keluar', { defaultValue: 'Total Keluar' })} value={data?.totalKeluar ?? 0} loading={loading} />
        <SummaryCell tone="primary" label={t('laporan:kas.saldo', { defaultValue: 'Saldo Akhir' })} value={data?.saldoAkhir ?? 0} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('laporan:kas.breakdown', { defaultValue: 'Breakdown Pemasukan' })}
            </CardTitle>
            <CardDescription>
              {t('laporan:kas.breakdownHint', { defaultValue: 'Manual / denda / hilang / modal' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loading || !data ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ChartPie
                data={[
                  { key: 'manual', label: 'Manual', value: data.fromManual },
                  { key: 'denda', label: 'Denda', value: data.fromDenda },
                  { key: 'hilang', label: 'Ganti hilang', value: data.fromHilang },
                  { key: 'modal', label: 'Modal', value: data.fromModal },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('laporan:kas.detail', { defaultValue: 'Detail Kas' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading || !data ? (
              <Skeleton className="h-[200px] w-full" />
            ) : data.rows.length === 0 ? (
              <p className="py-8 text-center text-sm italic text-muted-foreground">
                {t('laporan:empty', { defaultValue: 'Belum ada data pada rentang ini' })}
              </p>
            ) : (
              <div className="max-h-[260px] overflow-auto">
                <table className="w-full text-sm" data-testid="kas-table">
                  <thead className="sticky top-0 bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">{t('laporan:column.tanggal', { defaultValue: 'Tanggal' })}</th>
                      <th className="px-3 py-2">{t('laporan:column.keterangan', { defaultValue: 'Keterangan' })}</th>
                      <th className="px-3 py-2 text-right">{t('laporan:column.nominal', { defaultValue: 'Nominal' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.tanggal}</td>
                        <td className="px-3 py-2">
                          <div>{r.keterangan}</div>
                          <div className="text-xs text-muted-foreground">{r.sumber}</div>
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium tabular-nums ${
                            r.jenis === 'masuk'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {r.jenis === 'masuk' ? '+' : '−'}
                          {RUPIAH.format(r.nominal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONE_CLASS = {
  primary: 'text-primary',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  rose: 'text-rose-600 dark:text-rose-400',
} as const;

function SummaryCell({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE_CLASS;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <span className={`text-xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>
            {RUPIAH.format(value)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
