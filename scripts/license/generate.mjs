#!/usr/bin/env node
/**
 * License key generator (Ed25519, offline-verifiable).
 *
 * Produces codes of the form:
 *   PU1.<base64url(payload-json)>.<base64url(signature)>
 *
 * `payload` is signed with the PRIVATE key; the app ships only the PUBLIC key,
 * so codes cannot be forged without the private key.
 *
 * Usage:
 *   node scripts/license/generate.mjs \
 *     --count 500 --max-activations 2 --expires 2027-12-31 \
 *     --out "C:/Users/you/perpustakaan-license"
 *
 * The output directory receives:
 *   private.key.pem   ← KEEP SECRET (never commit)
 *   public.key.pem    ← safe to embed in the app
 *   codes.csv         ← the 500 codes (id,code,maxActivations,expires)
 *
 * If `private.key.pem` already exists in --out it is reused, so re-running
 * does not invalidate previously issued codes.
 */
import { generateKeyPairSync, sign, createPublicKey } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const count = Number.parseInt(arg('count', '500'), 10);
const maxActivations = Number.parseInt(arg('max-activations', '2'), 10);
const expires = arg('expires', '2027-12-31');
const prefix = arg('prefix', 'PU');
const outDir = resolve(arg('out', join(process.cwd(), 'licenses')));

if (!Number.isFinite(count) || count < 1) {
  console.error('--count must be a positive integer');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const privPath = join(outDir, 'private.key.pem');
const pubPath = join(outDir, 'public.key.pem');

let privateKey;
let publicKey;
if (existsSync(privPath)) {
  privateKey = readFileSync(privPath, 'utf8');
  publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  console.log(`Reusing existing key pair from ${outDir}`);
} else {
  const pair = generateKeyPairSync('ed25519');
  privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' });
  writeFileSync(privPath, privateKey, { mode: 0o600 });
  writeFileSync(pubPath, publicKey);
  console.log(`Generated new key pair in ${outDir}`);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const rows = [['id', 'code', 'maxActivations', 'expires']];
for (let n = 1; n <= count; n += 1) {
  const id = `${prefix}-${String(n).padStart(4, '0')}`;
  const payload = { v: 1, i: id, m: maxActivations, e: expires };
  const payloadB64 = b64url(JSON.stringify(payload));
  const signature = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey);
  const code = `PU1.${payloadB64}.${b64url(signature)}`;
  rows.push([id, code, String(maxActivations), expires]);
}

const csv = rows.map((r) => r.join(',')).join('\n');
writeFileSync(join(outDir, 'codes.csv'), `${csv}\n`);

console.log(`\nWrote ${count} codes to ${join(outDir, 'codes.csv')}`);
console.log(`Public key (embed in app):\n${publicKey}`);
console.log(`\nSample code:\n${rows[1][1]}`);
console.log('\n⚠  Keep private.key.pem secret. Anyone with it can mint valid codes.');
