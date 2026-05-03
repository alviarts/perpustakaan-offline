import type { SessionUser } from '@/stores/authStore';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface LoginPayload {
  user: SessionUser;
  token: string | null;
}

interface LoginArgs {
  username: string;
  password: string;
  rememberMe: boolean;
}

export async function loginRequest(args: LoginArgs): Promise<LoginPayload> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<LoginPayload>('auth_login', { ...args });
  }
  return mockLogin(args);
}

export async function logoutRequest(): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('auth_logout');
    return;
  }
}

export async function tryAutoLogin(): Promise<SessionUser | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SessionUser | null>('auth_login_with_token');
  }
  return null;
}

function mockLogin({ username, password }: LoginArgs): Promise<LoginPayload> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        resolve({
          user: {
            id: 1,
            username: 'admin',
            fullName: 'Administrator',
            role: 'admin',
          },
          token: null,
        });
      } else {
        reject(new Error('invalid_credentials'));
      }
    }, 250);
  });
}
