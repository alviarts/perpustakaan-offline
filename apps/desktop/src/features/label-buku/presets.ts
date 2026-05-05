import type { LabelBukuField, LabelBukuLayout } from '@/lib/labelBuku';

/**
 * Bundled label-buku presets (v1.0.6 #22). Each preset returns a complete
 * `LabelBukuLayout` so the gallery can render a thumbnail without any
 * dynamic merging. Preset ids are URL-safe and stable — they're used as
 * React keys and as `data-testid` suffixes in the gallery.
 */
export interface LabelBukuPreset {
  id: string;
  nama: string;
  deskripsi: string;
  layout: LabelBukuLayout;
}

function blank(
  fields: LabelBukuField[],
  background = '#ffffff',
  widthMm = 70,
  heightMm = 35,
): LabelBukuLayout {
  return { widthMm, heightMm, background, fields };
}

/* ------------------------------------------------------------------ */
/* Helper field builders so the presets stay readable                   */
/* ------------------------------------------------------------------ */

function rect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius?: number,
): LabelBukuField {
  return { id, kind: 'rect', x, y, width, height, fill, ...(radius ? { radius } : {}) };
}

function text(
  id: string,
  kind: LabelBukuField['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Partial<LabelBukuField> = {},
): LabelBukuField {
  return {
    id,
    kind,
    x,
    y,
    width,
    height,
    fontSize: opts.fontSize ?? 9,
    color: opts.color ?? '#0f172a',
    align: opts.align ?? 'left',
    ...(opts.fontWeight ? { fontWeight: opts.fontWeight } : {}),
    ...(opts.text !== undefined ? { text: opts.text } : {}),
  };
}

function barcode(id: string, x: number, y: number, w: number, h: number): LabelBukuField {
  return { id, kind: 'barcode', x, y, width: w, height: h };
}

function qr(id: string, x: number, y: number, w: number, h: number): LabelBukuField {
  return { id, kind: 'qr', x, y, width: w, height: h };
}

/* ------------------------------------------------------------------ */
/* 10 Presets                                                           */
/* ------------------------------------------------------------------ */

// 1. Default — judul + barcode + kodeEksemplar
const standar: LabelBukuLayout = blank([
  text('identitas', 'identitas', 4, 4, 92, 10, {
    fontSize: 9,
    fontWeight: 'bold',
    align: 'center',
  }),
  text('judul', 'judul', 4, 18, 92, 12, {
    fontSize: 10,
    fontWeight: 'bold',
    align: 'center',
  }),
  text('kode', 'kodeBuku', 4, 34, 40, 10, { fontSize: 11, fontWeight: 'bold' }),
  barcode('barcode', 4, 50, 92, 36),
  text('kodeek', 'kodeEksemplar', 4, 88, 92, 10, { fontSize: 8, color: '#475569', align: 'center' }),
]);

// 2. Punggung Buku (spine label) — narrow vertical
const punggungBuku: LabelBukuLayout = blank(
  [
    rect('top', 0, 0, 100, 22, '#0f172a'),
    text('identitas', 'identitas', 4, 3, 92, 16, {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#ffffff',
      align: 'center',
    }),
    text('ddc', 'kodeDdc', 4, 26, 92, 14, {
      fontSize: 16,
      fontWeight: 'bold',
      align: 'center',
    }),
    text('kode', 'kodeBuku', 4, 44, 92, 10, { fontSize: 9, align: 'center' }),
    text('kodeek', 'kodeEksemplar', 4, 60, 92, 12, {
      fontSize: 8,
      color: '#475569',
      align: 'center',
    }),
    barcode('barcode', 4, 76, 92, 22),
  ],
  '#ffffff',
  35,
  70,
);

// 3. Klasik — outlined card, judul tengah
const klasik: LabelBukuLayout = blank([
  rect('frame', 1, 2, 98, 96, '#f1f5f9', 1),
  rect('accent', 1, 2, 98, 6, '#1e293b'),
  text('identitas', 'identitas', 4, 12, 92, 8, {
    fontSize: 7,
    color: '#475569',
    align: 'center',
  }),
  text('judul', 'judul', 4, 22, 92, 14, {
    fontSize: 11,
    fontWeight: 'bold',
    align: 'center',
  }),
  text('pengarang', 'pengarang', 4, 38, 92, 8, {
    fontSize: 7,
    color: '#475569',
    align: 'center',
  }),
  barcode('barcode', 8, 52, 84, 30),
  text('kodeek', 'kodeEksemplar', 4, 86, 92, 8, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

// 4. Minimalis — bersih, fokus barcode
const minimalis: LabelBukuLayout = blank([
  text('judul', 'judul', 4, 6, 92, 12, {
    fontSize: 10,
    fontWeight: 'bold',
    align: 'left',
  }),
  text('kode', 'kodeBuku', 4, 22, 60, 8, { fontSize: 8, color: '#475569' }),
  text('tahun', 'tahun', 66, 22, 30, 8, { fontSize: 8, color: '#475569', align: 'right' }),
  barcode('barcode', 4, 38, 92, 44),
  text('kodeek', 'kodeEksemplar', 4, 86, 92, 10, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

// 5. QR Modern — kode QR di samping judul
const qrModern: LabelBukuLayout = blank([
  rect('sideband', 0, 0, 8, 100, '#1d4ed8'),
  text('identitas', 'identitas', 12, 6, 60, 10, {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1d4ed8',
  }),
  text('judul', 'judul', 12, 18, 60, 18, {
    fontSize: 10,
    fontWeight: 'bold',
  }),
  text('kode', 'kodeBuku', 12, 38, 60, 8, { fontSize: 8, color: '#475569' }),
  text('pengarang', 'pengarang', 12, 48, 60, 8, { fontSize: 7, color: '#475569' }),
  qr('qr', 74, 12, 22, 38),
  barcode('barcode', 12, 60, 84, 26),
  text('kodeek', 'kodeEksemplar', 4, 88, 92, 10, {
    fontSize: 7,
    color: '#475569',
    align: 'center',
  }),
]);

// 6. Bold Header — pita warna di atas
const boldHeader: LabelBukuLayout = blank([
  rect('header', 0, 0, 100, 28, '#dc2626'),
  text('identitas', 'identitas', 4, 4, 92, 10, {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    align: 'center',
  }),
  text('judul', 'judul', 4, 14, 92, 12, {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    align: 'center',
  }),
  text('kode', 'kodeBuku', 4, 32, 60, 10, { fontSize: 10, fontWeight: 'bold' }),
  text('tahun', 'tahun', 66, 32, 30, 10, { fontSize: 9, color: '#475569', align: 'right' }),
  barcode('barcode', 4, 46, 92, 38),
  text('kodeek', 'kodeEksemplar', 4, 88, 92, 10, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

// 7. Sidebar Info — DDC sidebar + judul + barcode
const sidebarInfo: LabelBukuLayout = blank([
  rect('left', 0, 0, 26, 100, '#0f766e'),
  text('ddc', 'kodeDdc', 1, 14, 24, 14, {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    align: 'center',
  }),
  text('kodebuku', 'kodeBuku', 1, 30, 24, 8, {
    fontSize: 7,
    color: '#a7f3d0',
    align: 'center',
  }),
  text('judul', 'judul', 28, 6, 70, 18, {
    fontSize: 10,
    fontWeight: 'bold',
  }),
  text('pengarang', 'pengarang', 28, 26, 70, 8, {
    fontSize: 7,
    color: '#475569',
  }),
  text('penerbit', 'penerbit', 28, 36, 70, 8, {
    fontSize: 7,
    color: '#475569',
  }),
  barcode('barcode', 28, 50, 70, 32),
  text('kodeek', 'kodeEksemplar', 28, 86, 70, 10, {
    fontSize: 7,
    color: '#475569',
    align: 'center',
  }),
]);

// 8. Eco — frame dengan accent hijau, footer kompak
const eco: LabelBukuLayout = blank([
  rect('topbar', 0, 0, 100, 4, '#16a34a'),
  rect('bottombar', 0, 96, 100, 4, '#16a34a'),
  text('identitas', 'identitas', 4, 8, 92, 8, {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#16a34a',
    align: 'center',
  }),
  text('judul', 'judul', 4, 18, 92, 12, {
    fontSize: 10,
    fontWeight: 'bold',
    align: 'center',
  }),
  text('kode', 'kodeBuku', 4, 34, 92, 8, { fontSize: 8, align: 'center', color: '#475569' }),
  barcode('barcode', 4, 46, 92, 36),
  text('kodeek', 'kodeEksemplar', 4, 84, 92, 10, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

// 9. Inventaris — fokus data lengkap (judul + pengarang + penerbit + tahun)
const inventaris: LabelBukuLayout = blank([
  rect('header', 0, 0, 100, 18, '#1f2937'),
  text('identitas', 'identitas', 4, 5, 92, 10, {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    align: 'center',
  }),
  text('judul', 'judul', 4, 22, 92, 10, { fontSize: 9, fontWeight: 'bold' }),
  text('pengarang', 'pengarang', 4, 34, 60, 6, { fontSize: 6, color: '#475569' }),
  text('penerbit', 'penerbit', 4, 42, 60, 6, { fontSize: 6, color: '#475569' }),
  text('tahun', 'tahun', 66, 34, 30, 6, { fontSize: 6, color: '#475569', align: 'right' }),
  text('kode', 'kodeBuku', 66, 42, 30, 6, { fontSize: 6, color: '#475569', align: 'right' }),
  barcode('barcode', 4, 52, 92, 32),
  text('kodeek', 'kodeEksemplar', 4, 86, 92, 10, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

// 10. QR + Barcode kombo — keduanya tersedia
const qrBarcodeKombo: LabelBukuLayout = blank([
  text('identitas', 'identitas', 4, 4, 92, 10, {
    fontSize: 9,
    fontWeight: 'bold',
    align: 'center',
  }),
  text('judul', 'judul', 4, 16, 70, 14, {
    fontSize: 10,
    fontWeight: 'bold',
    align: 'left',
  }),
  qr('qr', 76, 14, 20, 36),
  text('kode', 'kodeBuku', 4, 32, 70, 8, { fontSize: 8, color: '#475569' }),
  text('pengarang', 'pengarang', 4, 42, 70, 8, { fontSize: 7, color: '#475569' }),
  barcode('barcode', 4, 56, 92, 30),
  text('kodeek', 'kodeEksemplar', 4, 88, 92, 10, {
    fontSize: 8,
    color: '#0f172a',
    align: 'center',
  }),
]);

export const LABEL_BUKU_PRESETS: readonly LabelBukuPreset[] = [
  {
    id: 'standar',
    nama: 'Standar',
    deskripsi: 'Layout default 70 × 35 mm dengan judul + barcode + kode eksemplar',
    layout: standar,
  },
  {
    id: 'punggung-buku',
    nama: 'Punggung Buku',
    deskripsi: 'Stiker vertikal 35 × 70 mm dengan kode DDC besar untuk punggung rak',
    layout: punggungBuku,
  },
  {
    id: 'klasik',
    nama: 'Klasik',
    deskripsi: 'Frame klasik dengan judul tengah, cocok untuk koleksi referensi',
    layout: klasik,
  },
  {
    id: 'minimalis',
    nama: 'Minimalis',
    deskripsi: 'Tampilan polos, fokus pada barcode besar dan kode',
    layout: minimalis,
  },
  {
    id: 'qr-modern',
    nama: 'QR Modern',
    deskripsi: 'QR samping judul, sideband biru, barcode di bawah',
    layout: qrModern,
  },
  {
    id: 'bold-header',
    nama: 'Bold Header',
    deskripsi: 'Pita merah di atas, judul putih, kompak untuk perpustakaan sekolah',
    layout: boldHeader,
  },
  {
    id: 'sidebar-info',
    nama: 'Sidebar Info',
    deskripsi: 'DDC pada sidebar tosca + info lengkap (pengarang/penerbit)',
    layout: sidebarInfo,
  },
  {
    id: 'eco',
    nama: 'Eco',
    deskripsi: 'Aksen hijau atas-bawah, body bersih, identitas perpustakaan menonjol',
    layout: eco,
  },
  {
    id: 'inventaris',
    nama: 'Inventaris',
    deskripsi: 'Detail lengkap (pengarang, penerbit, tahun, kode) untuk audit fisik',
    layout: inventaris,
  },
  {
    id: 'qr-barcode-kombo',
    nama: 'QR + Barcode',
    deskripsi: 'Kombinasi QR & barcode supaya scanner kamera dan scanner gun keduanya bekerja',
    layout: qrBarcodeKombo,
  },
];
