import { describe, expect, it, vi, beforeEach } from 'vitest';
import { read, utils } from 'xlsx';

import type { Anggota, AnggotaListArgs, AnggotaListResult } from '@/lib/anggota';

const { listMock, invokeMock, saveDialogMock } = vi.hoisted(() => ({
  listMock: vi.fn<(args: AnggotaListArgs) => Promise<AnggotaListResult>>(),
  invokeMock: vi.fn(),
  saveDialogMock: vi.fn(),
}));

vi.mock('@/lib/anggota', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    anggotaApi: { list: listMock },
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: saveDialogMock,
}));

vi.mock('@/lib/auth', () => ({
  isTauri: () => false,
}));

import {
  buildAnggotaWorkbookBytes,
  defaultExportFilename,
  fetchAllAnggota,
  toExportRow,
} from '@/lib/anggotaExport';

function makeAnggota(overrides: Partial<Anggota> = {}): Anggota {
  return {
    id: 1,
    kodeAnggota: 'A001',
    nama: 'Andi Pratama',
    jenisKelamin: 'L',
    kelas: 'XII IPA 1',
    jurusan: 'IPA',
    agama: 'Islam',
    tempatLahir: 'Jakarta',
    tanggalLahir: '2008-05-12',
    noTelp: '08123456789',
    email: 'andi@example.com',
    alamat: 'Jl. Mawar 1',
    fotoPath: null,
    tanggalDaftar: '2024-07-15',
    aktif: true,
    catatan: null,
    createdAt: '2024-07-15T08:00:00Z',
    updatedAt: '2024-07-15T08:00:00Z',
    ...overrides,
  };
}

describe('toExportRow', () => {
  it('flattens an Anggota row into Excel-friendly snake_case columns', () => {
    const row = toExportRow(makeAnggota());
    expect(row.kode_anggota).toBe('A001');
    expect(row.nama).toBe('Andi Pratama');
    expect(row.jenis_kelamin).toBe('L');
    expect(row.kelas).toBe('XII IPA 1');
    expect(row.tanggal_daftar).toBe('2024-07-15');
    expect(row.aktif).toBe('Aktif');
  });

  it('renders inactive rows with the Indonesian "Nonaktif" label', () => {
    const row = toExportRow(makeAnggota({ aktif: false }));
    expect(row.aktif).toBe('Nonaktif');
  });

  it('coerces null optional fields into empty strings (not the literal "null")', () => {
    const row = toExportRow(
      makeAnggota({
        jenisKelamin: null,
        kelas: null,
        jurusan: null,
        agama: null,
        tempatLahir: null,
        tanggalLahir: null,
        noTelp: null,
        email: null,
        alamat: null,
        catatan: null,
      }),
    );
    expect(row.jenis_kelamin).toBe('');
    expect(row.kelas).toBe('');
    expect(row.alamat).toBe('');
    expect(row.catatan).toBe('');
  });
});

describe('buildAnggotaWorkbookBytes', () => {
  it('produces a non-empty Uint8Array with a valid XLSX header (PK signature)', () => {
    const bytes = buildAnggotaWorkbookBytes([makeAnggota()]);
    expect(bytes.length).toBeGreaterThan(64);
    // XLSX is a ZIP — first 2 bytes must be "PK".
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('produces a workbook whose first sheet contains the header row + data rows', () => {
    const bytes = buildAnggotaWorkbookBytes([
      makeAnggota({ kodeAnggota: 'A001', nama: 'Andi' }),
      makeAnggota({ id: 2, kodeAnggota: 'A002', nama: 'Budi' }),
    ]);
    const wb = read(bytes, { type: 'array' });
    expect(wb.SheetNames[0]).toBe('Anggota');
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows.length).toBe(2);
    expect(rows[0]?.['Kode Anggota']).toBe('A001');
    expect(rows[1]?.['Kode Anggota']).toBe('A002');
    expect(rows[0]?.['Nama']).toBe('Andi');
  });

  it('round-trips an empty list as a header-only workbook', () => {
    const bytes = buildAnggotaWorkbookBytes([]);
    const wb = read(bytes, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = utils.sheet_to_json<Record<string, string>>(sheet);
    expect(rows.length).toBe(0);
    // utils.sheet_to_json returns 0 rows but the header row is still there —
    // confirm by reading the AOA representation.
    const aoa = utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    expect((aoa[0] as string[])[0]).toBe('Kode Anggota');
  });
});

describe('defaultExportFilename', () => {
  it('formats the filename with zero-padded date + time components', () => {
    const now = new Date(2026, 4, 4, 9, 7); // 2026-05-04 09:07 local
    const name = defaultExportFilename(now);
    expect(name).toBe('anggota-20260504-0907.xlsx');
  });
});

describe('fetchAllAnggota', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('paginates through anggotaApi.list until a short page is returned', async () => {
    listMock.mockResolvedValueOnce({
      items: Array.from({ length: 500 }, (_, i) =>
        makeAnggota({ id: i + 1, kodeAnggota: `A${i + 1}` }),
      ),
      total: 750,
    });
    listMock.mockResolvedValueOnce({
      items: Array.from({ length: 250 }, (_, i) =>
        makeAnggota({ id: 501 + i, kodeAnggota: `A${501 + i}` }),
      ),
      total: 750,
    });
    const out = await fetchAllAnggota({ query: 'foo' });
    expect(out).toHaveLength(750);
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(listMock).toHaveBeenNthCalledWith(1, { query: 'foo', limit: 500, offset: 0 });
    expect(listMock).toHaveBeenNthCalledWith(2, { query: 'foo', limit: 500, offset: 500 });
  });

  it('returns immediately on a single short page', async () => {
    listMock.mockResolvedValueOnce({
      items: [makeAnggota({ id: 1 }), makeAnggota({ id: 2 })],
      total: 2,
    });
    const out = await fetchAllAnggota({});
    expect(out).toHaveLength(2);
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
