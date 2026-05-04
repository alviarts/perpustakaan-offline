# Assets & Code Reuse — Migration v2

> Decision matrix: bagian v1 mana yang **REUSE** (copy/port), **BUANG** (drop),
> **PORT** (translasi konsep), dan **MIGRATE** (transform via script).
>
> Pakai sebagai checklist saat Devin 2 mulai scaffolding.

## 1. REUSE — copy langsung / minor adapt

### 1.1 SQLite schema

| File v1 | File v2 |
|---|---|
| `src/perpustakaan/db/schema.sql` | `apps/desktop/src-tauri/src/db/schema.sql` |

- Copy 1:1 (15 tabel inti).
- Tambah migration v2 untuk tabel baru (lihat ARCHITECTURE.md §4): `kategori`,
  `bahasa`, `jurusan`, `agama`, `kta_templates`, `auth_tokens`.
- Pertahankan PRAGMA: `foreign_keys = ON`, `journal_mode = WAL`.
- Index, trigger, default values: copy semua.

### 1.2 Business logic patterns

Logic CRUD + validasi v1 (`src/perpustakaan/services/*.py`,
`src/perpustakaan/models/*.py`) **tidak di-port file-by-file**, tapi pattern-nya
di-port:

| File v1 | Pattern → v2 lokasi |
|---|---|
| `services/auth.py` | bcrypt verify + session → `src-tauri/src/commands/auth.rs` |
| `services/permissions.py` + `permissions_registry.py` | RBAC matrix → `src-tauri/src/commands/permissions.rs` + `src/stores/authStore.ts` |
| `services/barcode_service.py` | barcode QR/Code39 → `src/lib/barcode.ts` (frontend) |
| `services/pdf_service.py` | PDF KTA + nota + laporan → `src/lib/pdf/*.ts` (pdf-lib) |
| `services/excel_service.py` | import/export Excel → `src/lib/excel.ts` (`xlsx` lib) |
| `services/sheets_service.py` | Google Sheets sync → `src/features/settings/sync/sheets.ts` |
| `services/report_service.py` | aggregate query laporan → `src-tauri/src/commands/laporan.rs` |
| `services/backup_service.py` + `backup_scheduler.py` | DB backup + jadwal → `src-tauri/src/commands/backup.rs` + Tauri scheduler |
| `models/anggota.py` ... `models/audit_log.py` | CRUD per domain → `src-tauri/src/commands/<domain>.rs` |

> Devin pengerja sesi yang relevan WAJIB baca file v1 yang dimaksud sebagai
> source of truth untuk: kolom yang dipakai, validasi business, edge cases.

### 1.3 i18n strings

| File v1 | File v2 |
|---|---|
| `src/perpustakaan/i18n.py` | `apps/desktop/src/i18n/{id,en}/*.json` |

- Extract semua string ID/EN dari `i18n.py` → JSON.
- Pecah per-namespace: `common.json`, `auth.json`, `dashboard.json`, dll.
- Sweep audit wording (revisi #25) di Devin 11.

### 1.4 Test fixtures + seed

| File v1 | File v2 |
|---|---|
| `tests/conftest.py` | `apps/desktop/tests/fixtures/db.ts` |
| `src/perpustakaan/db/seed.py` (demo data) | `scripts/seed-demo.ts` |
| `assets/ddc-source.txt` | `apps/desktop/src-tauri/resources/seed/ddc.txt` |

- Demo data 5 anggota + 10 buku + 2 peminjaman: port jadi seed script TS.
- Pakai sama key/values supaya QA visual konsisten dengan v1.

### 1.5 Permissions catalog

`services/permissions_registry.py` → port jadi TS const di
`apps/desktop/src/lib/permissions.ts` (single source of truth, share via
`packages/shared`).

### 1.6 Manual book content

| File v1 | File v2 |
|---|---|
| `docs/manual.md` (Markdown plain) | `docs/migration-v2/manual/*.md` (multi-page) → bundle `apps/desktop/src-tauri/resources/manual/index.html` |

- Source markdown di-split per chapter, lalu di-build jadi static HTML
  (mdBook / VitePress / Docusaurus minimal).
- Devin 11 yang generate.

---

## 2. BUANG — tidak di-port

### 2.1 customtkinter UI layer

| Path v1 | Status |
|---|---|
| `src/perpustakaan/gui/` | DROP semua (`__init__.py`, `app.py` parts, `login.py`, `main_window.py`, `views/*.py`, `widgets.py`, `password_dialogs.py`, `help_dialog.py`, `tour.py`) |
| `src/perpustakaan/gui/animations.py` + `animation_player.py` | DROP (PIL procedural animation tidak relevan di webview) |
| `src/perpustakaan/gui/illustrations.py` | DROP (procedural PIL drawing → ganti SVG/PNG) |
| `src/perpustakaan/gui/effects.py` | DROP (CT-specific effects) |
| `src/perpustakaan/gui/icons.py`, `phosphor.py` | DROP source Python, port ke TS (lihat §3) |
| `src/perpustakaan/gui/design_tokens.py` | DROP (replace dengan Tailwind config) |

### 2.2 Asset procedural

| Path v1 | Status |
|---|---|
| `assets/animations/` | DROP (frame-based PIL animation) |
| `assets/illustrations/` | DROP (procedural PNG) |

Replace dengan asset baru (revisi #6) di `apps/desktop/public/illustrations/`.

### 2.3 Build pipeline lama

| Path v1 | Status |
|---|---|
| `build.spec` (PyInstaller) | DROP (Devin 12) |
| `build.bat` | DROP (Devin 12) |
| `installer/installer.iss` | REPLACE (Devin 12 bikin baru di `apps/desktop/src-tauri/installer/inno-setup.iss`) |

> CATATAN: file ini tetap ada selama migrasi (Devin 2–11) supaya v1 masih bisa
> di-build kalau ada bug critical yang harus di-patch. Devin 12 akan hapus
> setelah release v1.0.0 v2 stable.

### 2.4 Test customtkinter

| Path v1 | Status |
|---|---|
| `tests/test_smoke_gui.py` | DROP (CT smoke test, replace Playwright) |
| `tests/test_widgets_visual.py` | DROP |
| `tests/test_animation_player.py`, `test_animations_v4.py`, `test_effects.py` | DROP |
| `tests/test_design_tokens.py` | DROP |
| `tests/test_help_dialog.py`, `test_tour_contextual.py` | DROP |
| `tests/test_phosphor.py`, `test_icons.py`, `test_fonts.py` | DROP (Python-side, replace dengan Vitest) |

Tests yang tetap relevan (logic, bukan GUI) → port ke Vitest:
`test_auth.py`, `test_anggota_buku.py`, `test_peminjaman.py`,
`test_password_security.py`, `test_permissions.py`, `test_backup_terjadwal.py`,
`test_seed.py`.

### 2.5 Misc

- Smoke test screenshots (`docs/smoke-test/*.png`) — DROP (akan diganti
  Playwright screenshots).
- `scripts/` Python (`init_db.py`, dll.) — DROP, replace dengan TS scripts.

---

## 3. PORT — translasi konsep / library

### 3.1 Phosphor icons

| v1 | v2 |
|---|---|
| `gui/phosphor.py` (custom mapping) | `@phosphor-icons/react` |

- Daftar icon yang dipakai v1 → cari counterpart React-nya:
  - `gui/phosphor.py` define alias seperti `house`, `users`, `book`,
    `gear`, `chart-line`, etc.
  - Di v2 import langsung: `import { House, Users, Book, Gear, ChartLine } from '@phosphor-icons/react'`.
- Devin 2 generate file index `apps/desktop/src/lib/icons.ts` yang re-export
  yang dipakai untuk konsistensi tree-shaking.

### 3.2 Theme tokens

| v1 (`design_tokens.py`) | v2 |
|---|---|
| color palette dict | `apps/desktop/tailwind.config.ts` `theme.extend.colors` |
| spacing scale | Tailwind default + custom |
| typography | Tailwind `fontFamily` + `fontSize` |

Reuse warna kunci v1 (primary brand color, dll.) — copy hex-nya.

### 3.3 Animation patterns

| v1 (`gui/animations.py`) | v2 |
|---|---|
| Tween fade/slide procedural | Framer Motion `<motion.div initial animate exit>` |
| Bounce / spring | Framer Motion `transition={{ type: 'spring' }}` |

### 3.4 Form validation

| v1 (Tk validation manual) | v2 |
|---|---|
| `entry.config(validate='key')` | `react-hook-form` + `zod` schema |
| password rules custom | `zod.string().min(8).regex(...)` + reuse rule list dari `password_dialogs.py` |

### 3.5 Tour / onboarding

| v1 (`tour.py`) | v2 |
|---|---|
| custom highlight overlay | `driver.js` atau `react-joyride` (optional, Devin 11) |

### 3.6 Help dialog

| v1 (`help_dialog.py` + `help_content.py`) | v2 |
|---|---|
| modal customtkinter | shadcn `Sheet` / `Dialog` + Markdown render (revisi #4 manual HTML) |

### 3.7 Fonts

| v1 (`assets/fonts/*`) | v2 |
|---|---|
| TTF bundled di PyInstaller | TTF/WOFF2 bundle di `apps/desktop/public/fonts/` + `@font-face` di `index.css` |

---

## 4. MIGRATE — transform via script

### 4.1 Database v1 → v2

Devin 12 bikin script `scripts/migrate-v1-to-v2.ts`:

- Input: path ke `.db` v1 (default `%APPDATA%/PerpustakaanOffline/perpustakaan.db`).
- Output: `.db` v2 (default `%APPDATA%/PerpustakaanOffline/perpustakaan-v2.db`).
- Flow:
  1. Buka DB v1 read-only.
  2. Buat DB v2 fresh dengan schema baru (apply semua migrations).
  3. Copy row per tabel (skip `schema_version`, applied otomatis).
  4. Untuk tabel baru di v2 (kategori/bahasa/jurusan/agama/kta_templates):
     seed default values + (jika ada) extract dari v1 settings JSON.
  5. Validasi: count row tiap tabel match.
  6. Backup `.db` v1 → `<filename>.v1-backup-<timestamp>.db`.
  7. Print summary report (count per tabel, error list).
- UI: tombol "Migrasi DB v1" di Settings → Backup tab (Devin 11) atau
  one-shot dialog di first launch v2 (Devin 12).

### 4.2 Settings JSON schema

v1 `settings` table key/value, v2 tetap key/value (reuse), tapi nambah key
baru:

```
kta_template_default_id    -> int (id row di kta_templates)
sidebar_collapsed          -> bool (tapi yang otoritatif tetap localStorage)
theme                       -> 'light' | 'dark' | 'system'
language                    -> 'id' | 'en'
remember_me_enabled         -> bool
backup_schedule_cron        -> string (e.g. '0 2 * * *' = 2am daily)
```

Migration script add default values untuk key baru.

### 4.3 User passwords

Hash bcrypt v1 langsung di-reuse v2 (algoritma sama). Tidak perlu user reset
password.

### 4.4 Asset copy

KTA template lama (`settings.kta_layout_json` di v1) di-import ke `kta_templates`
(satu template default = layout v1) supaya KTA tidak hilang.

---

## 5. Quick reference table

| v1 path | Action | v2 path |
|---|---|---|
| `src/perpustakaan/db/schema.sql` | REUSE | `apps/desktop/src-tauri/src/db/schema.sql` |
| `src/perpustakaan/db/seed.py` | PORT | `scripts/seed-demo.ts` |
| `src/perpustakaan/i18n.py` | REUSE strings | `apps/desktop/src/i18n/{id,en}/*.json` |
| `src/perpustakaan/services/auth.py` | PORT logic | `apps/desktop/src-tauri/src/commands/auth.rs` |
| `src/perpustakaan/services/permissions*.py` | PORT | `apps/desktop/src-tauri/src/commands/permissions.rs` + TS const |
| `src/perpustakaan/services/pdf_service.py` | PORT | `apps/desktop/src/lib/pdf/*.ts` |
| `src/perpustakaan/services/barcode_service.py` | PORT | `apps/desktop/src/lib/barcode.ts` |
| `src/perpustakaan/services/excel_service.py` | PORT | `apps/desktop/src/lib/excel.ts` |
| `src/perpustakaan/services/sheets_service.py` | PORT | `apps/desktop/src/features/settings/sync/sheets.ts` |
| `src/perpustakaan/services/report_service.py` | PORT | `apps/desktop/src-tauri/src/commands/laporan.rs` |
| `src/perpustakaan/services/backup*.py` | PORT | `apps/desktop/src-tauri/src/commands/backup.rs` |
| `src/perpustakaan/models/*.py` | PORT (reference) | `apps/desktop/src-tauri/src/commands/*.rs` |
| `src/perpustakaan/gui/` | DROP | `apps/desktop/src/features/*` (rewrite) |
| `src/perpustakaan/gui/icons.py`, `phosphor.py` | PORT | `apps/desktop/src/lib/icons.ts` (re-export `@phosphor-icons/react`) |
| `src/perpustakaan/gui/design_tokens.py` | PORT | `apps/desktop/tailwind.config.ts` |
| `src/perpustakaan/gui/illustrations.py` | DROP | `apps/desktop/public/illustrations/*.svg` (asset baru #6) |
| `src/perpustakaan/gui/animations.py` | DROP | Framer Motion / Tailwind animate-in |
| `src/perpustakaan/gui/help_dialog.py` + `help_content.py` | DROP | Manual HTML #4 |
| `assets/ddc-source.txt` | REUSE | `apps/desktop/src-tauri/resources/seed/ddc.txt` |
| `assets/animations/`, `assets/illustrations/` | DROP | (lihat §6 ASSETS_REUSE) |
| `assets/fonts/*` | REUSE | `apps/desktop/public/fonts/` |
| `assets/icons/` | REVIEW | Pertahankan yang non-procedural; rest replace |
| `tests/test_auth.py`, `test_anggota_buku.py`, `test_peminjaman.py` | PORT logic | `apps/desktop/tests/unit/*.test.ts` |
| `tests/test_smoke_gui.py` | DROP | `apps/desktop/tests/e2e/smoke.spec.ts` (Playwright) |
| `build.spec`, `build.bat`, `installer/installer.iss` | DROP (Devin 12) | `apps/desktop/src-tauri/tauri.conf.json` + Tauri MSI/NSIS |
| `docs/manual.md` | PORT | `docs/migration-v2/manual/*.md` → HTML bundled |
| `docs/screenshots/` | KEEP (referensi) | (read-only, baseline visual) |

---

## 6. Catatan untuk Devin 12 (release v1.0.0)

Setelah v2 stable + tested:

1. Move `src/perpustakaan/` → `legacy/v1/perpustakaan/` (atau tag git +
   delete dari main).
2. Move `tests/` (file yang di-DROP) ke `legacy/v1/tests/`.
3. Hapus `build.spec`, `build.bat`, `installer/`.
4. Disable workflow `ci.yml` (rename ke `ci-v1.yml.disabled` atau hapus).
5. Update `README.md` jadi panduan v2.
6. Tag `v1.0.0` (release pertama v2 stable).
7. Hapus `.venv`, `requirements.txt`, `pyproject.toml` Python (atau pertahankan
   sebagai stub kalau ada utilitas mig CLI).

Cleanup ini di-handle by Devin 12, bukan Devin 1–11.
