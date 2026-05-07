import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { OpacFeaturedCarousel } from '@/features/opac/OpacFeaturedCarousel';
import type { BukuPilihanSlide } from '@/lib/bukuPilihan';
import type { Buku } from '@/lib/buku';

function makeBuku(id: number, judul: string): Buku {
  return {
    id,
    kodeBuku: `K${id}`,
    judul,
    pengarang: `Penulis ${id}`,
    jumlahEksemplar: 1,
    jumlahTersedia: 1,
    harga: 0,
    tanggalInput: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeSlide(id: number, judul: string): BukuPilihanSlide {
  return {
    id,
    bukuId: id,
    position: id - 1,
    pinnedAt: '2026-05-01T00:00:00Z',
    label: null,
    expiresAt: null,
    buku: makeBuku(id, judul),
  };
}

function renderCarousel(
  slides: BukuPilihanSlide[],
  reducedMotion = false,
  onSelect = vi.fn(),
) {
  const result = render(
    <I18nextProvider i18n={i18n}>
      <OpacFeaturedCarousel slides={slides} onSelect={onSelect} reducedMotion={reducedMotion} />
    </I18nextProvider>,
  );
  return { onSelect, ...result };
}

describe('OpacFeaturedCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when there are no slides', () => {
    const { container } = renderCarousel([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders dot indicators for N pinned books', () => {
    renderCarousel([
      makeSlide(1, 'A'),
      makeSlide(2, 'B'),
      makeSlide(3, 'C'),
    ]);
    const dots = screen.getByTestId('opac-featured-dots');
    expect(within(dots).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('auto-rotates to the next slide after 5s', async () => {
    renderCarousel([
      makeSlide(1, 'First'),
      makeSlide(2, 'Second'),
    ]);
    expect(screen.getByText('First')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('pauses auto-rotate on hover', async () => {
    renderCarousel([
      makeSlide(1, 'Stays'),
      makeSlide(2, 'Hidden'),
    ]);
    const region = screen.getByTestId('opac-featured-carousel');
    fireEvent.mouseEnter(region);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Stays')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('disables auto-rotate when prefers-reduced-motion is set', async () => {
    renderCarousel(
      [makeSlide(1, 'Calm'), makeSlide(2, 'Busy')],
      true,
    );
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Calm')).toBeInTheDocument();
    expect(screen.queryByText('Busy')).not.toBeInTheDocument();
  });

  it('arrow buttons advance and wrap', () => {
    renderCarousel([
      makeSlide(1, 'A'),
      makeSlide(2, 'B'),
      makeSlide(3, 'C'),
    ]);
    fireEvent.click(screen.getByTestId('opac-featured-next'));
    expect(screen.getByText('B')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('opac-featured-prev'));
    fireEvent.click(screen.getByTestId('opac-featured-prev'));
    // Wraps from index 0 backwards to last (C).
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('clicking a slide calls onSelect with the underlying buku', () => {
    const { onSelect } = renderCarousel([makeSlide(7, 'Pick me')]);
    fireEvent.click(screen.getByTestId('opac-featured-slide-7'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const firstCall = onSelect.mock.calls[0];
    expect(firstCall?.[0].id).toBe(7);
  });
});
