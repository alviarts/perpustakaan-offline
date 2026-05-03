import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const SCRIPT_PATH = resolve(ROOT, 'scripts/migrate-v1-to-v2.mjs');
const SCHEMA_PATH = resolve(ROOT, 'apps/desktop/src-tauri/src/db/schema.sql');

const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');
const SCHEMA = readFileSync(SCHEMA_PATH, 'utf8');

function listTablesIn(text: string): string[] {
  const re = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]!);
  return out;
}

function arrayLiteralFromScript(name: string): string[] {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = SCRIPT.match(re);
  if (!m) throw new Error(`Could not find array ${name} in migration script`);
  return Array.from(m[1]!.matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)).map((g) => g[1]!);
}

describe('migration script v1 → v2', () => {
  const expected = arrayLiteralFromScript('EXPECTED_TABLES');
  const copyOrder = arrayLiteralFromScript('COPY_ORDER');
  const schemaTables = listTablesIn(SCHEMA);

  it('lists every table that the canonical schema declares', () => {
    expect(expected.sort()).toEqual([...schemaTables].sort());
  });

  it('copy order covers every table except auto-managed schema_version', () => {
    const copySet = new Set(copyOrder);
    expect(copySet.has('schema_version')).toBe(false);
    const expectedSet = new Set(expected.filter((t) => t !== 'schema_version'));
    expect(copySet).toEqual(expectedSet);
  });

  it('places parent tables before child tables in COPY_ORDER', () => {
    const idx = (t: string) => copyOrder.indexOf(t);
    expect(idx('users')).toBeLessThan(idx('peminjaman'));
    expect(idx('anggota')).toBeLessThan(idx('peminjaman'));
    expect(idx('buku')).toBeLessThan(idx('eksemplar'));
    expect(idx('eksemplar')).toBeLessThan(idx('peminjaman_item'));
    expect(idx('peminjaman')).toBeLessThan(idx('peminjaman_item'));
    expect(idx('users')).toBeLessThan(idx('user_permissions'));
    expect(idx('permissions')).toBeLessThan(idx('user_permissions'));
  });

  it('schema enables foreign keys and WAL', () => {
    expect(SCHEMA).toMatch(/PRAGMA foreign_keys = ON/);
    expect(SCHEMA).toMatch(/PRAGMA journal_mode = WAL/);
  });
});
