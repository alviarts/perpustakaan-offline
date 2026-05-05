import type { Anggota } from '@/lib/anggota';
import type { KtaField } from '@/lib/kta';
import type { LibraryIdentity } from '@/stores/identityStore';

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Format an ISO date (YYYY-MM-DD or full ISO) to Indonesian long form
 * "12 Mei 2008". Returns the raw string if parsing fails so the caller
 * never ends up with `Invalid Date` on the printed card.
 */
export function formatTanggalId(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!m) return trimmed;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12
  ) {
    return trimmed;
  }
  const bulan = BULAN_ID[month - 1] ?? '';
  return `${day} ${bulan} ${year}`;
}

function jenisKelaminLabel(value: string | null | undefined): string {
  if (!value) return '-';
  const v = value.trim().toUpperCase();
  if (v === 'L' || v === 'LAKI' || v === 'LAKI-LAKI' || v === 'M' || v === 'MALE') return 'Laki-laki';
  if (v === 'P' || v === 'PEREMPUAN' || v === 'F' || v === 'FEMALE') return 'Perempuan';
  return value;
}

function tahunMasuk(anggota: Anggota): string {
  const m = /^(\d{4})/.exec(anggota.tanggalDaftar.trim());
  return m ? m[1]! : '-';
}

function tempatTanggalLahir(anggota: Anggota): string {
  const tempat = (anggota.tempatLahir ?? '').trim();
  const tanggal = formatTanggalId(anggota.tanggalLahir);
  if (tempat && tanggal) return `${tempat}, ${tanggal}`;
  return tempat || tanggal || '-';
}

/**
 * Resolve textual fields for the KTA renderers (preview + print + PDF).
 * Image-based field kinds (`foto`, `qr`, `ttdKepsek`, `rect`) are handled
 * separately by each renderer so they can return image-specific markup
 * instead of a string.
 *
 * `mode` controls the placeholder behaviour:
 *  - `preview` keeps human-friendly fallback strings ("Nama Anggota",
 *    "KODE-XXX", "-") sehingga editor preview tidak terlihat blank ketika
 *    member belum dipilih.
 *  - `print` mengembalikan empty string untuk field yang tidak ada
 *    nilainya supaya kartu cetakan tidak kotor dengan literal "-".
 */
export function resolveKtaFieldText(
  field: KtaField,
  anggota: Anggota | null,
  identity: LibraryIdentity,
  mode: 'preview' | 'print' = 'print',
): string {
  const dash = mode === 'preview' ? '-' : '';
  const namaFallback = mode === 'preview' ? 'Nama Anggota' : '';
  const kodeFallback = mode === 'preview' ? 'KODE-XXX' : '';
  switch (field.kind) {
    case 'static':
      return field.text ?? '';
    case 'identitas':
      return identity.nama;
    case 'nama':
      return anggota?.nama ?? namaFallback;
    case 'kodeAnggota':
      return anggota?.kodeAnggota ?? kodeFallback;
    case 'kelas':
      return anggota?.kelas ?? dash;
    case 'jurusan':
      return anggota?.jurusan ?? dash;
    case 'agama':
      return anggota?.agama ?? dash;
    case 'tempatTanggalLahir':
      return anggota ? tempatTanggalLahir(anggota) : dash;
    case 'jenisKelamin':
      return anggota ? jenisKelaminLabel(anggota.jenisKelamin) : dash;
    case 'alamat':
      return anggota?.alamat?.trim() || dash;
    case 'noTelp':
      return anggota?.noTelp?.trim() || dash;
    case 'tahunMasuk':
      return anggota ? tahunMasuk(anggota) : dash;
    case 'berlakuSd':
      // `text` di template di-treat sebagai override eksplisit. Kalau
      // tidak diset, renderer fallback ke text statis "—" supaya admin
      // sadar ini perlu di-edit.
      return (field.text ?? '').trim() || dash;
    case 'namaKepsek':
      return identity.kepalaSekolah?.trim() || identity.kepala || dash;
    default:
      return '';
  }
}
