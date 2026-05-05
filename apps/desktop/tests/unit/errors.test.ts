import { describe, expect, it } from 'vitest';
import { formatTauriError } from '@/lib/errors';

describe('formatTauriError', () => {
  it('extracts the message from AppError::Validation', () => {
    expect(formatTauriError({ Validation: 'kode_buku required' })).toBe(
      'kode_buku required',
    );
  });

  it('extracts the message from AppError::NotFound', () => {
    expect(formatTauriError({ NotFound: 'buku id=42' })).toBe('buku id=42');
  });

  it('extracts the message from AppError::Conflict', () => {
    expect(formatTauriError({ Conflict: 'kode_buku sudah dipakai' })).toBe(
      'kode_buku sudah dipakai',
    );
  });

  it('extracts the message from AppError::Internal', () => {
    expect(formatTauriError({ Internal: 'db locked' })).toBe('db locked');
  });

  it('passes through Error instances', () => {
    expect(formatTauriError(new Error('boom'))).toBe('boom');
  });

  it('passes through plain strings', () => {
    expect(formatTauriError('upload failed')).toBe('upload failed');
  });

  it('falls back to JSON.stringify for unknown object shapes', () => {
    expect(formatTauriError({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatTauriError(null)).toBe('null');
    expect(formatTauriError(undefined)).toBe('undefined');
  });

  it('handles numeric and boolean primitives', () => {
    expect(formatTauriError(42)).toBe('42');
    expect(formatTauriError(false)).toBe('false');
  });

  it('never returns "[object Object]" for AppError-shaped objects', () => {
    // Regression guard for BUG-002: the toast description was rendering
    // "[object Object]" because String({ Validation: '...' }) === '[object Object]'.
    expect(formatTauriError({ Validation: 'x' })).not.toBe('[object Object]');
  });

  it('prioritises Validation over Internal when both are set', () => {
    // Defensive: if the backend ever serialises into a multi-key shape, we
    // still surface the user-actionable message rather than the internal one.
    const v = formatTauriError({ Validation: 'expected', Internal: 'leak' });
    expect(v).toBe('expected');
  });

  // BUG-10 in the v1.0.7 batch: the Rust backend serialises `AppError` via
  // `error.rs` as `{ code, message }` (NOT the externally-tagged enum shape),
  // so the formatter must accept the modern shape too — otherwise toasts
  // surfaced the raw JSON to the user.

  it('extracts message from the {code,message} struct shape', () => {
    expect(
      formatTauriError({
        code: 'validation',
        message: 'melebihi maksimal 3 buku per anggota (saat ini 2)',
      }),
    ).toBe('melebihi maksimal 3 buku per anggota (saat ini 2)');
  });

  it('strips a legacy "validation: " Display prefix from the message', () => {
    // Older builds serialised via Display, leaking the `validation: ` prefix
    // into the message. Be tolerant of that mid-flight upgrade.
    expect(
      formatTauriError({
        code: 'validation',
        message: 'validation: kode_buku required',
      }),
    ).toBe('kode_buku required');
  });

  it('strips the legacy prefix from externally-tagged variants too', () => {
    expect(formatTauriError({ Validation: 'validation: x' })).toBe('x');
  });

  it('does not mistake an arbitrary {message} object for an AppError', () => {
    // Without `code`, the new branch must not fire.
    expect(formatTauriError({ message: 'boom' })).toBe('{"message":"boom"}');
  });
});
