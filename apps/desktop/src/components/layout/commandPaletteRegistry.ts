/**
 * Command palette registry (A1-CommandPalette, v1.1.0).
 *
 * Static lists of in-app routes and quick actions surfaced through the
 * `GlobalSearchDialog` command palette. Other features can reference these
 * lists to keep their own static UI (sidebar, settings menu, etc.) in sync,
 * or extend the registry with `addCommandPaletteAction` to register
 * feature-specific actions (e.g. FEAT-Sirkulasi-Search → "Mulai Sirkulasi",
 * D5-SandboxDemoMode → "Toggle Mode Demo").
 *
 * The registry intentionally avoids importing React components (icons are
 * passed in as React types) so feature modules can register entries lazily
 * without pulling the renderer into their bundle.
 */
import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  BookMarked,
  CalendarCheck,
  ClipboardList,
  Database,
  FileBarChart,
  FilePlus,
  HardDriveDownload,
  Heart,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Moon,
  Monitor,
  ScanLine,
  Settings,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react';

import { useThemeStore } from '@/stores/themeStore';
import { settingsApi } from '@/lib/settings';
import { logoutRequest } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

export type CommandPaletteIcon = ComponentType<{ className?: string }>;

export interface CommandPaletteRouteEntry {
  /** Stable identifier — also used as the i18n key suffix and registry key. */
  key: string;
  /** Path passed to `navigate({ to })`. */
  to: string;
  /** Lucide icon shown next to the label. */
  icon: CommandPaletteIcon;
}

export interface CommandPaletteActionContext {
  /** Type kept loose so feature modules don't need to import the router. */
  navigate: (path: string) => void;
  showToast: (input: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  t: TFunction;
}

export interface CommandPaletteActionEntry {
  /** Stable identifier — also used as the i18n key suffix and registry key. */
  key: string;
  /** Lucide icon shown next to the label. */
  icon: CommandPaletteIcon;
  /**
   * Invoked AFTER the dialog closes. Implementations may be async; callers
   * should not await — long-running work should be fired-and-forgotten and
   * surface progress via toasts.
   */
  execute: (ctx: CommandPaletteActionContext) => void | Promise<void>;
}

/**
 * Default routes surfaced when the user opens the palette. Order is the
 * default rendering order; the first 6 entries are surfaced when the query
 * is empty (the "Halaman" group).
 */
export const COMMAND_PALETTE_ROUTES: readonly CommandPaletteRouteEntry[] = [
  { key: 'dashboard', to: '/dashboard', icon: LayoutDashboard },
  { key: 'anggota', to: '/anggota', icon: Users },
  { key: 'buku', to: '/buku', icon: BookOpen },
  { key: 'peminjaman', to: '/peminjaman', icon: ArrowLeftRight },
  { key: 'sirkulasi', to: '/sirkulasi', icon: ScanLine },
  { key: 'laporan', to: '/laporan', icon: BarChart3 },
  { key: 'pengembalian', to: '/pengembalian', icon: Undo2 },
  { key: 'reservasi', to: '/reservasi', icon: BookMarked },
  { key: 'wishlist', to: '/wishlist', icon: Heart },
  { key: 'stocktake', to: '/stocktake', icon: ClipboardList },
  { key: 'kunjungan', to: '/kunjungan', icon: CalendarCheck },
  { key: 'settings', to: '/settings', icon: Settings },
  { key: 'backup', to: '/laporan/backup', icon: HardDriveDownload },
  { key: 'auditLog', to: '/settings/audit-log', icon: History },
  { key: 'kta', to: '/settings/kta', icon: IdCard },
  { key: 'manual', to: '/settings/manual', icon: BookOpen },
  { key: 'tentang', to: '/settings/tentang', icon: Database },
] as const;

/** Number of entries from `COMMAND_PALETTE_ROUTES` shown when query is empty. */
export const COMMAND_PALETTE_DEFAULT_ROUTE_LIMIT = 6;

/**
 * Built-in quick actions. Order is the default rendering order. Feature
 * modules can append their own via `addCommandPaletteAction(entry)` —
 * registrations are processed lazily so call sites don't need to ship
 * anything at import time.
 */
const BUILTIN_ACTIONS: CommandPaletteActionEntry[] = [
  {
    key: 'backupSekarang',
    icon: HardDriveDownload,
    execute: ({ navigate, showToast, t }) => {
      navigate('/laporan/backup');
      showToast({
        title: t('commandPalette.action.backupSekarang.toast'),
      });
    },
  },
  {
    key: 'cetakLaporanBulanan',
    icon: FileBarChart,
    execute: ({ navigate }) => {
      navigate('/laporan');
    },
  },
  {
    key: 'tambahAnggota',
    icon: UserPlus,
    execute: ({ navigate }) => {
      navigate('/anggota/new');
    },
  },
  {
    key: 'tambahBuku',
    icon: FilePlus,
    execute: ({ navigate }) => {
      navigate('/buku/new');
    },
  },
  {
    key: 'tambahPeminjaman',
    icon: ArrowLeftRight,
    execute: ({ navigate }) => {
      navigate('/peminjaman/new');
    },
  },
  {
    key: 'toggleTheme',
    icon: Moon,
    execute: ({ showToast, t }) => {
      const state = useThemeStore.getState();
      const next = state.resolved === 'dark' ? 'light' : 'dark';
      state.setTheme(next);
      showToast({
        title: t(`commandPalette.action.toggleTheme.toast.${next}`),
      });
    },
  },
  {
    key: 'bukaOpac',
    icon: Monitor,
    execute: async ({ showToast, t }) => {
      try {
        await settingsApi.saveAppMode('public');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('commandPalette.action.bukaOpac.fail'),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },
  {
    key: 'logout',
    icon: LogOut,
    execute: async ({ showToast, t }) => {
      try {
        await logoutRequest();
        useAuthStore.getState().logout();
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('commandPalette.action.logout.fail'),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },
];

const extraActions: CommandPaletteActionEntry[] = [];

/**
 * Append a feature-owned action to the registry. Subsequent reads of
 * `getCommandPaletteActions()` will include the registered entry. Calling
 * with the same `key` replaces any previous registration.
 */
export function addCommandPaletteAction(entry: CommandPaletteActionEntry): void {
  const existing = extraActions.findIndex((a) => a.key === entry.key);
  if (existing >= 0) {
    extraActions.splice(existing, 1, entry);
  } else {
    extraActions.push(entry);
  }
}

/** Return the union of built-in + feature-registered actions in declared order. */
export function getCommandPaletteActions(): readonly CommandPaletteActionEntry[] {
  return [...BUILTIN_ACTIONS, ...extraActions];
}

/** Test helper — wipes runtime registrations without affecting built-ins. */
export function _clearExtraCommandPaletteActions(): void {
  extraActions.length = 0;
}
