import { describe, expect, it } from 'vitest';
import {
  buildLaporanEksekutifHtml,
  generateLaporanEksekutifPdf,
  type LaporanEksekutifData,
  type LaporanEksekutifInput,
} from '@/lib/pdf/laporanEksekutif';

const PERIOD = { startIso: '2026-05-01', endIso: '2026-05-31' };
const FIXED_AT = new Date('2026-05-31T08:00:00Z');

const IDENTITAS = {
  nama: 'SMA Negeri 1 Demo',
  alamat: 'Jl. Pendidikan 1',
  kepala: 'Drs. Budi <Demo>',
  npsn: '20100001',
  tahunAjaran: '2025/2026',
};

function buildData(overrides: Partial<LaporanEksekutifData> = {}): LaporanEksekutifData {
  return {
    kpi: {
      totalAnggotaAktif: 120,
      totalBuku: 540,
      peminjamanPeriode: 33,
      dendaOutstanding: 87_500,
    },
    weeklyLoans: [
      { bucket: 'M1 Mei', count: 6 },
      { bucket: 'M2 Mei', count: 12 },
      { bucket: 'M3 Mei', count: 9 },
      { bucket: 'M4 Mei', count: 6 },
    ],
    topBuku: [
      { judul: 'Bumi Manusia', count: 8 },
      { judul: 'Laut Bercerita', count: 5 },
    ],
    topAnggota: [
      { nama: 'Siti', kelas: 'X-IPA-1', count: 7 },
      { nama: 'Rudi', kelas: 'X-IPS-2', count: 5 },
    ],
    anggotaDendaTinggi: [
      { nama: 'Andi', kelas: 'XI-IPA-3', outstanding: 75_000 },
      { nama: 'Below threshold', outstanding: 30_000 },
    ],
    bukuReservasiTanpaStok: [
      { judul: 'Atomic Habits', reservasiCount: 3 },
    ],
    ...overrides,
  };
}

function build(overrides: Partial<LaporanEksekutifInput> = {}): string {
  return buildLaporanEksekutifHtml({
    period: PERIOD,
    identitas: IDENTITAS,
    data: buildData(),
    generatedAt: FIXED_AT,
    ...overrides,
  });
}

describe('buildLaporanEksekutifHtml (C1-LaporanEksekutifPDF)', () => {
  it('renders identitas, period, all KPI numbers, and all three chart sections', () => {
    const html = build();
    expect(html).toContain('SMA Negeri 1 Demo');
    expect(html).toContain('NPSN: 20100001');
    expect(html).toContain('TA: 2025/2026');
    // Period rendered in id-ID long form
    expect(html).toMatch(/01 Mei 2026.*31 Mei 2026/);
    // KPI numbers (id-ID locale uses '.' as thousands sep)
    expect(html).toContain('120');
    expect(html).toContain('540');
    expect(html).toContain('33');
    expect(html).toMatch(/Rp\s?87\.500/);
    // Three sub-sections
    expect(html).toContain('Peminjaman per minggu');
    expect(html).toContain('Top 5 Buku');
    expect(html).toContain('Top 5 Anggota Peminjam');
  });

  it('escapes HTML in identitas to prevent injection', () => {
    const html = build();
    expect(html).toContain('Drs. Budi &lt;Demo&gt;');
    expect(html).not.toContain('Drs. Budi <Demo>');
  });

  it('renders the empty-state note when no peminjaman in period', () => {
    const data = buildData({
      kpi: {
        totalAnggotaAktif: 120,
        totalBuku: 540,
        peminjamanPeriode: 0,
        dendaOutstanding: 0,
      },
      weeklyLoans: [],
    });
    const html = buildLaporanEksekutifHtml({ period: PERIOD, data, generatedAt: FIXED_AT });
    expect(html).toContain('Tidak ada peminjaman dalam periode ini');
    expect(html).not.toContain('Peminjaman per minggu');
  });

  it('includes action items only for anggota whose denda is above threshold (Rp 50.000)', () => {
    const html = build();
    expect(html).toContain('Andi');
    expect(html).toMatch(/denda Rp\s?75\.000/);
    expect(html).not.toContain('Below threshold');
  });

  it('includes book-reservasi action items when stok is exhausted', () => {
    const html = build();
    expect(html).toContain('Atomic Habits');
    expect(html).toContain('3 reservasi');
    expect(html).toContain('pertimbangkan pengadaan');
  });

  it('falls back to placeholder action-item note when none triggered', () => {
    const data = buildData({
      anggotaDendaTinggi: [],
      bukuReservasiTanpaStok: [],
    });
    const html = buildLaporanEksekutifHtml({ period: PERIOD, data, generatedAt: FIXED_AT });
    expect(html).toContain('Tidak ada item tindak lanjut otomatis');
  });

  it('uses fallback library name when identitas is omitted', () => {
    const data = buildData();
    const html = buildLaporanEksekutifHtml({ period: PERIOD, data, generatedAt: FIXED_AT });
    expect(html).toContain('Perpustakaan');
  });

  it('renders a kepala-sekolah signature placeholder when name missing', () => {
    const data = buildData();
    const html = buildLaporanEksekutifHtml({
      period: PERIOD,
      identitas: { nama: 'Demo' },
      data,
      generatedAt: FIXED_AT,
    });
    expect(html).toContain('(__________________)');
  });
});

describe('generateLaporanEksekutifPdf', () => {
  it('returns a non-empty Blob with HTML content type', () => {
    // jsdom returns null from window.open by default; stub a minimal popup so
    // the print path completes without throwing.
    const fakeWin = {
      document: { open() {}, write() {}, close() {} },
      focus() {},
      print() {},
    } as unknown as Window;
    const original = window.open;
    window.open = (() => fakeWin) as typeof window.open;
    try {
      const blob = generateLaporanEksekutifPdf({
        period: PERIOD,
        identitas: IDENTITAS,
        data: buildData(),
        generatedAt: FIXED_AT,
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(500);
      expect(blob.type).toContain('text/html');
    } finally {
      window.open = original;
    }
  });
});
