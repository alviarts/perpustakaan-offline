import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OpacAdminUnlockButton } from '@/features/opac/OpacAdminUnlockButton';

function renderButton(verifyResult: boolean | Error) {
  const onVerify = vi.fn(async (_u: string, _p: string) => {
    if (verifyResult instanceof Error) throw verifyResult;
    return verifyResult;
  });
  const onSuccess = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <OpacAdminUnlockButton onVerify={onVerify} onSuccess={onSuccess} />
    </I18nextProvider>,
  );
  return { onVerify, onSuccess };
}

const openDialog = (): void => {
  const trigger = screen.getByRole('button', { name: /Mode Admin/i });
  fireEvent.click(trigger);
};

describe('OpacAdminUnlockButton (FEAT-27)', () => {
  it('opens the password dialog when the lock button is clicked', () => {
    renderButton(true);
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  it('calls onSuccess on a correct password', async () => {
    const { onVerify, onSuccess } = renderButton(true);
    openDialog();
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi|Verify/i }));
    await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1));
    expect(onVerify).toHaveBeenCalledWith('admin', 'admin123');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows an error after a wrong password', async () => {
    const { onSuccess } = renderButton(false);
    openDialog();
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi|Verify/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('locks the form after 3 failed attempts', async () => {
    const { onVerify, onSuccess } = renderButton(false);
    openDialog();

    for (let i = 0; i < 3; i++) {
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: `wrong-${i}` } });
      fireEvent.click(screen.getByRole('button', { name: /Verifikasi|Verify/i }));
      await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(i + 1));
    }

    expect(onSuccess).not.toHaveBeenCalled();
    const submit = screen.getByRole('button', { name: /Verifikasi|Verify/i });
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText(/Password/i)).toBeDisabled();
  });
});
