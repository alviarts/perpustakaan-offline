import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpacHomePage } from './OpacHomePage';
import { OpacSearchPage } from './OpacSearchPage';
import { OpacAdminUnlockButton } from './OpacAdminUnlockButton';
import { OpacKtaScanFlow } from './OpacKtaScanFlow';
import { useOpacIdleReset } from './useOpacIdleReset';
import { settingsApi } from '@/lib/settings';
import { loginRequest, isTauri } from '@/lib/auth';
import { useToast } from '@/components/ui/toast-manager';

type View = { kind: 'home' } | { kind: 'search'; query: string };

export interface OpacAppProps {
  /** Optional override for testing or for callers that need to inject a custom verifier. */
  verifyAdmin?: (username: string, password: string) => Promise<boolean>;
  /** Optional override for testing the reload after admin unlock. */
  onUnlockSuccess?: () => void | Promise<void>;
  /** Optional library identity name to render in header. */
  libraryName?: string;
}

const defaultVerifyAdmin = async (username: string, password: string): Promise<boolean> => {
  try {
    await loginRequest({ username, password, rememberMe: false });
    return true;
  } catch {
    return false;
  }
};

const defaultUnlockSuccess = async (): Promise<void> => {
  await settingsApi.saveAppMode('admin');
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

export function OpacApp({
  verifyAdmin = defaultVerifyAdmin,
  onUnlockSuccess = defaultUnlockSuccess,
  libraryName,
}: OpacAppProps = {}): JSX.Element {
  const { t } = useTranslation('opac');
  const { showToast } = useToast();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [scanOpen, setScanOpen] = useState(false);

  const goHome = useCallback(() => setView({ kind: 'home' }), []);

  useOpacIdleReset(() => {
    setScanOpen(false);
    setView({ kind: 'home' });
  });

  useEffect(() => {
    if (!isTauri() || typeof window === 'undefined') return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const win = await import('@tauri-apps/api/window');
        const current = win.getCurrentWindow();
        await current.setFullscreen(true);
        await current.setDecorations(false);
        await current.setAlwaysOnTop(true);
      } catch {
        if (!cancelled) {
          showToast({
            variant: 'destructive',
            title: t('kiosk.fullscreenError'),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F11' || (e.altKey && e.key === 'F4')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <div className="relative h-full w-full bg-background" data-testid="opac-app">
      {view.kind === 'home' ? (
        <OpacHomePage
          libraryName={libraryName}
          onSearch={(q) => setView({ kind: 'search', query: q })}
          onScanKta={() => setScanOpen(true)}
        />
      ) : (
        <OpacSearchPage initialQuery={view.query} onBack={goHome} />
      )}
      <OpacKtaScanFlow open={scanOpen} onOpenChange={setScanOpen} />
      <OpacAdminUnlockButton
        onVerify={verifyAdmin}
        onSuccess={() => {
          void onUnlockSuccess();
        }}
      />
    </div>
  );
}
