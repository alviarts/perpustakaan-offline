import { describe, expect, it } from 'vitest';
import { getSecurityQuestion, loginRequest, resetViaSecurityQuestion } from '@/lib/auth';

describe('loginRequest (mock fallback)', () => {
  it('resolves with admin user for valid default credentials', async () => {
    const result = await loginRequest({
      username: 'admin',
      password: 'admin123',
      rememberMe: false,
    });
    expect(result.user.username).toBe('admin');
    expect(result.user.role).toBe('admin');
    expect(result.token).toBeNull();
  });

  it('rejects with invalid_credentials for wrong password', async () => {
    await expect(
      loginRequest({ username: 'admin', password: 'wrong', rememberMe: false }),
    ).rejects.toThrow('invalid_credentials');
  });

  it('rejects with invalid_credentials for unknown user', async () => {
    await expect(
      loginRequest({ username: 'ghost', password: 'admin123', rememberMe: false }),
    ).rejects.toThrow('invalid_credentials');
  });
});

describe('forgot-password mock fallback', () => {
  it('returns the seeded question for the default admin', async () => {
    const q = await getSecurityQuestion('admin');
    expect(q).toMatch(/hewan peliharaan/i);
  });

  it('returns null for an unknown username', async () => {
    expect(await getSecurityQuestion('ghost')).toBeNull();
  });

  it('rejects with invalid_credentials when answer mismatches', async () => {
    await expect(
      resetViaSecurityQuestion({
        username: 'admin',
        answer: 'wrong',
        newPassword: 'newpass',
      }),
    ).rejects.toThrow('invalid_credentials');
  });

  it('rejects when password is too short', async () => {
    await expect(
      resetViaSecurityQuestion({
        username: 'admin',
        answer: 'kucing',
        newPassword: 'abc',
      }),
    ).rejects.toThrow('validation');
  });

  it('resolves on a correct answer + valid password', async () => {
    await expect(
      resetViaSecurityQuestion({
        username: 'admin',
        answer: '  KUCING ',
        newPassword: 'pass1234',
      }),
    ).resolves.toBeUndefined();
  });
});
