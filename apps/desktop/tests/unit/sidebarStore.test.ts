import { describe, expect, it, beforeEach } from 'vitest';
import { useSidebarStore } from '@/stores/sidebarStore';

describe('sidebarStore', () => {
  beforeEach(() => {
    localStorage.removeItem('po:sidebar');
    useSidebarStore.setState({ collapsed: false, autoCollapsed: false });
  });

  it('toggle flips collapsed flag and clears autoCollapsed', () => {
    useSidebarStore.setState({ collapsed: true, autoCollapsed: true });
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
    expect(useSidebarStore.getState().autoCollapsed).toBe(false);
  });

  it('setCollapsed marks autoCollapsed when fromViewport=true', () => {
    useSidebarStore.getState().setCollapsed(true, true);
    expect(useSidebarStore.getState().collapsed).toBe(true);
    expect(useSidebarStore.getState().autoCollapsed).toBe(true);
  });

  it('persists collapsed value to localStorage', async () => {
    useSidebarStore.getState().setCollapsed(true);
    await Promise.resolve();
    const raw = localStorage.getItem('po:sidebar');
    expect(raw).not.toBeNull();
    expect(raw).toContain('"collapsed":true');
  });

  it('does not persist autoCollapsed flag', async () => {
    useSidebarStore.getState().setCollapsed(true, true);
    await Promise.resolve();
    const raw = localStorage.getItem('po:sidebar');
    expect(raw).not.toContain('autoCollapsed');
  });
});
