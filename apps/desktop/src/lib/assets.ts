import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@/lib/auth';

/**
 * Asset upload categories. Each maps to a subdirectory under
 * `<app_data_dir>/uploads/` on the Rust side; the literal value is
 * validated by `validate_category` in `commands/assets.rs`, so adding a
 * new category here also requires bumping the allow-list there.
 */
export type AssetCategory = 'anggota' | 'buku' | 'identitas';

/** Image extensions accepted by the Tauri file dialog and the backend. */
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'] as const;

export interface AssetSaveResult {
  /** Path stored in DB, relative to `app_data_dir`. Always uses `/`. */
  relPath: string;
  /** Absolute path on disk for the saved file (preview-render shortcut). */
  absPath: string;
}

export interface AssetsRpc {
  /**
   * Pop the OS file picker (image filter), copy the chosen file under
   * `<app_data_dir>/uploads/<category>/`, and return the path stored in
   * DB plus the absolute path so the caller can render a preview without
   * a follow-up `resolve` round-trip.
   *
   * Resolves to `null` when the user dismisses the dialog.
   */
  pickAndSave(category: AssetCategory): Promise<AssetSaveResult | null>;

  /**
   * Turn a path stored in DB (typically relative under `uploads/`) back
   * into an absolute filesystem path. Pass-through for legacy v1 entries
   * that are already absolute.
   */
  resolve(path: string): Promise<string>;

  /** Best-effort delete of an upload. No-op for absolute / empty paths. */
  delete(path: string): Promise<void>;
}

const tauriRpc: AssetsRpc = {
  async pickAndSave(category) {
    const picked = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: 'Image', extensions: [...IMAGE_EXTS] }],
    });
    if (!picked || Array.isArray(picked)) return null;
    const result = await invoke<{ relPath: string; absPath: string }>('assets_save', {
      category,
      srcPath: picked,
    });
    return { relPath: result.relPath, absPath: result.absPath };
  },
  resolve: (path) => invoke<string>('assets_resolve', { relPath: path }),
  delete: (path) => invoke<void>('assets_delete', { relPath: path }),
};

/**
 * Browser-mode mock. Persists the picked path in-memory only; preview
 * rendering falls back to a placeholder icon since we cannot read local
 * files outside the Tauri host. The shape mirrors `tauriRpc` so callers
 * never need to branch on `isTauri()` themselves.
 */
const mockRpc: AssetsRpc = {
  async pickAndSave(category) {
    const stamp = Date.now();
    return {
      relPath: `uploads/${category}/mock-${stamp}.png`,
      absPath: `mock://uploads/${category}/mock-${stamp}.png`,
    };
  },
  async resolve(path) {
    if (!path) return '';
    return path;
  },
  async delete() {
    /* noop */
  },
};

export const assetsApi: AssetsRpc = isTauri() ? tauriRpc : mockRpc;
