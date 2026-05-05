/**
 * Tauri command error formatter.
 *
 * Tauri's `invoke()` rejects with whatever the Rust side returned via
 * `serde_json`, NOT with an `Error` instance. Our backend serialises
 * `AppError` as a `{ code, message }` struct (see `error.rs`), so the
 * happy path is to surface `message` verbatim. Earlier revisions used
 * the externally-tagged enum shape `{ "Validation": "..." }` and a few
 * legacy callers may still pass that — both are handled.
 *
 * Without this normalisation users saw the raw JSON in toasts (BUG-002
 * and BUG-10 in the v1.0.7 batch), e.g.
 * `{"code":"validation","message":"melebihi maksimal 2 buku ..."}`.
 */

const APP_ERROR_KEYS = ['Validation', 'NotFound', 'Conflict', 'Internal'] as const;

export type AppErrorKey = (typeof APP_ERROR_KEYS)[number];

export type TauriAppError = { [K in AppErrorKey]?: string };

/** Strip `validation: ` / `not found: ` etc. that older Display-based
 *  serialisations leaked into the message. Keep stripping idempotent so
 *  the new `{code,message}` shape (which already has a clean message) is
 *  unaffected. */
function stripLegacyPrefix(msg: string): string {
  return msg.replace(/^(validation|not found|internal|conflict):\s*/i, '');
}

export function formatTauriError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return stripLegacyPrefix(err);
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;

    // New shape: `{ code, message }` from `AppError::serialize`.
    if (typeof record.message === 'string' && typeof record.code === 'string') {
      return stripLegacyPrefix(record.message);
    }

    // Legacy externally-tagged shape: `{ Validation: "..." }`.
    for (const key of APP_ERROR_KEYS) {
      const v = record[key];
      if (typeof v === 'string') return stripLegacyPrefix(v);
    }

    // Last resort: show the JSON instead of `[object Object]`.
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
