import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@/lib/auth';
import { assetsApi } from '@/lib/assets';
import { userProfileApi } from '@/lib/userProfile';

/**
 * Resolve the signed-in operator's avatar to a renderable data URL. Returns
 * `null` when the user has no portrait set, or when running in browser-mode
 * dev where we cannot read local files.
 *
 * Re-fetches whenever the `users:profile-changed` Tauri event fires (emitted
 * by the profile dialog after a successful save) so the header avatar
 * updates without a full page reload.
 */
export function useUserAvatar(userId: number | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (userId == null) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    async function refresh(): Promise<void> {
      try {
        if (userId == null) return;
        const profile = await userProfileApi.get(userId);
        if (cancelled) return;
        if (!profile.fotoPath) {
          setUrl(null);
          return;
        }
        const data = await assetsApi.readDataUrl(profile.fotoPath);
        if (cancelled) return;
        setUrl(data || null);
      } catch {
        // Quietly fall back to the initial — the header should never crash
        // because of a missing avatar.
        if (!cancelled) setUrl(null);
      }
    }

    void refresh();

    if (isTauri()) {
      void listen<unknown>('users:profile-changed', () => {
        void refresh();
      }).then((u) => {
        if (cancelled) {
          u();
        } else {
          unlisten = u;
        }
      });
    }

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [userId]);

  return url;
}
