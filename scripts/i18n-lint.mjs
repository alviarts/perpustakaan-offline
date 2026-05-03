#!/usr/bin/env node
/**
 * i18n linter (revisi #25).
 *
 * Verifies that:
 *   1. Every locale (id, en) has the same set of namespaces.
 *   2. Within each namespace, every leaf key present in `id/<ns>.json` also
 *      exists in `en/<ns>.json` and vice-versa.
 *
 * Exits non-zero on any divergence so CI can gate on it.
 *
 * Note: orphan-key detection (key never referenced from source) is intentionally
 *      out of scope here — TanStack Router auto-generates routes that may use
 *      keys via `t(...)` with computed names. Adding strict orphan checks
 *      would produce too many false positives without static analysis. The
 *      coverage check (id/en parity) is the high-value invariant.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const i18nRoot = resolve(repoRoot, 'apps/desktop/src/i18n');
const locales = ['id', 'en'];

function leafKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...leafKeys(v, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

function loadNamespace(locale, ns) {
  const path = resolve(i18nRoot, locale, `${ns}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const errors = [];
  const namespacesPerLocale = new Map();
  for (const locale of locales) {
    const dir = resolve(i18nRoot, locale);
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => basename(f, '.json'))
      .sort();
    namespacesPerLocale.set(locale, files);
  }

  const baseLocale = locales[0];
  const baseNamespaces = namespacesPerLocale.get(baseLocale);
  for (const other of locales.slice(1)) {
    const otherNamespaces = namespacesPerLocale.get(other);
    const missing = baseNamespaces.filter((ns) => !otherNamespaces.includes(ns));
    const extra = otherNamespaces.filter((ns) => !baseNamespaces.includes(ns));
    for (const ns of missing) errors.push(`[${other}] missing namespace '${ns}' (present in ${baseLocale})`);
    for (const ns of extra) errors.push(`[${other}] extra namespace '${ns}' (not in ${baseLocale})`);
  }

  for (const ns of baseNamespaces) {
    const tables = {};
    for (const locale of locales) {
      if (!namespacesPerLocale.get(locale).includes(ns)) continue;
      tables[locale] = leafKeys(loadNamespace(locale, ns));
    }
    const localeNames = Object.keys(tables);
    if (localeNames.length < 2) continue;
    const [a, b] = localeNames;
    const set = (arr) => new Set(arr);
    const aSet = set(tables[a]);
    const bSet = set(tables[b]);
    for (const k of tables[a]) {
      if (!bSet.has(k)) errors.push(`[${b}/${ns}] missing key '${k}' (present in ${a})`);
    }
    for (const k of tables[b]) {
      if (!aSet.has(k)) errors.push(`[${a}/${ns}] missing key '${k}' (present in ${b})`);
    }
  }

  if (errors.length > 0) {
    console.error('i18n-lint: found divergences:');
    for (const err of errors) console.error(`  - ${err}`);
    console.error(`\n${errors.length} issue(s) found.`);
    process.exit(1);
  }
  console.log('i18n-lint: id ↔ en parity OK across all namespaces.');
}

main();
