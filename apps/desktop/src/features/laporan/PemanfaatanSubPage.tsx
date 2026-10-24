import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import {
  laporanApi,
  type BulanCountRow,
  type BukuIdleRow,
  type EksemplarMasalahRow,
  type TurnoverCopyRow,
} from '@/lib/laporan';
import { formatTauriError } from '@/lib/errors';
import { presetRangeMonth, RangeToolbar } from './RangeToolbar';
import { pivotBulan } from './utils';
import { akreditasiApi, DEFAULT_AKREDITASI_PROFIL } from '@/lib/akreditasi';

function MatrixTable({
  columns,
  rows,
  testid,
}: {
  columns: string[];
  rows: Array<{ label: string; values: number[]; total: number }>;
  testid: string;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" data-testid={testid}>
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted/40 px-3 py-2">—</th>
            {columns.map((c) => (
              <th key={c} className="px-2 py-2 text-right whitespace-nowrap">
                {c}
              </th>
            ))}
            <th className="px-3 py-2 text-right">Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t hover:bg-muted/30">
              <td className="sticky left-0 bg-background px-3 py-2 font-medium">{r.label}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-2 py-2 text-right tabular-nums">
                  {v || '·'}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LaporanPemanfaatan(): JSX.Element {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [awalBulan, setAwalBulan] = useState(7);
  const [subjek, setSubjek] = useState<BulanCountRow[]>([]);
  const [kategori, setKategori] = useState<BulanCountRow[]>([]);
  const [turnover, setTurnover] = useState<TurnoverCopyRow[]>([]);
  const [idle, setIdle] = useState<BukuIdleRow[]>([]);
  const [masalah, setMasalah] = useState<EksemplarMasalahRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void akreditasiApi
      .profilGet()
      .then((p) => setAwalBulan(p.tahunAjaranAwal || DEFAULT_AKREDITASI_PROFIL.tahunAjaranAwal))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      laporanApi.pinjamSubjekBulan(range.from, range.to),
      laporanApi.pinjamKategoriBulan(range.from, range.to),
      laporanApi.turnoverCopy(range.from, range.to, 200),
      laporanApi.bukuIdle(range.from, range.to, 300),
      laporanApi.eksemplarBermasalah(),
    ])
      .then(([s, k, tu, id, ma]) => {
        if (cancel) return;
        setSubjek(s);
        setKategori(k);
        setTurnover(tu);
        setIdle(id);
        setMasalah(ma);
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

  const subjekPivot = useMemo(() => pivotBulan(subjek), [subjek]);
  const kategoriPivot = useMemo(() => pivotBulan(kategori), [kategori]);

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-pemanfaatan">
      <RangeToolbar
        range={range}
        onRangeChange={setRange}
        awalBulanTahunAjaran={awalBulan}
        exportDisabled={loading}
      />

      {loading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:pemanfaatan.subjek.title', {
                  defaultValue: 'Peminjaman per Subjek (DDC) × Bulan',
                })}
              </CardTitle>
              <CardDescription>
                {t('laporan:pemanfaatan.subjek.subtitle', {
                  defaultValue: 'Jumlah buku dipinjam per kelas DDC setiap bulan',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {subjekPivot.rows.length === 0 ? (
                <Empty t={t} />
              ) : (
                <MatrixTable
                  columns={subjekPivot.columns}
                  rows={subjekPivot.rows}
                  testid="pemanfaatan-subjek-matrix"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:pemanfaatan.kategori.title', {
                  defaultValue: 'Peminjaman per Kategori × Bulan',
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {kategoriPivot.rows.length === 0 ? (
                <Empty t={t} />
              ) : (
                <MatrixTable
                  columns={kategoriPivot.columns}
                  rows={kategoriPivot.rows}
                  testid="pemanfaatan-kategori-matrix"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:pemanfaatan.turnover.title', {
                  defaultValue: 'Turnover per Eksemplar',
                })}
              </CardTitle>
              <CardDescription>
                {t('laporan:pemanfaatan.turnover.subtitle', {
                  defaultValue: 'Jumlah peminjaman tiap copy pada rentang terpilih',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {turnover.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm" data-testid="pemanfaatan-turnover-table">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">
                          {t('laporan:pemanfaatan.turnover.kode', { defaultValue: 'Kode eksemplar' })}
                        </th>
                        <th className="px-3 py-2">{t('laporan:column.judul', { defaultValue: 'Judul' })}</th>
                        <th className="px-3 py-2">{t('laporan:column.status', { defaultValue: 'Status' })}</th>
                        <th className="px-3 py-2 text-right">
                          {t('laporan:column.jumlah', { defaultValue: 'Jumlah' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnover.map((r) => (
                        <tr key={r.kodeEksemplar} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs">{r.kodeEksemplar}</td>
                          <td className="px-3 py-2">{r.judul}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.jumlah}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:pemanfaatan.idle.title', {
                  defaultValue: 'Buku Tidak Dipinjam pada Rentang Ini',
                })}
              </CardTitle>
              <CardDescription>
                {t('laporan:pemanfaatan.idle.subtitle', {
                  defaultValue: 'Kandidat weeding / promosi koleksi',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {idle.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm" data-testid="pemanfaatan-idle-table">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">{t('laporan:column.kode', { defaultValue: 'Kode' })}</th>
                        <th className="px-3 py-2">{t('laporan:column.judul', { defaultValue: 'Judul' })}</th>
                        <th className="px-3 py-2 text-right">
                          {t('laporan:pemanfaatan.idle.eksemplar', { defaultValue: 'Eksemplar' })}
                        </th>
                        <th className="px-3 py-2">
                          {t('laporan:pemanfaatan.idle.terakhir', { defaultValue: 'Terakhir dipinjam' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {idle.map((r) => (
                        <tr key={r.bukuId} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground">{r.kode}</td>
                          <td className="px-3 py-2">{r.judul}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.jumlahEksemplar}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {r.terakhir ?? t('laporan:pemanfaatan.idle.never', { defaultValue: 'Belum pernah' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('laporan:pemanfaatan.masalah.title', {
                  defaultValue: 'Eksemplar Rusak / Hilang',
                })}
              </CardTitle>
              <CardDescription>
                {t('laporan:pemanfaatan.masalah.subtitle', {
                  defaultValue: 'Kandidat penyusutan koleksi',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {masalah.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm" data-testid="pemanfaatan-masalah-table">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">
                          {t('laporan:pemanfaatan.turnover.kode', { defaultValue: 'Kode eksemplar' })}
                        </th>
                        <th className="px-3 py-2">{t('laporan:column.judul', { defaultValue: 'Judul' })}</th>
                        <th className="px-3 py-2">{t('laporan:column.status', { defaultValue: 'Status' })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masalah.map((r) => (
                        <tr key={r.kodeEksemplar} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs">{r.kodeEksemplar}</td>
                          <td className="px-3 py-2">{r.judul}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
