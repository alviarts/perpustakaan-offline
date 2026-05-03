import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartBar } from '@/components/shared/ChartBar';
import { useToast } from '@/components/ui/toast-manager';
import { laporanApi, toCsv, type TopBukuRow } from '@/lib/laporan';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { buildLaporanPdfHtml, downloadText, printHtml } from './utils';
import { formatTauriError } from '@/lib/errors';

export function LaporanTopBuku() {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [rows, setRows] = useState<TopBukuRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    laporanApi
      .topBuku(range.from, range.to, 10)
      .then((res) => {
        if (!cancel) setRows(res);
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
  }, [range, showToast, t]);

  function handleExportCsv(): void {
    const csv = toCsv(
      ['Rank', 'Kode', 'Judul', 'Pengarang', 'Jumlah'],
      rows.map((r, i) => [i + 1, r.kode, r.judul, r.pengarang ?? '-', r.jumlah]),
    );
    downloadText(csv, `laporan-top-buku-${range.from}_${range.to}.csv`, 'text/csv');
  }

  function handleExportPdf(): void {
    const html = buildLaporanPdfHtml({
      title: t('laporan:topBuku.title', { defaultValue: 'Top Buku' }),
      periode: `${range.from} → ${range.to}`,
      table: {
        headers: ['#', 'Kode', 'Judul', 'Pengarang', 'Jumlah'],
        rows: rows.map((r, i) => [i + 1, r.kode, r.judul, r.pengarang ?? '-', r.jumlah]),
      },
    });
    printHtml(html);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-top-buku">
      <RangeToolbar
        range={range}
        onRangeChange={setRange}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        exportDisabled={rows.length === 0}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('laporan:topBuku.title', { defaultValue: 'Top Buku' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:topBuku.subtitle', { defaultValue: '10 buku paling sering dipinjam' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4">
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              {t('laporan:empty', { defaultValue: 'Belum ada data pada rentang ini' })}
            </p>
          ) : (
            <>
              <ChartBar
                data={rows.map((r) => ({ key: r.kode, label: r.kode, value: r.jumlah }))}
                height={180}
              />
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm" data-testid="top-buku-table">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2">#</th>
                      <th className="px-3 py-2">{t('laporan:column.kode', { defaultValue: 'Kode' })}</th>
                      <th className="px-3 py-2">{t('laporan:column.judul', { defaultValue: 'Judul' })}</th>
                      <th className="px-3 py-2">{t('laporan:column.pengarang', { defaultValue: 'Pengarang' })}</th>
                      <th className="px-3 py-2 text-right">{t('laporan:column.jumlah', { defaultValue: 'Jumlah' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.bukuId} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{i + 1}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.kode}</td>
                        <td className="px-3 py-2">{r.judul}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.pengarang ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.jumlah}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
