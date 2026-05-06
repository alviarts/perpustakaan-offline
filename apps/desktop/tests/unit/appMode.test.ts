import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_MODE,
  APP_MODE_KEY,
  settingsApi,
  type AppMode,
} from '@/lib/settings';

describe('settingsApi.appMode (browser mock — FEAT-27)', () => {
  beforeEach(() => {
    settingsApi.__resetMock?.();
    window.localStorage.clear();
  });

  afterEach(() => {
    settingsApi.__resetMock?.();
    window.localStorage.clear();
  });

  it('exposes the canonical setting key', () => {
    expect(APP_MODE_KEY).toBe('desktop.app_mode');
  });

  it('defaults to admin when no value is persisted yet', async () => {
    expect(DEFAULT_APP_MODE).toBe('admin');
    const got = await settingsApi.getAppMode();
    expect(got).toBe('admin');
  });

  it('persists public mode through a save → get round trip', async () => {
    const saved = await settingsApi.saveAppMode('public');
    expect(saved).toBe('public');
    const got = await settingsApi.getAppMode();
    expect(got).toBe('public');
  });

  it('persists admin mode after toggling back from public', async () => {
    await settingsApi.saveAppMode('public');
    await settingsApi.saveAppMode('admin');
    const got = await settingsApi.getAppMode();
    expect(got).toBe('admin');
  });

  it.each<['admin' | 'public']>([['admin'], ['public']])(
    'survives independent reads after %s persist',
    async (mode: AppMode) => {
      await settingsApi.saveAppMode(mode);
      const a = await settingsApi.getAppMode();
      const b = await settingsApi.getAppMode();
      expect(a).toBe(mode);
      expect(b).toBe(mode);
    },
  );
});
