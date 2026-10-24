import { describe, expect, it } from 'vitest';
import { verifyLicenseCode } from '@/lib/license';

// Kode nyata dari codes.csv (PU-0001). Verifikasi memakai public key yang
// ditanam di app, jadi test ini memastikan signature & payload cocok.
const VALID_CODE =
  'PU1.eyJ2IjoxLCJpIjoiUFUtMDAwMSIsIm0iOjIsImUiOiIyMDI3LTEyLTMxIn0.dZH7ND7u6f_rObY3Ck07Ldcik5qSE17Z4XQCGys3i5brUBbbnPfdLSafXoz51_ngu8Bvo7MzbuGpVieK7rbHCQ';

describe('verifyLicenseCode', () => {
  it('accepts a genuine code and returns its payload', async () => {
    const payload = await verifyLicenseCode(VALID_CODE);
    expect(payload.i).toBe('PU-0001');
    expect(payload.m).toBe(2);
    expect(payload.e).toBe('2027-12-31');
  });

  it('rejects a tampered code', async () => {
    const tampered = `${VALID_CODE.slice(0, -3)}AAA`;
    await expect(verifyLicenseCode(tampered)).rejects.toThrow();
  });

  it('rejects malformed input', async () => {
    await expect(verifyLicenseCode('bukan-kode')).rejects.toThrow(/tidak dikenal/i);
  });
});
