import { z } from 'zod';

const optionalString = z.string().trim();

export const anggotaFormSchema = z.object({
  kodeAnggota: z.string().trim().min(1, 'kodeAnggotaRequired'),
  nama: z.string().trim().min(1, 'namaRequired'),
  jenisKelamin: z.union([z.literal('L'), z.literal('P'), z.literal('')]),
  kelas: optionalString.optional(),
  jurusan: optionalString.optional(),
  agama: optionalString.optional(),
  tempatLahir: optionalString.optional(),
  tanggalLahir: optionalString.optional(),
  noTelp: optionalString.optional(),
  email: optionalString
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'emailInvalid' });
    }),
  alamat: optionalString.optional(),
  fotoPath: optionalString.optional(),
  tanggalDaftar: optionalString.optional(),
  aktif: z.boolean(),
  catatan: optionalString.optional(),
});

export type AnggotaFormValues = z.infer<typeof anggotaFormSchema>;

/** Convert form values to the IPC payload, mapping empty strings to null. */
export function toAnggotaInput(values: AnggotaFormValues): {
  kodeAnggota: string;
  nama: string;
  jenisKelamin: 'L' | 'P' | null;
  kelas: string | null;
  jurusan: string | null;
  agama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  noTelp: string | null;
  email: string | null;
  alamat: string | null;
  fotoPath: string | null;
  tanggalDaftar: string | null;
  aktif: boolean;
  catatan: string | null;
} {
  const norm = (v?: string): string | null => (v && v.trim().length > 0 ? v.trim() : null);
  return {
    kodeAnggota: values.kodeAnggota,
    nama: values.nama,
    jenisKelamin: values.jenisKelamin === '' ? null : values.jenisKelamin,
    kelas: norm(values.kelas),
    jurusan: norm(values.jurusan),
    agama: norm(values.agama),
    tempatLahir: norm(values.tempatLahir),
    tanggalLahir: norm(values.tanggalLahir),
    noTelp: norm(values.noTelp),
    email: norm(values.email),
    alamat: norm(values.alamat),
    fotoPath: norm(values.fotoPath),
    tanggalDaftar: norm(values.tanggalDaftar),
    aktif: values.aktif,
    catatan: norm(values.catatan),
  };
}
