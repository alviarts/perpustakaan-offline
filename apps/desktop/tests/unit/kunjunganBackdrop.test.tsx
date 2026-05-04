import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { KunjunganBackdrop } from '@/features/kunjungan/KunjunganBackdrop';

describe('KunjunganBackdrop', () => {
  it('renders three composition layers (reader, shelf, trend)', () => {
    const { getByTestId } = render(<KunjunganBackdrop />);
    expect(getByTestId('kunjungan-backdrop')).toBeInTheDocument();
    expect(getByTestId('backdrop-reader')).toBeInTheDocument();
    expect(getByTestId('backdrop-shelf')).toBeInTheDocument();
    expect(getByTestId('backdrop-trend')).toBeInTheDocument();
  });

  it('marks the backdrop aria-hidden and pointer-events-none so it never steals focus or clicks', () => {
    const { getByTestId } = render(<KunjunganBackdrop />);
    const root = getByTestId('kunjungan-backdrop');
    expect(root).toHaveAttribute('aria-hidden');
    expect(root.className).toMatch(/pointer-events-none/);
    expect(root.className).toMatch(/-z-10/);
  });

  it('uses currentColor for stroke + fill so the illustration adapts to the active theme', () => {
    const { container } = render(<KunjunganBackdrop />);
    const colored = container.querySelectorAll('[stroke="currentColor"], [fill="currentColor"]');
    // Three SVGs combined contribute >20 vector primitives (book, shelf, trend).
    expect(colored.length).toBeGreaterThan(20);
  });

  it('uses text-primary on every SVG layer so the theme primary token drives the colour', () => {
    const { container } = render(<KunjunganBackdrop />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
    for (const svg of svgs) {
      expect(svg.getAttribute('class') ?? '').toMatch(/text-primary/);
    }
  });
});
