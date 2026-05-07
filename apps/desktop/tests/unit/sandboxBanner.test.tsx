import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

// Mock the sandbox RPC so we control the active flag and observe disable() calls.
vi.mock('@/lib/sandbox', () => {
  const status = vi.fn();
  const enable = vi.fn();
  const disable = vi.fn();
  return {
    sandboxApi: { status, enable, disable },
  };
});

import { SandboxBanner } from '@/components/layout/SandboxBanner';
import { sandboxApi } from '@/lib/sandbox';

function renderBanner() {
  return render(
    <I18nextProvider i18n={i18n}>
      <SandboxBanner />
    </I18nextProvider>,
  );
}

describe('SandboxBanner', () => {
  const reloadSpy = vi.fn();
  const originalReload = window.location.reload;

  beforeEach(() => {
    vi.mocked(sandboxApi.status).mockReset();
    vi.mocked(sandboxApi.enable).mockReset();
    vi.mocked(sandboxApi.disable).mockReset();
    reloadSpy.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: originalReload },
    });
  });

  it('renders nothing when sandbox is inactive', async () => {
    vi.mocked(sandboxApi.status).mockResolvedValue({
      active: false,
      dbPath: '/p',
      demoDbPath: '/d',
      prodDbPath: '/p',
    });
    renderBanner();
    // Banner only mounts asynchronously; assert it stays absent.
    await waitFor(() => {
      expect(sandboxApi.status).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('sandbox-banner')).not.toBeInTheDocument();
  });

  it('renders banner + disable button when sandbox is active', async () => {
    vi.mocked(sandboxApi.status).mockResolvedValue({
      active: true,
      dbPath: '/d',
      demoDbPath: '/d',
      prodDbPath: '/p',
    });
    renderBanner();
    expect(await screen.findByTestId('sandbox-banner')).toBeInTheDocument();
    expect(screen.getByTestId('sandbox-banner-disable')).toBeInTheDocument();
  });

  it('calls sandboxApi.disable() and reloads when disable button clicked', async () => {
    vi.mocked(sandboxApi.status).mockResolvedValue({
      active: true,
      dbPath: '/d',
      demoDbPath: '/d',
      prodDbPath: '/p',
    });
    vi.mocked(sandboxApi.disable).mockResolvedValue({
      active: false,
      dbPath: '/p',
      demoDbPath: '/d',
      prodDbPath: '/p',
    });
    renderBanner();
    const btn = await screen.findByTestId('sandbox-banner-disable');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(sandboxApi.disable).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('hides itself if status() rejects (treats as inactive)', async () => {
    vi.mocked(sandboxApi.status).mockRejectedValue(new Error('rpc down'));
    renderBanner();
    await waitFor(() => {
      expect(sandboxApi.status).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('sandbox-banner')).not.toBeInTheDocument();
  });
});
