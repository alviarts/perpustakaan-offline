import { describe, expect, it } from 'vitest';
import { loginRequest } from '@/lib/auth';

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
