import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpacHomePage } from './OpacHomePage';
import { OpacSearchPage } from './OpacSearchPage';
import { OpacAdminUnlockButton } from './OpacAdminUnlockButton';
import { OpacKtaScanFlow } from './OpacKtaScanFlow';
import { OpacMemberProfile } from './OpacMemberProfile';
import { useOpacIdleReset } from './useOpacIdleReset';
import { settingsApi } from '@/lib/settings';
import { loginRequest, isTauri } from '@/lib/auth';
import { useToast } from '@/components/ui/toast-manager';
import { kunjunganApi } from '@/lib/kunjungan';
import { reservasiApi } from '@/lib/reservasi';
import { formatTauriError } from '@/lib/errors';
import type { Anggota } from '@/lib/anggota';
import type { Buku } from '@/lib/buku';

type View = { kind: 'home' } | { kind: 'profile' } | { kind: 'search'; query: string };

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

const KUNJUNGAN_THROTTLE_MS = 5 * 60 * 1000;
const KUNJUNGAN_THROTTLE_KEY = 'po:opac-kunjungan-last';

interface KunjunganThrottleEntry {
  anggotaId: number;
  ts: number;
}

function readLastKunjungan(anggotaId: number): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KUNJUNGAN_THROTTLE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as KunjunganThrottleEntry[];
    if (!Array.isArray(list)) return null;
    const hit = list.find((e) => e?.anggotaId === anggotaId);
    return hit?.ts ?? null;
  } catch {
    return null;
  }
}

function writeLastKunjungan(anggotaId: number): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(KUNJUNGAN_THROTTLE_KEY);
    const list: KunjunganThrottleEntry[] = raw ? (JSON.parse(raw) as KunjunganThrottleEntry[]) : [];
    const cutoff = Date.now() - KUNJUNGAN_THROTTLE_MS * 12; // 1h history is plenty
    const fresh = (Array.isArray(list) ? list : []).filter(
      (e) => e?.anggotaId !== anggotaId && typeof e?.ts === 'number' && e.ts >= cutoff,
    );
    fresh.push({ anggotaId, ts: Date.now() });
    window.localStorage.setItem(KUNJUNGAN_THROTTLE_KEY, JSON.stringify(fresh));
  } catch {
    // localStorage may be unavailable — silently ignore
  }
}

export function OpacApp({
  verifyAdmin = defaultVerifyAdmin,
  onUnlockSuccess = defaultUnlockSuccess,
  libraryName,
}: OpacAppProps = {}): JSX.Element {
  const { t } = useTranslation('opac');
  const { showToast } = useToast();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [scanOpen, setScanOpen] = useState(false);
  const [member, setMember] = useState<Anggota | null>(null);

  const goHome = useCallback(() => {
    setView(member ? { kind: 'profile' } : { kind: 'home' });
  }, [member]);

  useOpacIdleReset(() => {
    setScanOpen(false);
    setMember(null);
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

  const handleMemberAuthenticated = useCallback(
    (m: Anggota): void => {
      setMember(m);
      setView({ kind: 'profile' });
      // Sub-feature B — auto absen kehadiran. Throttle so a member who
      // re-scans within 5 minutes does not produce duplicate kunjungan
      // rows; show a "welcome back" toast instead.
      const last = readLastKunjungan(m.id);
      const now = Date.now();
      if (last !== null && now - last < KUNJUNGAN_THROTTLE_MS) {
        showToast({
          title: t('session.welcomeBack', { nama: m.nama }),
        });
        return;
      }
      writeLastKunjungan(m.id);
      void (async (): Promise<void> => {
        try {
          await kunjunganApi.create({ anggotaId: m.id, sumber: 'manual' });
          showToast({
            title: t('session.kehadiranTercatat'),
            description: m.nama,
          });
        } catch (err) {
          // Non-fatal: still let the member browse, just surface the
          // error so the operator can investigate.
          showToast({
            variant: 'destructive',
            title: t('session.kehadiranFail'),
            description: formatTauriError(err),
          });
        }
      })();
    },
    [showToast, t],
  );

  const handleLogout = useCallback((): void => {
    setMember(null);
    setView({ kind: 'home' });
  }, []);

  const handleReserveBook = useCallback(
    async (buku: Buku): Promise<void> => {
      if (!member) {
        showToast({
          variant: 'destructive',
          title: t('reservasi.loginFirst'),
        });
        return;
      }
      try {
        const created = await reservasiApi.create({
          anggotaId: member.id,
          bukuId: buku.id,
        });
        showToast({
          title: t('reservasi.created'),
          description: t('reservasi.queueDescription', {
            judul: buku.judul,
            urutan: created.urutan,
          }),
        });
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('reservasi.createFail'),
          description: formatTauriError(err),
        });
      }
    },
    [member, showToast, t],
  );

  return (
    <div className="relative h-full w-full bg-background" data-testid="opac-app">
      {view.kind === 'profile' && member ? (
        <OpacMemberProfile
          member={member}
          onLogout={handleLogout}
          onSearchBooks={() => setView({ kind: 'search', query: '' })}
        />
      ) : view.kind === 'search' ? (
        <OpacSearchPage
          initialQuery={view.query}
          onBack={goHome}
          member={member}
          onReserve={(b) => {
            void handleReserveBook(b);
          }}
        />
      ) : (
        <OpacHomePage
          libraryName={libraryName}
          onSearch={(q) => setView({ kind: 'search', query: q })}
          onScanKta={() => setScanOpen(true)}
          member={member}
          onReserve={(b) => {
            void handleReserveBook(b);
          }}
        />
      )}
      <OpacKtaScanFlow
        open={scanOpen}
        onOpenChange={setScanOpen}
        onMemberAuthenticated={handleMemberAuthenticated}
      />
      <OpacAdminUnlockButton
        onVerify={verifyAdmin}
        onSuccess={() => {
          void onUnlockSuccess();
        }}
      />
    </div>
  );
}
