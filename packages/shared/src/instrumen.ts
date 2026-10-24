/**
 * Official accreditation instrument catalog (butir + A–D scoring criteria),
 * scraped from the FPPTI Jateng simulator which mirrors the Perpusnas
 * instruments. Kept in a separate module (not re-exported for runtime from the
 * package root) so its ~600 KB payload only loads when the Akreditasi feature
 * is opened — via `@shared/instrumen`.
 *
 * Regenerate with: node scripts/scrape-instrumen.mjs
 */
import data from './akreditasi/instrumen.json';

export interface InstrumenOpsi {
  skor: number;
  label: string;
  kriteria: string;
}

export type InstrumenJawaban = 'a' | 'b' | 'c' | 'd';

export interface InstrumenButir {
  /** 1-based komponen number. */
  komponen: number;
  /** 1-based butir number within the komponen. */
  no: number;
  teks: string;
  bukti: string;
  opsi: Record<InstrumenJawaban, InstrumenOpsi>;
}

export interface InstrumenKomponen {
  no: number;
  judul: string;
  butir: number;
  skorMaks: number;
  bobot: number;
}

export interface Instrumen {
  komponen: InstrumenKomponen[];
  butir: InstrumenButir[];
}

const REGISTRY = data as unknown as Record<string, Instrumen>;

export function getInstrumen(jenjangId: string | null | undefined): Instrumen | null {
  if (!jenjangId) return null;
  return REGISTRY[jenjangId] ?? null;
}

export function hasInstrumen(jenjangId: string): boolean {
  return jenjangId in REGISTRY;
}
