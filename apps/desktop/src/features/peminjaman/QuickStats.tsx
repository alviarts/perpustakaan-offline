import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BookMarked, CalendarRange, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { peminjamanApi, type PeminjamanQuickStats } from '@/lib/peminjaman';

interface StatProps {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'primary' | 'warning' | 'danger' | 'muted';
}

const TONE: Record<StatProps['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  muted: 'bg-muted text-muted-foreground',
};

function StatCard({ Icon, label, value, tone }: StatProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PeminjamanQuickStatsBar({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const { t } = useTranslation('peminjaman');
  const [stats, setStats] = useState<PeminjamanQuickStats | null>(null);

  useEffect(() => {
    let cancel = false;
    peminjamanApi
      .quickStats()
      .then((s) => {
        if (!cancel) setStats(s);
      })
      .catch(() => {
        if (!cancel) {
          setStats({ aktifHariIni: 0, aktifMingguIni: 0, overdue: 0, totalAktif: 0 });
        }
      });
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  return (
    <div
      data-testid="peminjaman-quick-stats"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <StatCard
        Icon={Clock}
        tone="primary"
        label={t('stats.aktifHariIni', { defaultValue: 'Aktif Hari Ini' })}
        value={stats?.aktifHariIni ?? 0}
      />
      <StatCard
        Icon={CalendarRange}
        tone="muted"
        label={t('stats.aktifMingguIni', { defaultValue: 'Aktif Minggu Ini' })}
        value={stats?.aktifMingguIni ?? 0}
      />
      <StatCard
        Icon={BookMarked}
        tone="muted"
        label={t('stats.totalAktif', { defaultValue: 'Total Aktif' })}
        value={stats?.totalAktif ?? 0}
      />
      <StatCard
        Icon={AlertTriangle}
        tone="danger"
        label={t('stats.overdue', { defaultValue: 'Overdue' })}
        value={stats?.overdue ?? 0}
      />
    </div>
  );
}
