#!/usr/bin/env node
/**
 * Validate every code in codes.csv against public.key.pem.
 * Prints a summary and exits non-zero if any code fails.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { verifyLicenseCode } from './verify.mjs';

const dir = resolve(process.argv[2] ?? join(process.cwd(), 'licenses'));
const pub = readFileSync(join(dir, 'public.key.pem'), 'utf8');
const lines = readFileSync(join(dir, 'codes.csv'), 'utf8').trim().split(/\r?\n/);

const rows = lines.slice(1).map((line) => {
  const [id, code, maxActivations, expires] = line.split(',');
  return { id, code, maxActivations, expires };
});

let ok = 0;
const failures = [];
for (const row of rows) {
  const res = verifyLicenseCode(row.code, pub);
  if (res.ok && res.payload.i === row.id && String(res.payload.m) === row.maxActivations) {
    ok += 1;
  } else {
    failures.push({ id: row.id, reason: res.ok ? 'payload mismatch' : res.reason });
  }
}

// Negative test: a tampered code must be rejected.
const tampered = `${rows[0].code.slice(0, -2)}AA`;
const tamperRes = verifyLicenseCode(tampered, pub);

console.log(`codes:   ${rows.length}`);
console.log(`valid:   ${ok}`);
console.log(`invalid: ${failures.length}`);
console.log(`tamper rejected: ${tamperRes.ok ? 'NO (BAD)' : 'yes'}`);
if (failures.length) {
  console.log(failures.slice(0, 5));
  process.exit(1);
}
if (tamperRes.ok) process.exit(1);
