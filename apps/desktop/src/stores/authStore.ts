import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'pustakawan' | 'siswa';
}

interface AuthState {
  user: SessionUser | null;
  rememberMe: boolean;
  isAuthenticated: () => boolean;
  setUser: (user: SessionUser | null) => void;
  setRememberMe: (remember: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      rememberMe: false,
      isAuthenticated: () => get().user !== null,
      setUser: (user) => set({ user }),
      setRememberMe: (rememberMe) => set({ rememberMe }),
      logout: () => set({ user: null, rememberMe: false }),
    }),
    { name: 'po:auth' },
  ),
);
