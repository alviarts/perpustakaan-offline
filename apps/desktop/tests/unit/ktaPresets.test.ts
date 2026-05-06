import { describe, expect, it } from 'vitest';
import {
  KTA_PRESETS,
  KTA_PRESETS_EXTRA,
  getPresetById,
} from '@/features/kta/presets';
import type { KtaField } from '@/lib/kta';

const TEXT_KINDS = new Set<KtaField['kind']>([
  'nama',
  'kodeAnggota',
  'kelas',
  'jurusan',
  'agama',
  'identitas',
  'static',
]);

describe('KTA preset library (#10 + FEAT-16)', () => {
  it('ships exactly 20 default designs (10 v1.0.5 + 10 v1.0.8/FEAT-16)', () => {
    expect(KTA_PRESETS).toHaveLength(20);
  });

  it('contains every FEAT-16 preset id in KTA_PRESETS (not extras)', () => {
    const ids = KTA_PRESETS.map((p) => p.id);
    const feat16Ids = [
      'ichasoft-klasik-blue',
      'simple-flat-coral',
      'corporate-grey-monochrome',
      'gradient-sunset-purple',
      'wave-bottom-aqua',
      'kotak-grid-mustard',
      'kartu-batik-merah',
      'vertikal-strip-mint',
      'polkadot-pastel-pink',
      'monoline-line-art-black',
    ];
    for (const id of feat16Ids) {
      expect(ids).toContain(id);
    }
  });

  it('every preset has a unique kebab-case id', () => {
    const ids = [...KTA_PRESETS, ...KTA_PRESETS_EXTRA].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every preset uses CR-80 dimensions', () => {
    for (const p of KTA_PRESETS) {
      expect(p.layout.widthMm).toBeCloseTo(85.6, 2);
      expect(p.layout.heightMm).toBeCloseTo(53.98, 2);
    }
  });

  it('every preset has a foto, qr, identitas, nama, kodeAnggota field', () => {
    for (const p of KTA_PRESETS) {
      const kinds = p.layout.fields.map((f) => f.kind);
      expect(kinds).toContain('foto');
      expect(kinds).toContain('qr');
      expect(kinds).toContain('identitas');
      expect(kinds).toContain('nama');
      expect(kinds).toContain('kodeAnggota');
    }
  });

  it('every field stays within the card box (0..100% inclusive)', () => {
    for (const p of KTA_PRESETS) {
      for (const f of p.layout.fields) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.width).toBeGreaterThan(0);
        expect(f.height).toBeGreaterThan(0);
        expect(f.x + f.width).toBeLessThanOrEqual(100.5);
        expect(f.y + f.height).toBeLessThanOrEqual(100.5);
      }
    }
  });

  it('every field id is unique within its preset', () => {
    for (const p of KTA_PRESETS) {
      const ids = p.layout.fields.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('rect fields carry a fill colour', () => {
    for (const p of KTA_PRESETS) {
      for (const f of p.layout.fields) {
        if (f.kind === 'rect') {
          expect(f.fill).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    }
  });

  it('text-bearing fields use a font size between 5 and 16 px', () => {
    for (const p of KTA_PRESETS) {
      for (const f of p.layout.fields) {
        if (TEXT_KINDS.has(f.kind) && f.fontSize !== undefined) {
          expect(f.fontSize).toBeGreaterThanOrEqual(5);
          expect(f.fontSize).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  it('getPresetById returns the matching preset for a known id', () => {
    expect(getPresetById('klasik-polos')?.nama).toBe('Klasik Polos');
    expect(getPresetById('emas-eksklusif-gold')?.nama).toBe('Emas Eksklusif');
    expect(getPresetById('does-not-exist')).toBeUndefined();
  });

  it('getPresetById can also reach the extras pool', () => {
    expect(getPresetById('dwi-bahasa-slate')?.nama).toBe('Dwi-bahasa Slate');
  });
});
