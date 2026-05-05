import { create } from 'zustand';
import { isTauri } from '@/lib/auth';

export interface LibraryIdentity {
  nama: string;
  alamat: string;
  kepala: string;
  npsn: string;
  tahunAjaran: string;
  logoPath: string;
  kontak: string;
  /**
   * FEAT-03 — path ke file gambar tanda tangan kepala sekolah (transparan
   * PNG ideal). Disetel dari Settings → Identitas dan otomatis dipakai
   * oleh KTA renderer kalau template-nya punya field `ttdKepsek`.
   */
  ttdKepsekPath: string;
  /**
   * FEAT-03 — nama kepala sekolah. Berbeda dari `kepala` (kepala
   * perpustakaan). Dipakai oleh KTA renderer ketika template punya field
   * `namaKepsek` dan dipasangkan dengan `ttdKepsekPath` sebagai blok
   * tanda tangan di sisi belakang kartu.
   */
  kepalaSekolah: string;
}

const DEFAULT_IDENTITY: LibraryIdentity = {
  nama: 'Perpustakaan Sekolah',
  alamat: '-',
  kepala: '-',
  npsn: '-',
  tahunAjaran: '2024/2025',
  logoPath: '',
  kontak: '-',
  ttdKepsekPath: '',
  kepalaSekolah: '',
};

interface RustIdentity {
  nama: string;
  alamat: string;
  kepala: string;
  npsn: string;
  tahun_ajaran: string;
  logo_path: string;
  kontak: string;
  ttd_kepsek_path?: string | null;
  kepala_sekolah?: string | null;
}

const fromRust = (r: RustIdentity): LibraryIdentity => ({
  nama: r.nama,
  alamat: r.alamat,
  kepala: r.kepala,
  npsn: r.npsn,
  tahunAjaran: r.tahun_ajaran,
  logoPath: r.logo_path,
  kontak: r.kontak,
  ttdKepsekPath: r.ttd_kepsek_path ?? '',
  kepalaSekolah: r.kepala_sekolah ?? '',
});

interface IdentityState {
  identity: LibraryIdentity;
  loaded: boolean;
  loadIdentity: () => Promise<void>;
  setIdentity: (identity: LibraryIdentity) => void;
}

export const useIdentityStore = create<IdentityState>()((set) => ({
  identity: DEFAULT_IDENTITY,
  loaded: false,
  loadIdentity: async () => {
    if (!isTauri()) {
      set({ loaded: true });
      return;
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke<RustIdentity>('identity_get');
      set({ identity: fromRust(r), loaded: true });
    } catch (err) {
      console.warn('identity_get failed, using defaults', err);
      set({ loaded: true });
    }
  },
  setIdentity: (identity) => set({ identity }),
}));

export async function subscribeIdentityChanges(): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<RustIdentity>('identity:changed', (event) => {
    useIdentityStore.getState().setIdentity(fromRust(event.payload));
  });
  return unlisten;
}
