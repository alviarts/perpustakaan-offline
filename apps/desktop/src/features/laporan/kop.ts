import type { LibraryIdentity } from '@/stores/identityStore';
import type { AkreditasiProfil } from '@/lib/akreditasi';
import type { LaporanIdentitas, LaporanTtd } from './utils';

/** Build official letterhead (kop) + signature block from stored identity. */
export function buildKop(
  identity: LibraryIdentity,
  profil?: AkreditasiProfil | null,
  tempatTanggal?: string,
): { identitas: LaporanIdentitas; ttd: LaporanTtd } {
  return {
    identitas: {
      nama: identity.nama,
      alamat: identity.alamat,
      npsn: identity.npsn && identity.npsn !== '-' ? identity.npsn : undefined,
      npp: profil?.npp ? profil.npp : undefined,
      kontak: identity.kontak && identity.kontak !== '-' ? identity.kontak : undefined,
    },
    ttd: {
      jabatan: 'Kepala Sekolah',
      nama: identity.kepalaSekolah || undefined,
      tempatTanggal,
    },
  };
}
