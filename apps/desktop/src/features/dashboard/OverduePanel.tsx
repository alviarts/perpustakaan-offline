import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { peminjamanApi, type OverdueRow } from '@/lib/peminjaman';

const DASHBOARD_LIMIT = 5;

/**
 * Dashboard panel that highlights overdue peminjaman items. Hidden when
 * the count is zero so the dashboard is not cluttered for clean libraries.
 */
export function OverduePanel() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [rows, setRows] = useState<OverdueRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    peminjamanApi
      .overdueList(DASHBOARD_LIMIT)
      .then((list) => {
        if (!cancel) setRows(list);
      })
      .catch(() => {
        if (!cancel) setRows([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) {
    return (
      <Card data-testid="dashboard-overdue-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!rows || rows.length === 0) return null;

  return (
    <Card
      className="border-rose-200/70 bg-rose-50/40 dark:border-rose-500/30 dark:bg-rose-500/5"
      data-testid="dashboard-overdue"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          <CardTitle className="text-base text-rose-700 dark:text-rose-300">
            {t('dashboard:overdue.title', { defaultValue: 'Peminjaman Terlambat' })}
          </CardTitle>
        </div>
        <CardDescription>
          {t('dashboard:overdue.subtitle', {
            count: rows.length,
            defaultValue: '{{count}} buku belum dikembalikan',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        {rows.map((r) => (
          <Link
            key={`${r.peminjamanId}-${r.itemId}`}
            to="/peminjaman/$id"
            params={{ id: String(r.peminjamanId) }}
            className="hover:bg-background/60 flex items-center gap-3 rounded-md border border-rose-200/40 bg-background/40 p-2.5 dark:border-rose-500/20"
          >
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium">{r.bukuJudul}</div>
              <div className="text-muted-foreground truncate text-xs">
                {r.anggotaNama} · {r.anggotaKode}
                {r.anggotaKelas ? ` · ${r.anggotaKelas}` : ''} · {r.nomorPinjam}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {r.hariTerlambat}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t('dashboard:overdue.unitDays', { defaultValue: 'hari' })}
              </div>
            </div>
          </Link>
        ))}
        <Link
          to="/peminjaman"
          className="text-primary self-end text-xs font-medium hover:underline"
          data-testid="dashboard-overdue-see-all"
        >
          {t('dashboard:overdue.viewAll', { defaultValue: 'Lihat semua di Peminjaman →' })}
        </Link>
      </CardContent>
    </Card>
  );
}
