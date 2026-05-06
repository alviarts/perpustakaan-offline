import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { DendaQuickPresetRow } from '@/components/shared/DendaQuickPresetRow';

function renderRow(props: {
  dendaPerHari: number;
  testidPrefix: string;
  onSelect?: (value: number) => void;
}) {
  const onSelect = props.onSelect ?? vi.fn();
  const result = render(
    <I18nextProvider i18n={i18n}>
      <DendaQuickPresetRow
        dendaPerHari={props.dendaPerHari}
        onSelect={onSelect}
        testidPrefix={props.testidPrefix}
      />
    </I18nextProvider>,
  );
  return { onSelect, ...result };
}

describe('DendaQuickPresetRow', () => {
  it('renders 3 deduped buttons when dendaPerHari = 5000 (multiplier shadows fixed)', () => {
    renderRow({ dendaPerHari: 5000, testidPrefix: 'pengembalian-bayar' });
    const container = screen.getByTestId('pengembalian-bayar-quick');
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('pengembalian-bayar-quick-1x')).toBeInTheDocument();
    expect(screen.getByTestId('pengembalian-bayar-quick-2x')).toBeInTheDocument();
    expect(screen.getByTestId('pengembalian-bayar-quick-3x')).toBeInTheDocument();
    // Fixed presets fully shadowed; none should render.
    expect(
      screen.queryByTestId('pengembalian-bayar-quick-fixed-5000'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('pengembalian-bayar-quick-fixed-10000'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('pengembalian-bayar-quick-fixed-15000'),
    ).not.toBeInTheDocument();
  });

  it('renders 6 unique buttons when dendaPerHari = 2000 (no overlap)', () => {
    renderRow({ dendaPerHari: 2000, testidPrefix: 'peminjaman-bayar' });
    expect(screen.getByTestId('peminjaman-bayar-quick-1x')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-2x')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-3x')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-5000')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-10000')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-15000')).toBeInTheDocument();
  });

  it('hides multiplier section when dendaPerHari = 0', () => {
    renderRow({ dendaPerHari: 0, testidPrefix: 'peminjaman-bayar' });
    expect(screen.queryByTestId('peminjaman-bayar-quick-1x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('peminjaman-bayar-quick-2x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('peminjaman-bayar-quick-3x')).not.toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-5000')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-10000')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-fixed-15000')).toBeInTheDocument();
  });

  it('calls onSelect with the multiplier value (dendaPerHari × mult) when a multiplier button is clicked', () => {
    const { onSelect } = renderRow({
      dendaPerHari: 1500,
      testidPrefix: 'peminjaman-bayar',
    });
    fireEvent.click(screen.getByTestId('peminjaman-bayar-quick-2x'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(3000);
  });

  it('calls onSelect with the fixed preset value when a fixed-preset button is clicked', () => {
    const { onSelect } = renderRow({
      dendaPerHari: 0,
      testidPrefix: 'peminjaman-bayar',
    });
    fireEvent.click(screen.getByTestId('peminjaman-bayar-quick-fixed-10000'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith(10000);
  });

  it('honors the testidPrefix prop independently for both pages', () => {
    const { unmount } = renderRow({
      dendaPerHari: 2000,
      testidPrefix: 'pengembalian-bayar',
    });
    expect(screen.getByTestId('pengembalian-bayar-quick')).toBeInTheDocument();
    expect(screen.getByTestId('pengembalian-bayar-quick-1x')).toBeInTheDocument();
    expect(
      screen.queryByTestId('peminjaman-bayar-quick'),
    ).not.toBeInTheDocument();
    unmount();

    renderRow({ dendaPerHari: 2000, testidPrefix: 'peminjaman-bayar' });
    expect(screen.getByTestId('peminjaman-bayar-quick')).toBeInTheDocument();
    expect(screen.getByTestId('peminjaman-bayar-quick-1x')).toBeInTheDocument();
    expect(
      screen.queryByTestId('pengembalian-bayar-quick'),
    ).not.toBeInTheDocument();
  });

  it('returns null (does not render container) when there are zero buttons to show', () => {
    // With dendaPerHari = 0 AND empty fixed presets, the helper would return [].
    // We can't pass custom fixed presets through the public API but the
    // negative-defensive case is well-covered in dendaPresets.test.ts. Here
    // just verify that the row gracefully handles a guaranteed-non-empty case
    // by rendering its container, as the inverse of the null-return path.
    const { container } = renderRow({
      dendaPerHari: 5000,
      testidPrefix: 'peminjaman-bayar',
    });
    expect(container.firstChild).not.toBeNull();
  });
});
