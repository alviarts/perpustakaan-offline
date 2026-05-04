import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

vi.mock('@/components/ui/toast-manager', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({
  getSecurityQuestion: vi.fn<(username: string) => Promise<string | null>>(),
  resetViaSecurityQuestion:
    vi.fn<(args: { username: string; answer: string; newPassword: string }) => Promise<void>>(),
  setSecurityQuestion: vi.fn(),
}));

vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getSecurityQuestion: mocks.getSecurityQuestion,
    resetViaSecurityQuestion: mocks.resetViaSecurityQuestion,
    setSecurityQuestion: mocks.setSecurityQuestion,
  };
});

import { ForgotPasswordDialog } from '@/features/auth/ForgotPasswordDialog';

i18n.init({
  lng: 'id',
  fallbackLng: 'id',
  defaultNS: 'auth',
  ns: ['auth'],
  resources: {
    id: {
      auth: {
        forgot: {
          title: 'Reset Kata Sandi',
          intro: 'Aplikasi luring.',
          steps: { username: '1. Konfirmasi pengguna', answer: '2. Jawab pertanyaan' },
          fields: {
            username: 'Nama pengguna',
            usernamePlaceholder: 'Masukkan nama pengguna',
            answer: 'Jawaban Anda',
            answerPlaceholder: 'Tidak peka huruf besar/kecil',
            newPassword: 'Kata sandi baru',
            newPasswordPlaceholder: 'Min 6 karakter',
            confirmPassword: 'Ulangi kata sandi baru',
          },
          actions: {
            next: 'Lanjut',
            submit: 'Atur kata sandi baru',
            cancel: 'Batal',
            back: 'Kembali',
          },
          feedback: {
            noQuestion: 'Pengguna belum mengatur pertanyaan keamanan.',
            passwordMismatch: 'Konfirmasi tidak cocok.',
            passwordTooShort: 'Kata sandi minimal 6 karakter.',
            wrongAnswer: 'Jawaban salah.',
            success: 'Kata sandi direset.',
            generic: 'Tidak bisa memproses.',
          },
          questionLabel: 'Pertanyaan keamanan',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
});

function renderDialog(): { onOpenChange: ReturnType<typeof vi.fn> } {
  const onOpenChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ForgotPasswordDialog open={true} onOpenChange={onOpenChange} />
    </I18nextProvider>,
  );
  return { onOpenChange };
}

beforeEach(() => {
  mocks.getSecurityQuestion.mockReset();
  mocks.resetViaSecurityQuestion.mockReset();
});

describe('ForgotPasswordDialog', () => {
  it('shows the username step initially', () => {
    renderDialog();
    expect(screen.getByTestId('forgot-step-username')).toBeInTheDocument();
    expect(screen.queryByTestId('forgot-step-reset')).toBeNull();
  });

  it('surfaces the noQuestion error when backend returns null', async () => {
    mocks.getSecurityQuestion.mockResolvedValue(null);
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'ghost' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await waitFor(() =>
      expect(screen.getByTestId('forgot-error')).toHaveTextContent(/belum mengatur pertanyaan/i),
    );
    expect(screen.queryByTestId('forgot-step-reset')).toBeNull();
  });

  it('advances to reset step when a question is returned', async () => {
    mocks.getSecurityQuestion.mockResolvedValue('Nama hewan peliharaan pertama?');
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await waitFor(() => expect(screen.getByTestId('forgot-step-reset')).toBeInTheDocument());
    expect(screen.getByTestId('forgot-question')).toHaveTextContent(
      /Nama hewan peliharaan pertama/i,
    );
    expect(mocks.getSecurityQuestion).toHaveBeenCalledWith('admin');
  });

  it('rejects mismatched password confirmation without calling backend', async () => {
    mocks.getSecurityQuestion.mockResolvedValue('Q?');
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await screen.findByTestId('forgot-step-reset');
    fireEvent.change(screen.getByPlaceholderText('Tidak peka huruf besar/kecil'), {
      target: { value: 'kucing' },
    });
    fireEvent.change(screen.getByPlaceholderText('Min 6 karakter'), {
      target: { value: 'pass1234' },
    });
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByTestId('forgot-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('forgot-error')).toHaveTextContent(/tidak cocok/i),
    );
    expect(mocks.resetViaSecurityQuestion).not.toHaveBeenCalled();
  });

  it('rejects too-short password without calling backend', async () => {
    mocks.getSecurityQuestion.mockResolvedValue('Q?');
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await screen.findByTestId('forgot-step-reset');
    fireEvent.change(screen.getByPlaceholderText('Tidak peka huruf besar/kecil'), {
      target: { value: 'kucing' },
    });
    fireEvent.change(screen.getByPlaceholderText('Min 6 karakter'), {
      target: { value: 'abc' },
    });
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByTestId('forgot-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('forgot-error')).toHaveTextContent(/minimal 6 karakter/i),
    );
    expect(mocks.resetViaSecurityQuestion).not.toHaveBeenCalled();
  });

  it('maps invalid_credentials backend error to wrongAnswer', async () => {
    mocks.getSecurityQuestion.mockResolvedValue('Q?');
    mocks.resetViaSecurityQuestion.mockRejectedValue(new Error('invalid_credentials'));
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await screen.findByTestId('forgot-step-reset');
    fireEvent.change(screen.getByPlaceholderText('Tidak peka huruf besar/kecil'), {
      target: { value: 'wrong' },
    });
    fireEvent.change(screen.getByPlaceholderText('Min 6 karakter'), {
      target: { value: 'pass1234' },
    });
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), {
      target: { value: 'pass1234' },
    });
    fireEvent.click(screen.getByTestId('forgot-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('forgot-error')).toHaveTextContent(/jawaban salah/i),
    );
  });

  it('calls backend and closes on success', async () => {
    mocks.getSecurityQuestion.mockResolvedValue('Q?');
    mocks.resetViaSecurityQuestion.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ForgotPasswordDialog open={true} onOpenChange={onOpenChange} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama pengguna'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByTestId('forgot-next'));
    await screen.findByTestId('forgot-step-reset');
    fireEvent.change(screen.getByPlaceholderText('Tidak peka huruf besar/kecil'), {
      target: { value: 'kucing' },
    });
    fireEvent.change(screen.getByPlaceholderText('Min 6 karakter'), {
      target: { value: 'pass1234' },
    });
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), {
      target: { value: 'pass1234' },
    });
    fireEvent.click(screen.getByTestId('forgot-submit'));
    await waitFor(() =>
      expect(mocks.resetViaSecurityQuestion).toHaveBeenCalledWith({
        username: 'admin',
        answer: 'kucing',
        newPassword: 'pass1234',
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
