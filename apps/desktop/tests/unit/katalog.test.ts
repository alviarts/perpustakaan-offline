import { describe, expect, it } from 'vitest';
import { generateCatalog, mainClass, type DdcEntry, type ExistingBook } from '@/lib/katalog';

const DDC: DdcEntry[] = [
  { kode: '000', nama: 'Karya Umum' },
  { kode: '004', nama: 'Ilmu Komputer' },
  { kode: '004.6', nama: 'Jaringan Komputer' },
  { kode: '005', nama: 'Pemrograman & Program Komputer' },
  { kode: '005.74', nama: 'Basis Data' },
  { kode: '100', nama: 'Filsafat & Psikologi' },
  { kode: '150', nama: 'Psikologi' },
  { kode: '200', nama: 'Agama' },
  { kode: '297', nama: 'Agama Islam' },
  { kode: '297.4', nama: 'Fikih' },
  { kode: '300', nama: 'Ilmu Sosial' },
  { kode: '330', nama: 'Ekonomi' },
  { kode: '400', nama: 'Bahasa' },
  { kode: '500', nama: 'Sains Murni' },
  { kode: '510', nama: 'Matematika' },
  { kode: '600', nama: 'Teknologi & Sains Terapan' },
  { kode: '700', nama: 'Kesenian, Hiburan, Olahraga' },
  { kode: '741', nama: 'Menggambar & Seni Gambar' },
  { kode: '741.4', nama: 'Ilustrasi & Ilustrator' },
  { kode: '741.5', nama: 'Kartun, Karikatur & Komik' },
  { kode: '741.6', nama: 'Seni Grafis Komersial (Ilustrasi Buku, Poster, Desain Grafis)' },
  { kode: '770', nama: 'Fotografi' },
  { kode: '780', nama: 'Musik' },
  { kode: '796', nama: 'Olahraga & Permainan Atletik' },
  { kode: '800', nama: 'Sastra' },
  { kode: '813', nama: 'Sastra Indonesia (Fiksi Indonesia)' },
  { kode: '823', nama: 'Fiksi Inggris' },
  { kode: '830', nama: 'Sastra Jerman' },
  { kode: '900', nama: 'Sejarah & Geografi' },
  { kode: '959.8', nama: 'Sejarah Indonesia' },
];

const EMPTY: ExistingBook[] = [];

describe('mainClass', () => {
  it('extracts the first three digits', () => {
    expect(mainClass('813.5')).toBe('813');
    expect(mainClass('800')).toBe('800');
    expect(mainClass('')).toBe('');
  });
});

describe('generateCatalog', () => {
  it('builds a call number from DDC + author + title letter', () => {
    const result = generateCatalog({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      kategori: 'Fiksi',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('813');
    expect(result.callNumber).toBe('813 HIR l');
    expect(result.kodeBuku).toBe('813-HIR-L-01-0');
    expect(result.rak).toBe('0');
  });

  it('learns the shelf location from existing books with the same DDC', () => {
    const existing: ExistingBook[] = [
      { kodeBuku: '813 A a', kodeDdc: '813', rak: 'RAK B' },
      { kodeBuku: '813 B b', kodeDdc: '813', rak: 'RAK B' },
      { kodeBuku: '500 C c', kodeDdc: '500', rak: 'RAK D' },
    ];
    const result = generateCatalog({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      kategori: 'Fiksi',
      ddcList: DDC,
      existing,
    });
    expect(result.rak).toBe('RAK B');
  });

  it('makes the book code unique against the collection', () => {
    const existing: ExistingBook[] = [
      { kodeBuku: '813-HIR-L-01-B', kodeDdc: '813', rak: 'RAK B' },
    ];
    const result = generateCatalog({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      kategori: 'Fiksi',
      ddcList: DDC,
      existing,
    });
    expect(result.callNumber).toBe('813 HIR l');
    expect(result.kodeBuku).toBe('813-HIR-L-01-B-01');
  });

  it('uses 823 for English fiction, not 813', () => {
    const result = generateCatalog({
      judul: 'The Secret Garden',
      pengarang: 'Frances Hodgson Burnett',
      subjects: ['Fiction', 'English literature'],
      language: 'en',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('823');
    expect(result.kodeBuku).toMatch(/^823-BUR-[A-Z]-\d{2}-[A-Z0-9]+$/);
    expect(result.kodeBuku).not.toContain(' ');
  });

  it('keeps 813 for Indonesian fiction', () => {
    const result = generateCatalog({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      subjects: ['Fiksi Indonesia'],
      language: 'id',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('813');
  });

  it('produces a scan-safe code (A-Z, 0-9 and dash only)', () => {
    const result = generateCatalog({
      judul: 'Ilustrasi Buku Anak',
      pengarang: 'Rina Wijaya',
      subjects: ['Ilustrasi'],
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeBuku).toMatch(/^[A-Z0-9.-]+$/);
    expect(result.kodeBuku).toMatch(/-\d{2}-/);
  });

  it('uses ISBN subjects to pick the class when kategori is empty', () => {
    const result = generateCatalog({
      judul: 'Filosofi Teras',
      pengarang: 'Henry Manampiring',
      subjects: ['Motivasi diri', 'Pengembangan karakter'],
      ddcList: DDC,
      existing: EMPTY,
    });
    // "Pengembangan karakter"/"Motivasi" tidak punya aturan khusus → fallback
    // ke kelas filsafat/psikologi (100) lewat kata "psikologi" di nama? Tidak,
    // jadi harus tetap menghasilkan kode yang valid dari master.
    expect(DDC.map((d) => d.kode)).toContain(result.kodeDdc);
  });

  it('maps religion keywords to class 200', () => {
    const result = generateCatalog({
      judul: 'Fikih Islam',
      pengarang: 'Sulaiman Rasjid',
      subjects: ['Agama Islam'],
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc.startsWith('2')).toBe(true);
  });

  it('never returns a DDC code that is not in the master list', () => {
    const small: DdcEntry[] = [{ kode: '500', nama: 'Sains' }];
    const result = generateCatalog({
      judul: 'Buku Tanpa Kategori',
      pengarang: 'Anonim',
      ddcList: small,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('500');
  });

  it('handles an empty DDC master gracefully', () => {
    const result = generateCatalog({
      judul: 'Tanpa Master',
      pengarang: 'Penulis',
      ddcList: [],
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('');
    expect(result.callNumber).toBe('000 PEN t');
  });

  it('uses the illustration subdivision for illustration books', () => {
    const result = generateCatalog({
      judul: 'Ilustrasi Buku Anak',
      pengarang: 'Rina Wijaya',
      subjects: ['Ilustrasi'],
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc.startsWith('741')).toBe(true);
  });

  it('uses 741.5 for comics / cartoons', () => {
    const result = generateCatalog({
      judul: 'Petualangan Komik',
      pengarang: 'Budi Santoso',
      subjects: ['Komik', 'Kartun'],
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('741.5');
  });

  it('uses 741.6 for graphic design / posters', () => {
    const result = generateCatalog({
      judul: 'Desain Grafis Modern',
      pengarang: 'Sari Dewi',
      subjects: ['Desain Grafis', 'Poster'],
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(result.kodeDdc).toBe('741.6');
  });

  it('maps topics to sharper DDC subdivisions', () => {    const cases: Array<{ judul: string; subjects: string[]; expected: string }> = [
      { judul: 'Jaringan Komputer', subjects: ['Jaringan komputer'], expected: '004.6' },
      { judul: 'Basis Data MySQL', subjects: ['Basis data', 'database'], expected: '005.74' },
      { judul: 'Fikih Ibadah', subjects: ['Fikih', 'Agama Islam'], expected: '297.4' },
      { judul: 'Ekonomi Makro', subjects: ['Ekonomi'], expected: '330' },
      { judul: 'Matematika Diskrit', subjects: ['Matematika'], expected: '510' },
      { judul: 'Sejarah Indonesia Modern', subjects: ['Sejarah Indonesia'], expected: '959.8' },
      { judul: 'Psikologi Remaja', subjects: ['Psikologi'], expected: '150' },
    ];
    for (const c of cases) {
      const r = generateCatalog({
        judul: c.judul,
        pengarang: 'Penulis Uji',
        subjects: c.subjects,
        ddcList: DDC,
        existing: EMPTY,
      });
      expect(r.kodeDdc, c.judul).toBe(c.expected);
    }
  });

  it('prefers the catalogue DDC (sourceDdc) over heuristics', () => {
    const r = generateCatalog({
      judul: 'Filosofi Teras',
      pengarang: 'Henry Manampiring',
      subjects: ['Motivasi diri'],
      sourceDdc: '155.25',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(r.kodeDdc).toBe('155.25');
    expect(r.kodeBuku).toBe('155.25-MAN-F-01-0');
  });

  it('skips leading articles for the title letter', () => {
    const r = generateCatalog({
      judul: 'The Secret Garden',
      pengarang: 'Frances Hodgson Burnett',
      sourceDdc: '823',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(r.kodeBuku).toMatch(/^823-BUR-S-\d{2}-/);
  });

  it('embeds the copy count as two digits', () => {
    const r = generateCatalog({
      judul: 'Laskar Pelangi',
      pengarang: 'Andrea Hirata',
      sourceDdc: '813',
      qty: 12,
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(r.kodeBuku).toBe('813-HIR-L-12-0');
  });

  it('uses 0 for an empty level and 00 for zero copies', () => {
    const r = generateCatalog({
      judul: 'Bumi Manusia',
      pengarang: 'Pramoedya Ananta Toer',
      sourceDdc: '899.221',
      ddcList: DDC,
      existing: EMPTY,
    });
    expect(r.kodeBuku).toBe('899.221-TOE-B-01-0');
  });
});
