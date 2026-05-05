import { useEffect } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
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
  const navigate = useNavigate();

  // Auto-collapse on narrow viewports.
  useEffect(() => {
    if (isNarrow && !collapsed) {
      setCollapsed(true, true);
    } else if (!isNarrow && collapsed && useSidebarStore.getState().autoCollapsed) {
      // Restore expanded only if collapse was triggered by viewport (not user).
      setCollapsed(false, false);
    }
  }, [isNarrow, collapsed, setCollapsed]);

  // Global shortcuts: Ctrl/Cmd+B toggles sidebar, Ctrl/Cmd+L opens
  // the webcam circulation page (#19, v1.0.6).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        toggle();
      } else if (key === 'l') {
        e.preventDefault();
        void navigate({ to: '/sirkulasi' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle, navigate]);

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
