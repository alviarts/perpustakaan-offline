import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  Users,
  BookOpen,
  ArrowLeftRight,
  BookPlus,
  UserPlus,
  Sparkles,
  Quote,
  ChevronRight,
  TrendingUp,
  Trophy,
  Timer,
  Calculator,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/shared/KpiCard';
import { ChartPie } from '@/components/shared/ChartPie';
import { ChartBar } from '@/components/shared/ChartBar';
import { ChartLine } from '@/components/shared/ChartLine';
import { Heatmap } from '@/components/shared/Heatmap';
import { LiveClock } from '@/components/shared/LiveClock';
import { OverduePanel } from '@/features/dashboard/OverduePanel';
import { getQuoteByIndex } from '@/lib/dailyQuote';
import { useQuoteRotation } from '@/features/dashboard/useQuoteRotation';
import { formatTauriError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  dashboardApi,
  type DashboardInsights,
  type DashboardKpi,
  type DdcSlice,
  type DayBucket,
  type HeatCell,
  type TopBuku,
  type TopPeminjam,
  type TrendBucket,
  type TrendWindow,
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
  heatmap: HeatCell[];
  insights: DashboardInsights;
}

export function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FEAT-25: trend window toggle (7d / 30d / 6m / 1y). Default 30d, the
  // sweet spot for at-a-glance "how busy was the library this month?".
  const [trendWindow, setTrendWindow] = useState<TrendWindow>('days30');
  const [trendData, setTrendData] = useState<TrendBucket[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      dashboardApi.kpi(),
      dashboardApi.ddc(),
      dashboardApi.kunjungan7d(),
      dashboardApi.topPeminjam(5),
      dashboardApi.topBuku(5),
      dashboardApi.heatmap(),
      dashboardApi.insights(),
    ])
      .then(([kpi, ddc, kunjungan, topPeminjam, topBuku, heatmap, insights]) => {
        if (cancel) return;
        setData({ kpi, ddc, kunjungan, topPeminjam, topBuku, heatmap, insights });
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

  // Trend window has its own loader so toggling between 7d/30d/6m/1y doesn't
  // re-fetch the rest of the dashboard. We intentionally allow stale display
  // (no skeleton) while the next window resolves to keep the UI responsive.
  useEffect(() => {
    let cancel = false;
    setTrendLoading(true);
    dashboardApi
      .trend(trendWindow)
      .then((rows) => {
        if (cancel) return;
        setTrendData(rows);
      })
      .catch((err) => {
        if (cancel) return;
        setError(formatTauriError(err));
      })
      .finally(() => {
        if (!cancel) setTrendLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [trendWindow]);

  const kpi = data?.kpi;
  const isEmpty =
    !loading &&
    !!data &&
    data.kpi.totalAnggota === 0 &&
    data.kpi.totalBuku === 0 &&
    data.kpi.bukuDipinjam === 0;

  // Quote-of-the-day rotation (FEAT-Dashboard-Quotes-2min). Initial index
  // is deterministic per calendar day so reload-day-1 always shows the
  // same first quote. The hook auto-advances every QUOTE_ROTATE_MS via a
  // slide-up leave animation, and exposes `advance` so the manual
  // "next" button runs through the same animation phases.
  const { quoteIndex, quoteLeaving, advance: advanceQuote } = useQuoteRotation();
  const dailyQuote = getQuoteByIndex(quoteIndex);

  // Trend datapoints rendered into the line chart. Daily windows show "DD/MM"
  // labels, monthly windows show "Mon" (short month name in current locale).
  const trendChartData = useMemo(
    () =>
      trendData.map((b) => {
        let label = b.bucket;
        if (b.bucket.length === 10) {
          // YYYY-MM-DD daily bucket → "DD/MM".
          const d = new Date(`${b.bucket}T00:00:00`);
          label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (b.bucket.length === 7) {
          // YYYY-MM monthly bucket → short month in current locale + 2-digit year.
          const [year = '', month = '1'] = b.bucket.split('-');
          const d = new Date(Number(year), Number(month) - 1, 1);
          label = d.toLocaleDateString(undefined, { month: 'short' }) + ` '${year.slice(2)}`;
        }
        return { key: b.bucket, label, value: b.count };
      }),
    [trendData],
  );

  const heatmapDayLabels = useMemo(
    () => [
      t('dashboard:dow.sun', { defaultValue: 'Min' }),
      t('dashboard:dow.mon', { defaultValue: 'Sen' }),
      t('dashboard:dow.tue', { defaultValue: 'Sel' }),
      t('dashboard:dow.wed', { defaultValue: 'Rab' }),
      t('dashboard:dow.thu', { defaultValue: 'Kam' }),
      t('dashboard:dow.fri', { defaultValue: 'Jum' }),
      t('dashboard:dow.sat', { defaultValue: 'Sab' }),
    ],
    [t],
  );

  const trendWindowOptions: Array<{ key: TrendWindow; label: string }> = [
    {
      key: 'days7',
      label: t('dashboard:trend.windows.days7', { defaultValue: '7 hari' }),
    },
    {
      key: 'days30',
      label: t('dashboard:trend.windows.days30', { defaultValue: '30 hari' }),
    },
    {
      key: 'months6',
      label: t('dashboard:trend.windows.months6', { defaultValue: '6 bulan' }),
    },
    {
      key: 'year1',
      label: t('dashboard:trend.windows.year1', { defaultValue: '1 tahun' }),
    },
  ];

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
          {/*
            Two-phase fade-slide animation:
            - When `quoteLeaving` is true, the existing element transitions
              to `opacity-0 -translate-y-2` over 300 ms (slide up + fade out).
            - When the timer fires we flip `quoteIndex`, which changes the
              `key` and forces React to remount this div. The fresh mount
              plays `animate-slide-up` (300 ms), entering from below with a
              fade-in. Net effect: ≈600 ms swap, no flicker.
            `motion-reduce` users get the new quote without animation.
          */}
          <div
            key={quoteIndex}
            className={cn(
              'flex min-w-0 flex-1 flex-col gap-1',
              quoteLeaving
                ? '-translate-y-2 opacity-0 transition-all duration-300 ease-out'
                : 'motion-safe:animate-slide-up',
              'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none motion-reduce:animate-none',
            )}
            aria-live="polite"
          >
            <p className="text-sm italic leading-relaxed text-foreground">
              {`"${dailyQuote.text}"`}
            </p>
            <p className="text-xs text-muted-foreground">— {dailyQuote.author}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 flex-shrink-0"
            onClick={advanceQuote}
            data-testid="daily-quote-next"
            aria-label={t('dashboard:quote.next', { defaultValue: 'Quote selanjutnya' })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
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
              href="/anggota"
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
              href="/buku"
            />
            <KpiCard
              label={t('dashboard:kpi.dipinjam', { defaultValue: 'Buku Dipinjam' })}
              value={loading ? '—' : (kpi?.bukuDipinjam ?? 0).toLocaleString('id-ID')}
              delta={kpi?.deltaPinjamPct}
              Icon={ArrowLeftRight}
              tone="amber"
              loading={loading}
              href="/peminjaman"
            />
          </section>

          <OverduePanel />

          {/* FEAT-25 — Insights cards (top buku, top peminjam, avg loans, avg duration). */}
          <section
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="insights-row"
          >
            <InsightCard
              loading={loading}
              Icon={Trophy}
              tone="amber"
              label={t('dashboard:insights.topBuku', {
                defaultValue: 'Buku terlaris bulan ini',
              })}
              primary={data?.insights.topBukuThisMonth?.judul ?? '—'}
              secondary={
                data?.insights.topBukuThisMonth
                  ? t('dashboard:insights.topBukuSubline', {
                      count: data.insights.topBukuThisMonth.jumlah,
                      defaultValue: '{{count}}× dipinjam',
                    })
                  : t('dashboard:insights.empty', { defaultValue: 'Belum ada data' })
              }
              href={
                data?.insights.topBukuThisMonth
                  ? `/buku/${data.insights.topBukuThisMonth.bukuId}`
                  : undefined
              }
            />
            <InsightCard
              loading={loading}
              Icon={TrendingUp}
              tone="primary"
              label={t('dashboard:insights.topPeminjam', {
                defaultValue: 'Peminjam teraktif',
              })}
              primary={data?.insights.topPeminjamThisMonth?.nama ?? '—'}
              secondary={
                data?.insights.topPeminjamThisMonth
                  ? `${data.insights.topPeminjamThisMonth.kodeAnggota}${
                      data.insights.topPeminjamThisMonth.kelas
                        ? ` · ${data.insights.topPeminjamThisMonth.kelas}`
                        : ''
                    }`
                  : t('dashboard:insights.empty', { defaultValue: 'Belum ada data' })
              }
              href={
                data?.insights.topPeminjamThisMonth
                  ? `/anggota/${data.insights.topPeminjamThisMonth.anggotaId}`
                  : undefined
              }
            />
            <InsightCard
              loading={loading}
              Icon={Calculator}
              tone="emerald"
              label={t('dashboard:insights.avgLoans', {
                defaultValue: 'Rata-rata pinjam / anggota',
              })}
              primary={
                data?.insights
                  ? data.insights.avgLoansPerMember.toFixed(1)
                  : '—'
              }
              secondary={t('dashboard:insights.avgLoansSubline', {
                defaultValue: 'Pinjaman per anggota aktif',
              })}
            />
            <InsightCard
              loading={loading}
              Icon={Timer}
              tone="amber"
              label={t('dashboard:insights.avgDuration', {
                defaultValue: 'Rata-rata durasi pinjam',
              })}
              primary={
                data?.insights
                  ? t('dashboard:insights.daysValue', {
                      count: Number(data.insights.avgLoanDurationDays.toFixed(1)),
                      value: data.insights.avgLoanDurationDays.toFixed(1),
                      defaultValue: '{{value}} hari',
                    })
                  : '—'
              }
              secondary={t('dashboard:insights.avgDurationSubline', {
                defaultValue: 'Berdasarkan buku yang sudah dikembalikan',
              })}
            />
          </section>

          {/* FEAT-25 — Trend line + Heatmap waktu populer. */}
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="trend-card">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">
                    {t('dashboard:trend.title', { defaultValue: 'Trend Peminjaman' })}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard:trend.subtitle', {
                      defaultValue: 'Aktivitas peminjaman per periode',
                    })}
                  </CardDescription>
                </div>
                <div
                  className="inline-flex shrink-0 rounded-md border bg-muted/40 p-0.5"
                  role="tablist"
                  aria-label={t('dashboard:trend.windowLabel', {
                    defaultValue: 'Pilih periode',
                  })}
                  data-testid="trend-window-toggle"
                >
                  {trendWindowOptions.map((opt) => {
                    const active = opt.key === trendWindow;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTrendWindow(opt.key)}
                        className={cn(
                          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                        data-testid={`trend-window-${opt.key}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {loading || (trendLoading && trendChartData.length === 0) ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <Link
                    to="/laporan/grafik"
                    className="block rounded-md ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={t('dashboard:trend.drilldown', {
                      defaultValue: 'Lihat laporan detail',
                    })}
                    data-testid="trend-drilldown-link"
                  >
                    <ChartLine
                      data={trendChartData}
                      maxXTicks={trendWindow === 'days7' ? 7 : trendWindow === 'months6' ? 6 : 6}
                    />
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card data-testid="heatmap-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t('dashboard:heatmap.title', { defaultValue: 'Waktu Populer' })}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:heatmap.subtitle', {
                    defaultValue: 'Aktivitas pinjam per jam (6 minggu terakhir)',
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {loading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <Heatmap
                    data={data?.heatmap ?? []}
                    dayLabels={heatmapDayLabels}
                    formatTooltip={(c, dayLabel) =>
                      t('dashboard:heatmap.tooltip', {
                        day: dayLabel,
                        hour: String(c.hour).padStart(2, '0'),
                        count: c.count,
                        defaultValue: '{{day}} · {{hour}}:00 — {{count}} pinjam',
                      })
                    }
                  />
                )}
              </CardContent>
            </Card>
          </section>

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

interface InsightCardProps {
  loading: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  /** Visual tone — maps to a tinted icon background. */
  tone: 'primary' | 'amber' | 'emerald';
  label: string;
  primary: string;
  secondary?: string;
  /**
   * Optional TanStack Router target. When provided AND `loading` is false,
   * the card becomes clickable (FEAT-Dashboard-Clickable-KPI). The skeleton
   * state is intentionally non-navigable so callers can pass a derived href
   * such as `/buku/${data?.insights.topBukuThisMonth?.id}` without guarding.
   */
  href?: string;
}

function InsightCard({
  loading,
  Icon,
  tone,
  label,
  primary,
  secondary,
  href,
}: InsightCardProps) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
      : tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-primary/10 text-primary';
  const interactive = typeof href === 'string' && !loading;
  const inner = (
    <Card
      data-testid="insight-card"
      data-interactive={interactive ? 'true' : undefined}
      className={cn(
        interactive &&
          'cursor-pointer transition-shadow hover:ring-1 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('rounded-md p-2', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {loading ? (
            <Skeleton className="mt-1 h-5 w-2/3" />
          ) : (
            <span className="truncate text-base font-semibold tabular-nums">{primary}</span>
          )}
          {secondary && !loading && (
            <span className="truncate text-xs text-muted-foreground">{secondary}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
  if (interactive) {
    return (
      <Link
        to={href}
        aria-label={label}
        className="block rounded-xl no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-testid="insight-card-link"
      >
        {inner}
      </Link>
    );
  }
  return inner;
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
