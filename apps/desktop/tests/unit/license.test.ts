import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLicenseState,
  readLicenseState,
  trialDaysLeft,
  trialEndsAt,
  trialEverStarted,
  trialStart,
  verifyLicenseCode,
} from '@/lib/license';

// Kode nyata dari codes.csv (PU-0001). Verifikasi memakai public key yang
// ditanam di app, jadi test ini memastikan signature & payload cocok.
const VALID_CODE =
  'PU1.eyJ2IjoxLCJpIjoiUFUtMDAwMSIsIm0iOjIsImUiOiIyMDI3LTEyLTMxIn0.dZH7ND7u6f_rObY3Ck07Ldcik5qSE17Z4XQCGys3i5brUBbbnPfdLSafXoz51_ngu8Bvo7MzbuGpVieK7rbHCQ';

const LS_STATE = 'perpustakaan.license.v1';
const LS_TRIAL_START = 'perpustakaan.trial.start';
const LS_TRIAL_USED = 'perpustakaan.trial.used';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('trialDaysLeft / trialStart', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts a fresh 30-day trial on first read', () => {
    const start = trialStart();
    expect(start.getTime()).toBeCloseTo(Date.now(), -3);
    expect(trialDaysLeft()).toBe(30);
  });

  it('keeps the same start date across reads (no reset)', () => {
    const first = trialStart().toISOString();
    expect(trialStart().toISOString()).toBe(first);
  });

  it('counts down elapsed days', () => {
    window.localStorage.setItem(LS_TRIAL_START, daysAgoIso(10));
    expect(trialDaysLeft()).toBe(20);
  });

  it('clamps at 0 once the trial window has passed', () => {
    window.localStorage.setItem(LS_TRIAL_START, daysAgoIso(31));
    expect(trialDaysLeft()).toBe(0);
  });
});

describe('readLicenseState (state machine)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns trial while no license is saved', () => {
    expect(readLicenseState().status).toBe('trial');
  });

  it('returns terkunci when the trial has expired', () => {
    window.localStorage.setItem(LS_TRIAL_START, daysAgoIso(31));
    expect(readLicenseState().status).toBe('terkunci');
  });

  it('returns aktif for a saved, not-yet-expired license', () => {
    window.localStorage.setItem(
      LS_STATE,
      JSON.stringify({ status: 'aktif', licenseId: 'PU-0001', expires: '2099-12-31' }),
    );
    expect(readLicenseState().status).toBe('aktif');
  });

  it('returns kedaluwarsa when the saved license expiry has passed', () => {
    window.localStorage.setItem(
      LS_STATE,
      JSON.stringify({ status: 'aktif', licenseId: 'PU-0001', expires: '2020-01-01' }),
    );
    const state = readLicenseState();
    expect(state.status).toBe('kedaluwarsa');
    expect(state.expires).toBe('2020-01-01');
  });

  it('keeps a saved locked/expired state locked (no trial fallback)', () => {
    window.localStorage.setItem(LS_STATE, JSON.stringify({ status: 'terkunci' }));
    expect(readLicenseState().status).toBe('terkunci');
    window.localStorage.setItem(LS_STATE, JSON.stringify({ status: 'kedaluwarsa' }));
    expect(readLicenseState().status).toBe('kedaluwarsa');
  });

  it('does not restart the trial when trial.start is deleted', () => {
    trialStart();
    expect(trialEverStarted()).toBe(true);
    window.localStorage.removeItem(LS_TRIAL_START);
    expect(readLicenseState().status).toBe('terkunci');
    expect(window.localStorage.getItem(LS_TRIAL_START)).toBeNull();
  });

  it('does not restart the trial after clearLicenseState on an expired device', () => {
    window.localStorage.setItem(LS_TRIAL_START, daysAgoIso(31));
    expect(readLicenseState().status).toBe('terkunci');
    clearLicenseState();
    expect(readLicenseState().status).toBe('terkunci');
  });
});

describe('trialEndsAt', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns start date plus 30 days', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    window.localStorage.setItem(LS_TRIAL_START, start.toISOString());
    window.localStorage.setItem(LS_TRIAL_USED, '1');
    const end = trialEndsAt();
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(diffDays).toBe(30);
  });
});

describe('verifyLicenseCode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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
