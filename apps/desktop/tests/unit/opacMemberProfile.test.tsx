import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OpacMemberProfile } from '@/features/opac/OpacMemberProfile';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import type { Anggota } from '@/lib/anggota';

vi.mock('@/lib/peminjaman', () => ({
  peminjamanApi: {
    anggotaLoanHistory: vi.fn(),
  },
}));

vi.mock('@/lib/reservasi', () => ({
  reservasiApi: {
    listByAnggota: vi.fn(),
    cancel: vi.fn(),
  },
}));

import { peminjamanApi } from '@/lib/peminjaman';
import { reservasiApi } from '@/lib/reservasi';

const member: Anggota = {
  id: 1,
  kodeAnggota: 'A001',
  nama: 'Budi Santoso',
  kelas: 'XI IPA 1',
  jurusan: 'IPA',
  tanggalDaftar: '2025-01-01',
  aktif: true,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

function Wrap({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <ToastManagerProvider>
          {children}
          <ToastViewport />
        </ToastManagerProvider>
      </ToastProvider>
    </I18nextProvider>
  );
}

const baseHistory = {
  summary: {
    aktifCount: 1,
    overdueCount: 0,
    totalDenda: 0,
    totalBayar: 0,
    lastPinjam: '2025-01-15',
  },
  topBuku: [],
  history: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  (peminjamanApi.anggotaLoanHistory as Mock).mockResolvedValue(baseHistory);
  (reservasiApi.listByAnggota as Mock).mockResolvedValue([]);
});

describe('OpacMemberProfile', () => {
  it('renders header with nama / kode / kelas / jurusan', async () => {
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('A001')).toBeInTheDocument();
    expect(screen.getByText(/XI IPA 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jurusan|Major/i)).toBeInTheDocument();
  });

  it('shows active loans with overdue badge when past due date', async () => {
    const yesterday = new Date(Date.now() - 86_400_000 * 3).toISOString().slice(0, 10);
    (peminjamanApi.anggotaLoanHistory as Mock).mockResolvedValue({
      ...baseHistory,
      history: [
        {
          peminjamanId: 1,
          nomorPinjam: 'PJ-001',
          tanggalPinjam: '2025-01-01',
          tanggalJatuhTempo: yesterday,
          status: 'dipinjam',
          totalItem: 1,
          totalDenda: 0,
          bukuJudulPertama: 'Sapiens',
        },
      ],
    });
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    expect(await screen.findByText('Sapiens')).toBeInTheDocument();
    expect(screen.getByText(/Terlambat 3 hari|3 days overdue/i)).toBeInTheDocument();
  });

  it('shows denda outstanding card only when totalDenda > totalBayar', async () => {
    (peminjamanApi.anggotaLoanHistory as Mock).mockResolvedValue({
      ...baseHistory,
      summary: { ...baseHistory.summary, totalDenda: 5000, totalBayar: 1000 },
    });
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('opac-profile-denda')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Rp\s*4\.000|IDR/)).toBeInTheDocument();
  });

  it('does not render denda card when zero', async () => {
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    await screen.findByText('Budi Santoso');
    expect(screen.queryByTestId('opac-profile-denda')).not.toBeInTheDocument();
  });

  it('lists active reservasi with queue position and lets the member cancel', async () => {
    (reservasiApi.listByAnggota as Mock).mockResolvedValue([
      {
        id: 7,
        anggotaId: 1,
        anggotaNama: 'Budi Santoso',
        anggotaKode: 'A001',
        bukuId: 99,
        bukuJudul: 'Pulang',
        bukuKode: 'B-99',
        urutan: 2,
        status: 'menunggu',
        slotRak: null,
        tanggalRequest: '2025-01-10',
        tanggalSiapDiambil: null,
        expiredAt: null,
        catatan: null,
        createdAt: '2025-01-10',
        updatedAt: '2025-01-10',
      },
    ]);
    (reservasiApi.cancel as Mock).mockResolvedValue(undefined);
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    expect(await screen.findByText('Pulang')).toBeInTheDocument();
    expect(screen.getByText(/Antrean #2|Queue #2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('opac-reservasi-cancel-7'));
    await waitFor(() => expect(reservasiApi.cancel).toHaveBeenCalledWith(7));
  });

  it('toggles riwayat section open/closed', async () => {
    (peminjamanApi.anggotaLoanHistory as Mock).mockResolvedValue({
      ...baseHistory,
      history: [
        {
          peminjamanId: 5,
          nomorPinjam: 'PJ-005',
          tanggalPinjam: '2025-01-01',
          tanggalJatuhTempo: '2025-01-15',
          tanggalKembali: '2025-01-14',
          status: 'dikembalikan',
          totalItem: 1,
          totalDenda: 0,
          bukuJudulPertama: 'Old Book',
        },
      ],
    });
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={() => {}} onSearchBooks={() => {}} />
      </Wrap>,
    );
    await screen.findByText('Budi Santoso');
    expect(screen.queryByText('Old Book')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('opac-profile-history-toggle'));
    expect(await screen.findByText('Old Book')).toBeInTheDocument();
  });

  it('calls onLogout when the logout button is clicked', async () => {
    const onLogout = vi.fn();
    render(
      <Wrap>
        <OpacMemberProfile member={member} onLogout={onLogout} onSearchBooks={() => {}} />
      </Wrap>,
    );
    await screen.findByText('Budi Santoso');
    fireEvent.click(screen.getByTestId('opac-profile-logout'));
    expect(onLogout).toHaveBeenCalled();
  });
});
