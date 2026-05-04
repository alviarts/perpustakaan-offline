# Revision Backlog — Migration v2

> 26 revisi yang harus dikerjakan selama migrasi v1 → v2. Tiap revisi punya:
> **ID**, **Judul**, **Kategori**, **Scope detail** (file v1 → lokasi v2),
> **Dependency** ke revisi lain, **Prioritas** (P0/P1/P2),
> **Reference image** (di `docs/migration-v2/references/`), dan
> **Definition of Done**.
>
> Mapping revisi → sesi ada di kolom **Sesi**. Detail per-sesi di
> `docs/migration-v2/sessions/SESSION_NN.md`.

## Legenda

- **Kategori**: `UI` (visual), `UX` (alur), `Bug`, `Asset`, `Logic`.
- **Prioritas**:
  - `P0` — blocker rilis v2 (fitur inti tidak jalan tanpa ini).
  - `P1` — penting, harus masuk v1.0.0 tapi punya workaround sementara.
  - `P2` — nice-to-have, boleh slip ke v1.1 kalau time-box ketat.
- **Reference image**: filename pattern `revision-NN-<short>.png` (misal
  `revision-05-login.png`). Ditaruh di `docs/migration-v2/references/`.
  Jika belum ada (Devin 1 belum drop), pakai screenshot v1 di
  `docs/screenshots/` sebagai baseline visual.

---

## Revisi #1 — Logo installer + `.exe` icon

| Field | Value |
|---|---|
| **Kategori** | Asset |
| **Prioritas** | P1 |
| **Sesi** | 12 |
| **Dependency** | — |
| **Reference** | `references/revision-01-installer-logo.png` |

**Scope v1 → v2**

- v1: `installer/installer.iss` (Inno Setup) + `build.spec` PyInstaller (icon
  Windows lewat `--icon`).
- v2: `apps/desktop/src-tauri/tauri.conf.json` field `bundle.icon`
  (multiple sizes: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`,
  `icon.ico`). Inno Setup config v2 di
  `apps/desktop/src-tauri/installer/inno-setup.iss` (atau pakai Tauri MSI native).

**Definition of Done**

- [ ] Logo `.ico` muncul di Start Menu, Windows Search, Taskbar pinned, Alt-Tab.
- [ ] Logo `.png` muncul di window title-bar (Tauri default).
- [ ] Installer `.exe` punya icon yang sama (bukan default Inno Setup ribbon).
- [ ] Source asset (SVG / 1024×1024 PNG) di-commit ke
      `apps/desktop/src-tauri/icons/source/`.

---

## Revisi #2 — Hapus "Select Setup Language" di installer

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P2 |
| **Sesi** | 12 |
| **Dependency** | — |
| **Reference** | `references/revision-02-no-language-picker.png` |

**Scope v1 → v2**

- v1: Inno Setup default include semua bahasa di `[Languages]` → muncul popup
  "Select Setup Language" sebelum wizard.
- v2: Konfigurasi installer Tauri (Inno Setup template via Tauri) hanya
  include 1 bahasa default (Indonesian atau English—pilih satu di Devin 11
  audit wording). Set `ShowLanguageDialog=no` di section `[Setup]`.

**Definition of Done**

- [ ] Jalankan installer fresh di Windows 10/11 → popup language tidak muncul.
- [ ] Wizard langsung ke welcome screen.

---

## Revisi #3 — License page custom + replace CD/box wizard graphic

| Field | Value |
|---|---|
| **Kategori** | Asset / UX |
| **Prioritas** | P2 |
| **Sesi** | 12 |
| **Dependency** | #1 (logo source) |
| **Reference** | `references/revision-03-license-and-wizard.png` |

**Scope v1 → v2**

- v1: License default Inno Setup (`LicenseFile=` kosong / generic), wizard
  graphic = box CD generic.
- v2:
  - License markdown disusun di `docs/legal/LICENSE-installer.txt` dengan
    kredit "alvi arts / vwrks" + lisensi MIT/GPL-3.0 (samakan dengan
    `LICENSE` repo root).
  - Wizard graphic: render logo "Nusantara" (PNG 164×314 untuk `WizardImage`
    + 55×58 untuk `WizardSmallImage`) → simpan di
    `apps/desktop/src-tauri/installer/assets/`.

**Definition of Done**

- [ ] Halaman "License Agreement" di installer menampilkan teks kredit + isi
      LICENSE.
- [ ] Side-banner installer tidak lagi pakai box CD generic, tapi logo
      Nusantara.

---

## Revisi #4 — Manual book HTML responsif gantikan README.md

| Field | Value |
|---|---|
| **Kategori** | UX / UI |
| **Prioritas** | P1 |
| **Sesi** | 11 |
| **Dependency** | #11 (sync identitas) |
| **Reference** | `references/revision-04-manual-html.png` |

**Scope v1 → v2**

- v1: `docs/manual.md` Markdown plain, dibuka di GitHub.
- v2: Generate `apps/desktop/src-tauri/resources/manual/index.html` dari
  Markdown source (`docs/migration-v2/manual/*.md`) pakai
  [`@docusaurus/...`] atau static gen sederhana (mdBook / VitePress build →
  copy `dist/` ke resources). Buka via Tauri command `open_manual` ke browser
  default user. Responsif (mobile/tablet preview), search bar, dark mode toggle.

**Definition of Done**

- [ ] Tombol "Manual" di sidebar / header membuka manual HTML di browser default.
- [ ] Manual punya: nav sidebar, search, dark mode toggle, responsif <768px.
- [ ] Identitas perpustakaan (nama sekolah) muncul di header manual (sync via
      template).

---

## Revisi #5 — Redesign login modern minimal

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P0 |
| **Sesi** | 2 |
| **Dependency** | #11 (sync identitas) |
| **Reference** | `references/revision-05-login.png`, `docs/screenshots/01-login.png` (baseline v1) |

**Scope v1 → v2**

- v1: `src/perpustakaan/gui/login.py` (customtkinter form 1-kolom).
- v2: `apps/desktop/src/features/auth/Login.tsx`:
  - Layout 2-kolom (≥768px): kiri form, kanan illustration / gradient.
  - <768px: collapse jadi 1-kolom (form di atas, ilustrasi di bawah / hidden).
  - shadcn `Card` + `Form` + `Input` + `Button`.
  - Animasi entrance (fade + slight slide-up, Framer Motion atau Tailwind
    `animate-in`).
  - Logo + nama perpustakaan dari Settings (revisi #11).
  - Checkbox "Ingat Saya" (revisi #10).

**Definition of Done**

- [ ] Login screen render 2-kolom di desktop, 1-kolom di mobile.
- [ ] Form submit pakai bcrypt verify (lewat Tauri command).
- [ ] Animasi entrance halus, no flash.
- [ ] Test Vitest (form validation) + Playwright e2e (login happy path).

---

## Revisi #6 — Asset quality high-res

| Field | Value |
|---|---|
| **Kategori** | Asset |
| **Prioritas** | P1 |
| **Sesi** | 12 (final pass), bertahap di sesi UI |
| **Dependency** | — |
| **Reference** | `references/revision-06-assets-undraw.png` |

**Scope v1 → v2**

- v1: `assets/illustrations/*.png` (procedural / low-res), `assets/animations/`
  (PIL animation frames).
- v2: Sumber asset bebas pakai (royalty-free, attribution OK):
  - [unDraw](https://undraw.co/) (SVG/PNG, customizable color)
  - [Storyset](https://storyset.com/) (PNG/SVG, 1024px+)
  - [DrawKit](https://drawkit.com/) (subset gratis)
  - Letakkan di `apps/desktop/public/illustrations/`.
  - Format SVG kalau tersedia (scalable). Kalau PNG, minimal 1024×1024.
  - Naming: `<feature>-<state>.svg` (misal `kunjungan-empty.svg`,
    `dashboard-hero.svg`).

**Definition of Done**

- [ ] Tidak ada lagi PIL procedural rendering di runtime.
- [ ] Semua ilustrasi besar di-bundle sebagai SVG / 1024px+ PNG.
- [ ] License/attribution tiap asset tercatat di `apps/desktop/public/illustrations/CREDITS.md`.

---

## Revisi #7 — Sidebar collapsible

| Field | Value |
|---|---|
| **Kategori** | UI / UX |
| **Prioritas** | P0 |
| **Sesi** | 3 |
| **Dependency** | — |
| **Reference** | `references/revision-07-sidebar.png` |

**Scope v1 → v2**

- v1: `gui/main_window.py` sidebar fixed width.
- v2: `apps/desktop/src/components/layout/Sidebar.tsx` dengan shadcn `Sidebar`
  (jika dipakai) atau custom:
  - Chevron toggle di header sidebar (icon `CaretDoubleLeft` / `CaretDoubleRight`).
  - Width: 240px expanded, 64px collapsed (icon-only).
  - Persist state di `localStorage` (key `sidebar:collapsed`) + Zustand store.
  - Keyboard shortcut `Ctrl+B` (Windows/Linux) / `Cmd+B` (macOS).
  - Tooltip on-hover saat collapsed (shadcn `Tooltip`).
  - Auto-collapse saat viewport <1024px (media query + Zustand action).

**Definition of Done**

- [ ] Toggle chevron expand/collapse smooth (CSS transition 200ms).
- [ ] State persist after page reload (Zustand + localStorage).
- [ ] `Ctrl+B` shortcut works global.
- [ ] Tooltip muncul on-hover saat collapsed.
- [ ] Resize window <1024px → sidebar auto-collapse.

---

## Revisi #8 — Theme switcher dropdown

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P1 |
| **Sesi** | 2 |
| **Dependency** | — |
| **Reference** | `references/revision-08-theme-switcher.png` |

**Scope v1 → v2**

- v1: `gui/main_window.py` theme manual lewat customtkinter set_appearance_mode.
- v2: shadcn `DropdownMenu` di header:
  - Icon button (`Sun` / `Moon` / `Monitor` dari `@phosphor-icons/react`).
  - Popover 3 row: `Light`, `Dark`, `System`.
  - Animasi fade-in (Radix built-in).
  - State di Zustand `themeStore` + persist `localStorage` (key `theme`).
  - Apply via `next-themes` atau manual: toggle `dark` class di `<html>`.

**Definition of Done**

- [ ] Klik icon → popover 3 opsi muncul.
- [ ] Pilih `System` → ikut `prefers-color-scheme` OS.
- [ ] State persist after reload.
- [ ] Tidak ada flash light → dark saat reload (FOUC suppressed via inline
      script di `index.html`).

---

## Revisi #9 — Redesign dashboard modern

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P0 |
| **Sesi** | 8 |
| **Dependency** | #11, #15 |
| **Reference** | `references/revision-09-dashboard.png`, `docs/screenshots/02-dashboard.png` |

**Scope v1 → v2**

- v1: `gui/views/dashboard_view.py` Treeview + counter cards.
- v2: `apps/desktop/src/features/dashboard/Dashboard.tsx`:
  - **Hero row** (3 cards): Total Anggota, Total Buku, Buku Dipinjam (icon +
    angka besar + delta vs bulan lalu).
  - **Donut chart**: distribusi DDC (`recharts` `<PieChart>`).
  - **Bar chart**: kunjungan 7 hari terakhir (`recharts` `<BarChart>`).
  - **Featured row**: 5 anggota top + 5 buku top (mini-card carousel atau
    grid 2-kolom).
  - Hapus Treeview.

**Definition of Done**

- [ ] Hero card responsif (3-kolom ≥1024px, 1-kolom mobile).
- [ ] Charts pakai theme-aware color (light/dark).
- [ ] Loading state (skeleton via shadcn `Skeleton`).
- [ ] Empty state (illustration #6 + CTA "Tambah anggota / buku").

---

## Revisi #10 — "Ingat Saya" auto-login

| Field | Value |
|---|---|
| **Kategori** | Logic |
| **Prioritas** | P1 |
| **Sesi** | 2 |
| **Dependency** | #5 |
| **Reference** | `references/revision-10-remember-me.png` |

**Scope v1 → v2**

- v1: tidak ada fitur ini di v1.
- v2:
  - Frontend: checkbox "Ingat Saya" di login form.
  - Backend (Rust Tauri command): generate token = `bcrypt(user_id || expires_at || rand_salt)`,
    encrypt pakai AES-256-GCM dengan key derive dari machine id (Tauri
    `tauri-plugin-stronghold` atau `keyring-rs`).
  - Simpan token di OS keyring (`tauri-plugin-stronghold` / `keyring-rs`),
    bukan plain file.
  - Expire 30 hari (`expires_at` di payload).
  - On startup: jika token valid → skip login screen.

**Definition of Done**

- [ ] Centang "Ingat Saya" → restart app → langsung masuk dashboard.
- [ ] Token kadaluwarsa setelah 30 hari → fallback ke login screen.
- [ ] Logout → token dihapus dari keyring.
- [ ] Test unit Rust untuk encrypt/decrypt + expire check.

---

## Revisi #11 — Sync identitas perpustakaan

| Field | Value |
|---|---|
| **Kategori** | Logic / UI |
| **Prioritas** | P0 |
| **Sesi** | 3 (foundation), dipakai di 5/8/9/10/11 |
| **Dependency** | — |
| **Reference** | `references/revision-11-identity-sync.png` |

**Scope v1 → v2**

- v1: `models/settings.py` simpan `nama_perpustakaan`, `logo_path`,
  `alamat`, `kepala_perpustakaan`. Tapi tidak konsisten muncul di semua view.
- v2:
  - Zustand store `identityStore` subscribe ke Tauri event `identity:changed`.
  - Komponen wajib re-render saat identity berubah:
    - Sidebar header (logo + nama)
    - App header
    - Dashboard hero card
    - KTA template (logo + nama + alamat)
    - Laporan PDF/print header
    - Login screen
    - Manual HTML header (template injection)
    - About dialog

**Definition of Done**

- [ ] Edit `nama_perpustakaan` di Settings → semua tempat di atas update tanpa reload.
- [ ] Logo upload → semua tempat update.
- [ ] PDF Laporan generate setelah edit → header pakai data baru.

---

## Revisi #12 — Date picker calendar popup

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P0 |
| **Sesi** | 6 (peminjaman/pengembalian), reusable component |
| **Dependency** | — |
| **Reference** | `references/revision-12-date-picker.png` |

**Scope v1 → v2**

- v1: customtkinter date entry text field, format manual.
- v2: `apps/desktop/src/components/ui/date-picker.tsx`:
  - Bungkus shadcn `Popover` + `Calendar` (react-day-picker).
  - Locale Indonesia (`date-fns/locale/id`).
  - Range tahun configurable via prop `yearRange={[2020, 2030]}` (default
    [currentYear-5, currentYear+5]).
  - Tombol shortcut "Hari Ini" di footer.
  - Keyboard nav (arrow keys, Page Up/Down ganti bulan).

**Definition of Done**

- [ ] Klik input → popup kalender muncul.
- [ ] Bulan/hari dalam Bahasa Indonesia.
- [ ] Tombol "Hari Ini" set tanggal hari ini + close popup.
- [ ] Pakai di Peminjaman, Pengembalian, Laporan filter date range.

---

## Revisi #13 — Fix glitch fullscreen + responsive

| Field | Value |
|---|---|
| **Kategori** | Bug / UI |
| **Prioritas** | P0 |
| **Sesi** | 3 |
| **Dependency** | — |
| **Reference** | `references/revision-13-resize-glitch.png` |

**Scope v1 → v2**

- v1: customtkinter resize sering glitch (widget overlap, scrollbar nyangkut).
- v2:
  - Tauri window: `resizable: true`, `fullscreen: false` default,
    `minSize: { width: 800, height: 600 }`.
  - Tailwind responsive: breakpoint 768 (md), 1280 (xl).
  - Sidebar auto-collapse <1024px (lihat #7).
  - CSS `transition` pada layout container biar resize smooth.
  - Test manual: drag window edge → tidak ada flicker, tombol/menu tetap clickable.

**Definition of Done**

- [ ] Resize 800×600 → 1920×1080 → 800×600: tidak ada widget hilang/overlap.
- [ ] Fullscreen toggle (F11): tidak ada glitch.
- [ ] Test Playwright resize ke 3 viewport (768, 1280, 1920).

---

## Revisi #14 — Sistem KTA komplit

| Field | Value |
|---|---|
| **Kategori** | UI / Logic |
| **Prioritas** | P1 |
| **Sesi** | 10 |
| **Dependency** | #4 (anggota), #5 (master data) |
| **Reference** | `references/revision-14-kta.png` |

**Scope v1 → v2**

- v1: `services/pdf_service.py` generate KTA fixed template, font path sering
  glitch (relative path PyInstaller).
- v2:
  - Template editor visual (drag-drop area) di Settings → simpan layout JSON
    di `kta_templates` table.
  - Auto-fill: `[nama]`, `[nis]`, `[kelas]`, `[foto]`, `[barcode_qr]`.
  - Generate PDF pakai `pdf-lib` (browser-side) atau `printpdf` (Rust).
  - Barcode QR berisi `member_id` → scan di Peminjaman langsung auto-fill.
  - Fix font path: bundle font di `apps/desktop/src-tauri/resources/fonts/`
    + load via `tauri::path::resolve_path`.

**Definition of Done**

- [ ] Template editor: pindah field, ubah font size/color, simpan.
- [ ] Cetak KTA satu / batch (semua anggota terpilih).
- [ ] Scan barcode QR di Peminjaman → field anggota auto-fill.
- [ ] Test unit untuk template parser + auto-fill.

---

## Revisi #15 — Live search instant debounced

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P1 |
| **Sesi** | 4 (anggota), reusable di 5/6/9 |
| **Dependency** | — |
| **Reference** | `references/revision-15-live-search.png` |

**Scope v1 → v2**

- v1: Search button manual, query di klik.
- v2:
  - Hook `useDebouncedSearch(query, 200)` di
    `apps/desktop/src/hooks/use-debounced-search.ts`.
  - Apply ke list view: Anggota, Buku, Peminjaman, Pengembalian, Laporan.
  - Indicator: shadcn `Loader2` saat loading.
  - Highlight match (substring bold) di hasil.

**Definition of Done**

- [ ] Ketik di search bar → list update tanpa klik tombol, delay 200ms.
- [ ] Empty state saat 0 hasil ("Tidak ada hasil untuk '<query>'").
- [ ] Hook reusable, ada test Vitest.

---

## Revisi #16 — Fix layout Data Buku

| Field | Value |
|---|---|
| **Kategori** | Bug / UI |
| **Prioritas** | P0 |
| **Sesi** | 5 |
| **Dependency** | — |
| **Reference** | `references/revision-16-buku-layout.png`, `docs/screenshots/04-buku.png` |

**Scope v1 → v2**

- v1: `gui/views/buku_view.py` master/detail rusak (panel kanan kosong saat
  no selection), animasi `bounce_book` empty state nyangkut.
- v2:
  - Layout master/detail pakai `ResizablePanelGroup` (shadcn).
  - Empty state pakai illustration SVG + CTA.
  - Pilih row di tabel kiri → detail di kanan update.
  - Tombol Add/Edit/Delete di toolbar atas.

**Definition of Done**

- [ ] No selection → panel kanan tampil empty illustration + CTA.
- [ ] Pilih row → detail muncul (cover, judul, ISBN, eksemplar list).
- [ ] Resize panel divider smooth.

---

## Revisi #17 — Dropdown master data + CRUD di Settings

| Field | Value |
|---|---|
| **Kategori** | Logic / UI |
| **Prioritas** | P1 |
| **Sesi** | 4 (anggota partial) + 5 (full) |
| **Dependency** | — |
| **Reference** | `references/revision-17-master-data.png` |

**Scope v1 → v2**

- v1: hanya DDC + Kelas yang punya CRUD di Settings, dropdown kategori
  hardcoded.
- v2:
  - Tabel master data: `ddc`, `kategori`, `bahasa`, `jurusan`, `kelas`,
    `agama`. Tambah migration untuk yang belum ada (kategori, bahasa,
    jurusan, agama).
  - CRUD page di Settings → 6 sub-tab.
  - Seed data:
    - DDC: dari `assets/ddc-source.txt` (sudah ada).
    - Bahasa: ISO 639-1 list (10 paling umum: id, en, ar, jw, su, ...).
    - Agama: 6 agama resmi Indonesia.
    - Kelas: contoh 7A..12C (configurable).
    - Kategori, jurusan: kosong default, user input.

**Definition of Done**

- [ ] 6 master data CRUD-able dari Settings.
- [ ] Dropdown di form Anggota / Buku auto-pull dari master data.
- [ ] Migration script seed default values saat first run.

---

## Revisi #18 — Fix Kunjungan animasi + filter

| Field | Value |
|---|---|
| **Kategori** | UI / Bug |
| **Prioritas** | P1 |
| **Sesi** | 7 |
| **Dependency** | — |
| **Reference** | `references/revision-18-kunjungan.png`, `docs/screenshots/05-kunjungan.png` |

**Scope v1 → v2**

- v1: `gui/views/kunjungan_view.py` animasi PIL bg solid (tidak transparent),
  no quick stats, no filter date range.
- v2:
  - Replace animasi → SVG illustration transparent (asset #6).
  - Quick stat card: Hari Ini / Minggu Ini / Bulan Ini (counter card).
  - Filter date range (date picker #12).
  - Tabel kunjungan dengan kolom: Nama, Kelas, Jam Masuk, Tujuan.
  - Live search #15.

**Definition of Done**

- [ ] Bg illustration transparent (sesuai theme light/dark).
- [ ] Quick stat 3 angka real-time.
- [ ] Filter date range update tabel.

---

## Revisi #19 — Style dropdown match width

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P2 |
| **Sesi** | 4 |
| **Dependency** | — |
| **Reference** | `references/revision-19-dropdown.png` |

**Scope v1 → v2**

- v1: customtkinter dropdown popup width tidak match trigger.
- v2: shadcn `Select` / `Combobox`:
  - Set `--radix-select-trigger-width` di styles supaya popup = trigger width.
  - Animasi `data-state=open` (slide-down 150ms).
  - Keyboard nav (arrow up/down, Enter, Esc).

**Definition of Done**

- [ ] Popup width selalu sama dengan trigger.
- [ ] Animasi smooth.
- [ ] Test keyboard nav di Playwright.

---

## Revisi #20 — Autocomplete anggota & buku

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P0 |
| **Sesi** | 4 (anggota), 6 (peminjaman pakai keduanya) |
| **Dependency** | #15 |
| **Reference** | `references/revision-20-autocomplete.png` |

**Scope v1 → v2**

- v1: input nama text plain, no suggestion.
- v2: shadcn `Command` / `Combobox`:
  - 2-line item: line 1 = nama, line 2 = NIS / kelas (anggota) atau ISBN /
    judul (buku).
  - Fuzzy match pakai `fuse.js` atau SQL `LIKE %q%`.
  - "Smart suggest": rekomendasi berdasar history (e.g. anggota sering pinjam
    → tampil duluan).

**Definition of Done**

- [ ] Ketik 2+ char → popup suggestion 2-line item.
- [ ] Pilih item → form auto-fill data lengkap.
- [ ] Performance <50ms untuk 1000 records.

---

## Revisi #21 — Redesign Peminjaman komplit

| Field | Value |
|---|---|
| **Kategori** | UI / UX |
| **Prioritas** | P0 |
| **Sesi** | 6 |
| **Dependency** | #12, #20, #15 |
| **Reference** | `references/revision-21-peminjaman.png`, `docs/screenshots/06-peminjaman.png` |

**Scope v1 → v2**

- v1: form linear, no info panel, no quick stats.
- v2:
  - Form layout 2-kolom: kiri form input, kanan panel info (anggota / buku
    detail).
  - Autocomplete #20 untuk anggota + buku.
  - Date range picker #12 (tanggal pinjam, jatuh tempo).
  - Validasi: anggota tidak punya pinjaman aktif yang melewati limit;
    buku punya eksemplar tersedia.
  - Print nota: PDF mini (5×7cm) ke printer thermal atau A4.
  - Quick stats di header: Pinjam Aktif Hari Ini / Minggu Ini.

**Definition of Done**

- [ ] Pilih anggota → panel info (foto, nama, kelas, riwayat) muncul.
- [ ] Pilih buku → panel info (cover, judul, eksemplar) muncul.
- [ ] Validasi block submit kalau invalid (toast error).
- [ ] Submit → buat record + print nota.
- [ ] Test e2e Playwright happy path.

---

## Revisi #22 — Window resize fleksibel

| Field | Value |
|---|---|
| **Kategori** | Bug |
| **Prioritas** | P0 |
| **Sesi** | 3 |
| **Dependency** | — |
| **Reference** | `references/revision-22-window-resize.png` |

**Scope v1 → v2**

- v1: Tk window kadang tombol/menu kepotong saat windowed.
- v2: Tauri config:
  - `resizable: true`
  - `minWidth: 800`, `minHeight: 600`
  - `fullscreen: false` default
  - `maximized: true` saat first launch (boleh diubah user)

**Definition of Done**

- [ ] Resize ke 800×600 → semua tombol/menu masih clickable.
- [ ] Resize ke 1920×1080 → layout fluid, no excessive whitespace.
- [ ] Maximize/restore button works.

---

## Revisi #23 — Redesign Laporan komplit

| Field | Value |
|---|---|
| **Kategori** | UI |
| **Prioritas** | P0 |
| **Sesi** | 9 |
| **Dependency** | #6, #7, #8, #11, #12 |
| **Reference** | `references/revision-23-laporan.png`, `docs/screenshots/08-laporan.png` |

**Scope v1 → v2**

- v1: Treeview + tabs.
- v2: Layout sidebar nav (5 sub-page):
  1. **Grafik Kunjungan**: line chart per bulan / tahun (recharts).
  2. **Top Peminjam**: tabel + bar chart 10 besar.
  3. **Top Buku**: tabel + bar chart 10 besar (filter periode).
  4. **Kas**: tabel pemasukan denda + manual + chart cumulative.
  5. **Backup**: tombol backup full DB + restore + jadwal.
  - Filter date range di tiap sub-page (date picker #12).
  - Export PDF + Excel pakai service shared.

**Definition of Done**

- [ ] 5 sub-page Laporan jalan dengan data real.
- [ ] Export PDF / Excel works (header pakai identitas #11).
- [ ] Backup → file `.db` + checksum SHA256 di folder backup user.

---

## Revisi #24 — Settings comprehensive 12 kategori

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P1 |
| **Sesi** | 11 |
| **Dependency** | #11, #14, #17, #25 |
| **Reference** | `references/revision-24-settings.png`, `docs/screenshots/09-setting.png` |

**Scope v1 → v2**

- v1: 1 page settings flat.
- v2: 12 sub-page nav (mirip Google Workspace settings):
  1. Identitas Perpustakaan (#11)
  2. Aturan Peminjaman (rename dari "Transaksi", #25)
  3. Master Data (#17)
  4. KTA Template (#14)
  5. Tampilan (theme, font scale, density)
  6. Bahasa (ID/EN)
  7. Akun & Pengguna
  8. Hak Akses (Permissions)
  9. Backup & Restore
  10. Sinkronisasi (Google Sheets, optional)
  11. Audit Log
  12. Tentang
  - Search bar global (filter sub-page + setting items).
  - Tooltip di tiap toggle.
  - Tombol "Reset to default" per sub-page + global.

**Definition of Done**

- [ ] 12 sub-page nav works.
- [ ] Search bar filter setting items real-time.
- [ ] Tooltip muncul on-hover (delay 500ms).
- [ ] "Reset to default" → confirm dialog → revert ke default values.

---

## Revisi #25 — Audit wording final

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P1 |
| **Sesi** | 2 (partial baseline), 11 (full sweep) |
| **Dependency** | — |
| **Reference** | `references/revision-25-wording.png` |

**Scope v1 → v2**

- Rename "Transaksi" → "Aturan Peminjaman" (di Settings, menu).
- Sweep semua label/dialog/error/i18n untuk konsistensi:
  - Bahasa Indonesia formal (bukan "Lo / Gua").
  - Hindari jargon teknis di error message ("Foreign key constraint" →
    "Data masih dipakai di tempat lain").
  - Capitalization konsisten (Title Case untuk label, sentence case untuk help text).
- File i18n: `apps/desktop/src/i18n/id.json` + `en.json`.

**Definition of Done**

- [ ] Tidak ada lagi string "Transaksi" sebagai menu label.
- [ ] Lint i18n: tidak ada key tidak terpakai / missing translation.
- [ ] Review user (di PR Devin 11).

---

## Revisi #26 — Mouse wheel scroll global + smooth

| Field | Value |
|---|---|
| **Kategori** | UX |
| **Prioritas** | P2 |
| **Sesi** | 12 |
| **Dependency** | — |
| **Reference** | `references/revision-26-scroll.png` |

**Scope v1 → v2**

- v1: customtkinter scroll kadang tidak responsif di area tertentu.
- v2:
  - Default browser scroll (smooth via `scroll-behavior: smooth`).
  - Custom scrollbar via `tailwindcss-scrollbar` plugin atau
    [`overlayscrollbars`](https://kingsora.github.io/OverlayScrollbars/):
    auto-hide setelah idle 1.5s, fade-in saat scroll.
  - Test: scroll di Dashboard, Tabel Anggota, Settings → semua smooth.

**Definition of Done**

- [ ] Scrollbar auto-hide saat idle, fade-in saat scroll.
- [ ] Tidak ada area "dead zone" yang tidak terima wheel event.
- [ ] Smooth scroll behavior at default.

---

## Coverage matrix (revisi → sesi)

| Sesi | Revisi tercover |
|---|---|
| 1 (bootstrap) | — (dokumentasi only) |
| 2 (scaffolding) | #5, #8, #10, #25 (partial) |
| 3 (layout shell) | #7, #11 (foundation), #13, #22 |
| 4 (anggota) | #15, #17 (anggota), #19, #20 (anggota) |
| 5 (buku + master data) | #16, #17 (full) |
| 6 (peminjaman/pengembalian) | #12, #21 |
| 7 (kunjungan) | #18 |
| 8 (dashboard) | #9 |
| 9 (laporan) | #23 |
| 10 (KTA) | #14 |
| 11 (settings + manual) | #4, #24, #25 (full) |
| 12 (installer + release) | #1, #2, #3, #6 (final), #26 |

Semua 26 revisi tercover. Sesi 11 dan 12 jadi finishing pass (audit + asset polish).
