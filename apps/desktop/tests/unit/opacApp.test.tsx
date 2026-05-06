import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OpacApp } from '@/features/opac/OpacApp';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

function Wrap({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <ToastManagerProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <ToastViewport />
        </ToastManagerProvider>
      </ToastProvider>
    </I18nextProvider>
  );
}

describe('OpacApp (FEAT-27)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the home page by default with search bar and scan KTA CTA', async () => {
    render(
      <Wrap>
        <OpacApp />
      </Wrap>,
    );
    expect(await screen.findByPlaceholderText(/Cari judul|Search by title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan KTA Saya|Scan My KTA/i })).toBeInTheDocument();
  });

  it('navigates to the search view when the user submits the home search form', async () => {
    render(
      <Wrap>
        <OpacApp />
      </Wrap>,
    );
    const input = await screen.findByPlaceholderText(/Cari judul|Search by title/i);
    fireEvent.change(input, { target: { value: 'sapiens' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Kembali|Back/i })).toBeInTheDocument(),
    );
  });

  it('shows the lock-icon admin unlock button anchored bottom-right', async () => {
    render(
      <Wrap>
        <OpacApp />
      </Wrap>,
    );
    expect(
      await screen.findByRole('button', { name: /Mode Admin|Admin Mode/i }),
    ).toBeInTheDocument();
  });
});
