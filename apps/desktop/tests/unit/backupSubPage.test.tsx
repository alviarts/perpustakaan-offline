/**
 * @vitest-environment jsdom
 *
 * FEAT-24 — Backup enhancement coverage. Validates the new history list,
 * encrypted backup, and cloud rclone passthrough sections render correctly,
 * use the mock RPC layer (browser fallback), and gate their primary buttons
 * on the right preconditions (password length, configured remote).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LaporanBackup } from '@/features/laporan/BackupSubPage';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import idLaporan from '@/i18n/id/laporan.json';

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'id',
      fallbackLng: 'id',
      resources: {
        id: { laporan: idLaporan },
      },
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage('id');
  }
});

function renderBackup(): void {
  render(
    <I18nextProvider i18n={i18n}>
      <ToastManagerProvider>
        <LaporanBackup />
      </ToastManagerProvider>
    </I18nextProvider>,
  );
}

describe('LaporanBackup (FEAT-24)', () => {
  it('renders new history, encrypted, and cloud cards', async () => {
    renderBackup();
    expect(screen.getByTestId('backup-history-card')).toBeInTheDocument();
    expect(screen.getByTestId('backup-encrypted-card')).toBeInTheDocument();
    expect(screen.getByTestId('backup-cloud-card')).toBeInTheDocument();
  });

  it('loads mock backup history rows on mount', async () => {
    renderBackup();
    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });
    const table = screen.getByTestId('history-table');
    expect(within(table).getByText('lokal')).toBeInTheDocument();
  });

  it('disables encrypted backup button until password ≥ 8 chars', async () => {
    renderBackup();
    const user = userEvent.setup();
    const button = screen.getByTestId('encrypted-create');
    expect(button).toBeDisabled();
    await user.type(screen.getByTestId('encrypted-pwd'), 'short');
    expect(button).toBeDisabled();
    await user.type(screen.getByTestId('encrypted-pwd'), 'enough123');
    expect(button).not.toBeDisabled();
  });

  it('toggles encrypted password visibility', async () => {
    renderBackup();
    const user = userEvent.setup();
    const input = screen.getByTestId('encrypted-pwd') as HTMLInputElement;
    expect(input.type).toBe('password');
    await user.click(screen.getByTestId('encrypted-pwd-toggle'));
    expect(input.type).toBe('text');
    await user.click(screen.getByTestId('encrypted-pwd-toggle'));
    expect(input.type).toBe('password');
  });

  it('disables cloud upload button until rclone remote is set', async () => {
    renderBackup();
    await waitFor(() => {
      expect(screen.getByTestId('cloud-upload')).toBeInTheDocument();
    });
    const upload = screen.getByTestId('cloud-upload');
    expect(upload).toBeDisabled();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('cloud-remote'), 'gdrive-backup');
    expect(upload).not.toBeDisabled();
  });

  it('updates history filter dest type via select', async () => {
    renderBackup();
    await waitFor(() => screen.getByTestId('history-table'));
    const user = userEvent.setup();
    const select = screen.getByTestId('history-desttype') as HTMLSelectElement;
    await user.selectOptions(select, 'rclone');
    expect(select.value).toBe('rclone');
  });
});
