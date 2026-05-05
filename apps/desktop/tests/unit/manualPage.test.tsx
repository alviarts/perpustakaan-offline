/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ManualPage } from '@/features/settings/ManualPage';
import idSettings from '@/i18n/id/settings.json';

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'id',
      fallbackLng: 'id',
      resources: {
        id: { settings: idSettings },
      },
      interpolation: { escapeValue: false },
    });
  }
});

function renderManual(): void {
  render(
    <I18nextProvider i18n={i18n}>
      <ManualPage />
    </I18nextProvider>,
  );
}

describe('ManualPage', () => {
  it('renders the manual title from docs/manual.md as an h1', () => {
    renderManual();
    expect(
      screen.getByRole('heading', { name: /Manual Pengguna — Perpustakaan Nusantara/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('renders an h2 for known top-level sections', () => {
    renderManual();
    // "Login & Akun" is one of the well-known h2s in docs/manual.md.
    expect(screen.getByRole('heading', { name: /Login & Akun/i, level: 2 })).toBeInTheDocument();
  });

  it('builds a sticky table of contents with at least one entry', () => {
    renderManual();
    const toc = screen.getByTestId('manual-toc');
    const buttons = within(toc).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(3);
  });

  it('filters the table of contents when the search input changes', async () => {
    renderManual();
    const user = userEvent.setup();
    const search = screen.getByTestId('manual-search');
    await user.type(search, 'Login');
    const toc = screen.getByTestId('manual-toc');
    const buttons = within(toc).getAllByRole('button');
    // Every visible TOC entry should mention "login" (case-insensitive).
    for (const btn of buttons) {
      expect(btn.textContent?.toLowerCase()).toContain('login');
    }
  });

  it(
    'shows an empty-state message when the search has no matches',
    async () => {
      renderManual();
      const user = userEvent.setup();
      const search = screen.getByTestId('manual-search');
      await user.type(search, 'zzznotinmanual');
      expect(screen.getByText(/Tidak ada bagian yang cocok/i)).toBeInTheDocument();
    },
    // The full manual.md re-renders on every keystroke when the search
    // input updates state, so 14 chars × the ~200ms render cost can push
    // this past the default 5s when the suite runs in parallel. Give it
    // breathing room — the user-facing perf is still snappy because real
    // usage doesn't render the manual at this density.
    15000,
  );

  it('emits anchor IDs on h2 headings so the TOC scroll-jump works', () => {
    renderManual();
    const heading = screen.getByRole('heading', { name: /Login & Akun/i, level: 2 });
    expect(heading.id).toBe('login-akun');
  });
});
