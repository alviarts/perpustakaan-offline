import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * i18n parity guard (revisi #25). Mirrors `scripts/i18n-lint.mjs` so the same
 * invariant is checked in unit tests as well as in CI.
 *
 *   id ↔ en must contain the exact same set of leaf keys for every namespace.
 *
 * If you add a new key to `apps/desktop/src/i18n/id/*.json`, you MUST add the
 * same key to `apps/desktop/src/i18n/en/*.json` (with an English translation).
 */
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [prefix];
  }
  const record = obj as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(record)) {
    const next = prefix ? `${prefix}.${key}` : key;
    out.push(...flattenKeys(record[key], next));
  }
  return out;
}

const I18N_ROOT = resolve(__dirname, '../../src/i18n');

function loadNamespace(locale: 'id' | 'en', file: string): unknown {
  const raw = readFileSync(resolve(I18N_ROOT, locale, file), 'utf8');
  return JSON.parse(raw);
}

describe('i18n coverage', () => {
  const idFiles = readdirSync(resolve(I18N_ROOT, 'id')).filter((f) => f.endsWith('.json'));
  const enFiles = readdirSync(resolve(I18N_ROOT, 'en')).filter((f) => f.endsWith('.json'));

  it('id and en contain the same namespaces', () => {
    expect(idFiles.sort()).toEqual(enFiles.sort());
  });

  for (const file of idFiles) {
    it(`namespace "${file}" has identical keys in id and en`, () => {
      const idKeys = flattenKeys(loadNamespace('id', file)).sort();
      const enKeys = flattenKeys(loadNamespace('en', file)).sort();

      const onlyInId = idKeys.filter((k) => !enKeys.includes(k));
      const onlyInEn = enKeys.filter((k) => !idKeys.includes(k));

      expect(onlyInId, `missing in en/${file}`).toEqual([]);
      expect(onlyInEn, `missing in id/${file}`).toEqual([]);
    });
  }

  it('settings namespace contains a key per sub-page', () => {
    const settings = loadNamespace('id', 'settings.json') as Record<string, unknown>;
    const sections = settings.sections as Record<string, unknown>;
    const required = [
      'identitas',
      'aturanPeminjaman',
      'masterData',
      'kta',
      'tampilan',
      'bahasa',
      'akun',
      'hakAkses',
      'backup',
      'sinkronisasi',
      'auditLog',
      'tentang',
    ];
    for (const r of required) {
      expect(sections, `missing settings.sections.${r}`).toHaveProperty(r);
    }
  });
});
