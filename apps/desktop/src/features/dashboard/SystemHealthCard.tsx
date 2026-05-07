import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bell,
  Calendar,
  ChevronRight,
  CircleCheck,
  Database,
  HardDrive,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { dashboardApi, type SystemHealth } from '@/lib/dashboard';

/**
 * Format a byte count as a short human-readable string. Uses 1024-step units
 * (KB/MB/GB), 1 decimal of precision once we cross the KB boundary, integer
 * bytes below 1 KB. Exported for tests and reuse.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[i]}`;
}

/**
 * Format an ISO timestamp as a relative phrase ("baru saja", "5 menit lalu",
 * "2 jam lalu", "3 hari lalu") in Indonesian. The optional `now` arg keeps
 * the helper testable; production code passes `Date.now()`.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const diffMs = now - ts;
  if (diffMs < 0) return 'baru saja';
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 45) return 'baru saja';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  const years = Math.round(days / 365);
  return `${years} tahun lalu`;
}

function formatAbsolute(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

interface RowProps {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  to?: string;
  testId?: string;
  iconClassName?: string;
}

function Row({ label, value, Icon, to, testId, iconClassName }: RowProps): React.ReactElement {
  const inner = (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2.5',
        to && 'transition-colors hover:bg-background/70',
      )}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md bg-muted/60',
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {value}
        {to ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
      </div>
    </div>
  );
  if (!to) return inner;
  return (
    <Link to={to} aria-label={label} data-testid={testId ? `${testId}-link` : undefined}>
      {inner}
    </Link>
  );
}

/**
 * D1-SystemHealthWidget — single dashboard card surfacing operational health:
 * DB size, last/next backup, pending reservasi count, app version + optional
 * "Update tersedia" pill. All five rows render even while data loads via
 * skeleton placeholders.
 */
export function SystemHealthCard(): React.ReactElement {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancel = false;
    dashboardApi
      .systemHealth()
      .then((d) => {
        if (!cancel) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancel) setError(true);
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
      <Card data-testid="system-health-card-loading">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('dashboard:systemHealth.title', { defaultValue: 'Sistem & Backup' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 pt-0">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-10 w-full" data-testid="system-health-skeleton-row" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="system-health-card-error">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('dashboard:systemHealth.title', { defaultValue: 'Sistem & Backup' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {t('common:errors.loadFailed', { defaultValue: 'Gagal memuat data.' })}
        </CardContent>
      </Card>
    );
  }

  const lastBackupLabel = data.lastBackupAt
    ? formatRelative(data.lastBackupAt)
    : t('common:status.never', { defaultValue: 'Belum pernah' });
  const nextBackupLabel = data.nextBackupAt
    ? formatAbsolute(data.nextBackupAt, i18n.language)
    : t('dashboard:systemHealth.scheduleAuto', { defaultValue: 'Lihat jadwal' });
  const pending = data.pendingReservasi;
  const PendingIcon = pending > 0 ? Bell : CircleCheck;
  const pendingTone =
    pending > 0
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';

  return (
    <Card data-testid="system-health-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">
            {t('dashboard:systemHealth.title', { defaultValue: 'Sistem & Backup' })}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        <Row
          Icon={Database}
          label={t('dashboard:systemHealth.dbSize', { defaultValue: 'Ukuran database' })}
          value={
            <span data-testid="system-health-db-size">{formatBytes(data.dbSizeBytes)}</span>
          }
          testId="system-health-row-db-size"
        />
        <Row
          Icon={HardDrive}
          label={t('dashboard:systemHealth.lastBackup', { defaultValue: 'Backup terakhir' })}
          value={<span data-testid="system-health-last-backup">{lastBackupLabel}</span>}
          to="/settings/backup"
          testId="system-health-row-last-backup"
        />
        <Row
          Icon={Calendar}
          label={t('dashboard:systemHealth.nextBackup', { defaultValue: 'Backup berikutnya' })}
          value={<span data-testid="system-health-next-backup">{nextBackupLabel}</span>}
          to="/settings/backup"
          testId="system-health-row-next-backup"
        />
        <Row
          Icon={PendingIcon}
          iconClassName={pendingTone}
          label={t('dashboard:systemHealth.pendingReservasi', {
            defaultValue: 'Reservasi menunggu',
          })}
          value={
            <span
              data-testid="system-health-pending-reservasi"
              data-tone={pending > 0 ? 'amber' : 'emerald'}
            >
              {pending.toLocaleString(i18n.language === 'en' ? 'en-GB' : 'id-ID')}
            </span>
          }
          to="/reservasi"
          testId="system-health-row-pending-reservasi"
        />
        <Row
          Icon={Tag}
          label={t('dashboard:systemHealth.version', { defaultValue: 'Versi aplikasi' })}
          value={
            <span className="flex items-center gap-2">
              <span data-testid="system-health-version">{data.appVersion}</span>
              {data.updateAvailable === true ? (
                <span
                  className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                  data-testid="system-health-update-pill"
                >
                  {t('dashboard:systemHealth.updateAvailable', {
                    defaultValue: 'Update tersedia',
                  })}
                </span>
              ) : null}
            </span>
          }
          testId="system-health-row-version"
        />
      </CardContent>
    </Card>
  );
}
