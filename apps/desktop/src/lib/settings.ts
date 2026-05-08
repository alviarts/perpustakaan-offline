/**
 * Settings API client (revisi #24).
 *
 * Provides typed access to:
 *   - Library identity        (Tauri: identity_get / identity_save)
 *   - Loan rules              (key-value via setting_get / setting_save)
 *   - Display preferences     (key-value)
 *   - Sync configuration      (key-value)
 *   - User accounts CRUD      (Tauri: settings_users_*)
 *   - Permission matrix       (Tauri: settings_permissions_*)
 *   - Audit log query         (Tauri: settings_audit_log_query)
 *
 * Each function falls back to a localStorage-backed mock so the UI is fully
 * functional in `pnpm dev` and in `vitest` (jsdom) without a Rust backend.
 */
import { isTauri } from '@/lib/auth';
import type { LibraryIdentity } from '@/stores/identityStore';

// ---------------------------------------------------------------------------
// Loan rules (Aturan Peminjaman)
// ---------------------------------------------------------------------------

export interface LoanRules {
  maksBukuPinjam: number;
  lamaPinjamHari: number;
  dendaPerHari: number;
  hariLibur: number[]; // 0=Sun..6=Sat (akan di-skip dari hitungan denda)
}

export const DEFAULT_LOAN_RULES: LoanRules = {
  maksBukuPinjam: 3,
  lamaPinjamHari: 7,
  dendaPerHari: 500,
  hariLibur: [0],
};

const LOAN_RULES_KEYS = {
  maks: 'transaksi.maks_buku_pinjam',
  lama: 'transaksi.lama_pinjam_hari',
  denda: 'transaksi.denda_per_hari',
  libur: 'transaksi.hari_libur',
} as const;

// ---------------------------------------------------------------------------
// Display preferences
// ---------------------------------------------------------------------------

export type Density = 'compact' | 'comfortable';

export interface DisplayPrefs {
  fontScale: number; // 0.8..1.4
  density: Density;
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  fontScale: 1.0,
  density: 'comfortable',
};

// ---------------------------------------------------------------------------
// Close behavior (BUG-011: tray vs exit on X-button click)
// ---------------------------------------------------------------------------

export type CloseBehavior = 'exit' | 'tray';

export const DEFAULT_CLOSE_BEHAVIOR: CloseBehavior = 'exit';

// ---------------------------------------------------------------------------
// App mode (admin vs public OPAC)
// ---------------------------------------------------------------------------

export type AppMode = 'admin' | 'public';

export const DEFAULT_APP_MODE: AppMode = 'admin';

export const APP_MODE_KEY = 'desktop.app_mode';

// ---------------------------------------------------------------------------
// Sync configuration
// ---------------------------------------------------------------------------

export interface SyncConfig {
  enabled: boolean;
  spreadsheetId: string;
  /** Legacy v1.0.6 read-only API-key field. Kept for backwards compatibility
   * but no longer used by the Tauri push/pull commands (which need a
   * Service Account for write access). FEAT-26 v1.0.8 introduced
   * `serviceAccountConfigured` instead — the JSON itself never round-trips
   * through the renderer, only a boolean signalling whether one is saved. */
  apiKey: string;
  lastSync: string | null;
  /** True when a Service Account JSON has been pasted+validated by the
   * Tauri backend (`sync_save_service_account`). Used to gate Push/Pull
   * buttons in Pengaturan → Sinkronisasi. */
  serviceAccountConfigured: boolean;
  /** Email of the configured Service Account (read-only display, derived
   * from the saved JSON's `client_email` field). Empty when none saved. */
  serviceAccountEmail: string;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  spreadsheetId: '',
  apiKey: '',
  lastSync: null,
  serviceAccountConfigured: false,
  serviceAccountEmail: '',
};

// FEAT-26 v1.0.8 — Sheets sync runtime types (status panel + run results).

export interface SyncStateRow {
  table_name: string;
  last_push_at: string | null;
  last_pull_at: string | null;
  last_push_hash: string | null;
  last_pull_hash: string | null;
  rows_pushed: number;
  rows_pulled: number;
  updated_at: string;
}

export interface SyncLogEntry {
  id: number;
  ts: string;
  direction: 'push' | 'pull' | 'test';
  table_name: string;
  status: 'ok' | 'error' | 'skipped' | 'noop';
  rows_changed: number;
  message: string | null;
}

export interface SyncStatusSnapshot {
  configured: boolean;
  enabled: boolean;
  spreadsheet_id: string;
  service_account_email: string;
  states: SyncStateRow[];
  log: SyncLogEntry[];
}

export interface SyncRunResult {
  direction: 'push' | 'pull' | 'test';
  rows_changed: number;
  status: 'ok' | 'error' | 'skipped' | 'noop';
  message: string;
}

export interface SyncTestResult {
  ok: boolean;
  spreadsheet_title: string;
  tabs: string[];
  service_account_email: string;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'pustakawan';

export interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  aktif: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserInput {
  username: string;
  fullName: string;
  role: UserRole;
  aktif: boolean;
  password?: string | null;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';
export type PermissionArea =
  | 'anggota'
  | 'buku'
  | 'peminjaman'
  | 'pengembalian'
  | 'kunjungan'
  | 'laporan'
  | 'settings'
  | 'audit_log';

export const PERMISSION_AREAS: PermissionArea[] = [
  'anggota',
  'buku',
  'peminjaman',
  'pengembalian',
  'kunjungan',
  'laporan',
  'settings',
  'audit_log',
];

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete'];

export type PermissionMatrix = Record<UserRole, Record<PermissionArea, Record<PermissionAction, boolean>>>;

const allTrue = (): Record<PermissionAction, boolean> => ({
  view: true,
  create: true,
  update: true,
  delete: true,
});

const onlyView = (): Record<PermissionAction, boolean> => ({
  view: true,
  create: false,
  update: false,
  delete: false,
});

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  admin: PERMISSION_AREAS.reduce(
    (acc, area) => ({ ...acc, [area]: allTrue() }),
    {} as Record<PermissionArea, Record<PermissionAction, boolean>>,
  ),
  pustakawan: PERMISSION_AREAS.reduce(
    (acc, area) => {
      const all = allTrue();
      // Pustakawan tidak bisa edit settings / audit log secara default
      if (area === 'settings' || area === 'audit_log') {
        return { ...acc, [area]: onlyView() };
      }
      return { ...acc, [area]: all };
    },
    {} as Record<PermissionArea, Record<PermissionAction, boolean>>,
  ),
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  username: string | null;
  aksi: string;
  entitas: string;
  entitasId: number | null;
  detail: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  user?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Mock storage helpers (localStorage)
// ---------------------------------------------------------------------------

const MOCK_KEYS = {
  loanRules: 'po:settings:loan-rules',
  display: 'po:settings:display',
  sync: 'po:settings:sync',
  users: 'po:settings:users',
  permissions: 'po:settings:permissions',
  audit: 'po:settings:audit-log',
  identity: 'po:settings:identity',
  closeBehavior: 'po:settings:close-behavior',
  appMode: 'po:settings:app-mode',
};

const readMock = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeMock = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

// ---------------------------------------------------------------------------
// Identity (delegates to identityStore command)
// ---------------------------------------------------------------------------

interface RustIdentity {
  nama: string;
  alamat: string;
  kepala: string;
  npsn: string;
  tahun_ajaran: string;
  logo_path: string;
  kontak: string;
  ttd_kepsek_path?: string | null;
  kepala_sekolah?: string | null;
}

const fromRust = (r: RustIdentity): LibraryIdentity => ({
  nama: r.nama,
  alamat: r.alamat,
  kepala: r.kepala,
  npsn: r.npsn,
  tahunAjaran: r.tahun_ajaran,
  logoPath: r.logo_path,
  kontak: r.kontak,
  ttdKepsekPath: r.ttd_kepsek_path ?? '',
  kepalaSekolah: r.kepala_sekolah ?? '',
});

const toRust = (i: LibraryIdentity): RustIdentity => ({
  nama: i.nama,
  alamat: i.alamat,
  kepala: i.kepala,
  npsn: i.npsn,
  tahun_ajaran: i.tahunAjaran,
  logo_path: i.logoPath,
  kontak: i.kontak,
  ttd_kepsek_path: i.ttdKepsekPath ?? '',
  kepala_sekolah: i.kepalaSekolah ?? '',
});

export const DEFAULT_IDENTITY: LibraryIdentity = {
  nama: 'Perpustakaan Sekolah',
  alamat: '-',
  kepala: '-',
  npsn: '-',
  tahunAjaran: '2024/2025',
  logoPath: '',
  kontak: '-',
  ttdKepsekPath: '',
  kepalaSekolah: '',
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface SettingsApi {
  getIdentity(): Promise<LibraryIdentity>;
  saveIdentity(payload: LibraryIdentity): Promise<LibraryIdentity>;
  resetIdentity(): Promise<LibraryIdentity>;

  getLoanRules(): Promise<LoanRules>;
  saveLoanRules(rules: LoanRules): Promise<LoanRules>;
  resetLoanRules(): Promise<LoanRules>;

  getDisplayPrefs(): Promise<DisplayPrefs>;
  saveDisplayPrefs(prefs: DisplayPrefs): Promise<DisplayPrefs>;
  resetDisplayPrefs(): Promise<DisplayPrefs>;

  getCloseBehavior(): Promise<CloseBehavior>;
  saveCloseBehavior(behavior: CloseBehavior): Promise<CloseBehavior>;
  forceQuit(): Promise<void>;

  getAppMode(): Promise<AppMode>;
  saveAppMode(mode: AppMode): Promise<AppMode>;

  getSyncConfig(): Promise<SyncConfig>;
  saveSyncConfig(cfg: SyncConfig): Promise<SyncConfig>;
  resetSyncConfig(): Promise<SyncConfig>;
  syncNow(): Promise<SyncConfig>;
  // FEAT-26 v1.0.8 — Service-Account-based bidirectional sync
  saveServiceAccountJson(json: string): Promise<void>;
  testSyncConnection(): Promise<SyncTestResult>;
  pushSyncNow(): Promise<SyncRunResult[]>;
  pullSyncNow(): Promise<SyncRunResult[]>;
  getSyncStatus(): Promise<SyncStatusSnapshot>;
  syncFullNow(): Promise<SyncRunResult[]>;
  generateMobileQr(): Promise<string>;
  exportMobileQr(bytes: Uint8Array): Promise<{ filename: string; absPath: string; dirAbsPath: string }>;
  openExportsFolder(): Promise<string>;

  listUsers(): Promise<UserRecord[]>;
  createUser(payload: UserInput): Promise<UserRecord>;
  updateUser(id: number, payload: UserInput): Promise<UserRecord>;
  deleteUser(id: number): Promise<void>;
  resetPassword(id: number, newPassword: string): Promise<void>;

  getPermissionMatrix(): Promise<PermissionMatrix>;
  savePermissionMatrix(matrix: PermissionMatrix): Promise<PermissionMatrix>;
  resetPermissionMatrix(): Promise<PermissionMatrix>;

  queryAuditLog(query: AuditLogQuery): Promise<AuditLogEntry[]>;
  __resetMock?: () => void;
}

// ---------------------------------------------------------------------------
// Mock implementation (browser fallback)
// ---------------------------------------------------------------------------

let mockUserSeq = 100;

function seedMockUsers(): UserRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      username: 'admin',
      fullName: 'Administrator',
      role: 'admin',
      aktif: true,
      lastLoginAt: now,
      createdAt: now,
    },
    {
      id: 2,
      username: 'pustakawan1',
      fullName: 'Pustakawan Satu',
      role: 'pustakawan',
      aktif: true,
      lastLoginAt: null,
      createdAt: now,
    },
  ];
}

function seedMockAudit(): AuditLogEntry[] {
  const base = Date.now();
  return [
    {
      id: 1,
      userId: 1,
      username: 'admin',
      aksi: 'login',
      entitas: 'auth',
      entitasId: null,
      detail: null,
      createdAt: new Date(base - 60_000).toISOString(),
    },
    {
      id: 2,
      userId: 1,
      username: 'admin',
      aksi: 'create',
      entitas: 'anggota',
      entitasId: 42,
      detail: 'Andini Putri',
      createdAt: new Date(base - 30_000).toISOString(),
    },
  ];
}

const mockApi: SettingsApi = {
  async getIdentity() {
    return readMock<LibraryIdentity>(MOCK_KEYS.identity, DEFAULT_IDENTITY);
  },
  async saveIdentity(payload) {
    writeMock(MOCK_KEYS.identity, payload);
    return payload;
  },
  async resetIdentity() {
    writeMock(MOCK_KEYS.identity, DEFAULT_IDENTITY);
    return DEFAULT_IDENTITY;
  },

  async getLoanRules() {
    return readMock<LoanRules>(MOCK_KEYS.loanRules, DEFAULT_LOAN_RULES);
  },
  async saveLoanRules(rules) {
    writeMock(MOCK_KEYS.loanRules, rules);
    return rules;
  },
  async resetLoanRules() {
    writeMock(MOCK_KEYS.loanRules, DEFAULT_LOAN_RULES);
    return DEFAULT_LOAN_RULES;
  },

  async getDisplayPrefs() {
    return readMock<DisplayPrefs>(MOCK_KEYS.display, DEFAULT_DISPLAY_PREFS);
  },
  async saveDisplayPrefs(prefs) {
    writeMock(MOCK_KEYS.display, prefs);
    return prefs;
  },
  async resetDisplayPrefs() {
    writeMock(MOCK_KEYS.display, DEFAULT_DISPLAY_PREFS);
    return DEFAULT_DISPLAY_PREFS;
  },

  async getCloseBehavior() {
    return readMock<CloseBehavior>(MOCK_KEYS.closeBehavior, DEFAULT_CLOSE_BEHAVIOR);
  },
  async saveCloseBehavior(behavior) {
    writeMock(MOCK_KEYS.closeBehavior, behavior);
    return behavior;
  },
  async forceQuit() {
    // No-op in browser/dev mock — there's no .exe to quit.
  },

  async getAppMode() {
    return readMock<AppMode>(MOCK_KEYS.appMode, DEFAULT_APP_MODE);
  },
  async saveAppMode(mode) {
    writeMock(MOCK_KEYS.appMode, mode);
    return mode;
  },

  async getSyncConfig() {
    return readMock<SyncConfig>(MOCK_KEYS.sync, DEFAULT_SYNC_CONFIG);
  },
  async saveSyncConfig(cfg) {
    writeMock(MOCK_KEYS.sync, cfg);
    return cfg;
  },
  async resetSyncConfig() {
    writeMock(MOCK_KEYS.sync, DEFAULT_SYNC_CONFIG);
    return DEFAULT_SYNC_CONFIG;
  },
  async syncNow() {
    const cfg = await this.getSyncConfig();
    const updated = { ...cfg, lastSync: new Date().toISOString() };
    writeMock(MOCK_KEYS.sync, updated);
    return updated;
  },
  async saveServiceAccountJson(json) {
    const cfg = await this.getSyncConfig();
    writeMock(MOCK_KEYS.sync, {
      ...cfg,
      serviceAccountConfigured: json.trim().length > 0,
      serviceAccountEmail: json.trim().length > 0 ? 'mock@example.iam.gserviceaccount.com' : '',
    });
  },
  async testSyncConnection() {
    return {
      ok: true,
      spreadsheet_title: 'Mock Sheet (browser fallback)',
      tabs: ['anggota'],
      service_account_email: 'mock@example.iam.gserviceaccount.com',
    };
  },
  async pushSyncNow() {
    const cfg = await this.getSyncConfig();
    writeMock(MOCK_KEYS.sync, { ...cfg, lastSync: new Date().toISOString() });
    return [
      {
        direction: 'push',
        rows_changed: 0,
        status: 'noop',
        message: 'mock browser fallback — no real sync performed',
      },
    ];
  },
  async pullSyncNow() {
    return [
      {
        direction: 'pull',
        rows_changed: 0,
        status: 'noop',
        message: 'mock browser fallback — no real sync performed',
      },
    ];
  },
  async getSyncStatus() {
    const cfg = await this.getSyncConfig();
    return {
      configured: cfg.serviceAccountConfigured && cfg.spreadsheetId.trim().length > 0,
      enabled: cfg.enabled,
      spreadsheet_id: cfg.spreadsheetId,
      service_account_email: cfg.serviceAccountEmail,
      states: [],
      log: [],
    };
  },
  async syncFullNow() {
    return [{ direction: 'pull', rows_changed: 0, status: 'noop', message: 'mock' },
            { direction: 'push', rows_changed: 0, status: 'noop', message: 'mock' }];
  },
  async generateMobileQr() {
    return JSON.stringify({ v: 1, lib: 'Mock Library', sid: 'mock-spreadsheet-id', sa: '{}' });
  },
  async exportMobileQr(_bytes) {
    return { filename: 'qr-mock.png', absPath: '/tmp/qr-mock.png', dirAbsPath: '/tmp' };
  },
  async openExportsFolder() {
    return '/tmp';
  },

  async listUsers() {
    let users = readMock<UserRecord[] | null>(MOCK_KEYS.users, null);
    if (!users) {
      users = seedMockUsers();
      writeMock(MOCK_KEYS.users, users);
    }
    return users;
  },
  async createUser(payload) {
    const users = await this.listUsers();
    if (users.some((u) => u.username === payload.username)) {
      throw new Error('username_taken');
    }
    mockUserSeq += 1;
    const next: UserRecord = {
      id: mockUserSeq,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      aktif: payload.aktif,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    writeMock(MOCK_KEYS.users, [...users, next]);
    return next;
  },
  async updateUser(id, payload) {
    const users = await this.listUsers();
    const idx = users.findIndex((u) => u.id === id);
    const existing = idx === -1 ? undefined : users[idx];
    if (idx === -1 || !existing) throw new Error('user_not_found');
    const updated: UserRecord = {
      ...existing,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      aktif: payload.aktif,
    };
    const next = [...users];
    next[idx] = updated;
    writeMock(MOCK_KEYS.users, next);
    return updated;
  },
  async deleteUser(id) {
    const users = await this.listUsers();
    writeMock(
      MOCK_KEYS.users,
      users.filter((u) => u.id !== id),
    );
  },
  async resetPassword(id, _newPassword) {
    const users = await this.listUsers();
    if (!users.some((u) => u.id === id)) throw new Error('user_not_found');
    return;
  },

  async getPermissionMatrix() {
    return readMock<PermissionMatrix>(MOCK_KEYS.permissions, DEFAULT_PERMISSION_MATRIX);
  },
  async savePermissionMatrix(matrix) {
    writeMock(MOCK_KEYS.permissions, matrix);
    return matrix;
  },
  async resetPermissionMatrix() {
    writeMock(MOCK_KEYS.permissions, DEFAULT_PERMISSION_MATRIX);
    return DEFAULT_PERMISSION_MATRIX;
  },

  async queryAuditLog(query) {
    let entries = readMock<AuditLogEntry[] | null>(MOCK_KEYS.audit, null);
    if (!entries) {
      entries = seedMockAudit();
      writeMock(MOCK_KEYS.audit, entries);
    }
    let filtered = entries;
    if (query.user) {
      const q = query.user.toLowerCase();
      filtered = filtered.filter((e) => (e.username ?? '').toLowerCase().includes(q));
    }
    if (query.action) {
      filtered = filtered.filter((e) => e.aksi === query.action);
    }
    if (query.entity) {
      filtered = filtered.filter((e) => e.entitas === query.entity);
    }
    if (query.from) {
      filtered = filtered.filter((e) => e.createdAt >= query.from!);
    }
    if (query.to) {
      filtered = filtered.filter((e) => e.createdAt <= query.to!);
    }
    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }
    return filtered;
  },

  __resetMock() {
    if (typeof window === 'undefined') return;
    Object.values(MOCK_KEYS).forEach((k) => window.localStorage.removeItem(k));
    mockUserSeq = 100;
  },
};

// ---------------------------------------------------------------------------
// Tauri implementation
// ---------------------------------------------------------------------------

const tauriApi: SettingsApi = {
  async getIdentity() {
    const { invoke } = await import('@tauri-apps/api/core');
    return fromRust(await invoke<RustIdentity>('identity_get'));
  },
  async saveIdentity(payload) {
    const { invoke } = await import('@tauri-apps/api/core');
    return fromRust(
      await invoke<RustIdentity>('identity_save', { payload: toRust(payload) }),
    );
  },
  async resetIdentity() {
    return tauriApi.saveIdentity(DEFAULT_IDENTITY);
  },

  async getLoanRules() {
    const { invoke } = await import('@tauri-apps/api/core');
    const rows = await invoke<Record<string, string>>('settings_get_many', {
      keys: Object.values(LOAN_RULES_KEYS),
    });
    return {
      maksBukuPinjam: parseInt(rows[LOAN_RULES_KEYS.maks] ?? '', 10) || DEFAULT_LOAN_RULES.maksBukuPinjam,
      lamaPinjamHari: parseInt(rows[LOAN_RULES_KEYS.lama] ?? '', 10) || DEFAULT_LOAN_RULES.lamaPinjamHari,
      dendaPerHari: parseInt(rows[LOAN_RULES_KEYS.denda] ?? '', 10) || DEFAULT_LOAN_RULES.dendaPerHari,
      hariLibur: parseHariLibur(rows[LOAN_RULES_KEYS.libur] ?? ''),
    };
  },
  async saveLoanRules(rules) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_set_many', {
      entries: {
        [LOAN_RULES_KEYS.maks]: String(rules.maksBukuPinjam),
        [LOAN_RULES_KEYS.lama]: String(rules.lamaPinjamHari),
        [LOAN_RULES_KEYS.denda]: String(rules.dendaPerHari),
        [LOAN_RULES_KEYS.libur]: rules.hariLibur.join(','),
      },
    });
    return rules;
  },
  async resetLoanRules() {
    return tauriApi.saveLoanRules(DEFAULT_LOAN_RULES);
  },

  async getDisplayPrefs() {
    const { invoke } = await import('@tauri-apps/api/core');
    const rows = await invoke<Record<string, string>>('settings_get_many', {
      keys: ['ui.font_scale', 'ui.density'],
    });
    const fontScale = parseFloat(rows['ui.font_scale'] ?? '');
    const density = (rows['ui.density'] ?? '') as Density;
    return {
      fontScale: Number.isFinite(fontScale) && fontScale > 0 ? fontScale : DEFAULT_DISPLAY_PREFS.fontScale,
      density: density === 'compact' || density === 'comfortable' ? density : DEFAULT_DISPLAY_PREFS.density,
    };
  },
  async saveDisplayPrefs(prefs) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_set_many', {
      entries: {
        'ui.font_scale': String(prefs.fontScale),
        'ui.density': prefs.density,
      },
    });
    return prefs;
  },
  async resetDisplayPrefs() {
    return tauriApi.saveDisplayPrefs(DEFAULT_DISPLAY_PREFS);
  },

  async getCloseBehavior() {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<string>('close_behavior_get');
    return raw === 'tray' ? 'tray' : 'exit';
  },
  async saveCloseBehavior(behavior) {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<string>('close_behavior_set', { behavior });
    return raw === 'tray' ? 'tray' : 'exit';
  },
  async forceQuit() {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('force_quit');
  },

  async getAppMode() {
    const { invoke } = await import('@tauri-apps/api/core');
    const rows = await invoke<Record<string, string>>('settings_get_many', {
      keys: [APP_MODE_KEY],
    });
    const raw = rows[APP_MODE_KEY] ?? '';
    return raw === 'public' ? 'public' : 'admin';
  },
  async saveAppMode(mode) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_set_many', {
      entries: { [APP_MODE_KEY]: mode },
    });
    return mode;
  },

  async getSyncConfig() {
    const { invoke } = await import('@tauri-apps/api/core');
    const rows = await invoke<Record<string, string>>('settings_get_many', {
      keys: ['sync.enabled', 'sync.spreadsheet_id', 'sync.api_key', 'sync.last_sync'],
    });
    // FEAT-26: derive serviceAccount* from sync_status (single Tauri call)
    // so the renderer never needs to round-trip the JSON itself.
    const status = await invoke<SyncStatusSnapshot>('sync_status');
    return {
      enabled: rows['sync.enabled'] === '1',
      spreadsheetId: rows['sync.spreadsheet_id'] ?? '',
      apiKey: rows['sync.api_key'] ?? '',
      lastSync: rows['sync.last_sync'] || null,
      serviceAccountConfigured: !!status.service_account_email,
      serviceAccountEmail: status.service_account_email,
    };
  },
  async saveSyncConfig(cfg) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_set_many', {
      entries: {
        'sync.enabled': cfg.enabled ? '1' : '0',
        'sync.spreadsheet_id': cfg.spreadsheetId,
        'sync.api_key': cfg.apiKey,
        'sync.last_sync': cfg.lastSync ?? '',
      },
    });
    return cfg;
  },
  async resetSyncConfig() {
    return tauriApi.saveSyncConfig(DEFAULT_SYNC_CONFIG);
  },
  async syncNow() {
    const cfg = await tauriApi.getSyncConfig();
    return tauriApi.saveSyncConfig({ ...cfg, lastSync: new Date().toISOString() });
  },
  async saveServiceAccountJson(json) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('sync_save_service_account', { json });
  },
  async testSyncConnection() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SyncTestResult>('sync_test_connection');
  },
  async pushSyncNow() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SyncRunResult[]>('sync_push_now');
  },
  async pullSyncNow() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SyncRunResult[]>('sync_pull_now');
  },
  async syncFullNow() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SyncRunResult[]>('sync_full_now');
  },
  async getSyncStatus() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SyncStatusSnapshot>('sync_status');
  },
  async generateMobileQr() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('sync_generate_mobile_qr');
  },
  async exportMobileQr(bytes) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<{ filename: string; absPath: string; dirAbsPath: string }>(
      'sync_export_mobile_qr',
      { bytes: Array.from(bytes) },
    );
  },
  async openExportsFolder() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('kta_open_exports_folder');
  },

  async listUsers() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<UserRecord[]>('settings_users_list');
  },
  async createUser(payload) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<UserRecord>('settings_users_create', { payload });
  },
  async updateUser(id, payload) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<UserRecord>('settings_users_update', { id, payload });
  },
  async deleteUser(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_users_delete', { id });
  },
  async resetPassword(id, newPassword) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('settings_users_reset_password', { id, newPassword });
  },

  async getPermissionMatrix() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PermissionMatrix>('settings_permissions_get');
  },
  async savePermissionMatrix(matrix) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PermissionMatrix>('settings_permissions_save', { matrix });
  },
  async resetPermissionMatrix() {
    return tauriApi.savePermissionMatrix(DEFAULT_PERMISSION_MATRIX);
  },

  async queryAuditLog(query) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AuditLogEntry[]>('settings_audit_log_query', { query });
  },
};

function parseHariLibur(raw: string): number[] {
  if (!raw) return DEFAULT_LOAN_RULES.hariLibur;
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function rpc(): SettingsApi {
  return isTauri() ? tauriApi : mockApi;
}

export const settingsApi: SettingsApi = {
  getIdentity: () => rpc().getIdentity(),
  saveIdentity: (payload) => rpc().saveIdentity(payload),
  resetIdentity: () => rpc().resetIdentity(),
  getLoanRules: () => rpc().getLoanRules(),
  saveLoanRules: (rules) => rpc().saveLoanRules(rules),
  resetLoanRules: () => rpc().resetLoanRules(),
  getDisplayPrefs: () => rpc().getDisplayPrefs(),
  saveDisplayPrefs: (prefs) => rpc().saveDisplayPrefs(prefs),
  resetDisplayPrefs: () => rpc().resetDisplayPrefs(),
  getCloseBehavior: () => rpc().getCloseBehavior(),
  saveCloseBehavior: (b) => rpc().saveCloseBehavior(b),
  forceQuit: () => rpc().forceQuit(),
  getAppMode: () => rpc().getAppMode(),
  saveAppMode: (mode) => rpc().saveAppMode(mode),
  getSyncConfig: () => rpc().getSyncConfig(),
  saveSyncConfig: (cfg) => rpc().saveSyncConfig(cfg),
  resetSyncConfig: () => rpc().resetSyncConfig(),
  syncNow: () => rpc().syncNow(),
  saveServiceAccountJson: (json) => rpc().saveServiceAccountJson(json),
  testSyncConnection: () => rpc().testSyncConnection(),
  pushSyncNow: () => rpc().pushSyncNow(),
  pullSyncNow: () => rpc().pullSyncNow(),
  getSyncStatus: () => rpc().getSyncStatus(),
  syncFullNow: () => rpc().syncFullNow(),
  generateMobileQr: () => rpc().generateMobileQr(),
  exportMobileQr: (bytes: Uint8Array) => rpc().exportMobileQr(bytes),
  openExportsFolder: () => rpc().openExportsFolder(),
  listUsers: () => rpc().listUsers(),
  createUser: (payload) => rpc().createUser(payload),
  updateUser: (id, payload) => rpc().updateUser(id, payload),
  deleteUser: (id) => rpc().deleteUser(id),
  resetPassword: (id, pw) => rpc().resetPassword(id, pw),
  getPermissionMatrix: () => rpc().getPermissionMatrix(),
  savePermissionMatrix: (m) => rpc().savePermissionMatrix(m),
  resetPermissionMatrix: () => rpc().resetPermissionMatrix(),
  queryAuditLog: (q) => rpc().queryAuditLog(q),
  __resetMock: () => mockApi.__resetMock?.(),
};
