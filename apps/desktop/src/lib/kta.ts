import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/auth';

export type KtaFieldKind =
  | 'nama'
  | 'kodeAnggota'
  | 'kelas'
  | 'jurusan'
  | 'agama'
  | 'foto'
  | 'qr'
  | 'static'
  | 'identitas';

export interface KtaField {
  id: string;
  kind: KtaFieldKind;
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
}

export interface KtaLayout {
  /** Lebar mm. Default ID-1 = 85.6 */
  widthMm: number;
  /** Tinggi mm. Default ID-1 = 53.98 */
  heightMm: number;
  background?: string;
  fields: KtaField[];
}

export interface KtaTemplate {
  id: number;
  nama: string;
  deskripsi: string | null;
  layoutJson: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KtaTemplateInput {
  nama: string;
  deskripsi?: string | null;
  layoutJson: string;
  isDefault?: boolean;
}

export interface KtaRpc {
  list: () => Promise<KtaTemplate[]>;
  get: (id: number) => Promise<KtaTemplate>;
  create: (input: KtaTemplateInput) => Promise<KtaTemplate>;
  update: (id: number, input: KtaTemplateInput) => Promise<KtaTemplate>;
  delete: (id: number) => Promise<void>;
  setDefault: (id: number) => Promise<KtaTemplate>;
}

const tauriRpc: KtaRpc = {
  list: () => invoke('kta_template_list'),
  get: (id) => invoke('kta_template_get', { id }),
  create: (input) => invoke('kta_template_create', { input }),
  update: (id, input) => invoke('kta_template_update', { id, input }),
  delete: (id) => invoke('kta_template_delete', { id }),
  setDefault: (id) => invoke('kta_template_set_default', { id }),
};

const STORAGE_KEY = 'po:kta:templates';

function readMockStore(): KtaTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KtaTemplate[];
  } catch {
    return [];
  }
}

function writeMockStore(rows: KtaTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function ensureSeed(): KtaTemplate[] {
  const existing = readMockStore();
  if (existing.length > 0) return existing;
  const seed: KtaTemplate = {
    id: 1,
    nama: 'Template Default',
    deskripsi: 'Layout standar ID-1 dengan foto + QR',
    layoutJson: JSON.stringify(defaultLayout()),
    isDefault: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeMockStore([seed]);
  return [seed];
}

const mockRpc: KtaRpc = {
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
    const next: KtaTemplate = {
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

export const ktaApi: KtaRpc = isTauri() ? tauriRpc : mockRpc;

export function defaultLayout(): KtaLayout {
  return {
    widthMm: 85.6,
    heightMm: 53.98,
    background: '#ffffff',
    fields: [
      {
        id: 'header',
        kind: 'static',
        text: 'KARTU TANDA ANGGOTA',
        x: 4,
        y: 6,
        width: 92,
        height: 8,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'center',
      },
      {
        id: 'identitas',
        kind: 'identitas',
        x: 4,
        y: 14,
        width: 92,
        height: 8,
        fontSize: 8,
        color: '#475569',
        align: 'center',
      },
      {
        id: 'foto',
        kind: 'foto',
        x: 4,
        y: 26,
        width: 22,
        height: 28,
      },
      {
        id: 'nama',
        kind: 'nama',
        x: 30,
        y: 28,
        width: 50,
        height: 10,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'left',
      },
      {
        id: 'kode',
        kind: 'kodeAnggota',
        x: 30,
        y: 38,
        width: 50,
        height: 6,
        fontSize: 8,
        color: '#334155',
        align: 'left',
      },
      {
        id: 'kelas',
        kind: 'kelas',
        x: 30,
        y: 44,
        width: 50,
        height: 6,
        fontSize: 8,
        color: '#475569',
        align: 'left',
      },
      {
        id: 'qr',
        kind: 'qr',
        x: 78,
        y: 28,
        width: 18,
        height: 18,
      },
    ],
  };
}

export function parseLayout(json: string): KtaLayout {
  try {
    const parsed = JSON.parse(json) as Partial<KtaLayout>;
    if (!parsed || !Array.isArray(parsed.fields)) return defaultLayout();
    return {
      widthMm: parsed.widthMm ?? 85.6,
      heightMm: parsed.heightMm ?? 53.98,
      background: parsed.background ?? '#ffffff',
      fields: parsed.fields,
    };
  } catch {
    return defaultLayout();
  }
}

/** member:<id> → number, atau null kalau bukan format kita. */
export function parseQrPayload(text: string): number | null {
  const t = text.trim();
  const m = /^member:(\d+)$/i.exec(t);
  if (m) return Number.parseInt(m[1]!, 10);
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  return null;
}

/** Encode payload ke string untuk QR. */
export function buildQrPayload(memberId: number): string {
  return `member:${memberId}`;
}
