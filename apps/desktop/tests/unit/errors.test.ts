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
});
