import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileBarChart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useToast } from '@/components/ui/toast-manager';
import { presetRangeMonth } from './RangeToolbar';
import { dashboardApi, type TopBuku, type TopPeminjam } from '@/lib/dashboard';
import { peminjamanApi, type PeminjamanRow } from '@/lib/peminjaman';
import { reservasiApi, type ReservasiRow } from '@/lib/reservasi';
import { settingsApi } from '@/lib/settings';
import {
  generateLaporanEksekutifPdf,
  type LaporanEksekutifAnggotaDenda,
  type LaporanEksekutifBukuReservasiZeroStock,
  type LaporanEksekutifData,
  type LaporanEksekutifIdentitas,
  type LaporanEksekutifWeekly,
} from '@/lib/pdf/laporanEksekutif';
import { formatTauriError } from '@/lib/errors';

function isoWeekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  // Approximate week-of-month: 1 + floor((day-1)/7).
  const week = Math.floor((d.getDate() - 1) / 7) + 1;
  const month = d.toLocaleDateString('id-ID', { month: 'short' });
  return `M${week} ${month}`;
}

function bucketWeekly(rows: PeminjamanRow[]): LaporanEksekutifWeekly[] {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const label = isoWeekLabel(r.tanggalPinjam);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count }));
}

function aggregateDendaTinggi(rows: PeminjamanRow[]): LaporanEksekutifAnggotaDenda[] {
  const acc = new Map<number, LaporanEksekutifAnggotaDenda>();
  for (const r of rows) {
    const outstanding = Math.max(0, (r.totalDenda ?? 0) - (r.totalBayar ?? 0));
    if (outstanding <= 0) continue;
    const existing = acc.get(r.anggotaId);
    if (existing) {
      existing.outstanding += outstanding;
    } else {
      acc.set(r.anggotaId, { nama: r.anggotaNama, outstanding });
    }
  }
  return Array.from(acc.values())
    .filter((a) => a.outstanding > 50_000)
    .sort((a, b) => b.outstanding - a.outstanding);
}

function aggregateBukuTanpaStok(reservasi: ReservasiRow[]): LaporanEksekutifBukuReservasiZeroStock[] {
  // We can't query stok directly from this thin slice — but rows that flip to
  // siap_diambil already have a slot, so any active reservasi still in
  // "menunggu" status implies zero stok at the moment the queue formed. We
  // surface those.
  const acc = new Map<number, LaporanEksekutifBukuReservasiZeroStock>();
  for (const r of reservasi) {
    if (r.status !== 'menunggu') continue;
    const existing = acc.get(r.bukuId);
    if (existing) {
      existing.reservasiCount += 1;
    } else {
      acc.set(r.bukuId, { judul: r.bukuJudul, reservasiCount: 1 });
    }
  }
  return Array.from(acc.values())
    .filter((b) => b.reservasiCount > 0)
    .sort((a, b) => b.reservasiCount - a.reservasiCount);
}

async function fetchAllPeminjaman(from: string, to: string): Promise<PeminjamanRow[]> {
  const limit = 500;
  let offset = 0;
  const all: PeminjamanRow[] = [];
  for (;;) {
    const page = await peminjamanApi.list({ from, to, limit, offset });
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length < limit || all.length >= page.total) break;
    if (offset > 5000) break; // hard safety cap
  }
  return all;
}

export function LaporanEksekutif() {
  const { t } = useTranslation(['laporan', 'common']);
  const { showToast } = useToast();
  const [range, setRange] = useState(presetRangeMonth);
  const [busy, setBusy] = useState(false);

  const handlePrint = useCallback(async () => {
    setBusy(true);
    try {
      const [identity, kpi, topBuku, topPeminjam, peminjamanRows, reservasi] = await Promise.all([
        settingsApi.getIdentity(),
        dashboardApi.kpi(),
        dashboardApi.topBuku(5),
        dashboardApi.topPeminjam(5),
        fetchAllPeminjaman(range.from, range.to),
        reservasiApi.listActive().catch(() => []),
      ]);

      const dendaOutstanding = peminjamanRows.reduce(
        (acc, r) => acc + Math.max(0, (r.totalDenda ?? 0) - (r.totalBayar ?? 0)),
        0,
      );

      const data: LaporanEksekutifData = {
        kpi: {
          totalAnggotaAktif: kpi.totalAnggota,
          totalBuku: kpi.totalBuku,
          peminjamanPeriode: peminjamanRows.length,
          dendaOutstanding,
        },
        weeklyLoans: bucketWeekly(peminjamanRows),
        topBuku: (topBuku as TopBuku[]).map((b) => ({ judul: b.judul, count: b.jumlah })),
        topAnggota: (topPeminjam as TopPeminjam[]).map((a) => ({
          nama: a.nama,
          kelas: a.kelas,
          count: a.jumlah,
        })),
        anggotaDendaTinggi: aggregateDendaTinggi(peminjamanRows),
        bukuReservasiTanpaStok: aggregateBukuTanpaStok(reservasi),
      };

      const identitas: LaporanEksekutifIdentitas = {
        nama: identity.nama,
        alamat: identity.alamat,
        kepala: identity.kepala,
        npsn: identity.npsn,
        tahunAjaran: identity.tahunAjaran,
        logoSrc: identity.logoPath || undefined,
      };

      generateLaporanEksekutifPdf({
        period: { startIso: range.from, endIso: range.to },
        identitas,
        data,
      });

      showToast({
        title: t('laporan:eksekutif.toastTitle', { defaultValue: 'Laporan disiapkan' }),
        description: t('laporan:eksekutif.toastDesc', {
          defaultValue: 'Jendela cetak akan terbuka.',
        }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:error.load', { defaultValue: 'Gagal memuat data' }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  }, [range, showToast, t]);

  useEffect(() => {
    // Pre-warm settings cache so first click feels snappier.
    void settingsApi.getIdentity();
  }, []);

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-eksekutif">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle>
                {t('laporan:eksekutif.title', { defaultValue: 'Laporan Eksekutif' })}
              </CardTitle>
              <CardDescription>
                {t('laporan:eksekutif.subtitle', {
                  defaultValue:
                    'PDF satu-klik untuk rapat bulanan kepala sekolah: KPI, tren, dan action items.',
                })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DateRangePicker value={range} onChange={setRange} />
          <Button
            onClick={handlePrint}
            disabled={busy}
            className="w-fit"
            data-testid="laporan-eksekutif-cetak"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('laporan:eksekutif.preparing', { defaultValue: 'Menyiapkan…' })}
              </>
            ) : (
              t('laporan:eksekutif.cetak', { defaultValue: 'Cetak PDF' })
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
