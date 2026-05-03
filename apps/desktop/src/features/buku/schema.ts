import { z } from 'zod';

const optionalString = z.string().trim();

export const bukuFormSchema = z.object({
  kodeBuku: z.string().trim().min(1, 'kodeBukuRequired'),
  judul: z.string().trim().min(1, 'judulRequired'),
  pengarang: optionalString.optional(),
  penerbit: optionalString.optional(),
  tahunTerbit: optionalString.optional(),
  kodeDdc: optionalString.optional(),
  kategori: optionalString.optional(),
  isbn: optionalString.optional(),
  jumlahEksemplar: optionalString.optional(),
  sumber: optionalString.optional(),
  harga: optionalString.optional(),
  bahasa: optionalString.optional(),
  deskripsi: optionalString.optional(),
  rak: optionalString.optional(),
  coverPath: optionalString.optional(),
});

export type BukuFormValues = z.infer<typeof bukuFormSchema>;

const toIntOrNull = (v?: string): number | null => {
  if (!v || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export function toBukuInput(values: BukuFormValues): {
  kodeBuku: string;
  judul: string;
  pengarang: string | null;
  penerbit: string | null;
  tahunTerbit: number | null;
  kodeDdc: string | null;
  kategori: string | null;
  isbn: string | null;
  jumlahEksemplar: number | null;
  sumber: string | null;
  harga: number | null;
  bahasa: string | null;
  deskripsi: string | null;
  rak: string | null;
  coverPath: string | null;
} {
  const norm = (v?: string): string | null => (v && v.trim() ? v.trim() : null);
  return {
    kodeBuku: values.kodeBuku.trim(),
    judul: values.judul.trim(),
    pengarang: norm(values.pengarang),
    penerbit: norm(values.penerbit),
    tahunTerbit: toIntOrNull(values.tahunTerbit),
    kodeDdc: norm(values.kodeDdc),
    kategori: norm(values.kategori),
    isbn: norm(values.isbn),
    jumlahEksemplar: toIntOrNull(values.jumlahEksemplar),
    sumber: norm(values.sumber),
    harga: toIntOrNull(values.harga),
    bahasa: norm(values.bahasa),
    deskripsi: norm(values.deskripsi),
    rak: norm(values.rak),
    coverPath: norm(values.coverPath),
  };
}
