/**
 * @vitest-environment jsdom
 *
 * Tests for the FEAT-26 v1.0.8 PR G Sinkronisasi page (Service Account JSON
 * paste + Test Connection / Push Now / Pull Now buttons + status panel).
 *
 * The Tauri RPC layer (`settingsApi`) is mocked via `vi.mock` so these tests
 * stay pure-frontend; the Rust orchestration is covered in
 * `apps/desktop/src-tauri/src/commands/sync/*` unit tests.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import idSettings from '@/i18n/id/settings.json';
import {
  DEFAULT_SYNC_CONFIG,
  type SyncConfig,
  type SyncStatusSnapshot,
  type SyncRunResult,
  type SyncTestResult,
} from '@/lib/settings';

// We mock the entire settingsApi facade because SinkronisasiPage only uses
// six methods on it. Returning typed promises from each gives the test
// realistic timing (loading states, toasts, etc.) without touching Tauri.
const mockState: {
  cfg: SyncConfig;
  status: SyncStatusSnapshot;
  saved: string[];
  testResult: SyncTestResult;
  pushResult: SyncRunResult[];
  pullResult: SyncRunResult[];
  shouldFailTest: boolean;
} = {
  cfg: { ...DEFAULT_SYNC_CONFIG },
  status: {
    configured: false,
    enabled: false,
    spreadsheet_id: '',
    service_account_email: '',
    states: [],
    log: [],
  },
  saved: [],
  testResult: {
    ok: true,
    spreadsheet_title: 'Demo',
    tabs: ['anggota'],
    service_account_email: 'sa@demo.iam.gserviceaccount.com',
  },
  pushResult: [{ direction: 'push', rows_changed: 0, status: 'noop', message: '' }],
  pullResult: [{ direction: 'pull', rows_changed: 0, status: 'ok', message: '' }],
  shouldFailTest: false,
};

vi.mock('@/lib/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings')>('@/lib/settings');
  return {
    ...actual,
    settingsApi: {
      ...actual.settingsApi,
      getSyncConfig: vi.fn(async () => mockState.cfg),
      saveSyncConfig: vi.fn(async (cfg: SyncConfig) => {
        mockState.cfg = cfg;
        return cfg;
      }),
      resetSyncConfig: vi.fn(async () => {
        mockState.cfg = { ...DEFAULT_SYNC_CONFIG };
        return mockState.cfg;
      }),
      saveServiceAccountJson: vi.fn(async (json: string) => {
        mockState.saved.push(json);
        const trimmed = json.trim();
        mockState.cfg = {
          ...mockState.cfg,
          serviceAccountConfigured: trimmed.length > 0,
          serviceAccountEmail: trimmed.length > 0 ? 'sa@demo.iam.gserviceaccount.com' : '',
        };
        mockState.status = {
          ...mockState.status,
          service_account_email: mockState.cfg.serviceAccountEmail,
        };
      }),
      testSyncConnection: vi.fn(async () => {
        if (mockState.shouldFailTest) throw new Error('boom');
        return mockState.testResult;
      }),
      pushSyncNow: vi.fn(async () => mockState.pushResult),
      pullSyncNow: vi.fn(async () => mockState.pullResult),
      getSyncStatus: vi.fn(async () => mockState.status),
    },
  };
});

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'id',
      fallbackLng: 'id',
      resources: { id: { settings: idSettings } },
      interpolation: { escapeValue: false },
    });
  }
  // reset mock state between tests
  mockState.cfg = { ...DEFAULT_SYNC_CONFIG };
  mockState.status = {
    configured: false,
    enabled: false,
    spreadsheet_id: '',
    service_account_email: '',
    states: [],
    log: [],
  };
  mockState.saved = [];
  mockState.shouldFailTest = false;
  mockState.pushResult = [
    { direction: 'push', rows_changed: 0, status: 'noop', message: '' },
  ];
  mockState.pullResult = [
    { direction: 'pull', rows_changed: 0, status: 'ok', message: '' },
  ];
});

async function renderPage(): Promise<void> {
  const { SinkronisasiPage } = await import('@/features/settings/SinkronisasiPage');
  render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <ToastManagerProvider>
          <SinkronisasiPage />
          <ToastViewport />
        </ToastManagerProvider>
      </ToastProvider>
    </I18nextProvider>,
  );
}

describe('SinkronisasiPage', () => {
  it('renders the not-configured banner before any Service Account is saved', async () => {
    await renderPage();
    expect(
      await screen.findByText(/Belum ada Service Account JSON/i),
    ).toBeInTheDocument();
  });

  it('disables Test/Push/Pull buttons until both sync is enabled and SA + spreadsheet ID are set', async () => {
    await renderPage();
    const testBtn = await screen.findByTestId('sync-test-connection');
    const pushBtn = await screen.findByTestId('sync-push-now');
    const pullBtn = await screen.findByTestId('sync-pull-now');
    expect(testBtn).toBeDisabled();
    expect(pushBtn).toBeDisabled();
    expect(pullBtn).toBeDisabled();
  });

  it('saves the Service Account JSON via saveServiceAccountJson and surfaces the SA email banner', async () => {
    await renderPage();
    const user = userEvent.setup();
    const ta = await screen.findByTestId('sync-sa-json');
    await user.type(ta, '{{ "type": "service_account" }');
    const save = screen.getByTestId('sync-sa-save');
    await user.click(save);
    await waitFor(() => {
      expect(mockState.saved.length).toBe(1);
    });
    expect((mockState.saved[0] ?? '').trim().length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/Service Account aktif/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/sa@demo\.iam\.gserviceaccount\.com/)).toBeInTheDocument();
  });

  it('enables Test/Push/Pull once SA is configured + spreadsheet ID set + sync enabled', async () => {
    mockState.cfg = {
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      spreadsheetId: '1aBcD',
      serviceAccountConfigured: true,
      serviceAccountEmail: 'sa@demo.iam.gserviceaccount.com',
    };
    mockState.status = {
      configured: true,
      enabled: true,
      spreadsheet_id: '1aBcD',
      service_account_email: 'sa@demo.iam.gserviceaccount.com',
      states: [],
      log: [],
    };
    await renderPage();
    const testBtn = await screen.findByTestId('sync-test-connection');
    await waitFor(() => {
      expect(testBtn).toBeEnabled();
    });
    expect(screen.getByTestId('sync-push-now')).toBeEnabled();
    expect(screen.getByTestId('sync-pull-now')).toBeEnabled();
  });

  it('shows a success toast and refreshes status after a successful Test Connection', async () => {
    mockState.cfg = {
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      spreadsheetId: '1aBcD',
      serviceAccountConfigured: true,
      serviceAccountEmail: 'sa@demo.iam.gserviceaccount.com',
    };
    mockState.status = {
      configured: true,
      enabled: true,
      spreadsheet_id: '1aBcD',
      service_account_email: 'sa@demo.iam.gserviceaccount.com',
      states: [],
      log: [],
    };
    await renderPage();
    const user = userEvent.setup();
    const testBtn = await screen.findByTestId('sync-test-connection');
    await waitFor(() => expect(testBtn).toBeEnabled());
    await user.click(testBtn);
    expect(
      await screen.findByText(/Koneksi ke Sheets berhasil/i),
    ).toBeInTheDocument();
  });

  it('renders an error toast when Test Connection rejects', async () => {
    mockState.cfg = {
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      spreadsheetId: '1aBcD',
      serviceAccountConfigured: true,
      serviceAccountEmail: 'sa@demo.iam.gserviceaccount.com',
    };
    mockState.status = {
      configured: true,
      enabled: true,
      spreadsheet_id: '1aBcD',
      service_account_email: 'sa@demo.iam.gserviceaccount.com',
      states: [],
      log: [],
    };
    mockState.shouldFailTest = true;
    await renderPage();
    const user = userEvent.setup();
    const testBtn = await screen.findByTestId('sync-test-connection');
    await waitFor(() => expect(testBtn).toBeEnabled());
    await user.click(testBtn);
    expect(await screen.findByText(/Tes koneksi gagal/i)).toBeInTheDocument();
  });

  it('renders the inline guide section with all three step headings', async () => {
    await renderPage();
    expect(await screen.findByTestId('sinkronisasi-guide')).toBeInTheDocument();
    expect(screen.getByText(/1\. ID Spreadsheet/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Service Account/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Share Spreadsheet/i)).toBeInTheDocument();
  });
});
