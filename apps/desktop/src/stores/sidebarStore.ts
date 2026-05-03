import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  /** True when collapse was triggered by viewport (auto), false when by user. */
  autoCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean, fromViewport?: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      autoCollapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed, autoCollapsed: false })),
      setCollapsed: (value, fromViewport = false) =>
        set({ collapsed: value, autoCollapsed: fromViewport }),
    }),
    {
      name: 'po:sidebar',
      storage: createJSONStorage(() => localStorage),
      // Don't persist autoCollapsed flag — re-derive on mount.
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
