import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

/**
 * Label Buku template (v1.0.6 #22). Mirrors `kta.ts`. The label is intended
 * for spine / cover / inside-cover stickers — Avery-style multi-up printing
 * is handled by `features/label-buku/print.ts` (multiple cards per A4).
 */

export type LabelBukuFieldKind =
  | 'static'
  | 'identitas'
  | 'judul'
  | 'kodeBuku'
  | 'kodeEksemplar'
  | 'pengarang'
  | 'penerbit'
  | 'tahun'
  | 'kodeDdc'
  | 'barcode'
  | 'qr'
  | 'rect';

export interface LabelBukuField {
  id: string;
  kind: LabelBukuFieldKind;
  /** Persen relatif terhadap card (0-100). */
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Hex fill colour. Used by `rect` kind only. */
  fill?: string;
  /** Corner radius in millimetres. Used by `rect` kind only. */
  radius?: number;
}

export interface LabelBukuLayout {
  /** Lebar mm. Default Avery-J8160-style label = 70 */
  widthMm: number;
  /** Tinggi mm. Default = 35 */
  heightMm: number;
  background?: string;
  fields: LabelBukuField[];
}

export interface LabelBukuTemplate {
  id: number;
  nama: string;
  deskripsi: string | null;
  layoutJson: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabelBukuTemplateInput {
  nama: string;
  deskripsi?: string | null;
  layoutJson: string;
  isDefault?: boolean;
}

export interface LabelBukuRpc {
  list: () => Promise<LabelBukuTemplate[]>;
  get: (id: number) => Promise<LabelBukuTemplate>;
  create: (input: LabelBukuTemplateInput) => Promise<LabelBukuTemplate>;
  update: (id: number, input: LabelBukuTemplateInput) => Promise<LabelBukuTemplate>;
  delete: (id: number) => Promise<void>;
  setDefault: (id: number) => Promise<LabelBukuTemplate>;
}

const tauriRpc: LabelBukuRpc = {
  list: () => invoke('label_buku_template_list'),
  get: (id) => invoke('label_buku_template_get', { id }),
  create: (input) => invoke('label_buku_template_create', { input }),
  update: (id, input) => invoke('label_buku_template_update', { id, input }),
  delete: (id) => invoke('label_buku_template_delete', { id }),
  setDefault: (id) => invoke('label_buku_template_set_default', { id }),
};

const STORAGE_KEY = 'po:label-buku:templates';

function readMockStore(): LabelBukuTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LabelBukuTemplate[];
  } catch {
    return [];
  }
}

function writeMockStore(rows: LabelBukuTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function ensureSeed(): LabelBukuTemplate[] {
  const existing = readMockStore();
  if (existing.length > 0) return existing;
  const seed: LabelBukuTemplate = {
    id: 1,
    nama: 'Template Default',
    deskripsi: 'Layout standar 70 × 35 mm dengan judul + barcode',
    layoutJson: JSON.stringify(defaultLayout()),
    isDefault: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeMockStore([seed]);
  return [seed];
}

const mockRpc: LabelBukuRpc = {
  async list() {
    return ensureSeed().sort((a, b) =>
      a.isDefault === b.isDefault ? a.nama.localeCompare(b.nama) : a.isDefault ? -1 : 1,
    );
  },
  async get(id) {
    const row = ensureSeed().find((r) => r.id === id);
    if (!row) throw new Error(`template id=${id} tidak ditemukan`);
    return row;
  },
  async create(input) {
    const rows = ensureSeed();
    const id = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.id)) + 1;
    const next: LabelBukuTemplate = {
      id,
      nama: input.nama,
      deskripsi: input.deskripsi ?? null,
      layoutJson: input.layoutJson,
      isDefault: input.isDefault ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const updated = next.isDefault ? rows.map((r) => ({ ...r, isDefault: false })) : rows;
    writeMockStore([...updated, next]);
    return next;
  },
  async update(id, input) {
    const rows = ensureSeed();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`template id=${id} tidak ditemukan`);
    const updated = [...rows];
    if (input.isDefault) {
      for (let i = 0; i < updated.length; i++) {
        if (i !== idx) updated[i] = { ...updated[i]!, isDefault: false };
      }
    }
    updated[idx] = {
      ...updated[idx]!,
      nama: input.nama,
      deskripsi: input.deskripsi ?? null,
      layoutJson: input.layoutJson,
      isDefault: input.isDefault ?? false,
      updatedAt: nowIso(),
    };
    writeMockStore(updated);
    return updated[idx]!;
  },
  async delete(id) {
    const rows = ensureSeed().filter((r) => r.id !== id);
    writeMockStore(rows);
  },
  async setDefault(id) {
    const rows = ensureSeed().map((r) => ({ ...r, isDefault: r.id === id }));
    writeMockStore(rows);
    const found = rows.find((r) => r.id === id);
    if (!found) throw new Error(`template id=${id} tidak ditemukan`);
    return found;
  },
};

export const labelBukuApi: LabelBukuRpc = isTauri() ? tauriRpc : mockRpc;

export function defaultLayout(): LabelBukuLayout {
  return {
    widthMm: 70,
    heightMm: 35,
    background: '#ffffff',
    fields: [
      {
        id: 'identitas',
        kind: 'identitas',
        x: 4,
        y: 4,
        width: 92,
        height: 10,
        fontSize: 9,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'center',
      },
      {
        id: 'judul',
        kind: 'judul',
        x: 4,
        y: 18,
        width: 92,
        height: 12,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'center',
      },
      {
        id: 'kode',
        kind: 'kodeBuku',
        x: 4,
        y: 34,
        width: 40,
        height: 10,
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'left',
      },
      { id: 'barcode', kind: 'barcode', x: 4, y: 50, width: 92, height: 36 },
      {
        id: 'kodeek',
        kind: 'kodeEksemplar',
        x: 4,
        y: 88,
        width: 92,
        height: 10,
        fontSize: 8,
        color: '#475569',
        align: 'center',
      },
    ],
  };
}

export function parseLayout(json: string): LabelBukuLayout {
  try {
    const parsed = JSON.parse(json) as Partial<LabelBukuLayout>;
    if (!parsed || !Array.isArray(parsed.fields)) return defaultLayout();
    return {
      widthMm: parsed.widthMm ?? 70,
      heightMm: parsed.heightMm ?? 35,
      background: parsed.background ?? '#ffffff',
      fields: parsed.fields,
    };
  } catch {
    return defaultLayout();
  }
}

/**
 * Sample data used by the editor / gallery so previews are filled with
 * realistic-looking strings even on a fresh DB. The `kodeEksemplar` is
 * deterministic so the barcode renders consistently across thumbnails.
 */
export interface BukuSample {
  judul: string;
  kodeBuku: string;
  kodeEksemplar: string;
  pengarang: string;
  penerbit: string;
  tahun: string;
  kodeDdc: string;
}

export function defaultBukuSample(): BukuSample {
  return {
    judul: 'Bumi Manusia',
    kodeBuku: '899.221 PRA b',
    kodeEksemplar: 'B0001-01',
    pengarang: 'Pramoedya Ananta Toer',
    penerbit: 'Lentera Dipantara',
    tahun: '2005',
    kodeDdc: '899.221',
  };
}
