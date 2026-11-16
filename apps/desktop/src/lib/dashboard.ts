import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';
import { anggotaApi } from '@/lib/anggota';
import { bukuApi } from '@/lib/buku';
import { peminjamanApi } from '@/lib/peminjaman';
import { kunjunganApi } from '@/lib/kunjungan';

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

/** D1-SystemHealthWidget — operational snapshot. */
export interface SystemHealth {
  dbSizeBytes: number;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
  pendingReservasi: number;
  appVersion: string;
  updateAvailable: boolean | null;
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
  systemHealth: () => Promise<SystemHealth>;
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
  systemHealth: () => invoke<SystemHealth>('dashboard_system_health'),
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

/** Hitung delta bulan ini vs bulan lalu dari tanggal pada data nyata. */
function monthDeltas(dates: string[]): [number, number] {
  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  let thisMonth = 0;
  let prevMonth = 0;
  for (const raw of dates) {
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= startThis) thisMonth += 1;
    else if (t >= startPrev) prevMonth += 1;
  }
  return [pctDelta(thisMonth, prevMonth), thisMonth];
}

const mockRpc: DashboardRpc = {
  async kpi() {
    // KPI harus konsisten dengan daftar Anggota/Buku/Peminjaman. Sebelumnya
    // angka hardcode (128/412/24) membuat dashboard tidak cocok dengan data
    // yang sebenarnya tersimpan di mock storage.
    const [anggota, buku, pinjam] = await Promise.all([
      anggotaApi.list({ aktif: true, limit: 10_000 }),
      bukuApi.list({ limit: 10_000 }),
      peminjamanApi.list({ limit: 10_000 }),
    ]);
    const totalAnggota = anggota.items.length;
    const totalBuku = buku.items.length;
    const totalEksemplar = buku.items.reduce(
      (sum, b) => sum + (b.jumlahEksemplar ?? 0),
      0,
    );
    const bukuDipinjam = pinjam.items.reduce(
      (sum, p) => sum + (p.status === 'dipinjam' ? p.itemDipinjam : 0),
      0,
    );
    const [deltaAnggotaPct] = monthDeltas(anggota.items.map((a) => a.createdAt));
    const [deltaBukuPct] = monthDeltas(buku.items.map((b) => b.createdAt));
    const [deltaPinjamPct] = monthDeltas(pinjam.items.map((p) => p.tanggalPinjam));
    return {
      totalAnggota,
      totalBuku,
      totalEksemplar,
      bukuDipinjam,
      deltaAnggotaPct,
      deltaBukuPct,
      deltaPinjamPct,
    };
  },
  async ddc() {
    const buku = await bukuApi.list({ limit: 10_000 });
    const counts = new Map<string, number>();
    for (const b of buku.items) {
      const kelas = (b.kodeDdc ?? '?').trim().charAt(0) || '?';
      counts.set(kelas, (counts.get(kelas) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([kelas, count]) => ({ kelas, label: DDC_LABELS[kelas] ?? kelas, count }))
      .sort((a, b) => b.count - a.count);
  },
  async kunjungan7d() {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const rows = await kunjunganApi.list({
      from: days[0],
      to: days[days.length - 1],
      limit: 10_000,
    });
    return days.map((tanggal) => ({
      tanggal,
      jumlah: rows.items
        .filter((r) => r.tanggal === tanggal)
        .reduce((sum, r) => sum + r.jumlahOrang, 0),
    }));
  },
  async topPeminjam(limit = 5) {
    const [anggota, pinjam] = await Promise.all([
      anggotaApi.list({ limit: 10_000 }),
      peminjamanApi.list({ limit: 10_000 }),
    ]);
    const acc = new Map<number, number>();
    for (const p of pinjam.items) acc.set(p.anggotaId, (acc.get(p.anggotaId) ?? 0) + 1);
    return Array.from(acc.entries())
      .map(([anggotaId, jumlah]) => {
        const a = anggota.items.find((it) => it.id === anggotaId);
        return {
          anggotaId,
          nama: a?.nama ?? `Anggota #${anggotaId}`,
          kodeAnggota: a?.kodeAnggota ?? '',
          kelas: a?.kelas ?? null,
          jumlah,
        };
      })
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, limit);
  },
  async topBuku(limit = 5) {
    const pinjam = await peminjamanApi.list({ limit: 10_000 });
    const details = await Promise.all(
      pinjam.items.map((p) => peminjamanApi.get(p.id).catch(() => null)),
    );
    const acc = new Map<number, TopBuku>();
    for (const detail of details) {
      for (const item of detail?.items ?? []) {
        const current = acc.get(item.bukuId);
        if (current) current.jumlah += 1;
        else
          acc.set(item.bukuId, {
            bukuId: item.bukuId,
            kode: item.bukuKode,
            judul: item.bukuJudul,
            pengarang: null,
            jumlah: 1,
          });
      }
    }
    return Array.from(acc.values())
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, limit);
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
  async systemHealth() {
    return {
      dbSizeBytes: 2 * 1024 * 1024 + 384 * 1024,
      lastBackupAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      nextBackupAt: null,
      pendingReservasi: 2,
      appVersion: '1.0.12',
      updateAvailable: null,
    };
  },
};

export const dashboardApi: DashboardRpc = isTauri() ? tauriRpc : mockRpc;

export function calcDeltaPct(current: number, previous: number): number {
  return pctDelta(current, previous);
}

export const DDC_LABEL_MAP: Readonly<Record<string, string>> = DDC_LABELS;
