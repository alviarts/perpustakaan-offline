import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CalendarClock,
  CircleDollarSign,
  History,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTauriError } from '@/lib/errors';
import { peminjamanApi, type AnggotaLoanHistory } from '@/lib/peminjaman';
import { cn } from '@/lib/utils';

const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const STATUS_TONE: Record<string, string> = {
  dipinjam: 'bg-primary/10 text-primary',
  sebagian: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  dikembalikan: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  terlambat: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  hilang: 'bg-rose-700/10 text-rose-700 dark:text-rose-400',
};

interface Props {
  anggotaId: number;
}

/**
 * Loan-history tab body for the anggota detail page. Hits
 * `anggota_loan_history` once on mount and renders a stat grid, top-5
 * borrowed books, and a chronological list of peminjaman with status
 * pills and per-row links to the peminjaman detail page.
 */
export function AnggotaRiwayatPanel({ anggotaId }: Props) {
  const { t, i18n } = useTranslation(['anggota', 'peminjaman', 'common']);
  const [data, setData] = useState<AnggotaLoanHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    peminjamanApi
      .anggotaLoanHistory(anggotaId)
      .then((d) => {
        if (!cancel) setData(d);
      })
      .catch((err) => {
        if (!cancel) setError(formatTauriError(err));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [anggotaId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/40 dark:border-rose-500/30 dark:bg-rose-500/5">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('anggota:history.loadError', { msg: error, defaultValue: error })}</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, topBuku, history } = data;
  const dateFormatter = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    try {
      return dateFormatter.format(new Date(`${iso}T00:00:00`));
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<History className="h-5 w-5" />}
          label={t('anggota:history.stats.total', { defaultValue: 'Total Peminjaman' })}
          value={summary.totalPeminjaman.toString()}
          hint={t('anggota:history.stats.totalHint', {
            count: summary.totalItem,
            defaultValue: '{{count}} buku diakses',
          })}
        />
        <StatCard
          icon={<BookMarked className="h-5 w-5" />}
          label={t('anggota:history.stats.aktif', { defaultValue: 'Sedang Dipinjam' })}
          value={summary.aktifCount.toString()}
          hint={
            summary.overdueCount > 0
              ? t('anggota:history.stats.overdueHint', {
                  count: summary.overdueCount,
                  defaultValue: '{{count}} terlambat',
                })
              : t('anggota:history.stats.onTime', { defaultValue: 'Tepat waktu' })
          }
          tone={summary.overdueCount > 0 ? 'rose' : summary.aktifCount > 0 ? 'primary' : 'muted'}
        />
        <StatCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          label={t('anggota:history.stats.denda', { defaultValue: 'Total Denda' })}
          value={RUPIAH.format(summary.totalDenda)}
          hint={t('anggota:history.stats.dibayar', {
            value: RUPIAH.format(summary.totalBayar),
            defaultValue: 'Sudah dibayar {{value}}',
          })}
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label={t('anggota:history.stats.lastPinjam', { defaultValue: 'Pinjam Terakhir' })}
          value={summary.lastPinjam ? fmtDate(summary.lastPinjam) : '—'}
        />
      </section>

      {topBuku.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('anggota:history.topBuku.title', { defaultValue: 'Buku Sering Dipinjam' })}
            </CardTitle>
            <CardDescription>
              {t('anggota:history.topBuku.subtitle', {
                defaultValue: '5 judul teratas berdasarkan jumlah peminjaman',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-5">
            {topBuku.map((b) => (
              <div
                key={b.bukuId}
                className="flex flex-col rounded-md border bg-muted/30 p-3"
              >
                <div className="text-muted-foreground text-xs font-mono">{b.kodeBuku}</div>
                <div className="line-clamp-2 text-sm font-medium">{b.judul}</div>
                <div className="text-primary mt-1 text-xs font-semibold">
                  {t('anggota:history.topBuku.count', {
                    count: b.jumlah,
                    defaultValue: '{{count}}× pinjam',
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('anggota:history.timeline.title', { defaultValue: 'Riwayat Peminjaman' })}
          </CardTitle>
          <CardDescription>
            {t('anggota:history.timeline.subtitle', {
              count: history.length,
              defaultValue: '{{count}} entri terbaru',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">
              {t('anggota:history.timeline.empty', {
                defaultValue: 'Belum ada peminjaman tercatat.',
              })}
            </p>
          ) : (
            <ul className="divide-y">
              {history.map((row) => (
                <li key={row.peminjamanId}>
                  <Link
                    to="/peminjaman/$id"
                    params={{ id: String(row.peminjamanId) }}
                    className="hover:bg-muted/60 group flex items-center gap-3 px-4 py-3 text-sm"
                  >
                    <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium">{row.nomorPinjam}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            STATUS_TONE[row.status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {t(`peminjaman:status.${row.status}` as never, {
                            defaultValue: row.status,
                          })}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {row.bukuJudulPertama ?? '—'}
                        {row.totalItem > 1 ? ` (+${row.totalItem - 1})` : ''}
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {fmtDate(row.tanggalPinjam)} → {fmtDate(row.tanggalJatuhTempo)}
                        {row.tanggalKembali
                          ? ` · ${t('anggota:history.timeline.returned', {
                              date: fmtDate(row.tanggalKembali),
                              defaultValue: 'kembali {{date}}',
                            })}`
                          : ''}
                      </div>
                    </div>
                    {row.totalDenda > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 shrink-0 text-xs font-semibold tabular-nums">
                        {RUPIAH.format(row.totalDenda)}
                      </span>
                    )}
                    <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'rose' | 'muted';
}

function StatCard({ icon, label, value, hint, tone = 'muted' }: StatProps) {
  const toneClass =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'primary'
        ? 'text-primary'
        : 'text-foreground';
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="bg-muted text-muted-foreground rounded-md p-2">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className={cn('truncate text-lg font-semibold tabular-nums', toneClass)}>
            {value}
          </div>
          {hint && <div className="text-muted-foreground truncate text-xs">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
