import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

/**
 * D5-SandboxDemoMode — operational status of the sandbox toggle. Mirrored
 * 1:1 from the Rust `SandboxStatus` struct (camelCase via serde).
 */
export interface SandboxStatus {
  active: boolean;
  dbPath: string;
  demoDbPath: string;
  prodDbPath: string;
}

export interface SandboxRpc {
  status: () => Promise<SandboxStatus>;
  enable: () => Promise<SandboxStatus>;
  disable: () => Promise<SandboxStatus>;
}

const tauriRpc: SandboxRpc = {
  status: () => invoke<SandboxStatus>('sandbox_status'),
  enable: () => invoke<SandboxStatus>('sandbox_enable'),
  disable: () => invoke<SandboxStatus>('sandbox_disable'),
};

/**
 * Mock implementation used in the dev browser (where there is no Tauri
 * backend). Keeps an in-memory flag so the SettingsPage and SandboxBanner
 * can be exercised end-to-end without a real DB swap.
 */
function makeMockRpc(): SandboxRpc {
  let active = false;
  const status = (): SandboxStatus => ({
    active,
    dbPath: active ? '/mock/perpustakaan-v2-demo.db' : '/mock/perpustakaan-v2.db',
    demoDbPath: '/mock/perpustakaan-v2-demo.db',
    prodDbPath: '/mock/perpustakaan-v2.db',
  });
  return {
    async status() {
      return status();
    },
    async enable() {
      active = true;
      return status();
    },
    async disable() {
      active = false;
      return status();
    },
  };
}

const mockRpc: SandboxRpc = makeMockRpc();

export const sandboxApi: SandboxRpc = {
  status: () => (isTauri() ? tauriRpc.status() : mockRpc.status()),
  enable: () => (isTauri() ? tauriRpc.enable() : mockRpc.enable()),
  disable: () => (isTauri() ? tauriRpc.disable() : mockRpc.disable()),
};
