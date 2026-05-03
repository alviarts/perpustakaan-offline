import { describe, expect, it, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    useThemeStore.setState({ theme: 'system', resolved: 'light' });
  });

  it('applies dark class when setting theme=dark', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('removes dark class when setting theme=light', () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('persists theme value', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
