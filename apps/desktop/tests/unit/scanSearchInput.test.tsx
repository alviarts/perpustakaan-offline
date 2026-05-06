/**
 * @vitest-environment jsdom
 *
 * Tests for ScanSearchInput (FEAT-Sirkulasi-Search).
 *
 * Confirms:
 * - Slow human typing opens a results dropdown after debounce.
 * - USB hand-scanner burst (≤ 35 ms inter-key, ends in Enter)
 *   bypasses the dropdown and submits the raw kode.
 * - ArrowDown + Enter picks a highlighted result.
 * - Escape closes the dropdown.
 * - `enableBukuSearch={false}` hides the buku section even when
 *   the API returns books.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import idSirkulasi from '@/i18n/id/sirkulasi.json';
import idCommon from '@/i18n/id/common.json';
import type { Anggota } from '@/lib/anggota';
import type { Buku } from '@/lib/buku';

const mockListAnggota = vi.fn();
const mockListBuku = vi.fn();

vi.mock('@/lib/anggota', () => ({
  anggotaApi: {
    list: (args: unknown) => mockListAnggota(args),
  },
}));
vi.mock('@/lib/buku', () => ({
  bukuApi: {
    list: (args: unknown) => mockListBuku(args),
  },
}));

import { ScanSearchInput } from '@/features/sirkulasi/ScanSearchInput';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'id',
    resources: {
      id: { sirkulasi: idSirkulasi, common: idCommon },
    },
    interpolation: { escapeValue: false },
  });
}

const sampleAnggota: Anggota[] = [
  {
    id: 1,
    kodeAnggota: 'M-001',
    nama: 'Alif Pratama',
    kelas: 'XII IPA 1',
    jurusan: null,
    aktif: true,
  } as Anggota,
  {
    id: 2,
    kodeAnggota: 'M-002',
    nama: 'Alika Sari',
    kelas: 'XI IPS 2',
    jurusan: null,
    aktif: true,
  } as Anggota,
];

const sampleBuku: Buku[] = [
  {
    id: 10,
    kodeBuku: 'B-100',
    judul: 'Aliran Sungai Pengetahuan',
    pengarang: 'Andrea Hirata',
    jumlahTersedia: 2,
  } as Buku,
];

function renderInput(overrides: Partial<React.ComponentProps<typeof ScanSearchInput>> = {}) {
  const onSubmitKode = vi.fn();
  const onPickAnggota = vi.fn();
  const onPickBuku = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ScanSearchInput
        onSubmitKode={onSubmitKode}
        onPickAnggota={onPickAnggota}
        onPickBuku={onPickBuku}
        {...overrides}
      />
    </I18nextProvider>,
  );
  return { onSubmitKode, onPickAnggota, onPickBuku };
}

describe('ScanSearchInput (FEAT-Sirkulasi-Search)', () => {
  beforeEach(() => {
    mockListAnggota.mockReset();
    mockListBuku.mockReset();
    mockListAnggota.mockResolvedValue({ items: sampleAnggota, total: sampleAnggota.length });
    mockListBuku.mockResolvedValue({ items: sampleBuku, total: sampleBuku.length });
  });

  it('opens the results dropdown after a slow typed query', async () => {
    renderInput();
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;
    // fireEvent.change is one bulk change — the burst tracker only
    // fires on keystrokes, so it stays cold and the typed value
    // looks like a search query.
    fireEvent.change(input, { target: { value: 'ali' } });
    await waitFor(() => {
      expect(screen.getByTestId('scan-search-dropdown')).toBeInTheDocument();
    });
    expect(screen.getByText('Alif Pratama')).toBeInTheDocument();
    expect(screen.getByText('Alika Sari')).toBeInTheDocument();
    expect(screen.getByText('Aliran Sungai Pengetahuan')).toBeInTheDocument();
  });

  it('USB scanner burst submits the raw kode without opening the dropdown', async () => {
    const props = renderInput();
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;

    // Simulate a tight burst (under 35 ms inter-key) of 8 keys + Enter.
    const payload = '12345678';
    for (const ch of payload) {
      // keyDown drives the burst tracker; the input value is set
      // separately to mimic real scanner behaviour.
      fireEvent.keyDown(input, { key: ch });
    }
    fireEvent.change(input, { target: { value: payload } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(props.onSubmitKode).toHaveBeenCalledWith(payload);
    });
    expect(props.onPickAnggota).not.toHaveBeenCalled();
    expect(props.onPickBuku).not.toHaveBeenCalled();
    // Dropdown must not be visible — the search runs on `value`
    // change, but the Enter handler short-circuits because the
    // dropdown is closed and the burst tracker fired.
    expect(screen.queryByTestId('scan-search-dropdown')).toBeNull();
  });

  it('ArrowDown + Enter picks the highlighted result', async () => {
    const props = renderInput();
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });
    await waitFor(() => screen.getByTestId('scan-search-dropdown'));

    // First item is highlighted by default — ArrowDown moves to second.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onPickAnggota).toHaveBeenCalledTimes(1);
    const firstCall = props.onPickAnggota.mock.calls[0];
    expect(firstCall?.[0]?.id).toBe(2);
    expect(props.onSubmitKode).not.toHaveBeenCalled();
  });

  it('Escape closes the dropdown without submitting', async () => {
    const props = renderInput();
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });
    await waitFor(() => screen.getByTestId('scan-search-dropdown'));
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('scan-search-dropdown')).toBeNull();
    });
    expect(props.onPickAnggota).not.toHaveBeenCalled();
    expect(props.onPickBuku).not.toHaveBeenCalled();
    expect(props.onSubmitKode).not.toHaveBeenCalled();
  });

  it('enableBukuSearch=false hides the buku section', async () => {
    renderInput({ enableBukuSearch: false });
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });
    await waitFor(() => screen.getByTestId('scan-search-dropdown'));
    // Anggota still rendered.
    expect(screen.getByText('Alif Pratama')).toBeInTheDocument();
    // Buku must not be requested at all.
    expect(mockListBuku).not.toHaveBeenCalled();
    expect(screen.queryByText('Aliran Sungai Pengetahuan')).toBeNull();
  });

  it('manual typed kode + Enter (no dropdown match) falls through to onSubmitKode', async () => {
    mockListAnggota.mockResolvedValue({ items: [], total: 0 });
    mockListBuku.mockResolvedValue({ items: [], total: 0 });
    const props = renderInput();
    const input = screen.getByTestId('scan-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'EX-999' } });
    // Wait for the debounce to settle (no dropdown opens).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(screen.queryByTestId('scan-search-dropdown')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSubmitKode).toHaveBeenCalledWith('EX-999');
  });
});
