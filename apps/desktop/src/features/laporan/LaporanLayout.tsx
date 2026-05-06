import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BarChart3, Database, FileBarChart, LineChart, ReceiptText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/laporan/grafik', labelKey: 'laporan:nav.grafik', defaultLabel: 'Grafik', Icon: LineChart },
  { to: '/laporan/eksekutif', labelKey: 'laporan:nav.eksekutif', defaultLabel: 'Eksekutif', Icon: FileBarChart },
  { to: '/laporan/top-peminjam', labelKey: 'laporan:nav.topPeminjam', defaultLabel: 'Top Peminjam', Icon: Users },
  { to: '/laporan/top-buku', labelKey: 'laporan:nav.topBuku', defaultLabel: 'Top Buku', Icon: BarChart3 },
  { to: '/laporan/kas', labelKey: 'laporan:nav.kas', defaultLabel: 'Kas', Icon: ReceiptText },
  { to: '/laporan/backup', labelKey: 'laporan:nav.backup', defaultLabel: 'Backup', Icon: Database },
];

export function LaporanLayout() {
  const { t } = useTranslation(['laporan', 'common']);
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6" data-testid="laporan-layout">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('laporan:title', { defaultValue: 'Laporan' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('laporan:subtitle', {
            defaultValue: 'Statistik & ekspor data perpustakaan',
          })}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside>
          <nav className="flex flex-col gap-1" data-testid="laporan-nav">
            {NAV.map(({ to, labelKey, defaultLabel, Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
                  '[&.active]:bg-primary/10 [&.active]:font-medium [&.active]:text-primary',
                )}
                activeProps={{ className: 'active' }}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey, { defaultValue: defaultLabel })}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
