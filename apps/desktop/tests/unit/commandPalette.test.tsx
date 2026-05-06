import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

import { GlobalSearchDialog } from '@/components/layout/GlobalSearchDialog';
import {
  COMMAND_PALETTE_ROUTES,
  addCommandPaletteAction,
  _clearExtraCommandPaletteActions,
} from '@/components/layout/commandPaletteRegistry';
import { ToastManagerProvider } from '@/components/ui/toast-manager';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/lib/anggota', () => ({
  anggotaApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('@/lib/buku', () => ({
  bukuApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('@/lib/peminjaman', () => ({
  peminjamanApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

function Wrap({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ToastManagerProvider>{children}</ToastManagerProvider>
    </I18nextProvider>
  );
}

describe('GlobalSearchDialog command palette (A1-CommandPalette)', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    _clearExtraCommandPaletteActions();
  });

  it('shows Quick Actions and Pages groups when query is empty (no data search)', () => {
    render(
      <Wrap>
        <GlobalSearchDialog open onOpenChange={() => {}} />
      </Wrap>,
    );
    // Default Halaman group surfaces top 6 routes
    const expectedKeys = COMMAND_PALETTE_ROUTES.slice(0, 6).map((r) => r.key);
    for (const key of expectedKeys) {
      expect(
        screen.getByTestId(`global-search-route-${key}`),
        `route ${key} should render in default empty state`,
      ).toBeInTheDocument();
    }
    // Aksi Cepat shows >= 8 actions including the 4 we always ship
    for (const key of [
      'backupSekarang',
      'tambahAnggota',
      'toggleTheme',
      'logout',
    ]) {
      expect(
        screen.getByTestId(`global-search-action-${key}`),
        `action ${key} should render in default empty state`,
      ).toBeInTheDocument();
    }
    // Hint must NOT render when registry already provides hits
    expect(screen.queryByTestId('global-search-hint')).not.toBeInTheDocument();
  });

  it('matches "back" against the Backup quick action and the Backup route', async () => {
    render(
      <Wrap>
        <GlobalSearchDialog open onOpenChange={() => {}} />
      </Wrap>,
    );
    const input = screen.getByTestId('global-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'back' } });
    await waitFor(() => {
      expect(
        screen.getByTestId('global-search-action-backupSekarang'),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('global-search-route-backup')).toBeInTheDocument();
    // Routes that don't match should not render
    expect(screen.queryByTestId('global-search-route-stocktake')).not.toBeInTheDocument();
  });

  it('navigates when a route entry is selected', () => {
    const onOpenChange = vi.fn();
    render(
      <Wrap>
        <GlobalSearchDialog open onOpenChange={onOpenChange} />
      </Wrap>,
    );
    fireEvent.click(screen.getByTestId('global-search-route-anggota'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith({ to: '/anggota' });
  });

  it('runs the registered execute callback when an action is selected', async () => {
    const onOpenChange = vi.fn();
    const execute = vi.fn();
    addCommandPaletteAction({
      key: 'testAction',
      icon: () => null as unknown as JSX.Element,
      execute,
    });
    render(
      <Wrap>
        <GlobalSearchDialog open onOpenChange={onOpenChange} />
      </Wrap>,
    );
    const item = await screen.findByTestId('global-search-action-testAction');
    fireEvent.click(item);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // execute fires after the dialog closes (setTimeout 0)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const ctx = execute.mock.calls[0]?.[0];
    expect(ctx).toBeDefined();
    expect(typeof ctx.navigate).toBe('function');
    expect(typeof ctx.showToast).toBe('function');
    expect(typeof ctx.t).toBe('function');
  });

  it('does not crash when query has no data matches (only routes/actions)', async () => {
    render(
      <Wrap>
        <GlobalSearchDialog open onOpenChange={() => {}} />
      </Wrap>,
    );
    const input = screen.getByTestId('global-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'back' } });
    await waitFor(() => {
      expect(
        screen.getByTestId('global-search-action-backupSekarang'),
      ).toBeInTheDocument();
    });
    // Empty banner must NOT render because routes/actions are present
    expect(screen.queryByTestId('global-search-empty')).not.toBeInTheDocument();
  });
});
