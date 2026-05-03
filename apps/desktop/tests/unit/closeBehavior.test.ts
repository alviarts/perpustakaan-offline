import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOSE_BEHAVIOR,
  settingsApi,
  type CloseBehavior,
} from '@/lib/settings';

describe('settingsApi.closeBehavior (browser mock — BUG-011)', () => {
  beforeEach(() => {
    settingsApi.__resetMock?.();
    window.localStorage.clear();
  });

  afterEach(() => {
    settingsApi.__resetMock?.();
    window.localStorage.clear();
  });

  it('defaults to "exit" before any value is saved', async () => {
    expect(DEFAULT_CLOSE_BEHAVIOR).toBe('exit');
    const got = await settingsApi.getCloseBehavior();
    expect(got).toBe('exit');
  });

  it('persists "tray" through save → get round trip', async () => {
    const saved = await settingsApi.saveCloseBehavior('tray');
    expect(saved).toBe('tray');
    const got = await settingsApi.getCloseBehavior();
    expect(got).toBe('tray');
  });

  it('persists "exit" through save → get round trip', async () => {
    // Switch to tray first to make sure 'exit' is an actual write, not the
    // default fallback.
    await settingsApi.saveCloseBehavior('tray');
    const saved = await settingsApi.saveCloseBehavior('exit');
    expect(saved).toBe('exit');
    const got = await settingsApi.getCloseBehavior();
    expect(got).toBe('exit');
  });

  it('forceQuit is a no-op in the browser mock and resolves cleanly', async () => {
    // Asserting that no exception leaks from the mock — in production the
    // Tauri impl invokes `force_quit` which std::process::exit's.
    await expect(settingsApi.forceQuit()).resolves.toBeUndefined();
  });

  it('round-trips both sides of the union via the typed API surface', async () => {
    const cases: CloseBehavior[] = ['exit', 'tray'];
    for (const c of cases) {
      await settingsApi.saveCloseBehavior(c);
      expect(await settingsApi.getCloseBehavior()).toBe(c);
    }
  });
});
