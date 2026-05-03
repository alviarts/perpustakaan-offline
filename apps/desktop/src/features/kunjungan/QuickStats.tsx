import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, CalendarRange, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { kunjunganApi, type KunjunganQuickStats } from '@/lib/kunjungan';

interface StatProps {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'primary' | 'sky' | 'emerald' | 'muted';
}

const TONE: Record<StatProps['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
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
          <p className="text-2xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function KunjunganQuickStatsBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation('kunjungan');
  const [stats, setStats] = useState<KunjunganQuickStats | null>(null);

  useEffect(() => {
    let cancel = false;
    kunjunganApi
      .quickStats()
      .then((s) => !cancel && setStats(s))
      .catch(() => !cancel && setStats({ hariIni: 0, mingguIni: 0, bulanIni: 0, total: 0 }));
    return () => {
      cancel = true;
    };
  }, [refreshKey]);

  return (
    <div data-testid="kunjungan-quick-stats" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        Icon={CalendarCheck}
        tone="primary"
        label={t('stats.hariIni', { defaultValue: 'Hari Ini' })}
        value={stats?.hariIni ?? 0}
      />
      <StatCard
        Icon={CalendarRange}
        tone="sky"
        label={t('stats.mingguIni', { defaultValue: 'Minggu Ini' })}
        value={stats?.mingguIni ?? 0}
      />
      <StatCard
        Icon={CalendarDays}
        tone="emerald"
        label={t('stats.bulanIni', { defaultValue: 'Bulan Ini' })}
        value={stats?.bulanIni ?? 0}
      />
      <StatCard
        Icon={Users}
        tone="muted"
        label={t('stats.total', { defaultValue: 'Total' })}
        value={stats?.total ?? 0}
      />
    </div>
  );
}
