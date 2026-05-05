import {
  IdCard,
  Settings as SettingsIcon,
  Database,
  Palette,
  Languages,
  Users,
  ShieldCheck,
  HardDriveDownload,
  RefreshCcw,
  History,
  Info,
  BookText,
  BookOpen,
} from 'lucide-react';

/**
 * 12 settings sub-page metadata (revisi #24).
 *
 * - `id` is the tail of the route, e.g. `identitas` → `/settings/identitas`.
 * - `i18nKey` resolves to a `settings:sections.<key>` group containing
 *   `label` + `summary` (and per-section field labels).
 * - `keywords` is a hand-curated list of search terms (in addition to the
 *   resolved label/summary translations) that the global search will match
 *   against. Stored in code so we don't bloat translation files with synonyms.
 */
export interface SectionDef {
  id: string;
  to: string;
  i18nKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'identitas',
    to: '/settings/identitas',
    i18nKey: 'identitas',
    Icon: IdCard,
    keywords: ['identitas', 'identity', 'nama', 'logo', 'alamat', 'kepala', 'npsn', 'kontak'],
  },
  {
    id: 'aturan-peminjaman',
    to: '/settings/aturan-peminjaman',
    i18nKey: 'aturanPeminjaman',
    Icon: BookText,
    keywords: [
      'aturan peminjaman',
      'loan rules',
      'peminjaman',
      'denda',
      'fine',
      'durasi',
      'duration',
      'limit',
      'maksimum',
      'hari libur',
      'holiday',
    ],
  },
  {
    id: 'master-data',
    to: '/settings/master-data',
    i18nKey: 'masterData',
    Icon: Database,
    keywords: ['master data', 'ddc', 'kategori', 'bahasa', 'jurusan', 'kelas', 'agama'],
  },
  {
    id: 'kta',
    to: '/settings/kta',
    i18nKey: 'kta',
    Icon: IdCard,
    keywords: ['kta', 'kartu', 'member card', 'template', 'barcode'],
  },
  {
    id: 'label-buku',
    to: '/settings/label-buku',
    i18nKey: 'labelBuku',
    Icon: BookText,
    keywords: [
      'label buku',
      'book label',
      'barcode buku',
      'spine label',
      'punggung buku',
      'template',
    ],
  },
  {
    id: 'tampilan',
    to: '/settings/tampilan',
    i18nKey: 'tampilan',
    Icon: Palette,
    keywords: ['tampilan', 'appearance', 'tema', 'theme', 'font', 'density', 'kerapatan'],
  },
  {
    id: 'bahasa',
    to: '/settings/bahasa',
    i18nKey: 'bahasa',
    Icon: Languages,
    keywords: ['bahasa', 'language', 'indonesia', 'english', 'i18n', 'locale'],
  },
  {
    id: 'akun',
    to: '/settings/akun',
    i18nKey: 'akun',
    Icon: Users,
    keywords: ['akun', 'pengguna', 'users', 'pustakawan', 'admin', 'password', 'reset'],
  },
  {
    id: 'hak-akses',
    to: '/settings/hak-akses',
    i18nKey: 'hakAkses',
    Icon: ShieldCheck,
    keywords: ['hak akses', 'permission', 'role', 'admin', 'pustakawan', 'matrix'],
  },
  {
    id: 'backup',
    to: '/settings/backup',
    i18nKey: 'backup',
    Icon: HardDriveDownload,
    keywords: ['backup', 'restore', 'database', 'jadwal', 'schedule'],
  },
  {
    id: 'sinkronisasi',
    to: '/settings/sinkronisasi',
    i18nKey: 'sinkronisasi',
    Icon: RefreshCcw,
    keywords: ['sinkronisasi', 'sync', 'google sheets', 'spreadsheet', 'api key'],
  },
  {
    id: 'audit-log',
    to: '/settings/audit-log',
    i18nKey: 'auditLog',
    Icon: History,
    keywords: ['audit log', 'riwayat', 'history', 'aksi', 'log'],
  },
  {
    id: 'manual',
    to: '/settings/manual',
    i18nKey: 'manual',
    Icon: BookOpen,
    keywords: [
      'manual',
      'panduan',
      'dokumentasi',
      'documentation',
      'help',
      'bantuan',
      'guide',
      'how to',
    ],
  },
  {
    id: 'tentang',
    to: '/settings/tentang',
    i18nKey: 'tentang',
    Icon: Info,
    keywords: ['tentang', 'about', 'version', 'versi', 'kredit', 'credits', 'github'],
  },
];

export const SETTINGS_ICON = SettingsIcon;

export interface SectionWithLabel extends SectionDef {
  label: string;
  summary: string;
}

/**
 * Pure, dependency-free search filter (revisi #24). Used by both the runtime
 * Settings sidebar and the unit test `settings-search.test.ts`. Matches against
 * the resolved label, summary, and curated keywords list. Returns the original
 * order when `query` is empty so the navigation stays stable.
 */
export function filterSections(sections: SectionWithLabel[], query: string): SectionWithLabel[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections.filter((s) => {
    const haystack = [s.label, s.summary, ...s.keywords].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
