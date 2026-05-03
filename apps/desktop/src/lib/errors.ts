/**
 * Tauri command error formatter.
 *
 * Tauri's `invoke()` rejects with whatever the Rust side returned via
 * `serde_json`, NOT with an `Error` instance. Our backend returns
 * `AppError` which serializes as an externally-tagged enum object such as
 * `{ "Validation": "tidak ada eksemplar tersedia ..." }`. The naive fallback
 * `String(err)` on that object yields the literal string `"[object Object]"`,
 * which is what users were seeing in toasts (BUG-002).
 *
 * `formatTauriError` extracts the human-readable message from the known
 * variants while still gracefully handling plain `Error` instances and
 * strings (used by frontend-only paths like the import dialogs).
 */

const APP_ERROR_KEYS = ['Validation', 'NotFound', 'Conflict', 'Internal'] as const;

export type AppErrorKey = (typeof APP_ERROR_KEYS)[number];

export type TauriAppError = { [K in AppErrorKey]?: string };

export function formatTauriError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    for (const key of APP_ERROR_KEYS) {
      const v = record[key];
      if (typeof v === 'string') return v;
    }
    // Fall back to JSON serialization so at least the user sees the shape
    // instead of `[object Object]`.
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
