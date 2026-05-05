import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

export interface UserProfile {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  fotoPath: string | null;
  tanggalLahir: string | null;
  tempatLahir: string | null;
  telepon: string | null;
  email: string | null;
  alamat: string | null;
  jenisKelamin: 'L' | 'P' | null;
  agama: string | null;
}

export interface UserProfileInput {
  fullName: string;
  fotoPath: string | null;
  tanggalLahir: string | null;
  tempatLahir: string | null;
  telepon: string | null;
  email: string | null;
  alamat: string | null;
  jenisKelamin: 'L' | 'P' | null;
  agama: string | null;
}

interface RawUserProfile {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  foto_path: string | null;
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  telepon: string | null;
  email: string | null;
  alamat: string | null;
  jenis_kelamin: 'L' | 'P' | null;
  agama: string | null;
}

function toCamel(raw: RawUserProfile): UserProfile {
  return {
    userId: raw.user_id,
    username: raw.username,
    fullName: raw.full_name,
    role: raw.role,
    fotoPath: raw.foto_path,
    tanggalLahir: raw.tanggal_lahir,
    tempatLahir: raw.tempat_lahir,
    telepon: raw.telepon,
    email: raw.email,
    alamat: raw.alamat,
    jenisKelamin: raw.jenis_kelamin,
    agama: raw.agama,
  };
}

export interface UserProfileApi {
  get(userId: number): Promise<UserProfile>;
  update(userId: number, payload: UserProfileInput): Promise<UserProfile>;
}

const tauriApi: UserProfileApi = {
  async get(userId) {
    const raw = await invoke<RawUserProfile>('user_profile_get', { userId });
    return toCamel(raw);
  },
  async update(userId, payload) {
    const raw = await invoke<RawUserProfile>('user_profile_update', {
      userId,
      payload,
    });
    return toCamel(raw);
  },
};

const browserStore = new Map<number, UserProfile>();

const browserApi: UserProfileApi = {
  async get(userId) {
    return (
      browserStore.get(userId) ?? {
        userId,
        username: 'admin',
        fullName: 'Administrator',
        role: 'admin',
        fotoPath: null,
        tanggalLahir: null,
        tempatLahir: null,
        telepon: null,
        email: null,
        alamat: null,
        jenisKelamin: null,
        agama: null,
      }
    );
  },
  async update(userId, payload) {
    const next: UserProfile = {
      ...(await browserApi.get(userId)),
      ...payload,
    };
    browserStore.set(userId, next);
    return next;
  },
};

export const userProfileApi: UserProfileApi = isTauri() ? tauriApi : browserApi;
