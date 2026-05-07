import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

// Mock @tanstack/react-router's Link with a plain anchor so the component
// can render without a router context. Mirrors kpiCard.test.tsx pattern.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    to: string;
    children: React.ReactNode;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <a href={to} aria-label={ariaLabel} data-testid={testId}>
      {children}
    </a>
  ),
}));

// Mock the dashboardApi so we control the data the component sees.
vi.mock('@/lib/dashboard', async (orig) => {
  const actual = await orig<typeof import('@/lib/dashboard')>();
  return {
    ...actual,
    dashboardApi: {
      ...actual.dashboardApi,
      systemHealth: vi.fn(),
    },
  };
});

import { dashboardApi, type SystemHealth } from '@/lib/dashboard';
import {
  SystemHealthCard,
  formatBytes,
  formatRelative,
} from '@/features/dashboard/SystemHealthCard';

const baseHealth: SystemHealth = {
  dbSizeBytes: 5_242_880, // 5 MB
  lastBackupAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  nextBackupAt: '2026-06-01T03:00:00Z',
  pendingReservasi: 0,
  appVersion: '1.1.0',
  updateAvailable: false,
};

function renderCard(): ReturnType<typeof render> {
  return render(
    <I18nextProvider i18n={i18n}>
      <SystemHealthCard />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.mocked(dashboardApi.systemHealth).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SystemHealthCard helpers', () => {
  it('formatBytes formats bytes / KB / MB / GB with sane precision', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5_242_880)).toBe('5.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(-1)).toBe('—');
  });

  it('formatRelative renders Indonesian relative-time labels', () => {
    const now = Date.parse('2026-05-06T12:00:00Z');
    expect(formatRelative(new Date(now - 10 * 1000).toISOString(), now)).toBe('baru saja');
    expect(formatRelative(new Date(now - 3 * 60 * 1000).toISOString(), now)).toBe('3 menit lalu');
    expect(formatRelative(new Date(now - 2 * 60 * 60 * 1000).toISOString(), now)).toBe(
      '2 jam lalu',
    );
    expect(formatRelative(new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe(
      '3 hari lalu',
    );
    expect(formatRelative('not-a-date', now)).toBe('—');
  });
});

describe('SystemHealthCard rendering', () => {
  it('shows the skeleton state while data is loading', () => {
    vi.mocked(dashboardApi.systemHealth).mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.getByTestId('system-health-card-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('system-health-skeleton-row')).toHaveLength(5);
  });

  it('renders all 5 rows with the resolved data', async () => {
    vi.mocked(dashboardApi.systemHealth).mockResolvedValue(baseHealth);
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('system-health-db-size')).toHaveTextContent('5.0 MB');
    expect(screen.getByTestId('system-health-last-backup')).toBeInTheDocument();
    expect(screen.getByTestId('system-health-next-backup')).toBeInTheDocument();
    expect(screen.getByTestId('system-health-pending-reservasi')).toHaveTextContent('0');
    expect(screen.getByTestId('system-health-version')).toHaveTextContent('1.1.0');
  });

  it('only renders the "Update tersedia" pill when updateAvailable === true', async () => {
    vi.mocked(dashboardApi.systemHealth).mockResolvedValue({
      ...baseHealth,
      updateAvailable: false,
    });
    const { unmount } = renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-card')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('system-health-update-pill')).not.toBeInTheDocument();
    unmount();

    vi.mocked(dashboardApi.systemHealth).mockResolvedValue({
      ...baseHealth,
      updateAvailable: true,
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-update-pill')).toBeInTheDocument();
    });
  });

  it('uses an emerald check tone when pendingReservasi === 0 and amber bell when > 0', async () => {
    vi.mocked(dashboardApi.systemHealth).mockResolvedValue({
      ...baseHealth,
      pendingReservasi: 0,
    });
    const { unmount } = renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-pending-reservasi')).toHaveAttribute(
        'data-tone',
        'emerald',
      );
    });
    unmount();

    vi.mocked(dashboardApi.systemHealth).mockResolvedValue({
      ...baseHealth,
      pendingReservasi: 4,
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-pending-reservasi')).toHaveAttribute(
        'data-tone',
        'amber',
      );
    });
    expect(screen.getByTestId('system-health-pending-reservasi')).toHaveTextContent('4');
  });

  it('routes the backup rows to /settings/backup and the reservasi row to /reservasi', async () => {
    vi.mocked(dashboardApi.systemHealth).mockResolvedValue(baseHealth);
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-row-last-backup-link')).toBeInTheDocument();
    });
    expect(screen.getByTestId('system-health-row-last-backup-link')).toHaveAttribute(
      'href',
      '/settings/backup',
    );
    expect(screen.getByTestId('system-health-row-next-backup-link')).toHaveAttribute(
      'href',
      '/settings/backup',
    );
    expect(screen.getByTestId('system-health-row-pending-reservasi-link')).toHaveAttribute(
      'href',
      '/reservasi',
    );
  });

  it('falls back to the error state when the RPC rejects', async () => {
    vi.mocked(dashboardApi.systemHealth).mockRejectedValue(new Error('boom'));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('system-health-card-error')).toBeInTheDocument();
    });
  });
});
