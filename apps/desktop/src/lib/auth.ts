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

// ---------------------------------------------------------------------------
// Forgot-password flow (PR-5).
//
// All three calls have a Tauri impl that invokes the Rust command and a mock
// impl for browser-mode dev so the UI can be exercised without a backend.
// The mock state is held in `module-local memory` so it resets on reload.
// ---------------------------------------------------------------------------

interface MockSecurityRecord {
  question: string;
  answer: string;
  password: string;
}

const MOCK_SECURITY_DB: Record<string, MockSecurityRecord> = {
  admin: { question: 'Nama hewan peliharaan pertama?', answer: 'kucing', password: 'admin123' },
};

export async function getSecurityQuestion(username: string): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('auth_get_security_question', { username });
  }
  const rec = MOCK_SECURITY_DB[username];
  return rec ? rec.question : null;
}

export async function resetViaSecurityQuestion(args: {
  username: string;
  answer: string;
  newPassword: string;
}): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('auth_reset_via_security_question', args);
    return;
  }
  const rec = MOCK_SECURITY_DB[args.username];
  if (!rec) throw new Error('invalid_credentials');
  if (rec.answer.toLowerCase().trim() !== args.answer.toLowerCase().trim()) {
    throw new Error('invalid_credentials');
  }
  if (args.newPassword.trim().length < 6) {
    throw new Error('validation');
  }
  rec.password = args.newPassword;
}

export async function setSecurityQuestion(args: {
  userId: number;
  question: string;
  answer: string;
}): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('auth_set_security_question', args);
    return;
  }
  // Mock just no-ops; in browser-mode the Akun page settings aren't the
  // primary surface being exercised.
}
