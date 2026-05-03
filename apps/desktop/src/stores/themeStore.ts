import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  resolve: () => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolved: getSystemTheme(),
      setTheme: (theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved);
        set({ theme, resolved });
      },
      resolve: () => {
        const { theme } = get();
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved);
        set({ resolved });
      },
    }),
    { name: 'po:theme' },
  ),
);

if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    const { theme, resolve } = useThemeStore.getState();
    if (theme === 'system') resolve();
  });
}
