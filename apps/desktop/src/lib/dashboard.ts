import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

export interface DashboardKpi {
  totalAnggota: number;
  /** Number of distinct titles in the catalog. Headline metric on the "Total Buku" KPI card. */
  totalBuku: number;
  /** Sum of `jumlah_eksemplar` across all buku — physical copies. Sub-line on the "Total Buku" KPI card. */
  totalEksemplar: number;
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

/**
 * FEAT-25 — extended analytics. The trend chart toggles between four time
 * windows; each window has a deterministic bucket count and key format so
 * the front-end can pre-allocate axis ticks without an extra round trip.
 */
export type TrendWindow = 'days7' | 'days30' | 'months6' | 'year1';

export interface TrendBucket {
  /** YYYY-MM-DD for daily buckets, YYYY-MM for monthly buckets. */
  bucket: string;
  count: number;
}

export interface HeatCell {
  /** Day of week, 0 = Sunday … 6 = Saturday (matches SQLite strftime('%w')). */
  dow: number;
  hour: number;
  count: number;
}

export interface DashboardInsights {
  topBukuThisMonth: TopBuku | null;
  topPeminjamThisMonth: TopPeminjam | null;
  avgLoansPerMember: number;
  avgLoanDurationDays: number;
}

export interface DashboardRpc {
  kpi: () => Promise<DashboardKpi>;
  ddc: () => Promise<DdcSlice[]>;
  kunjungan7d: () => Promise<DayBucket[]>;
  topPeminjam: (limit?: number) => Promise<TopPeminjam[]>;
  topBuku: (limit?: number) => Promise<TopBuku[]>;
  trend: (window: TrendWindow) => Promise<TrendBucket[]>;
  heatmap: () => Promise<HeatCell[]>;
  insights: () => Promise<DashboardInsights>;
}

const tauriRpc: DashboardRpc = {
  kpi: () => invoke<DashboardKpi>('dashboard_kpi'),
  ddc: () => invoke<DdcSlice[]>('dashboard_ddc_distribution'),
  kunjungan7d: () => invoke<DayBucket[]>('dashboard_kunjungan_7d'),
  topPeminjam: (limit) => invoke<TopPeminjam[]>('dashboard_top_peminjam', { limit }),
  topBuku: (limit) => invoke<TopBuku[]>('dashboard_top_buku', { limit }),
  // Tauri serializes the rust enum `TrendWindow::Days7` as the string "Days7",
  // but `#[serde(alias = "days7")]` on the enum lets us send the lowercase
  // camelCase form here for ergonomic TS-side typing. Same for the others.
  trend: (window) => invoke<TrendBucket[]>('dashboard_trend', { window }),
  heatmap: () => invoke<HeatCell[]>('dashboard_heatmap'),
  insights: () => invoke<DashboardInsights>('dashboard_insights'),
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
      totalBuku: 412,
      totalEksemplar: 1843,
      bukuDipinjam: 24,
      deltaAnggotaPct: pctDelta(128, 120),
      deltaBukuPct: pctDelta(412, 401),
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
  async trend(window) {
    const today = new Date();
    if (window === 'days7' || window === 'days30') {
      const days = window === 'days7' ? 7 : 30;
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (days - 1 - i));
        const bucket = d.toISOString().slice(0, 10);
        const count = Math.max(0, 6 + ((i * 13 + 7) % 12) - (i % 4));
        return { bucket, count };
      });
    }
    const months = window === 'months6' ? 6 : 12;
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
      const bucket = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const count = 40 + ((i * 23 + 11) % 60);
      return { bucket, count };
    });
  },
  async heatmap() {
    // Synthesise a plausible "school-hours-heavy" pattern: weekday 8-15 is hot,
    // weekday evening is warm, weekend low. Helps the UI look realistic in
    // browser dev mode without a backing DB.
    const cells: HeatCell[] = [];
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const isWeekend = dow === 0 || dow === 6;
        let count = 0;
        if (!isWeekend && hour >= 8 && hour < 16) {
          count = 4 + ((dow * 7 + hour * 3) % 9);
        } else if (!isWeekend && hour >= 16 && hour < 20) {
          count = 1 + ((dow + hour) % 3);
        } else if (isWeekend && hour >= 9 && hour < 14) {
          count = 1 + ((hour + dow) % 2);
        }
        cells.push({ dow, hour, count });
      }
    }
    return cells;
  },
  async insights() {
    return {
      topBukuThisMonth: {
        bukuId: 1,
        kode: 'B0042',
        judul: 'Bumi Manusia',
        pengarang: 'Pramoedya A. Toer',
        jumlah: 12,
      },
      topPeminjamThisMonth: {
        anggotaId: 1,
        nama: 'Adelia Putri',
        kodeAnggota: 'A0007',
        kelas: 'XI IPA 1',
        jumlah: 8,
      },
      avgLoansPerMember: 3.2,
      avgLoanDurationDays: 5.8,
    };
  },
};

export const dashboardApi: DashboardRpc = isTauri() ? tauriRpc : mockRpc;

export function calcDeltaPct(current: number, previous: number): number {
  return pctDelta(current, previous);
}

export const DDC_LABEL_MAP: Readonly<Record<string, string>> = DDC_LABELS;
