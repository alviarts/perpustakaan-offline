import { describe, expect, it } from 'vitest';

import { anggotaToHit, bukuToHit, peminjamanToHit } from '@/components/layout/GlobalSearchDialog';
import type { Anggota } from '@/lib/anggota';
import type { Buku } from '@/lib/buku';
import type { PeminjamanRow } from '@/lib/peminjaman';

const baseAnggota: Anggota = {
  id: 7,
  kodeAnggota: 'A007',
  nama: 'Andi Pratama',
  jenisKelamin: 'L',
  kelas: 'XII IPA 1',
  jurusan: 'IPA',
  agama: null,
  tempatLahir: null,
  tanggalLahir: null,
  noTelp: null,
  email: null,
  alamat: null,
  fotoPath: null,
  tanggalDaftar: '2024-07-01',
  aktif: true,
  catatan: null,
  createdAt: '2024-07-01T00:00:00Z',
  updatedAt: '2024-07-01T00:00:00Z',
};

const baseBuku: Buku = {
  id: 13,
  kodeBuku: 'BK-013',
  judul: 'Bumi Manusia',
  pengarang: 'Pramoedya Ananta Toer',
  penerbit: null,
  tahunTerbit: 1980,
  kodeDdc: null,
  kategori: null,
  isbn: null,
  jumlahEksemplar: 3,
  jumlahTersedia: 2,
  sumber: null,
  harga: 0,
  coverPath: null,
  bahasa: null,
  deskripsi: null,
  rak: null,
  tanggalInput: '2024-08-12',
  createdAt: '2024-08-12T00:00:00Z',
  updatedAt: '2024-08-12T00:00:00Z',
};

const basePeminjaman: PeminjamanRow = {
  id: 99,
  nomorPinjam: 'P-2025-099',
  anggotaId: 7,
  anggotaNama: 'Andi Pratama',
  anggotaKode: 'A007',
  tanggalPinjam: '2026-05-01',
  tanggalJatuhTempo: '2026-05-08',
  tanggalKembali: null,
  status: 'dipinjam',
  totalDenda: 0,
  totalBayar: 0,
  totalItem: 1,
  itemDipinjam: 1,
  catatan: null,
  createdAt: '2026-05-01T08:00:00Z',
};

describe('anggotaToHit', () => {
  it('builds a stable key, primary line, and detail-page route', () => {
    const hit = anggotaToHit(baseAnggota);
    expect(hit.key).toBe('anggota:7');
    expect(hit.kind).toBe('anggota');
    expect(hit.id).toBe(7);
    expect(hit.primary).toBe('Andi Pratama');
    expect(hit.secondary).toContain('A007');
    expect(hit.secondary).toContain('XII IPA 1');
    expect(hit.secondary).toContain('IPA');
    expect(hit.to).toBe('/anggota/7');
  });

  it('drops null kelas / jurusan from the subtitle so we never render the literal "null"', () => {
    const hit = anggotaToHit({ ...baseAnggota, kelas: null, jurusan: null });
    expect(hit.secondary).toBe('A007');
  });
});

describe('bukuToHit', () => {
  it('builds a stable key, primary line, and detail-page route', () => {
    const hit = bukuToHit(baseBuku);
    expect(hit.key).toBe('buku:13');
    expect(hit.kind).toBe('buku');
    expect(hit.id).toBe(13);
    expect(hit.primary).toBe('Bumi Manusia');
    expect(hit.secondary).toContain('BK-013');
    expect(hit.secondary).toContain('Pramoedya Ananta Toer');
    expect(hit.secondary).toContain('1980');
    expect(hit.to).toBe('/buku/13');
  });

  it('omits a null pengarang and missing tahunTerbit from the subtitle', () => {
    const hit = bukuToHit({ ...baseBuku, pengarang: null, tahunTerbit: null });
    expect(hit.secondary).toBe('BK-013');
  });
});

describe('peminjamanToHit', () => {
  it('builds a primary line that combines nomorPinjam and anggotaNama', () => {
    const hit = peminjamanToHit(basePeminjaman);
    expect(hit.key).toBe('peminjaman:99');
    expect(hit.kind).toBe('peminjaman');
    expect(hit.id).toBe(99);
    expect(hit.primary).toBe('P-2025-099 — Andi Pratama');
    expect(hit.secondary).toContain('P-2025-099');
    expect(hit.secondary).toContain('Andi Pratama');
    expect(hit.secondary).toContain('dipinjam');
    expect(hit.to).toBe('/peminjaman/99');
  });
});
