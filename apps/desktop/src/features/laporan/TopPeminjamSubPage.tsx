import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartBar } from '@/components/shared/ChartBar';
import { useToast } from '@/components/ui/toast-manager';
import { laporanApi, toCsv, type TopPeminjamRow } from '@/lib/laporan';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { buildLaporanPdfHtml, downloadText, printHtml } from './utils';

export function LaporanTopPeminjam() {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [rows, setRows] = useState<TopPeminjamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    laporanApi
      .topPeminjam(range.from, range.to, 10)
      .then((res) => {
        if (!cancel) setRows(res);
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
    const csv = toCsv(
      ['Rank', 'Nama', 'Kode', 'Kelas', 'Pinjam', 'Buku'],
      rows.map((r, i) => [i + 1, r.nama, r.kodeAnggota, r.kelas ?? '-', r.jumlahPinjam, r.jumlahBuku]),
    );
    downloadText(csv, `laporan-top-peminjam-${range.from}_${range.to}.csv`, 'text/csv');
  }

  function handleExportPdf(): void {
    const html = buildLaporanPdfHtml({
      title: t('laporan:topPeminjam.title', { defaultValue: 'Top Peminjam' }),
      periode: `${range.from} → ${range.to}`,
      table: {
        headers: ['#', 'Nama', 'Kode', 'Kelas', 'Pinjam', 'Buku'],
        rows: rows.map((r, i) => [i + 1, r.nama, r.kodeAnggota, r.kelas ?? '-', r.jumlahPinjam, r.jumlahBuku]),
      },
    });
    printHtml(html);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-top-peminjam">
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
            {t('laporan:topPeminjam.title', { defaultValue: 'Top Peminjam' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:topPeminjam.subtitle', { defaultValue: '10 anggota teraktif pada rentang ini' })}
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
                data={rows.map((r) => ({ key: r.kodeAnggota, label: r.nama.split(' ')[0] ?? '', value: r.jumlahPinjam }))}
                height={180}
              />
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm" data-testid="top-peminjam-table">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2">#</th>
                      <th className="px-3 py-2">{t('laporan:column.nama', { defaultValue: 'Nama' })}</th>
                      <th className="px-3 py-2">{t('laporan:column.kode', { defaultValue: 'Kode' })}</th>
                      <th className="px-3 py-2">{t('laporan:column.kelas', { defaultValue: 'Kelas' })}</th>
                      <th className="px-3 py-2 text-right">{t('laporan:column.pinjam', { defaultValue: 'Pinjam' })}</th>
                      <th className="px-3 py-2 text-right">{t('laporan:column.buku', { defaultValue: 'Buku' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.anggotaId} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{i + 1}</td>
                        <td className="px-3 py-2">{r.nama}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.kodeAnggota}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.kelas ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.jumlahPinjam}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.jumlahBuku}</td>
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
