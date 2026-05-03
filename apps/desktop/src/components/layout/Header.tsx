import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { Search, BookOpen, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useIdentityStore } from '@/stores/identityStore';
import { logoutRequest } from '@/lib/auth';
import { openManual } from '@/lib/manual';
import { cn } from '@/lib/utils';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'common:menu.dashboard',
  '/anggota': 'common:menu.anggota',
  '/buku': 'common:menu.buku',
  '/peminjaman': 'common:menu.peminjaman',
  '/pengembalian': 'common:menu.pengembalian',
  '/kunjungan': 'common:menu.kunjungan',
  '/laporan': 'common:menu.laporan',
  '/settings': 'common:menu.settings',
};

export function Header() {
  const { t } = useTranslation(['common', 'auth']);
  const router = useRouter();
  const routerState = useRouterState();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const identity = useIdentityStore((s) => s.identity);
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const currentLabelKey = ROUTE_LABELS[routerState.location.pathname] ?? 'common:menu.dashboard';

  // Ctrl+K / Cmd+K → focus search (placeholder; akan integrasi dengan global search di sesi 4+)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onLogout = async () => {
    await logoutRequest();
    logout();
    void router.navigate({ to: '/login' });
  };

  return (
    <header
      data-testid="app-header"
      className={cn(
        'flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4',
      )}
    >
      {/* Breadcrumb / current section */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/dashboard"
          className="text-muted-foreground hover:text-foreground"
          aria-label={t('common:menu.dashboard')}
        >
          {identity.nama}
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium">{t(currentLabelKey)}</span>
      </div>

      {/* Global search slot (Devin 4+ akan isi) */}
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            placeholder={t('common:placeholders.search')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const q = searchValue.trim();
                void router.navigate({
                  to: '/anggota',
                  search: q ? { q } : {},
                });
              }
            }}
            className="h-9 w-64 pl-8 pr-12"
            data-testid="header-search"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
            ⌃K
          </kbd>
        </div>

        <button
          type="button"
          data-testid="header-manual"
          aria-label={t('common:menu.manualBook')}
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground md:flex"
          onClick={() => void openManual(identity)}
        >
          <BookOpen className="h-4 w-4" />
        </button>

        <LanguageSwitcher />
        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="user-menu"
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-xs font-medium leading-tight">
                  {user?.fullName ?? '—'}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {user?.role ?? ''}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.username ?? '—'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" />
              {t('common:menu.profile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} data-testid="logout">
              <LogOut className="mr-2 h-4 w-4" />
              {t('common:menu.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
