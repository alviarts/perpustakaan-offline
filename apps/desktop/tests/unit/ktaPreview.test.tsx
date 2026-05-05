import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { KtaPreview } from '@/features/kta/KtaPreview';
import { defaultLayout } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';

const identity: LibraryIdentity = {
  nama: 'SMA Test',
  alamat: '-',
  kepala: '-',
  npsn: '-',
  tahunAjaran: '2024/2025',
  logoPath: '',
  kontak: '-',
  ttdKepsekPath: '',
  kepalaSekolah: '',
};

describe('KtaPreview', () => {
  it('uses fixed pixel size when scale is given (default)', () => {
    const { getByTestId } = render(
      <KtaPreview layout={defaultLayout()} anggota={null} identity={identity} scale={2} />,
    );
    const el = getByTestId('kta-preview');
    // 85.6 mm * 3.78 px/mm * 2 = 647.136 → rounded 647
    expect(el.style.width).toBe('647px');
    // 53.98 * 3.78 * 2 = 408.0888 → rounded 408
    expect(el.style.height).toBe('408px');
    expect(el.style.aspectRatio).toBe('');
  });

  it('stretches to container width with aspect-ratio when fitToWidth is true', () => {
    const { getByTestId } = render(
      <KtaPreview layout={defaultLayout()} anggota={null} identity={identity} fitToWidth />,
    );
    const el = getByTestId('kta-preview');
    expect(el.style.width).toBe('100%');
    // jsdom normalises mixed-precision values; assert both numerator and denominator are present.
    expect(el.style.aspectRatio).toContain('85.6');
    expect(el.style.aspectRatio).toContain('53.98');
    expect(el.style.height).toBe('');
  });
});
