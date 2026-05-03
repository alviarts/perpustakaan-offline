import { Link, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ArrowLeftRight,
  Undo2,
  CalendarCheck,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Library,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useIdentityStore } from '@/stores/identityStore';

interface NavItem {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Indicates the page hasn't been built yet — disable click + show "soon" badge */
  pending?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'common:menu.dashboard', Icon: LayoutDashboard },
  { to: '/anggota', labelKey: 'common:menu.anggota', Icon: Users },
  { to: '/buku', labelKey: 'common:menu.buku', Icon: BookOpen },
  { to: '/peminjaman', labelKey: 'common:menu.peminjaman', Icon: ArrowLeftRight, pending: true },
  { to: '/pengembalian', labelKey: 'common:menu.pengembalian', Icon: Undo2, pending: true },
  { to: '/kunjungan', labelKey: 'common:menu.kunjungan', Icon: CalendarCheck, pending: true },
  { to: '/laporan', labelKey: 'common:menu.laporan', Icon: BarChart3, pending: true },
  { to: '/settings', labelKey: 'common:menu.settings', Icon: Settings, pending: true },
];

export function Sidebar() {
  const { t } = useTranslation(['common']);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const identity = useIdentityStore((s) => s.identity);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed}
        className={cn(
          'flex h-full flex-col border-r border-border bg-card text-card-foreground',
          'transition-[width] duration-200 ease-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground',
            )}
          >
            <Library className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{identity.nama}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {t('common:tagline')}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2" aria-label="primary">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, labelKey, Icon, pending }) => {
              const active = currentPath === to || currentPath.startsWith(`${to}/`);
              const item = (
                <Link
                  to={pending ? '/dashboard' : to}
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={pending}
                  onClick={(e) => {
                    if (pending) e.preventDefault();
                  }}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    pending && 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 truncate">{t(labelKey)}</span>
                  )}
                  {!collapsed && pending && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      soon
                    </span>
                  )}
                </Link>
              );

              return (
                <li key={to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{item}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {t(labelKey)}
                        {pending ? ' · soon' : ''}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    item
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle */}
        <div className="border-t border-border p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggle}
                  data-testid="sidebar-toggle"
                  aria-label={t('common:sidebar.expand')}
                  className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t('common:sidebar.expand')} (Ctrl+B)
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={toggle}
              data-testid="sidebar-toggle"
              aria-label={t('common:sidebar.collapse')}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span>{t('common:sidebar.collapse')}</span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 text-[10px]">⌃B</kbd>
                <ChevronsLeft className="h-4 w-4" />
              </span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
