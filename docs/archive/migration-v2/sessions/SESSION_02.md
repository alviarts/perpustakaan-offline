# SESSION 02 — Scaffolding + login + theme + i18n

> **Devin session 2/12.** Bikin pondasi project v2. Setelah sesi ini, app
> sudah bisa di-`pnpm tauri dev`, login pakai admin/admin123 (reuse hash v1),
> theme switcher works, i18n ID/EN works.

## Goal

- Scaffolding monorepo Tauri 2.0 + React 18 + TS + Tailwind + shadcn + Zustand +
  TanStack Router + Vitest + Playwright.
- Reuse SQLite schema v1 (copy `db/schema.sql`).
- Login screen modern (revisi #5).
- Theme switcher (revisi #8).
- "Ingat Saya" auto-login (revisi #10).
- i18n baseline ID/EN (sebagian audit wording revisi #25).
- Setup CI/CD baru `ci-v2.yml` (lint + typecheck + unit test).

## Revisi tercover

- #5 (login redesign) — full
- #8 (theme switcher) — full
- #10 (Ingat Saya) — full
- #25 (audit wording) — partial baseline (extract i18n; sweep final di Devin 11)

## Dependencies

- Sesi 1 COMPLETED (`PROGRESS.md` ada).

## Tasks breakdown

### 1. Workspace scaffold

- Bikin root `package.json` workspace (`pnpm-workspace.yaml`).
- Bikin `apps/desktop/` dengan template `pnpm create tauri-app` (React + TS
  + Vite).
- Tambah `packages/shared/` (TS-only, untuk types DTO).
- Setup ESLint + Prettier + tsconfig strict.

### 2. Tailwind + shadcn

- Install Tailwind 3 + PostCSS + autoprefixer.
- Init shadcn dengan `npx shadcn@latest init`.
- Add komponen baseline: `Button`, `Input`, `Card`, `Form`, `Label`,
  `Checkbox`, `DropdownMenu`, `Tooltip`, `Toast`.

### 3. Tauri config

- `apps/desktop/src-tauri/tauri.conf.json`:
  - window: 1280×800, minWidth 800, minHeight 600, resizable, fullscreen
    false.
  - bundle: identifier `id.alviarts.perpustakaan`, productName
    `PerpustakaanOffline`.
- Plugin install: `tauri-plugin-sql` (sqlite), `tauri-plugin-fs`,
  `tauri-plugin-stronghold` (untuk #10).

### 4. DB layer (Rust)

- Copy `src/perpustakaan/db/schema.sql` ke
  `apps/desktop/src-tauri/src/db/schema.sql`.
- Setup `tauri-plugin-sql` migration runner di `main.rs`.
- Bikin command `auth.login(username, password)` (bcrypt verify) dan
  `auth.login_with_token(token)` untuk Ingat Saya.
- Token store di Stronghold / keyring (hindari plain file).

### 5. Frontend stores

- `src/stores/themeStore.ts` (light/dark/system, persist).
- `src/stores/i18nStore.ts` (id/en, persist).
- `src/stores/authStore.ts` (user, permissions, login/logout).

### 6. Login screen (revisi #5)

- `src/features/auth/Login.tsx`:
  - Layout 2-kolom (`md:grid-cols-2`).
  - Kolom kiri: form (username, password, "Ingat Saya" checkbox, submit).
  - Kolom kanan: gradient background + ilustrasi (placeholder SVG sampai
    Devin 12 swap #6).
  - Animasi entrance Framer Motion (fade + slide-up).
  - Identitas perpustakaan (nama + logo) dari `identityStore` (placeholder
    kalau belum ada di settings — fallback ke "Perpustakaan Offline").

### 7. Theme switcher (revisi #8)

- `src/components/layout/ThemeSwitcher.tsx`:
  - DropdownMenu icon button (`Sun` / `Moon` / `Monitor`).
  - 3 row: Light, Dark, System.
  - Apply via toggle `dark` class di `<html>` + persist Zustand.
  - Anti-FOUC: inline script di `index.html` baca `localStorage` sebelum
    React mount.

### 8. i18n baseline

- Install `react-i18next`.
- Extract semua string dari `src/perpustakaan/i18n.py` → JSON.
  Pecah jadi:
  - `i18n/id/common.json`, `auth.json`, `dashboard.json`, `anggota.json`,
    `buku.json`, `peminjaman.json`, `pengembalian.json`, `kunjungan.json`,
    `laporan.json`, `settings.json`, `errors.json`.
  - Mirror struktur untuk `en/`.
- Apply audit wording awal (revisi #25): rename "Transaksi" → "Aturan
  Peminjaman" di file relevan.

### 9. Routing baseline

- TanStack Router file-based di `src/routes/`:
  - `__root.tsx` (layout shell placeholder)
  - `login.tsx`
  - `_authed.tsx` (auth guard)
  - `_authed/dashboard.tsx` (placeholder card "Dashboard akan dibuat Devin 8")

### 10. Testing setup

- `vitest.config.ts` + sample test `auth.test.ts` (login validation).
- `playwright.config.ts` + sample e2e `login.spec.ts` (happy path).

### 11. CI/CD

- `.github/workflows/ci-v2.yml`:
  - Job `lint-typecheck`: pnpm lint, pnpm typecheck.
  - Job `unit-test`: pnpm test (Vitest).
  - (Tambah job `e2e` di Devin 3+ kalau Playwright stabil.)
- JANGAN ubah `ci.yml` legacy Python.

### 12. Update PROGRESS.md

- Status sesi 2 → COMPLETED, completed_at, pr URL.

## Deliverables

- File baru:
  - `pnpm-workspace.yaml`
  - `apps/desktop/` (full scaffold)
  - `apps/desktop/src-tauri/` (Cargo.toml, tauri.conf.json, main.rs,
    db/schema.sql + migrations runner, commands/auth.rs)
  - `apps/desktop/src/` (main.tsx, App.tsx, components/ui/*, components/layout/ThemeSwitcher.tsx,
    features/auth/Login.tsx, stores/{theme,i18n,auth}.ts, i18n/{id,en}/*.json,
    routes/*)
  - `apps/desktop/tests/` (unit + e2e samples)
  - `packages/shared/` (skeleton)
  - `.github/workflows/ci-v2.yml`
- Tests: 1+ Vitest unit, 1+ Playwright e2e (login happy path).
- Screenshot login screen (light + dark) di PR description.

## Definition of Done

- [ ] `pnpm install && pnpm --filter desktop tauri dev` boot up tanpa error.
- [ ] Login pakai `admin/admin123` (reuse hash v1) → masuk dashboard placeholder.
- [ ] Theme switcher 3 opsi works + persist.
- [ ] "Ingat Saya" centang → restart app → auto-login.
- [ ] i18n ID/EN switchable di Settings placeholder.
- [ ] CI v2 (lint/typecheck/test) pass.
- [ ] CI legacy Python (ci.yml) tetap pass (no Python changes).
- [ ] PROGRESS.md updated.
