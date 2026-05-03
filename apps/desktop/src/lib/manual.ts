/**
 * Manual book opener (revisi #4).
 *
 * - In Tauri builds: invokes the Rust `open_manual` command which spawns a
 *   dedicated webview window pointing at the bundled `/manual/index.html`.
 * - In the browser fallback (`pnpm dev`, `vitest`, Playwright): opens the same
 *   URL in a new browser tab.
 *
 * After opening, posts the current library identity to the manual window so it
 * can render the perpustakaan name in its header (revisi #11 cross-cut).
 */
import { isTauri } from '@/lib/auth';
import type { LibraryIdentity } from '@/stores/identityStore';

const MANUAL_URL = '/manual/index.html';

export async function openManual(identity?: LibraryIdentity): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_manual');
    return;
  }
  const win = window.open(MANUAL_URL, '_blank', 'noopener,noreferrer');
  if (win && identity?.nama) {
    setTimeout(() => {
      try {
        win.postMessage({ type: 'po:identity', nama: identity.nama }, '*');
      } catch {
        // Ignore — manual window may be on a different origin.
      }
    }, 500);
  }
}
