import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

export interface DashboardKpi {
  totalAnggota: number;
  totalBuku: number;
  bukuDipinjam: number;
  deltaAnggotaPct: number;
  deltaBukuPct: number;
  deltaPinjamPct: number;
}

export interface DdcSlice {
  kelas: string;
  label: string;
  count: number;
}

export interface DayBucket {
  tanggal: string;
  jumlah: number;
}

export interface TopPeminjam {
  anggotaId: number;
  nama: string;
  kodeAnggota: string;
  kelas: string | null;
  jumlah: number;
}

export interface TopBuku {
  bukuId: number;
  kode: string;
  judul: string;
  pengarang: string | null;
  jumlah: number;
}

export interface DashboardRpc {
  kpi: () => Promise<DashboardKpi>;
  ddc: () => Promise<DdcSlice[]>;
  kunjungan7d: () => Promise<DayBucket[]>;
  topPeminjam: (limit?: number) => Promise<TopPeminjam[]>;
  topBuku: (limit?: number) => Promise<TopBuku[]>;
}

const tauriRpc: DashboardRpc = {
  kpi: () => invoke<DashboardKpi>('dashboard_kpi'),
  ddc: () => invoke<DdcSlice[]>('dashboard_ddc_distribution'),
  kunjungan7d: () => invoke<DayBucket[]>('dashboard_kunjungan_7d'),
  topPeminjam: (limit) => invoke<TopPeminjam[]>('dashboard_top_peminjam', { limit }),
  topBuku: (limit) => invoke<TopBuku[]>('dashboard_top_buku', { limit }),
};

const DDC_LABELS: Record<string, string> = {
  '0': 'Karya Umum',
  '1': 'Filsafat',
  '2': 'Agama',
  '3': 'Ilmu Sosial',
  '4': 'Bahasa',
  '5': 'Sains',
  '6': 'Teknologi',
  '7': 'Kesenian',
  '8': 'Sastra',
  '9': 'Sejarah & Geografi',
  '?': 'Lainnya',
};

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const mockRpc: DashboardRpc = {
  async kpi() {
    return {
      totalAnggota: 128,
      totalBuku: 1843,
      bukuDipinjam: 24,
      deltaAnggotaPct: pctDelta(128, 120),
      deltaBukuPct: pctDelta(1843, 1810),
      deltaPinjamPct: pctDelta(24, 18),
    };
  },
  async ddc() {
    const seed: Array<[string, number]> = [
      ['0', 32],
      ['1', 18],
      ['2', 64],
      ['3', 121],
      ['4', 22],
      ['5', 88],
      ['6', 47],
      ['7', 12],
      ['8', 36],
      ['9', 19],
    ];
    return seed.map(([kelas, count]) => ({
      kelas,
      label: DDC_LABELS[kelas] ?? kelas,
      count,
    }));
  },
  async kunjungan7d() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const tanggal = d.toISOString().slice(0, 10);
      const jumlah = 8 + ((i * 7 + 11) % 14);
      return { tanggal, jumlah };
    });
  },
  async topPeminjam() {
    return [
      { anggotaId: 1, nama: 'Adelia Putri', kodeAnggota: 'A0007', kelas: 'XI IPA 1', jumlah: 14 },
      { anggotaId: 2, nama: 'Bagas Saputra', kodeAnggota: 'A0012', kelas: 'X IPS 2', jumlah: 11 },
      { anggotaId: 3, nama: 'Citra Lestari', kodeAnggota: 'A0021', kelas: 'XII IPA 3', jumlah: 9 },
      { anggotaId: 4, nama: 'Dani Pratama', kodeAnggota: 'A0034', kelas: 'X IPA 1', jumlah: 8 },
      { anggotaId: 5, nama: 'Erika Yulianti', kodeAnggota: 'A0045', kelas: 'XI IPS 1', jumlah: 6 },
    ];
  },
  async topBuku() {
    return [
      { bukuId: 1, kode: 'B0042', judul: 'Bumi Manusia', pengarang: 'Pramoedya A. Toer', jumlah: 21 },
      { bukuId: 2, kode: 'B0017', judul: 'Laskar Pelangi', pengarang: 'Andrea Hirata', jumlah: 17 },
      { bukuId: 3, kode: 'B0089', judul: 'Negeri 5 Menara', pengarang: 'Ahmad Fuadi', jumlah: 13 },
      { bukuId: 4, kode: 'B0123', judul: 'Atomic Habits', pengarang: 'James Clear', jumlah: 11 },
      { bukuId: 5, kode: 'B0211', judul: 'Sapiens', pengarang: 'Yuval Noah Harari', jumlah: 9 },
    ];
  },
};

export const dashboardApi: DashboardRpc = isTauri() ? tauriRpc : mockRpc;

export function calcDeltaPct(current: number, previous: number): number {
  return pctDelta(current, previous);
}

export const DDC_LABEL_MAP: Readonly<Record<string, string>> = DDC_LABELS;
