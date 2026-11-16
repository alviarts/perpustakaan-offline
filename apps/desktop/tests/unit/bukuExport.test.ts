import { describe, expect, it, vi, beforeEach } from 'vitest';
import { read, utils } from 'xlsx';

import type { Buku, BukuListArgs, BukuListResult } from '@/lib/buku';

const { listMock, invokeMock, saveDialogMock } = vi.hoisted(() => ({
  listMock: vi.fn<(args: BukuListArgs) => Promise<BukuListResult>>(),
  invokeMock: vi.fn(),
  saveDialogMock: vi.fn(),
}));

vi.mock('@/lib/buku', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    bukuApi: { list: listMock },
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: saveDialogMock }));
vi.mock('@/lib/auth', () => ({ isTauri: () => false }));

import {
  buildBukuWorkbookBytes,
  defaultBukuExportFilename,
  fetchAllBuku,
  runBukuExport,
  toBukuExportRow,
} from '@/lib/bukuExport';

function makeBuku(overrides: Partial<Buku> = {}): Buku {
  return {
    id: 1,
    kodeBuku: 'B0001',
    judul: 'Bumi Manusia',
    pengarang: 'Pramoedya Ananta Toer',
    penerbit: 'Hasta Mitra',
    tahunTerbit: 1980,
    kodeDdc: '813',
    kategori: 'Fiksi',
    isbn: '978-979-97312-3-2',
    jumlahEksemplar: 3,
    jumlahTersedia: 2,
    sumber: 'BOS',
    harga: 75000,
    coverPath: null,
    bahasa: 'id',
    deskripsi: null,
    rak: 'R1',
    tanggalInput: '2024-07-15',
    createdAt: '2024-07-15T08:00:00Z',
    updatedAt: '2024-07-15T08:00:00Z',
    ...overrides,
  };
}

describe('toBukuExportRow', () => {
  it('flattens a Buku row into Excel-friendly columns', () => {
    const row = toBukuExportRow(makeBuku());
    expect(row.kode_buku).toBe('B0001');
    expect(row.judul).toBe('Bumi Manusia');
    expect(row.tahun_terbit).toBe('1980');
    expect(row.jumlah_eksemplar).toBe(3);
    expect(row.jumlah_tersedia).toBe(2);
  });

  it('coerces null optional fields into empty strings, never "null"', () => {
    const row = toBukuExportRow(
      makeBuku({
        pengarang: null,
        penerbit: null,
        kodeDdc: null,
        kategori: null,
        isbn: null,
        bahasa: null,
        rak: null,
        sumber: null,
      }),
    );
    expect(row.pengarang).toBe('');
    expect(row.kode_ddc).toBe('');
    expect(row.isbn).toBe('');
    expect(row.rak).toBe('');
  });
});

describe('buildBukuWorkbookBytes', () => {
  it('produces a valid XLSX workbook with header + data rows', () => {
    const bytes = buildBukuWorkbookBytes([
      makeBuku(),
      makeBuku({ id: 2, kodeBuku: 'B0002', judul: 'Bumi Manusia 2' }),
    ]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const wb = read(bytes, { type: 'array' });
    expect(wb.SheetNames[0]).toBe('Buku');
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.['Kode Buku']).toBe('B0001');
    expect(rows[1]?.['Judul']).toBe('Bumi Manusia 2');
  });
});

describe('defaultBukuExportFilename', () => {
  it('formats a zero-padded filename', () => {
    expect(defaultBukuExportFilename(new Date(2026, 4, 4, 9, 7))).toBe(
      'buku-20260504-0907.xlsx',
    );
  });
});

describe('fetchAllBuku', () => {
  beforeEach(() => listMock.mockReset());

  it('paginates until a short page is returned', async () => {
    listMock.mockResolvedValueOnce({
      items: Array.from({ length: 500 }, (_, i) => makeBuku({ id: i + 1 })),
      total: 501,
    });
    listMock.mockResolvedValueOnce({
      items: [makeBuku({ id: 501 })],
      total: 501,
    });
    const out = await fetchAllBuku({ query: 'bumi' });
    expect(out).toHaveLength(501);
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(listMock).toHaveBeenNthCalledWith(1, { query: 'bumi', limit: 500, offset: 0 });
    expect(listMock).toHaveBeenNthCalledWith(2, { query: 'bumi', limit: 500, offset: 500 });
  });
});

describe('runBukuExport (browser fallback)', () => {
  beforeEach(() => {
    listMock.mockReset();
    invokeMock.mockReset();
    saveDialogMock.mockReset();
    // jsdom lacks URL.createObjectURL; real browsers / WebView2 provide it.
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: () => 'blob:mock',
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: () => undefined,
      });
    }
  });

  it('downloads via browser anchor and does not call Tauri invoke', async () => {
    listMock.mockResolvedValueOnce({
      items: [makeBuku()],
      total: 1,
    });
    const res = await runBukuExport({});
    expect(res).not.toBeNull();
    expect(res!.count).toBe(1);
    expect(res!.bytes).toBeGreaterThan(64);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(saveDialogMock).not.toHaveBeenCalled();
  });
});
