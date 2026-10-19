# Smoke Test Report — v1.3.0

**Tanggal:** 2026-10-20
**Branch:** `feature/isbn-scanner-v1.3.0`
**Fitur utama:** Import Buku via ISBN (scanner + multi-source lookup) + perbaikan cover OPAC
**Lingkungan:** Windows, Node v25.9.0, pnpm 9.15.1, Rust (edition 2021 / rust-version 1.77.2)

---

## Ringkasan

| Area | Hasil |
|---|---|
| `pnpm lint` | ✅ PASS |
| `pnpm typecheck` | ✅ PASS |
| `pnpm i18n:lint` | ✅ PASS (id ↔ en parity OK) |
| `pnpm test` (Vitest) | ⚠️ 579 PASS / 4 FAIL — **semua 4 pre-existing** (lihat di bawah) |
| `pnpm build` (Vite) | ✅ PASS (built in ~31s) |
| `cargo check` | ✅ PASS (compiles as v1.3.0) |
| `cargo clippy --all-targets -- -D warnings` | ✅ PASS |
| `cargo test --lib isbn_lookup` | ✅ PASS (3 unit test; 2 network test ignored) |
| Live lookup (Rust) | ✅ PASS (lihat bukti) |
| `pnpm tauri:dev` (app jalan) | ✅ PASS (build & launch OK) |

**Kesimpulan: v1.3.0 OK** — tidak ada regresi baru. 4 kegagalan test bersifat
pre-existing/environmental dan identik di `main`.

---

## Bukti live lookup (engine baru)

```
9786233463034 => Filosofi teras | Henry Manampiring | Penerbit Buku Kompas | 2021 | src=perpusnas | pages=326
9786022916628 => Laskar pelangi : original story | Andrea Hirata | Bentang Pustaka | 2019 | src=perpusnas | pages=336
9780306406157 => Error-correction coding for digital communications | Plenum Press | 1981 | src=open_library | pages=422
9789793062792 => ... | harga: Rp 69.000
```

Perpusnas (registry ISBN Indonesia) menang untuk buku lokal — inti perbaikan coverage.

---

## Kegagalan test (pre-existing, bukan dari v1.3.0)

Diverifikasi dengan menjalankan test yang sama di `main` (`4f0f1d0`) → **gagal identik**.

| Test | Kemungkinan penyebab |
|---|---|
| `tests/unit/kunjungan.test.ts` → `rangeForPreset` (2) | Tanggal/timezone (batas bulan & tahun) |
| `tests/unit/laporan.test.ts` → `grafik returns inclusive day range` | Tanggal/timezone |
| `tests/unit/opacMemberProfile.test.tsx` → overdue badge | Tanggal/timezone |
| `tests/unit/extractChangelog.test.ts` (suite) | `SyntaxError: Invalid or unexpected token` saat import `scripts/extract-changelog.mjs` |

### Detail: Node 25 Web Storage (environmental)

Tanpa workaround, `pnpm test` gagal 114 test dengan
`window.localStorage.clear is not a function`. Penyebab: Node **v25.9.0**
mengaktifkan Web Storage bawaan (`--localstorage-file` tanpa path valid) yang
menimpa `localStorage` jsdom.

**Workaround saat menjalankan test di mesin ini:**
```powershell
$env:NODE_OPTIONS="--no-webstorage"; pnpm test
```
Dengan flag ini: **579 PASS / 4 FAIL**. Di CI (Node 20/Linux) tidak terpengaruh.

---

## Yang TIDAK diuji (deferred)

- Click-through GUI penuh (login → anggota → buku → peminjaman → ...): tidak ada
  tool recording/GUI-control di lingkungan Windows ini.
- Windows installer (`pnpm tauri:build` + NSIS/MSI).
- Aplikasi Android (`apps/mobile`).
- Migrasi v1 → v2 & Excel import.

---

## Bug ditemukan di v1.3.0

Tidak ada bug baru. Bug yang diperbaiki di rilis ini:
- OPAC tidak menampilkan cover (upload manual & hasil scan ISBN) → dirender via
  `readDataUrl` (data URL), andal di Windows.
- Tutorial ISBN tidak mengikuti dark mode.
