export type Role = 'admin' | 'pustakawan' | 'siswa';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

export interface AppErrorPayload {
  code: string;
  message: string;
}

export const APP_NAME = 'Perpustakaan Nusantara' as const;
