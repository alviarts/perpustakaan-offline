import { describe, expect, it } from 'vitest';
import { classifyScannerError } from '@/features/sirkulasi/useBarcodeScanner';

/**
 * Match the categorisation that drives the structured error panel in
 * `SirkulasiPage`. The webcam scanner page renders different recovery
 * hints (retry button, reload button, instructions) based on these
 * tags, so misclassifying one would silently regress the UX.
 */
describe('classifyScannerError', () => {
  it('maps NotAllowedError to permission', () => {
    const e = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    expect(classifyScannerError(e)).toBe('permission');
  });

  it('maps the legacy PermissionDeniedError name to permission', () => {
    const e = Object.assign(new Error('denied'), { name: 'PermissionDeniedError' });
    expect(classifyScannerError(e)).toBe('permission');
  });

  it('maps SecurityError (insecure context) to permission', () => {
    const e = Object.assign(new Error('insecure'), { name: 'SecurityError' });
    expect(classifyScannerError(e)).toBe('permission');
  });

  it('maps NotFoundError to no-device', () => {
    const e = Object.assign(new Error('no cam'), { name: 'NotFoundError' });
    expect(classifyScannerError(e)).toBe('no-device');
  });

  it('maps OverconstrainedError to no-device', () => {
    const e = Object.assign(new Error('constraint'), { name: 'OverconstrainedError' });
    expect(classifyScannerError(e)).toBe('no-device');
  });

  it('maps NotReadableError (camera busy) to in-use', () => {
    const e = Object.assign(new Error('busy'), { name: 'NotReadableError' });
    expect(classifyScannerError(e)).toBe('in-use');
  });

  it('maps TrackStartError to in-use', () => {
    const e = Object.assign(new Error('busy'), { name: 'TrackStartError' });
    expect(classifyScannerError(e)).toBe('in-use');
  });

  it('falls back to other for unknown DOMException names', () => {
    const e = Object.assign(new Error('mystery'), { name: 'WeirdError' });
    expect(classifyScannerError(e)).toBe('other');
  });

  it('treats unmarked errors mentioning getUserMedia as unsupported', () => {
    expect(classifyScannerError(new Error('navigator.getUserMedia missing'))).toBe(
      'unsupported',
    );
  });

  it('handles non-error inputs without crashing', () => {
    expect(classifyScannerError(undefined)).toBe('other');
    expect(classifyScannerError(null)).toBe('other');
    expect(classifyScannerError('string error')).toBe('other');
  });
});
