import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OpacScanLockedDialog } from '@/features/opac/OpacScanLockedDialog';

function Wrap({ children }: { children: React.ReactNode }): JSX.Element {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

describe('OpacScanLockedDialog (FEAT-OPAC-Scan-Locked)', () => {
  it('renders the current member name in the title when open', () => {
    render(
      <Wrap>
        <OpacScanLockedDialog
          open
          onOpenChange={() => {}}
          memberName="Budi Santoso"
          onLogoutAndScan={() => {}}
        />
      </Wrap>,
    );
    expect(
      screen.getByText(/Anggota lain masih login: Budi Santoso|Another member is still signed in: Budi Santoso/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Logout & Scan|Sign out & Scan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Batal$|^Cancel$/i }),
    ).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Wrap>
        <OpacScanLockedDialog
          open={false}
          onOpenChange={() => {}}
          memberName="Budi Santoso"
          onLogoutAndScan={() => {}}
        />
      </Wrap>,
    );
    expect(screen.queryByTestId('opac-scan-locked-dialog')).not.toBeInTheDocument();
  });

  it('invokes onLogoutAndScan when Logout & Scan is clicked', () => {
    const onLogoutAndScan = vi.fn();
    render(
      <Wrap>
        <OpacScanLockedDialog
          open
          onOpenChange={() => {}}
          memberName="Siti Aisyah"
          onLogoutAndScan={onLogoutAndScan}
        />
      </Wrap>,
    );
    fireEvent.click(screen.getByTestId('opac-scan-locked-logout'));
    expect(onLogoutAndScan).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenChange(false) when Batal is clicked and does not call onLogoutAndScan', () => {
    const onOpenChange = vi.fn();
    const onLogoutAndScan = vi.fn();
    render(
      <Wrap>
        <OpacScanLockedDialog
          open
          onOpenChange={onOpenChange}
          memberName="Siti Aisyah"
          onLogoutAndScan={onLogoutAndScan}
        />
      </Wrap>,
    );
    fireEvent.click(screen.getByTestId('opac-scan-locked-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onLogoutAndScan).not.toHaveBeenCalled();
  });
});
