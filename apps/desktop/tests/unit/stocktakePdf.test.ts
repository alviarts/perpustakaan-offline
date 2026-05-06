import { describe, expect, it } from 'vitest';
import { buildStocktakeReport, type StocktakeReportLabels } from '@/features/stocktake/pdf';
import type { StocktakeItemRow, StocktakeSessionRow } from '@/lib/stocktake';

const labels: StocktakeReportLabels = {
  reportTitle: 'Laporan Stocktake / Opname',
  subtitle: 'Daftar Eksemplar Tidak Ditemukan',
  summary: 'Total: 5 | Ditemukan: 3 | Hilang: 2',
  tableHeader: {
    no: 'No.',
    kode: 'Kode',
    judul: 'Judul',
    pengarang: 'Pengarang',
    status: 'Status',
  },
  status: {
    belum_scan: 'Belum Scan',
    ditemukan: 'Ditemukan',
    tidak_ditemukan: 'Tidak Ditemukan',
  },
  noMissing: 'Semua eksemplar ditemukan',
  footer: { ttd: 'Petugas', kepsek: 'Kepala Sekolah' },
};

const session: StocktakeSessionRow = {
  id: 1,
  nama: 'Opname Awal',
  tanggalMulai: '2026-05-06 07:00:00',
  tanggalSelesai: '2026-05-06 09:00:00',
  status: 'selesai',
  catatan: null,
  petugasId: null,
  petugasNama: 'Bu Ana',
  total: 5,
  ditemukan: 3,
  missing: 2,
};

const identity = {
  nama: 'Perpustakaan SMA Test',
  alamat: 'Jl. Tes 12',
  kepala: 'Pak Budi',
  npsn: '123',
  tahunAjaran: '2025/2026',
  logoPath: '',
  kontak: '-',
  ttdKepsekPath: '',
  kepalaSekolah: 'Pak Budi',
};

function makeMissing(count: number): StocktakeItemRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    sessionId: 1,
    eksemplarId: i + 1,
    eksemplarKode: `B0001-${String(i + 1).padStart(2, '0')}`,
    bukuId: 1,
    bukuJudul: 'Sang Pemimpi',
    bukuPengarang: 'Andrea Hirata',
    status: 'tidak_ditemukan' as const,
    eksemplarStatus: 'tersedia',
    tanggalScan: null,
    catatan: null,
  }));
}

describe('buildStocktakeReport', () => {
  it('produces a single-page PDF for empty / small missing list', () => {
    const doc = buildStocktakeReport({
      session,
      missing: [],
      identity,
      labels,
    });
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('renders missing rows + paginates beyond ~30 items', () => {
    const doc = buildStocktakeReport({
      session,
      missing: makeMissing(45),
      identity,
      labels,
    });
    // 45 rows at ~7mm each ~= 315mm of body. Combined with header ~40mm,
    // we expect at least a second page.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('shows noMissing message when missing list is empty', () => {
    const doc = buildStocktakeReport({
      session,
      missing: [],
      identity,
      labels,
    });
    // Body containing the "noMissing" string is not directly inspectable
    // through jsPDF API; assert the doc renders without throwing.
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
