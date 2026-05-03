#!/usr/bin/env node
/*
 * Perpustakaan Offline — migration script v1 (PyTk) → v2 (Tauri).
 *
 * The on-disk SQLite schema is shared between v1 and v2 (16 tables, see
 * `apps/desktop/src-tauri/src/db/schema.sql`), so the migration is a
 * straightforward "validate-and-copy" rather than a transform. The script:
 *
 *   1. Validates the input `.db` is a v1-compatible file (16 expected tables).
 *   2. Backs up the input to `<filename>.v1-backup-<timestamp>.db`.
 *   3. Builds a fresh v2 `.db` with the latest schema.
 *   4. Copies every row from the v1 file into the v2 file in dependency order.
 *   5. Runs PRAGMA integrity_check + count parity check, fails loudly if any
 *      table count mismatches.
 *
 * Usage:
 *   node scripts/migrate-v1-to-v2.mjs <input-v1.db> <output-v2.db>
 *
 * The script is intentionally written in plain Node + `better-sqlite3` so it
 * can be run from CI / a Tauri sidecar without spawning Python.
 */

import { existsSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXPECTED_TABLES = [
  'schema_version',
  'settings',
  'users',
  'ddc',
  'kelas',
  'penerbit',
  'anggota',
  'buku',
  'eksemplar',
  'peminjaman',
  'peminjaman_item',
  'kunjungan',
  'kas',
  'permissions',
  'user_permissions',
  'audit_log',
];

// Order matters — child tables (FK-dependent) come after their parents.
const COPY_ORDER = [
  'settings',
  'users',
  'ddc',
  'kelas',
  'penerbit',
  'anggota',
  'buku',
  'eksemplar',
  'kunjungan',
  'kas',
  'permissions',
  'user_permissions',
  'peminjaman',
  'peminjaman_item',
  'audit_log',
];

function fail(msg) {
  console.error(`\u001b[31m✗ ${msg}\u001b[0m`);
  process.exit(1);
}

function info(msg) {
  console.log(`\u001b[36m• ${msg}\u001b[0m`);
}

function ok(msg) {
  console.log(`\u001b[32m✓ ${msg}\u001b[0m`);
}

async function loadSqlite() {
  try {
    return (await import('better-sqlite3')).default;
  } catch {
    fail(
      'better-sqlite3 not installed. Run `pnpm add -D better-sqlite3 -w` then retry.',
    );
    return null;
  }
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    fail('Usage: node scripts/migrate-v1-to-v2.mjs <input-v1.db> <output-v2.db>');
  }

  const input = resolve(inputArg);
  const output = resolve(outputArg);

  if (!existsSync(input)) fail(`Input file not found: ${input}`);
  if (existsSync(output)) {
    fail(`Output file already exists: ${output} — aborting to avoid clobbering.`);
  }

  const Database = await loadSqlite();

  info(`Opening v1 database: ${input}`);
  const v1 = new Database(input, { readonly: true, fileMustExist: true });

  // Validate v1 schema -------------------------------------------------------
  const tableNames = v1
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => row.name);
  const missing = EXPECTED_TABLES.filter((t) => !tableNames.includes(t));
  if (missing.length > 0) {
    fail(`v1 database is missing expected tables: ${missing.join(', ')}`);
  }
  ok(`v1 database has all ${EXPECTED_TABLES.length} expected tables.`);

  // Backup -------------------------------------------------------------------
  const backupPath = input.replace(/\.db$/, '') +
    `.v1-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  copyFileSync(input, backupPath);
  ok(`Backed up v1 to: ${backupPath}`);

  // Build fresh v2 -----------------------------------------------------------
  info(`Creating fresh v2 database: ${output}`);
  const schemaPath = resolve(__dirname, '../apps/desktop/src-tauri/src/db/schema.sql');
  if (!existsSync(schemaPath)) fail(`schema.sql not found at: ${schemaPath}`);
  const schemaSql = readFileSync(schemaPath, 'utf8');

  const v2 = new Database(output);
  v2.pragma('journal_mode = WAL');
  v2.pragma('foreign_keys = ON');
  v2.exec(schemaSql);
  ok('v2 schema applied.');

  // Copy rows in dependency order -------------------------------------------
  for (const table of COPY_ORDER) {
    const rows = v1.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      info(`${table}: 0 rows (skipped)`);
      continue;
    }
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const insert = v2.prepare(
      `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    );
    const bulk = v2.transaction((batch) => {
      for (const row of batch) insert.run(cols.map((c) => row[c]));
    });
    bulk(rows);
    ok(`${table}: copied ${rows.length} row${rows.length === 1 ? '' : 's'}.`);
  }

  // Validation pass ---------------------------------------------------------
  info('Running integrity_check on v2…');
  const integrity = v2.prepare('PRAGMA integrity_check').get();
  if (integrity.integrity_check !== 'ok') {
    fail(`v2 integrity check failed: ${integrity.integrity_check}`);
  }
  ok('v2 integrity_check = ok');

  info('Running row-count parity check…');
  const failures = [];
  for (const table of COPY_ORDER) {
    const a = v1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const b = v2.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    if (a !== b) failures.push(`${table}: v1=${a}  v2=${b}`);
  }
  if (failures.length > 0) {
    fail(`Row-count parity failed:\n  - ${failures.join('\n  - ')}`);
  }
  ok('Row counts match across all tables.');

  v1.close();
  v2.close();

  const sizeMb = (statSync(output).size / 1024 / 1024).toFixed(2);
  ok(`Migration complete. v2 written to ${output} (${sizeMb} MB).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
