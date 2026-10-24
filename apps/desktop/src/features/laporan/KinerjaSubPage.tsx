import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import { laporanApi, toCsv, type BulanCountRow } from '@/lib/laporan';
import { formatTauriError } from '@/lib/errors';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { buildLaporanPdfHtml, downloadText, pivotBulan, printHtml } from './utils';
import { buildKop } from './kop';
import { useIdentityStore } from '@/stores/identityStore';
import { akreditasiApi, DEFAULT_AKREDITASI_PROFIL, type AkreditasiProfil } from '@/lib/akreditasi';
import { exportXlsx } from '@/lib/exportExcel';

export function LaporanKinerja(): JSX.Element {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const [profil, setProfil] = useState<AkreditasiProfil>(DEFAULT_AKREDITASI_PROFIL);
  const [range, setRange] = useState(presetRangeMonth);
  const [rows, setRows] = useState<BulanCountRow[]>([]);
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
    laporanApi
      .kunjunganKelompokBulan(range.from, range.to)
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

  const pivot = useMemo(() => pivotBulan(rows), [rows]);
  const grandTotal = useMemo(() => pivot.rows.reduce((a, r) => a + r.total, 0), [pivot]);

  const matrixHeaders = useMemo(
    () => [t('laporan:kinerja.kelompok', { defaultValue: 'Kelompok' }), ...pivot.columns, 'Σ'],
    [pivot.columns, t],
  );
  const matrixRows = useMemo(
    () => pivot.rows.map((r) => [r.label, ...r.values, r.total]),
    [pivot.rows],
  );

  function handleExportCsv(): void {
    downloadText(
      toCsv(matrixHeaders, matrixRows),
      `kinerja-kunjungan-${range.from}_${range.to}.csv`,
      'text/csv',
    );
  }

  async function handleExportExcel(): Promise<void> {
    await exportXlsx({
      filename: `kinerja-kunjungan-${range.from}_${range.to}.xlsx`,
      sheetName: 'Kunjungan',
      headers: matrixHeaders,
      rows: matrixRows,
    });
  }

  function handleExportPdf(): void {
    const { identitas, ttd } = buildKop(identity, profil, new Date().toLocaleDateString('id-ID'));
    printHtml(
      buildLaporanPdfHtml({
        title: t('laporan:kinerja.title', { defaultValue: 'Laporan Kinerja — Kunjungan' }),
        periode: `${range.from} → ${range.to}`,
        identitas,
        ttd,
        table: { headers: matrixHeaders, rows: matrixRows },
        summary: [
          { label: t('laporan:kinerja.total', { defaultValue: 'Total kunjungan' }), value: String(grandTotal) },
        ],
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-kinerja">
      <RangeToolbar
        range={range}
        onRangeChange={setRange}
        awalBulanTahunAjaran={profil.tahunAjaranAwal}
        onExportCsv={handleExportCsv}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        exportDisabled={loading || pivot.rows.length === 0}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('laporan:kinerja.title', { defaultValue: 'Laporan Kinerja — Kunjungan' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:kinerja.subtitle', {
              defaultValue: 'Kunjungan per kelompok × bulan (jumlah orang)',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : pivot.rows.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              {t('laporan:empty', { defaultValue: 'Belum ada data pada rentang ini' })}
            </p>
          ) : (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                {t('laporan:kinerja.total', { defaultValue: 'Total kunjungan' })}:{' '}
                <span className="font-semibold text-foreground tabular-nums">{grandTotal}</span>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm" data-testid="kinerja-matrix">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {matrixHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 whitespace-nowrap first:sticky first:left-0 first:bg-muted/40">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.rows.map((r) => (
                      <tr key={r.label} className="border-t hover:bg-muted/30">
                        <td className="sticky left-0 bg-background px-3 py-2 font-medium">{r.label}</td>
                        {r.values.map((v, i) => (
                          <td key={i} className="px-3 py-2 text-right tabular-nums">
                            {v || '·'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
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
