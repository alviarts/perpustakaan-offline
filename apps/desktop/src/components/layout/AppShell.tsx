import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SandboxBanner } from './SandboxBanner';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { APPEARANCE_CHANGED_EVENT, applyAppearance } from '@/lib/appearance';
import { settingsApi, type AppLayout, type DisplayPrefs } from '@/lib/settings';

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<AppLayout>('klasik');
  const ringkasAppliedRef = useRef(false);

  // Hidrasi preferensi tampilan (layout/accent/density/fontScale) dan
  // terapkan ke root — bukan hanya saat membuka Settings → Tampilan.
  useEffect(() => {
    let alive = true;
    settingsApi
      .getDisplayPrefs()
      .then((prefs) => {
        // Hidrasi awal: jangan pancarkan event, supaya state sidebar yang
        // tersimpan (collapse manual) tidak ikut diubah.
        applyAppearance(prefs, false);
        if (alive) setLayout(prefs.layout);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Saat pengguna mengganti layout dari Settings → Tampilan (atau onboarding),
  // `applyAppearance` memancarkan event. Tanpa ini AppShell tidak tahu dan
  // sidebar tetap memakai state lama — makanya Ringkas & Modern terlihat sama.
  useEffect(() => {
    const onChanged = (e: Event): void => {
      const prefs = (e as CustomEvent<DisplayPrefs>).detail;
      if (!prefs?.layout) return;
      setLayout(prefs.layout);
      if (window.matchMedia(COLLAPSE_BREAKPOINT).matches) return;
      const shouldCollapse = prefs.layout === 'ringkas';
      if (useSidebarStore.getState().collapsed !== shouldCollapse) {
        setCollapsed(shouldCollapse, false);
      }
    };
    window.addEventListener(APPEARANCE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, onChanged);
  }, [setCollapsed]);

  // Layout "ringkas": mulai dengan sidebar mengecil (sekali per sesi).
  useEffect(() => {
    if (layout === 'ringkas' && !ringkasAppliedRef.current) {
      ringkasAppliedRef.current = true;
      if (!collapsed) setCollapsed(true, false);
    }
  }, [layout, collapsed, setCollapsed]);

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
        <SandboxBanner />
        <Header />
        <main className="flex-1 overflow-y-auto" data-testid="app-main">
          {/*
           * Transisi antar-halaman ala macOS: fade + sedikit geser vertikal.
           * Wrapper di-key per pathname sehingga React mengganti halaman secara
           * bersih. Tidak memakai AnimatePresence `mode="wait"` karena itu
           * membuat `<Outlet />` lama ikut me-render route baru saat exit →
           * form di-remount dan state hilang (5 e2e CRUD gagal).
           */}
          <motion.div
            key={pathname}
            className="h-full"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
