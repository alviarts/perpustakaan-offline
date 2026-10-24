import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Archive, BookCheck, ClipboardList, Gauge, LayoutDashboard, ListChecks, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  labelKey: string;
  defaultLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/akreditasi/ringkasan', labelKey: 'akreditasi:nav.ringkasan', defaultLabel: 'Ringkasan', Icon: LayoutDashboard },
  { to: '/akreditasi/butir', labelKey: 'akreditasi:nav.butir', defaultLabel: 'Butir Penilaian', Icon: ListChecks },
  { to: '/akreditasi/skor', labelKey: 'akreditasi:nav.skor', defaultLabel: 'Skor & Predikat', Icon: Gauge },
  { to: '/akreditasi/manual', labelKey: 'akreditasi:nav.manual', defaultLabel: 'Data Manual', Icon: ClipboardList },
  { to: '/akreditasi/bukti', labelKey: 'akreditasi:nav.bukti', defaultLabel: 'Bukti Fisik', Icon: ShieldCheck },
  { to: '/akreditasi/buku-bukti', labelKey: 'akreditasi:nav.bukuBukti', defaultLabel: 'Buku Bukti', Icon: BookCheck },
  { to: '/akreditasi/arsip', labelKey: 'akreditasi:nav.arsip', defaultLabel: 'Arsip', Icon: Archive },
];

export function AkreditasiLayout() {
  const { t } = useTranslation(['akreditasi', 'common']);
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6" data-testid="akreditasi-layout">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('akreditasi:title', { defaultValue: 'Akreditasi' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('akreditasi:subtitle', {
            defaultValue: 'Persiapan akreditasi perpustakaan: profil, data, dan bukti fisik',
          })}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside>
          <nav className="flex flex-col gap-1" data-testid="akreditasi-nav">
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
