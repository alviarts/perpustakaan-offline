import { isTauri } from '@/lib/auth';

export interface PeminjamanRow {
  id: number;
  nomorPinjam: string;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
  tanggalKembali?: string | null;
  status: 'dipinjam' | 'sebagian' | 'dikembalikan' | 'terlambat' | 'hilang';
  totalDenda: number;
  totalBayar: number;
  totalItem: number;
  itemDipinjam: number;
  catatan?: string | null;
  createdAt: string;
}

export interface PeminjamanItemRow {
  id: number;
  peminjamanId: number;
  bukuId: number;
  bukuJudul: string;
  bukuKode: string;
  eksemplarId?: number | null;
  eksemplarKode?: string | null;
  status: 'dipinjam' | 'dikembalikan' | 'hilang';
  tanggalKembali?: string | null;
  denda: number;
  catatan?: string | null;
}

export interface PeminjamanDetail {
  header: PeminjamanRow;
  items: PeminjamanItemRow[];
}

export interface PeminjamanListArgs {
  query?: string;
  status?: string;
  from?: string;
  to?: string;
  anggotaId?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface PeminjamanListResult {
  items: PeminjamanRow[];
  total: number;
}

export interface PeminjamanCreateInput {
  anggotaId: number;
  bukuIds: number[];
  /**
   * Optional per-row physical-copy override paired with `bukuIds`. When
   * provided, the i-th `eksemplarId` is the exact `eksemplar.id` to mark
   * as borrowed for the i-th `bukuId`. The Sirkulasi (webcam) flow uses
   * this so the scanned barcode is the one actually recorded on-loan —
   * without it, the backend silently picks the lowest-id available copy
   * via FIFO and the operator's later return scan can fail to find an
   * active loan.
   */
  eksemplarIds?: number[];
  tanggalPinjam?: string;
  tanggalJatuhTempo?: string;
  catatan?: string;
}

export interface PeminjamanReturnInput {
  peminjamanId: number;
  itemIds: number[];
  bayar?: number;
}

export interface PeminjamanReturnResult {
  items: PeminjamanItemRow[];
  totalDenda: number;
  totalBayar: number;
  statusHeader: string;
}

export interface PeminjamanQuickStats {
  aktifHariIni: number;
  aktifMingguIni: number;
  overdue: number;
  totalAktif: number;
}

export interface AnggotaLoanSummary {
  totalPeminjaman: number;
  totalItem: number;
  aktifCount: number;
  overdueCount: number;
  totalDenda: number;
  totalBayar: number;
  lastPinjam?: string | null;
}

export interface AnggotaTopBuku {
  bukuId: number;
  kodeBuku: string;
  judul: string;
  jumlah: number;
}

export interface AnggotaLoanHistoryRow {
  peminjamanId: number;
  nomorPinjam: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
  tanggalKembali?: string | null;
  status: 'dipinjam' | 'sebagian' | 'dikembalikan' | 'terlambat' | 'hilang';
  totalItem: number;
  totalDenda: number;
  bukuJudulPertama?: string | null;
}

export interface AnggotaLoanHistory {
  summary: AnggotaLoanSummary;
  topBuku: AnggotaTopBuku[];
  history: AnggotaLoanHistoryRow[];
}

export interface OverdueRow {
  peminjamanId: number;
  itemId: number;
  nomorPinjam: string;
  anggotaId: number;
  anggotaNama: string;
  anggotaKode: string;
  anggotaKelas?: string | null;
  bukuId: number;
  bukuJudul: string;
  bukuKode: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
  hariTerlambat: number;
}

export interface AnggotaSummary {
  id: number;
  kodeAnggota: string;
  nama: string;
  kelas?: string | null;
  jurusan?: string | null;
  aktif: boolean;
  fotoPath?: string | null;
  aktifCount: number;
  overdueCount: number;
}

export interface BukuSummary {
  id: number;
  kodeBuku: string;
  judul: string;
  pengarang?: string | null;
  coverPath?: string | null;
  jumlahTersedia: number;
  jumlahEksemplar: number;
}

export interface EksemplarResolved {
  eksemplarId: number;
  kodeEksemplar: string;
  status: string;
  bukuId: number;
  kodeBuku: string;
  judul: string;
  pengarang?: string | null;
}

export interface ActiveLoanForEksemplar {
  peminjamanId: number;
  peminjamanItemId: number;
  nomorPinjam: string;
  anggotaId: number;
  anggotaKode: string;
  anggotaNama: string;
  bukuId: number;
  kodeBuku: string;
  judul: string;
  eksemplarId: number;
  kodeEksemplar: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
}

interface PeminjamanRpc {
  list(args: PeminjamanListArgs): Promise<PeminjamanListResult>;
  get(id: number): Promise<PeminjamanDetail>;
  create(input: PeminjamanCreateInput): Promise<PeminjamanDetail>;
  kembalikan(input: PeminjamanReturnInput): Promise<PeminjamanReturnResult>;
  quickStats(): Promise<PeminjamanQuickStats>;
  overdueList(limit?: number): Promise<OverdueRow[]>;
  anggotaLoanHistory(id: number, limit?: number): Promise<AnggotaLoanHistory>;
  search(query: string): Promise<PeminjamanRow[]>;
  anggotaSummary(id: number): Promise<AnggotaSummary>;
  bukuSummary(id: number): Promise<BukuSummary>;
  resolveEksemplar(kode: string): Promise<EksemplarResolved | null>;
  aktifByEksemplar(kode: string): Promise<ActiveLoanForEksemplar | null>;
}

// ----------------------------------------------------------------------------
// Mock store (browser dev mode without Tauri)
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'po:peminjaman-mock';

interface MockState {
  rows: PeminjamanRow[];
  items: PeminjamanItemRow[];
  seq: number;
  itemSeq: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readMock(): MockState {
  if (typeof window === 'undefined') return { rows: [], items: [], seq: 0, itemSeq: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed: MockState = { rows: [], items: [], seq: 0, itemSeq: 0 };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as MockState;
  } catch {
    return { rows: [], items: [], seq: 0, itemSeq: 0 };
  }
}

function writeMock(state: MockState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.floor((da - db) / (1000 * 60 * 60 * 24));
}

const tauriRpc: PeminjamanRpc = {
  async list(args) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanListResult>('peminjaman_list', { args });
  },
  async get(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanDetail>('peminjaman_get', { id });
  },
  async create(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanDetail>('peminjaman_create', { input });
  },
  async kembalikan(input) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanReturnResult>('peminjaman_kembalikan', { input });
  },
  async quickStats() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanQuickStats>('peminjaman_quick_stats');
  },
  async overdueList(limit) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<OverdueRow[]>('peminjaman_overdue_list', { limit });
  },
  async anggotaLoanHistory(id, limit) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AnggotaLoanHistory>('anggota_loan_history', { id, limit });
  },
  async search(query) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PeminjamanRow[]>('pengembalian_search', { query });
  },
  async anggotaSummary(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AnggotaSummary>('anggota_summary', { id });
  },
  async bukuSummary(id) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<BukuSummary>('buku_summary', { id });
  },
  async resolveEksemplar(kode) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<EksemplarResolved | null>('eksemplar_resolve', { kode });
  },
  async aktifByEksemplar(kode) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ActiveLoanForEksemplar | null>('peminjaman_aktif_by_eksemplar', { kode });
  },
};

const mockRpc: PeminjamanRpc = {
  async list(args) {
    const state = readMock();
    let filtered = state.rows;
    const q = args.query?.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.nomorPinjam.toLowerCase().includes(q) ||
          r.anggotaNama.toLowerCase().includes(q) ||
          r.anggotaKode.toLowerCase().includes(q),
      );
    }
    if (args.status && args.status !== 'all') {
      filtered = filtered.filter((r) => r.status === args.status);
    }
    if (args.anggotaId) {
      filtered = filtered.filter((r) => r.anggotaId === args.anggotaId);
    }
    const total = filtered.length;
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    const items = filtered
      .slice()
      .sort((a, b) => b.tanggalPinjam.localeCompare(a.tanggalPinjam))
      .slice(offset, offset + limit);
    return { items, total };
  },
  async get(id) {
    const state = readMock();
    const header = state.rows.find((r) => r.id === id);
    if (!header) throw new Error(`peminjaman id=${id} not found`);
    const items = state.items.filter((i) => i.peminjamanId === id);
    return { header, items };
  },
  async create(input) {
    const state = readMock();
    const today = todayIso();
    const tglPinjam = input.tanggalPinjam ?? today;
    const tglJt = input.tanggalJatuhTempo ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const id = ++state.seq;
    const nomor = `PJ-${tglPinjam.replaceAll('-', '')}-${String(id).padStart(4, '0')}`;
    const header: PeminjamanRow = {
      id,
      nomorPinjam: nomor,
      anggotaId: input.anggotaId,
      anggotaNama: `Anggota ${input.anggotaId}`,
      anggotaKode: `A${String(input.anggotaId).padStart(4, '0')}`,
      tanggalPinjam: tglPinjam,
      tanggalJatuhTempo: tglJt,
      tanggalKembali: null,
      status: 'dipinjam',
      totalDenda: 0,
      totalBayar: 0,
      totalItem: input.bukuIds.length,
      itemDipinjam: input.bukuIds.length,
      catatan: input.catatan ?? null,
      createdAt: nowIso(),
    };
    state.rows.unshift(header);
    const items: PeminjamanItemRow[] = input.bukuIds.map((bid) => ({
      id: ++state.itemSeq,
      peminjamanId: id,
      bukuId: bid,
      bukuJudul: `Buku ${bid}`,
      bukuKode: `B${String(bid).padStart(4, '0')}`,
      eksemplarId: null,
      eksemplarKode: null,
      status: 'dipinjam',
      tanggalKembali: null,
      denda: 0,
      catatan: null,
    }));
    state.items.push(...items);
    writeMock(state);
    return { header, items };
  },
  async kembalikan(input) {
    const state = readMock();
    const header = state.rows.find((r) => r.id === input.peminjamanId);
    if (!header) throw new Error(`peminjaman id=${input.peminjamanId} not found`);
    const today = todayIso();
    let totalDenda = 0;
    for (const itemId of input.itemIds) {
      const item = state.items.find((i) => i.id === itemId);
      if (!item || item.status !== 'dipinjam') continue;
      const late = Math.max(0, dayDiff(today, header.tanggalJatuhTempo));
      item.denda = late * 500;
      item.status = 'dikembalikan';
      item.tanggalKembali = today;
      totalDenda += item.denda;
    }
    header.totalDenda += totalDenda;
    header.totalBayar += input.bayar ?? 0;
    const allDone = state.items
      .filter((i) => i.peminjamanId === input.peminjamanId)
      .every((i) => i.status !== 'dipinjam');
    header.status = allDone ? 'dikembalikan' : 'sebagian';
    if (allDone) header.tanggalKembali = today;
    header.itemDipinjam = state.items.filter(
      (i) => i.peminjamanId === input.peminjamanId && i.status === 'dipinjam',
    ).length;
    writeMock(state);
    const items = state.items.filter((i) => i.peminjamanId === input.peminjamanId);
    return {
      items,
      totalDenda: header.totalDenda,
      totalBayar: header.totalBayar,
      statusHeader: header.status,
    };
  },
  async quickStats() {
    const state = readMock();
    const today = todayIso();
    return {
      aktifHariIni: state.rows.filter((r) => r.tanggalPinjam === today).length,
      aktifMingguIni: state.rows.filter(
        (r) => dayDiff(today, r.tanggalPinjam) >= 0 && dayDiff(today, r.tanggalPinjam) <= 6,
      ).length,
      overdue: state.rows.filter(
        (r) => r.status !== 'dikembalikan' && dayDiff(today, r.tanggalJatuhTempo) > 0,
      ).length,
      totalAktif: state.items.filter((i) => i.status === 'dipinjam').length,
    };
  },
  async overdueList(limit) {
    const state = readMock();
    const today = todayIso();
    const cap = Math.max(1, Math.min(limit ?? 50, 500));
    const rows: OverdueRow[] = [];
    for (const i of state.items) {
      if (i.status !== 'dipinjam') continue;
      const header = state.rows.find((r) => r.id === i.peminjamanId);
      if (!header) continue;
      const late = dayDiff(today, header.tanggalJatuhTempo);
      if (late <= 0) continue;
      rows.push({
        peminjamanId: header.id,
        itemId: i.id,
        nomorPinjam: header.nomorPinjam,
        anggotaId: header.anggotaId,
        anggotaNama: header.anggotaNama,
        anggotaKode: header.anggotaKode,
        anggotaKelas: null,
        bukuId: i.bukuId,
        bukuJudul: i.bukuJudul,
        bukuKode: i.bukuKode,
        tanggalPinjam: header.tanggalPinjam,
        tanggalJatuhTempo: header.tanggalJatuhTempo,
        hariTerlambat: late,
      });
    }
    rows.sort((a, b) => b.hariTerlambat - a.hariTerlambat);
    return rows.slice(0, cap);
  },
  async anggotaLoanHistory(id, limit) {
    const state = readMock();
    const today = todayIso();
    const cap = Math.max(1, Math.min(limit ?? 100, 1000));
    const headers = state.rows.filter((r) => r.anggotaId === id);
    const summary: AnggotaLoanSummary = {
      totalPeminjaman: headers.length,
      totalItem: 0,
      aktifCount: 0,
      overdueCount: 0,
      totalDenda: 0,
      totalBayar: 0,
      lastPinjam: headers.length > 0 ? headers[0]!.tanggalPinjam : null,
    };
    const counts = new Map<number, AnggotaTopBuku>();
    const history: AnggotaLoanHistoryRow[] = [];
    for (const h of headers) {
      const items = state.items.filter((i) => i.peminjamanId === h.id);
      summary.totalItem += items.length;
      summary.totalDenda += h.totalDenda;
      summary.totalBayar += h.totalBayar;
      const judulPertama = items[0]?.bukuJudul ?? null;
      for (const i of items) {
        const c = counts.get(i.bukuId);
        if (c) c.jumlah += 1;
        else
          counts.set(i.bukuId, {
            bukuId: i.bukuId,
            kodeBuku: i.bukuKode,
            judul: i.bukuJudul,
            jumlah: 1,
          });
        if (i.status === 'dipinjam') {
          summary.aktifCount += 1;
          if (dayDiff(today, h.tanggalJatuhTempo) > 0) summary.overdueCount += 1;
        }
      }
      history.push({
        peminjamanId: h.id,
        nomorPinjam: h.nomorPinjam,
        tanggalPinjam: h.tanggalPinjam,
        tanggalJatuhTempo: h.tanggalJatuhTempo,
        tanggalKembali: h.tanggalKembali,
        status: h.status as AnggotaLoanHistoryRow['status'],
        totalItem: items.length,
        totalDenda: h.totalDenda,
        bukuJudulPertama: judulPertama,
      });
    }
    history.sort((a, b) => b.tanggalPinjam.localeCompare(a.tanggalPinjam));
    const topBuku = [...counts.values()]
      .sort((a, b) => b.jumlah - a.jumlah || a.judul.localeCompare(b.judul))
      .slice(0, 5);
    return { summary, topBuku, history: history.slice(0, cap) };
  },
  async search(query) {
    const state = readMock();
    const q = query.trim().toLowerCase();
    return state.rows
      .filter((r) => ['dipinjam', 'sebagian', 'terlambat'].includes(r.status))
      .filter(
        (r) =>
          q === '' ||
          r.nomorPinjam.toLowerCase().includes(q) ||
          r.anggotaNama.toLowerCase().includes(q) ||
          r.anggotaKode.toLowerCase().includes(q),
      )
      .slice(0, 20);
  },
  async anggotaSummary(id) {
    return {
      id,
      kodeAnggota: `A${String(id).padStart(4, '0')}`,
      nama: `Anggota ${id}`,
      kelas: '10 IPA 1',
      jurusan: 'IPA',
      aktif: true,
      fotoPath: null,
      aktifCount: 0,
      overdueCount: 0,
    };
  },
  async bukuSummary(id) {
    return {
      id,
      kodeBuku: `B${String(id).padStart(4, '0')}`,
      judul: `Buku ${id}`,
      pengarang: null,
      coverPath: null,
      jumlahTersedia: 3,
      jumlahEksemplar: 3,
    };
  },
  async resolveEksemplar() {
    // Mock store doesn't track eksemplar — circulation flow is Tauri-only.
    return null;
  },
  async aktifByEksemplar() {
    return null;
  },
};

export const peminjamanApi: PeminjamanRpc = isTauri() ? tauriRpc : mockRpc;

export function calculateDenda(
  tanggalJatuhTempo: string,
  tanggalKembali: string,
  dendaPerHari = 500,
): { hariTerlambat: number; denda: number } {
  const late = Math.max(0, dayDiff(tanggalKembali, tanggalJatuhTempo));
  return { hariTerlambat: late, denda: late * dendaPerHari };
}
