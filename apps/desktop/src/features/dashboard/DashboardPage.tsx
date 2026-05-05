import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Users, BookOpen, ArrowLeftRight, BookPlus, UserPlus, Sparkles, Quote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/KpiCard';
import { ChartPie } from '@/components/shared/ChartPie';
import { ChartBar } from '@/components/shared/ChartBar';
import { LiveClock } from '@/components/shared/LiveClock';
import { OverduePanel } from '@/features/dashboard/OverduePanel';
import { getQuoteForDate } from '@/lib/dailyQuote';
import { formatTauriError } from '@/lib/errors';
import {
  dashboardApi,
  type DashboardKpi,
  type DdcSlice,
  type DayBucket,
  type TopBuku,
  type TopPeminjam,
} from '@/lib/dashboard';
import { useAuthStore } from '@/stores/authStore';

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return DAY_NAMES_ID[d.getDay()] ?? iso;
}

interface DashboardData {
  kpi: DashboardKpi;
  ddc: DdcSlice[];
  kunjungan: DayBucket[];
  topPeminjam: TopPeminjam[];
  topBuku: TopBuku[];
}

export function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      dashboardApi.kpi(),
      dashboardApi.ddc(),
      dashboardApi.kunjungan7d(),
      dashboardApi.topPeminjam(5),
      dashboardApi.topBuku(5),
    ])
      .then(([kpi, ddc, kunjungan, topPeminjam, topBuku]) => {
        if (cancel) return;
        setData({ kpi, ddc, kunjungan, topPeminjam, topBuku });
      })
      .catch((err) => {
        if (cancel) return;
        setError(formatTauriError(err));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const kpi = data?.kpi;
  const isEmpty =
    !loading &&
    !!data &&
    data.kpi.totalAnggota === 0 &&
    data.kpi.totalBuku === 0 &&
    data.kpi.bukuDipinjam === 0;

  const dailyQuote = useMemo(() => getQuoteForDate(new Date()), []);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="dashboard-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard:title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard:greeting', { name: user?.fullName ?? 'Guest' })}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary md:inline-flex">
            <Sparkles className="h-3.5 w-3.5" />
            {t('dashboard:refreshed', { defaultValue: 'Real-time' })}
          </span>
          <LiveClock />
        </div>
      </header>

      <Card
        className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent"
        data-testid="daily-quote"
      >
        <CardContent className="flex items-start gap-3 p-4">
          <Quote className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-sm italic leading-relaxed text-foreground">
              {`"${dailyQuote.text}"`}
            </p>
            <p className="text-xs text-muted-foreground">— {dailyQuote.author}</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {t('dashboard:loadError', { defaultValue: 'Gagal memuat data: {{msg}}', msg: error })}
          </CardContent>
        </Card>
      )}

      {isEmpty && !error ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="kpi-row">
            <KpiCard
              label={t('dashboard:kpi.anggota', { defaultValue: 'Total Anggota' })}
              value={loading ? '—' : (kpi?.totalAnggota ?? 0).toLocaleString('id-ID')}
              delta={kpi?.deltaAnggotaPct}
              Icon={Users}
              tone="primary"
              loading={loading}
            />
            <KpiCard
              label={t('dashboard:kpi.buku', { defaultValue: 'Total Buku' })}
              value={loading ? '—' : (kpi?.totalBuku ?? 0).toLocaleString('id-ID')}
              subline={
                loading || !kpi
                  ? undefined
                  : t('dashboard:kpi.eksemplarSubline', {
                      count: kpi.totalEksemplar,
                      value: kpi.totalEksemplar.toLocaleString('id-ID'),
                      defaultValue: '{{value}} eksemplar',
                    })
              }
              delta={kpi?.deltaBukuPct}
              Icon={BookOpen}
              tone="emerald"
              loading={loading}
            />
            <KpiCard
              label={t('dashboard:kpi.dipinjam', { defaultValue: 'Buku Dipinjam' })}
              value={loading ? '—' : (kpi?.bukuDipinjam ?? 0).toLocaleString('id-ID')}
              delta={kpi?.deltaPinjamPct}
              Icon={ArrowLeftRight}
              tone="amber"
              loading={loading}
            />
          </section>

          <OverduePanel />

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t('dashboard:chart.ddc.title', { defaultValue: 'Distribusi Klasifikasi DDC' })}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:chart.ddc.subtitle', {
                    defaultValue: 'Sebaran kelas utama berdasarkan koleksi buku',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <ChartPie
                    data={(data?.ddc ?? []).map((d) => ({
                      key: d.kelas,
                      label: `${d.kelas} · ${d.label}`,
                      value: d.count,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t('dashboard:chart.kunjungan.title', {
                    defaultValue: 'Kunjungan 7 Hari Terakhir',
                  })}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:chart.kunjungan.subtitle', {
                    defaultValue: 'Total kunjungan harian',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <ChartBar
                    data={(data?.kunjungan ?? []).map((d) => ({
                      key: d.tanggal,
                      label: formatDayLabel(d.tanggal),
                      value: d.jumlah,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t('dashboard:featured.peminjam', { defaultValue: 'Top Peminjam' })}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:featured.peminjamHint', { defaultValue: '5 anggota teraktif' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-4">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                ) : (data?.topPeminjam ?? []).length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">
                    {t('dashboard:featured.empty', { defaultValue: 'Belum ada data' })}
                  </p>
                ) : (
                  data!.topPeminjam.map((p, i) => (
                    <FeaturedRow
                      key={p.anggotaId}
                      index={i + 1}
                      title={p.nama}
                      subtitle={`${p.kodeAnggota}${p.kelas ? ` · ${p.kelas}` : ''}`}
                      value={p.jumlah}
                      unit={t('dashboard:featured.unitPinjam', { defaultValue: 'pinjam' })}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t('dashboard:featured.buku', { defaultValue: 'Top Buku' })}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:featured.bukuHint', { defaultValue: '5 buku paling sering dipinjam' })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-4">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                ) : (data?.topBuku ?? []).length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">
                    {t('dashboard:featured.empty', { defaultValue: 'Belum ada data' })}
                  </p>
                ) : (
                  data!.topBuku.map((b, i) => (
                    <FeaturedRow
                      key={b.bukuId}
                      index={i + 1}
                      title={b.judul}
                      subtitle={`${b.kode}${b.pengarang ? ` · ${b.pengarang}` : ''}`}
                      value={b.jumlah}
                      unit={t('dashboard:featured.unitDipinjam', { defaultValue: 'kali' })}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

interface FeaturedRowProps {
  index: number;
  title: string;
  subtitle: string;
  value: number;
  unit: string;
}

function FeaturedRow({ index, title, subtitle, value, unit }: FeaturedRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/40">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {index}
      </span>
      <div className="flex-1 overflow-hidden">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation(['dashboard']);
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {t('dashboard:empty.title', { defaultValue: 'Mulai isi data perpustakaan' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboard:empty.subtitle', {
              defaultValue: 'Tambah data anggota & buku supaya dashboard berisi statistik real-time',
            })}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/anggota">
              <UserPlus className="mr-2 h-4 w-4" />
              {t('dashboard:empty.ctaAnggota', { defaultValue: 'Tambah Anggota' })}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/buku">
              <BookPlus className="mr-2 h-4 w-4" />
              {t('dashboard:empty.ctaBuku', { defaultValue: 'Tambah Buku' })}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
