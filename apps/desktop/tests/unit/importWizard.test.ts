import { describe, expect, it } from 'vitest';
import { read, utils, write } from 'xlsx';

import {
  autoMap,
  buildErrorReportCsv,
  buildMappedRows,
  buildTemplateBytes,
  normalizeHeader,
  parseBytes,
  type ImportFieldDef,
} from '@/lib/importWizard';

interface SampleItem extends Record<string, unknown> {
  kodeBuku: string;
  judul: string;
  tahunTerbit?: number | null;
}

const FIELDS: ImportFieldDef<SampleItem>[] = [
  {
    key: 'kodeBuku',
    label: 'Kode Buku',
    required: true,
    aliases: ['kode_buku', 'kode'],
    sample: 'BK-0001',
  },
  {
    key: 'judul',
    label: 'Judul',
    required: true,
    aliases: ['title'],
    sample: 'Bumi Manusia',
  },
  {
    key: 'tahunTerbit',
    label: 'Tahun',
    required: false,
    aliases: ['tahun', 'year'],
    sample: '1980',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 'invalid';
      if (n < 1000 || n > 2100) return 'out-of-range';
      return null;
    },
  },
];

function rowParser(raw: Record<string, string>): SampleItem {
  const item: SampleItem = {
    kodeBuku: (raw.kodeBuku ?? '').trim(),
    judul: (raw.judul ?? '').trim(),
  };
  const t = (raw.tahunTerbit ?? '').trim();
  if (t) {
    const n = Number(t);
    if (Number.isFinite(n)) item.tahunTerbit = Math.trunc(n);
  }
  return item;
}

function buildXlsx(headers: string[], rows: string[][]): Uint8Array {
  const aoa: (string | number)[][] = [headers, ...rows];
  const sheet = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'data');
  return new Uint8Array(write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

describe('normalizeHeader', () => {
  it('lowercases & replaces separators with underscore', () => {
    expect(normalizeHeader('Kode Buku')).toBe('kode_buku');
    expect(normalizeHeader('Tahun-Terbit')).toBe('tahun_terbit');
    expect(normalizeHeader('  No. Telepon  ')).toBe('no_telepon');
  });
});

describe('autoMap', () => {
  it('matches headers via aliases (case-insensitive)', () => {
    const headers = ['Kode Buku', 'Title', 'Year', 'Catatan'];
    const map = autoMap(FIELDS, headers);
    expect(map['Kode Buku']).toBe('kodeBuku');
    expect(map['Title']).toBe('judul');
    expect(map['Year']).toBe('tahunTerbit');
    expect(map['Catatan']).toBe('');
  });

  it('does not double-map a target', () => {
    const headers = ['kode', 'kode_buku'];
    const map = autoMap(FIELDS, headers);
    // first one wins
    expect(map.kode).toBe('kodeBuku');
    expect(map.kode_buku).toBe('');
  });
});

describe('parseBytes + buildMappedRows', () => {
  it('parses a workbook and validates rows', () => {
    const bytes = buildXlsx(
      ['Kode Buku', 'Judul', 'Tahun'],
      [
        ['BK-001', 'Bumi Manusia', '1980'],
        ['BK-002', 'Anak Semua Bangsa', '1980'],
        ['BK-003', '', '1980'], // missing judul
        ['BK-001', 'Duplikat', '1980'], // duplicate kode
        ['BK-004', 'Tahun Salah', '99999'], // invalid tahun
      ],
    );
    const parsed = parseBytes('sample.xlsx', bytes);
    expect(parsed.headers).toEqual(['Kode Buku', 'Judul', 'Tahun']);
    expect(parsed.rows).toHaveLength(5);

    const map = autoMap(FIELDS, parsed.headers);
    const rows = buildMappedRows(FIELDS, parsed, map, rowParser);
    expect(rows).toHaveLength(5);

    // Row 1 (sheet row 2) is OK
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[0]?.item.kodeBuku).toBe('BK-001');
    expect(rows[0]?.item.tahunTerbit).toBe(1980);

    // Missing judul
    expect(rows[2]?.errors).toContain('Judul wajib diisi');

    // Duplicate kode
    expect(rows[3]?.errors.some((e) => e.includes('duplikat'))).toBe(true);

    // Invalid tahun
    expect(rows[4]?.errors).toContain('out-of-range');
  });
});

describe('buildTemplateBytes', () => {
  it('produces a workbook with headers and sample row', () => {
    const bytes = buildTemplateBytes(FIELDS, 'Buku');
    const wb = read(bytes, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const aoa = utils.sheet_to_json<Array<string>>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    expect(aoa[0]).toEqual(['Kode Buku', 'Judul', 'Tahun']);
    expect(aoa[1]).toEqual(['BK-0001', 'Bumi Manusia', '1980']);
  });
});

describe('buildErrorReportCsv', () => {
  it('escapes quotes and emits header row', () => {
    const csv = buildErrorReportCsv([
      { row: 2, message: 'kode_buku is required' },
      { row: 5, message: 'duplicate "key"' },
    ]);
    expect(csv).toBe('row,message\n2,"kode_buku is required"\n5,"duplicate ""key"""\n');
  });
});
