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

export * from './jenjang';
export * from './akreditasi';
export type {
  Instrumen,
  InstrumenButir,
  InstrumenKomponen,
  InstrumenOpsi,
  InstrumenJawaban,
} from './instrumen';
