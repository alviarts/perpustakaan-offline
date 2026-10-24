/**
 * Verify a license code against the public key (no private key needed).
 * Shared by the app (renderer) and the CLI check script.
 */
import { verify, createPublicKey } from 'node:crypto';

/** Prettify PEM: accepts the raw base64 too. */
export function normalizePublicKey(pem) {
  if (pem.includes('BEGIN PUBLIC KEY')) return pem;
  const body = pem.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

/**
 * @param {string} code            e.g. "PU1.<payload>.<sig>"
 * @param {string} publicKeyPem
 * @param {Date}   [now]
 * @returns {{ok: true, payload: object} | {ok: false, reason: string}}
 */
export function verifyLicenseCode(code, publicKeyPem, now = new Date()) {
  if (!code || typeof code !== 'string') return { ok: false, reason: 'kode kosong' };
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'PU1') {
    return { ok: false, reason: 'format kode tidak dikenal' };
  }
  const [, payloadB64, sigB64] = parts;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'payload rusak' };
  }
  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(payloadB64, 'utf8'),
      createPublicKey(normalizePublicKey(publicKeyPem)),
      Buffer.from(sigB64, 'base64url'),
    );
  } catch {
    return { ok: false, reason: 'tanda tangan tidak valid' };
  }
  if (!valid) return { ok: false, reason: 'tanda tangan tidak valid' };
  if (payload.e) {
    const expiry = new Date(`${payload.e}T23:59:59Z`);
    if (!Number.isNaN(expiry.getTime()) && now > expiry) {
      return { ok: false, reason: `lisensi kedaluwarsa (${payload.e})` };
    }
  }
  return { ok: true, payload };
}
