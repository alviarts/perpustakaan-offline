/**
 * Lisensi & trial (30 hari).
 *
 * Alur:
 *  - Tanpa lisensi: aplikasi berjalan dalam mode **trial 30 hari** sejak
 *    pertama kali dijalankan. Setelah itu aplikasi terkunci.
 *  - Aktivasi: kode `PU1.<payload>.<signature>` dikirim ke Web App Google
 *    Apps Script. Kode diverifikasi secara lokal dengan **public key
 *    Ed25519** (anti-forgery), lalu server mencatat `machineId`
 *    (maks. 2 perangkat).
 *  - Status disimpan di localStorage supaya bisa dipakai offline.
 *
 * Catatan keamanan: public key aman ditanam di app; private key TIDAK ada
 * di repo. Tidak ada shared secret di app (server hanya butuh kode+mesin).
 */
import { isTauri } from '@/lib/auth';

export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3OoGzyyJNPoZehrV5Gp34xAD6hXkZCqA26em93J76WI=
-----END PUBLIC KEY-----`;

export const TRIAL_DAYS = 30;
const LS_STATE = 'perpustakaan.license.v1';
const LS_TRIAL_START = 'perpustakaan.trial.start';
const MACHINE_KEY = 'perpustakaan.machine.id';

/** Web App URL (bisa dioverride dari Pengaturan). */
export const DEFAULT_ACTIVATION_URL =
  'https://script.google.com/macros/s/AKfycbxIEBiCM6WSLFmnpjJobxINR8SvpHgRpr4v1hIyBrJVP_mb2YtVzSidwPxOdF78Yhfamg/exec';

export interface LicensePayload {
  v: number;
  i: string; // id kode
  m: number; // max aktivasi
  e: string; // kadaluarsa (YYYY-MM-DD)
}

export interface LicenseState {
  status: 'trial' | 'aktif' | 'kedaluwarsa' | 'terkunci';
  code?: string;
  licenseId?: string;
  expires?: string;
  activatedAt?: string;
  slot?: number;
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

/** Machine id stabil per perangkat (bukan identitas pribadi). */
export function getMachineId(): string {
  const s = storage();
  const existing = s?.getItem(MACHINE_KEY);
  if (existing) return existing;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const id = `PC-${rand.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  try {
    s?.setItem(MACHINE_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

/** Tanggal mulai trial (dibuat sekali). */
export function trialStart(): Date {
  const s = storage();
  const raw = s?.getItem(LS_TRIAL_START);
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const now = new Date();
  try {
    s?.setItem(LS_TRIAL_START, now.toISOString());
  } catch {
    // ignore
  }
  return now;
}

export function trialDaysLeft(now: Date = new Date()): number {
  const start = trialStart();
  const elapsedMs = now.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  return Math.max(0, TRIAL_DAYS - elapsedDays);
}

export function readLicenseState(): LicenseState {
  const saved = readJson<LicenseState>(LS_STATE);
  if (saved?.status === 'aktif' && saved.expires) {
    const exp = new Date(`${saved.expires}T23:59:59`);
    if (!Number.isNaN(exp.getTime()) && new Date() > exp) {
      return { ...saved, status: 'kedaluwarsa' };
    }
    return saved;
  }
  const left = trialDaysLeft();
  return { status: left > 0 ? 'trial' : 'terkunci' };
}

export function saveLicenseState(state: LicenseState): void {
  writeJson(LS_STATE, state);
}

export function clearLicenseState(): void {
  const s = storage();
  s?.removeItem(LS_STATE);
}

// ---------------------------------------------------------------------------
// Verifikasi Ed25519 (Web Crypto)
// ---------------------------------------------------------------------------

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s+/g, '');
  return b64urlToBytes(body.replace(/\+/g, '-').replace(/\//g, '_'));
}

/** Verifikasi tanda tangan kode lisensi. Mengembalikan payload bila valid. */
export async function verifyLicenseCode(
  code: string,
  publicKeyPem: string = LICENSE_PUBLIC_KEY,
): Promise<LicensePayload> {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'PU1') {
    throw new Error('Format kode lisensi tidak dikenal');
  }
  const [, payloadB64, sigB64] = parts as [string, string, string];

  const pem = publicKeyPem.includes('BEGIN PUBLIC KEY')
    ? publicKeyPem
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----\n`;

  const key = await crypto.subtle.importKey(
    'spki',
    pemToDer(pem),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    b64urlToBytes(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  if (!ok) throw new Error('Tanda tangan lisensi tidak valid');

  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as LicensePayload;
  } catch {
    throw new Error('Payload lisensi rusak');
  }
  if (payload.e) {
    const exp = new Date(`${payload.e}T23:59:59`);
    if (!Number.isNaN(exp.getTime()) && new Date() > exp) {
      throw new Error(`Lisensi kedaluwarsa (${payload.e})`);
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Aktivasi online
// ---------------------------------------------------------------------------

export interface ActivateResult {
  ok: boolean;
  slot?: number;
  reused?: boolean;
  error?: string;
}

export async function activateLicense(
  code: string,
  url: string = DEFAULT_ACTIVATION_URL,
): Promise<ActivateResult> {
  // 1) Verifikasi lokal dulu — kode palsu tidak perlu sampai ke server.
  const payload = await verifyLicenseCode(code);

  // 2) Catat ke server (batas 2 perangkat).
  const machineId = getMachineId();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ code: code.trim(), machineId }),
  });
  const data = (await res.json()) as ActivateResult;
  if (!data.ok) {
    throw new Error(data.error || 'Aktivasi ditolak server');
  }

  saveLicenseState({
    status: 'aktif',
    code: code.trim(),
    licenseId: payload.i,
    expires: payload.e,
    activatedAt: new Date().toISOString(),
    slot: data.slot,
  });
  return data;
}

export function isTauriEnv(): boolean {
  return isTauri();
}
