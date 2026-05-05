/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defaultLayout } from '@/lib/kta';
import type { Anggota } from '@/lib/anggota';
import type { LibraryIdentity } from '@/stores/identityStore';

vi.mock('@/lib/assets', () => ({
  assetsApi: {
    upload: vi.fn(),
    resolve: vi.fn(),
    readDataUrl: vi.fn(async (path: string) => {
      // Pretend we resolved the file to a 1×1 transparent PNG.
      if (path === 'uploads/foo.png') {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      }
      throw new Error('not found');
    }),
    delete: vi.fn(),
  },
}));

const identity: LibraryIdentity = {
  nama: 'SMA Test',
  alamat: '-',
  kepala: '-',
  npsn: '-',
  tahunAjaran: '2024/2025',
  logoPath: '',
  kontak: '-',
};

function makeAnggota(overrides: Partial<Anggota> = {}): Anggota {
  return {
    id: 1,
    kodeAnggota: 'A001',
    nama: 'Budi',
    jenisKelamin: 'L',
    kelas: 'XII IPA 1',
    jurusan: null,
    agama: null,
    tanggalLahir: null,
    alamat: null,
    noTelp: null,
    email: null,
    fotoPath: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildKtaPrintHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inlines the foto as a data URL when fotoPath is set', async () => {
    const { buildKtaPrintHtml } = await import('@/features/kta/print');
    const html = await buildKtaPrintHtml({
      layout: defaultLayout(),
      anggota: [makeAnggota({ fotoPath: 'uploads/foo.png' })],
      identity,
    });
    // The foto must appear as a base64 data URL inside the HTML — no raw
    // file path leaks through that the popup window cannot resolve.
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('src="uploads/foo.png"');
  });

  it('falls back to an SVG placeholder when fotoPath is null', async () => {
    const { buildKtaPrintHtml } = await import('@/features/kta/print');
    const html = await buildKtaPrintHtml({
      layout: defaultLayout(),
      anggota: [makeAnggota({ fotoPath: null })],
      identity,
    });
    expect(html).toContain('data:image/svg+xml');
    expect(html).toContain('FOTO');
  });

  it('falls back to placeholder when readDataUrl throws (e.g. missing file)', async () => {
    const { buildKtaPrintHtml } = await import('@/features/kta/print');
    const html = await buildKtaPrintHtml({
      layout: defaultLayout(),
      anggota: [makeAnggota({ fotoPath: 'uploads/missing.png' })],
      identity,
    });
    // assetsApi mock throws for any path other than uploads/foo.png.
    expect(html).toContain('data:image/svg+xml');
  });

  it('renders the QR as a data URL', async () => {
    const { buildKtaPrintHtml } = await import('@/features/kta/print');
    const html = await buildKtaPrintHtml({
      layout: defaultLayout(),
      anggota: [makeAnggota()],
      identity,
    });
    // qrcode lib emits image/png data URLs.
    expect(html).toMatch(/data:image\/png;base64,/);
  });

  it('produces a card sized to the layout dimensions', async () => {
    const { buildKtaPrintHtml } = await import('@/features/kta/print');
    const html = await buildKtaPrintHtml({
      layout: defaultLayout(), // 85.6mm × 53.98mm
      anggota: [makeAnggota()],
      identity,
    });
    // 85.6 * 3.78 = 323.568 → 324 (rounded), 53.98 * 3.78 = 204.0444 → 204
    expect(html).toContain('width:324px;height:204px');
  });
});
