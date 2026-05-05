import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const COLLAPSE_BREAKPOINT = '(max-width: 1023px)';

/**
 * Layout shell utama untuk semua route `_authed`.
 * Menyediakan Sidebar (collapsible) + Header + main content area.
 *
 * Behaviour:
 * - Auto-collapse sidebar saat viewport <1024px (revisi #7).
 * - Ctrl/Cmd+B toggle sidebar global (revisi #7).
 * - Layout `min-h-screen` + scroll di main → fullscreen-friendly (revisi #13).
 */
export function AppShell() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const isNarrow = useMediaQuery(COLLAPSE_BREAKPOINT);

  // Auto-collapse on narrow viewports.
  useEffect(() => {
    if (isNarrow && !collapsed) {
      setCollapsed(true, true);
    } else if (!isNarrow && collapsed && useSidebarStore.getState().autoCollapsed) {
      // Restore expanded only if collapse was triggered by viewport (not user).
      setCollapsed(false, false);
    }
  }, [isNarrow, collapsed, setCollapsed]);

  // Global Ctrl+B / Cmd+B shortcut.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return (
    <div className="flex h-full min-h-0 min-w-[800px] overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto" data-testid="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
