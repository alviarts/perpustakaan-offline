import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sandboxApi } from '@/lib/sandbox';

/**
 * D5-SandboxDemoMode — global yellow banner mounted above the AppShell
 * Header. Renders only when sandbox mode is active. The "Kembali ke Mode
 * Asli" button calls `sandbox_disable` and reloads the window so every
 * React Query cache is rebuilt from the production DB.
 */
export function SandboxBanner(): React.ReactElement | null {
  const { t } = useTranslation(['settings', 'common']);
  const [active, setActive] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancel = false;
    sandboxApi
      .status()
      .then((s) => {
        if (!cancel) setActive(s.active);
      })
      .catch(() => {
        if (!cancel) setActive(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (!active) return null;

  const handleDisable = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await sandboxApi.disable();
      // Hard reload so React Query, Zustand stores, and route loaders all
      // re-fetch from the production DB.
      window.location.reload();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-4 border-b border-amber-300/70 bg-amber-100 px-4 py-2 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      data-testid="sandbox-banner"
      role="status"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="text-sm font-medium">
          {t('settings:sections.sandbox.bannerMessage', {
            defaultValue: 'Mode Demo aktif — perubahan tidak menyentuh data asli.',
          })}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDisable}
        disabled={busy}
        data-testid="sandbox-banner-disable"
        className="border-amber-400 bg-white/40 text-amber-900 hover:bg-white/70 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100"
      >
        {t('settings:sections.sandbox.disable', { defaultValue: 'Kembali ke Mode Asli' })}
      </Button>
    </div>
  );
}
