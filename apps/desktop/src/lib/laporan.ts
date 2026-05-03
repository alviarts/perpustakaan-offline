import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

export type Granularity = 'day' | 'month' | 'year';

export interface GrafikBucket {
  bucket: string;
  kunjungan: number;
  peminjaman: number;
}

export interface TopPeminjamRow {
  anggotaId: number;
  nama: string;
  kodeAnggota: string;
  kelas: string | null;
  jumlahPinjam: number;
  jumlahBuku: number;
}

export interface TopBukuRow {
  bukuId: number;
  kode: string;
  judul: string;
  pengarang: string | null;
  jumlah: number;
}

export interface KasRow {
  id: number;
  tanggal: string;
  keterangan: string;
  jenis: 'masuk' | 'keluar';
  sumber: 'manual' | 'denda' | 'hilang' | 'modal';
  nominal: number;
}

export interface KasCumulative {
  tanggal: string;
  saldo: number;
}

export interface KasSummary {
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
  fromDenda: number;
  fromManual: number;
  fromHilang: number;
  fromModal: number;
  rows: KasRow[];
  cumulative: KasCumulative[];
}

export interface BackupResult {
  path: string;
  checksum: string;
  sizeBytes: number;
}

export interface BackupSchedule {
  enabled: boolean;
  cron: string;
  lastRun: string | null;
}

export interface LaporanRpc {
  grafik: (from: string, to: string, granularity?: Granularity) => Promise<GrafikBucket[]>;
  topPeminjam: (from: string, to: string, limit?: number) => Promise<TopPeminjamRow[]>;
  topBuku: (from: string, to: string, limit?: number) => Promise<TopBukuRow[]>;
  kas: (from: string, to: string) => Promise<KasSummary>;
  backupCreate: (targetDir: string) => Promise<BackupResult>;
  backupRestore: (filePath: string, expectedChecksum?: string) => Promise<BackupResult>;
  backupScheduleGet: () => Promise<BackupSchedule>;
  backupScheduleSet: (enabled: boolean, cron: string) => Promise<BackupSchedule>;
  backupDbPath: () => Promise<string>;
}

const tauriRpc: LaporanRpc = {
  grafik: (from, to, granularity) =>
    invoke<GrafikBucket[]>('laporan_grafik', { from, to, granularity }),
  topPeminjam: (from, to, limit) =>
    invoke<TopPeminjamRow[]>('laporan_top_peminjam', { from, to, limit }),
  topBuku: (from, to, limit) =>
    invoke<TopBukuRow[]>('laporan_top_buku', { from, to, limit }),
  kas: (from, to) => invoke<KasSummary>('laporan_kas', { from, to }),
  backupCreate: (targetDir) => invoke<BackupResult>('backup_create', { targetDir }),
  backupRestore: (filePath, expectedChecksum) =>
    invoke<BackupResult>('backup_restore', { filePath, expectedChecksum }),
  backupScheduleGet: () => invoke<BackupSchedule>('backup_schedule_get'),
  backupScheduleSet: (enabled, cron) =>
    invoke<BackupSchedule>('backup_schedule_set', { enabled, cron }),
  backupDbPath: () => invoke<string>('backup_db_path'),
};

const mockRpc: LaporanRpc = {
  async grafik(from, to, granularity = 'day') {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const result: GrafikBucket[] = [];
    if (granularity === 'day') {
      const cur = new Date(start);
      let i = 0;
      while (cur <= end) {
        result.push({
          bucket: cur.toISOString().slice(0, 10),
          kunjungan: 12 + ((i * 5 + 7) % 18),
          peminjaman: 3 + ((i * 3 + 2) % 9),
        });
        cur.setDate(cur.getDate() + 1);
        i += 1;
      }
    } else if (granularity === 'month') {
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      let i = 0;
      while (cur <= end) {
        const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        result.push({
          bucket: ym,
          kunjungan: 200 + i * 24,
          peminjaman: 60 + i * 7,
        });
        cur.setMonth(cur.getMonth() + 1);
        i += 1;
      }
    } else {
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        result.push({
          bucket: String(y),
          kunjungan: 1800 + (y % 100) * 30,
          peminjaman: 540 + (y % 100) * 11,
        });
      }
    }
    return result;
  },
  async topPeminjam(_from, _to, limit = 10) {
    const seed = [
      { nama: 'Adelia Putri', kode: 'A0007', kelas: 'XI IPA 1', jumlahPinjam: 14, jumlahBuku: 21 },
      { nama: 'Bagas Saputra', kode: 'A0012', kelas: 'X IPS 2', jumlahPinjam: 11, jumlahBuku: 17 },
      { nama: 'Citra Lestari', kode: 'A0021', kelas: 'XII IPA 3', jumlahPinjam: 9, jumlahBuku: 15 },
      { nama: 'Dani Pratama', kode: 'A0034', kelas: 'X IPA 1', jumlahPinjam: 8, jumlahBuku: 12 },
      { nama: 'Erika Yulianti', kode: 'A0045', kelas: 'XI IPS 1', jumlahPinjam: 6, jumlahBuku: 9 },
      { nama: 'Fariz Hakim', kode: 'A0058', kelas: 'XII IPS 2', jumlahPinjam: 5, jumlahBuku: 7 },
      { nama: 'Gita Larasati', kode: 'A0061', kelas: 'X IPA 2', jumlahPinjam: 4, jumlahBuku: 6 },
      { nama: 'Hani Khairiyah', kode: 'A0072', kelas: 'XI IPS 3', jumlahPinjam: 4, jumlahBuku: 5 },
      { nama: 'Iqbal Maulana', kode: 'A0080', kelas: 'XII IPA 1', jumlahPinjam: 3, jumlahBuku: 4 },
      { nama: 'Jihan Salsabila', kode: 'A0091', kelas: 'X IPS 1', jumlahPinjam: 2, jumlahBuku: 3 },
    ];
    return seed.slice(0, limit).map((s, i) => ({
      anggotaId: i + 1,
      nama: s.nama,
      kodeAnggota: s.kode,
      kelas: s.kelas,
      jumlahPinjam: s.jumlahPinjam,
      jumlahBuku: s.jumlahBuku,
    }));
  },
  async topBuku(_from, _to, limit = 10) {
    const seed = [
      { judul: 'Bumi Manusia', kode: 'B0042', pengarang: 'Pramoedya A. Toer', jumlah: 21 },
      { judul: 'Laskar Pelangi', kode: 'B0017', pengarang: 'Andrea Hirata', jumlah: 17 },
      { judul: 'Negeri 5 Menara', kode: 'B0089', pengarang: 'Ahmad Fuadi', jumlah: 13 },
      { judul: 'Atomic Habits', kode: 'B0123', pengarang: 'James Clear', jumlah: 11 },
      { judul: 'Sapiens', kode: 'B0211', pengarang: 'Yuval Noah Harari', jumlah: 9 },
      { judul: 'Tenggelamnya Kapal Van Der Wijck', kode: 'B0034', pengarang: 'Hamka', jumlah: 8 },
      { judul: 'Pulang', kode: 'B0156', pengarang: 'Tere Liye', jumlah: 7 },
      { judul: 'Dilan 1990', kode: 'B0203', pengarang: 'Pidi Baiq', jumlah: 6 },
      { judul: 'Filosofi Teras', kode: 'B0244', pengarang: 'Henry Manampiring', jumlah: 5 },
      { judul: 'Rich Dad Poor Dad', kode: 'B0298', pengarang: 'Robert Kiyosaki', jumlah: 4 },
    ];
    return seed.slice(0, limit).map((s, i) => ({
      bukuId: i + 1,
      kode: s.kode,
      judul: s.judul,
      pengarang: s.pengarang,
      jumlah: s.jumlah,
    }));
  },
  async kas(from, to) {
    const seedRows: KasRow[] = [
      { id: 1, tanggal: from, keterangan: 'Modal awal', jenis: 'masuk', sumber: 'modal', nominal: 250_000 },
      { id: 2, tanggal: from, keterangan: 'Beli stiker label', jenis: 'keluar', sumber: 'manual', nominal: 32_000 },
      { id: 3, tanggal: to, keterangan: 'Denda buku terlambat', jenis: 'masuk', sumber: 'denda', nominal: 9_000 },
      { id: 4, tanggal: to, keterangan: 'Ganti buku hilang', jenis: 'masuk', sumber: 'hilang', nominal: 65_000 },
    ];
    let running = 0;
    const cumulative: KasCumulative[] = [];
    let last: string | null = null;
    let totalMasuk = 0;
    let totalKeluar = 0;
    let fromDenda = 0;
    let fromManual = 0;
    let fromHilang = 0;
    let fromModal = 0;
    for (const r of seedRows) {
      running += r.jenis === 'masuk' ? r.nominal : -r.nominal;
      if (r.jenis === 'masuk') {
        totalMasuk += r.nominal;
        if (r.sumber === 'denda') fromDenda += r.nominal;
        else if (r.sumber === 'hilang') fromHilang += r.nominal;
        else if (r.sumber === 'modal') fromModal += r.nominal;
        else fromManual += r.nominal;
      } else {
        totalKeluar += r.nominal;
      }
      if (last === r.tanggal) {
        cumulative[cumulative.length - 1]!.saldo = running;
      } else {
        cumulative.push({ tanggal: r.tanggal, saldo: running });
        last = r.tanggal;
      }
    }
    return {
      totalMasuk,
      totalKeluar,
      saldoAkhir: totalMasuk - totalKeluar,
      fromDenda,
      fromManual,
      fromHilang,
      fromModal,
      rows: seedRows,
      cumulative,
    };
  },
  async backupCreate() {
    return {
      path: '/tmp/perpustakaan-mock.db',
      checksum: '0'.repeat(64),
      sizeBytes: 0,
    };
  },
  async backupRestore() {
    return {
      path: '/tmp/perpustakaan-mock.db',
      checksum: '0'.repeat(64),
      sizeBytes: 0,
    };
  },
  async backupScheduleGet() {
    return { enabled: false, cron: '0 2 * * *', lastRun: null };
  },
  async backupScheduleSet(enabled, cron) {
    return { enabled, cron, lastRun: null };
  },
  async backupDbPath() {
    return '/mock/perpustakaan.db';
  },
};

export const laporanApi: LaporanRpc = isTauri() ? tauriRpc : mockRpc;

/** Format human-readable preview untuk cron 5-field. */
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 'Format cron tidak valid';
  const [m, h, dom, mon, dow] = parts;
  const numeric = (v: string): number | null => {
    if (!/^\d+$/.test(v)) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const minute = numeric(m!);
  const hour = numeric(h!);
  if (minute == null || hour == null) {
    return `Cron: ${cron}`;
  }
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (dom === '*' && mon === '*' && dow === '*') {
    return `Setiap hari pukul ${time}`;
  }
  if (mon === '*' && dom === '*') {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const idx = numeric(dow!);
    if (idx != null && days[idx]) {
      return `Setiap ${days[idx]} pukul ${time}`;
    }
  }
  return `Cron: ${cron}`;
}

/** Format CSV row, escape jika ada koma atau kutip. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return lines.join('\n');
}
