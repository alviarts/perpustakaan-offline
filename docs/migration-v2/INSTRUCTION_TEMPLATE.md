# Devin Migration v2 — Universal Prompt Template

> Copy-paste prompt di bawah ini saat memulai sesi Devin baru untuk
> migrasi `perpustakaan-offline`. Devin akan otomatis menentukan dirinya sesi
> ke-berapa berdasarkan state `docs/migration-v2/PROGRESS.md`.
>
> Prompt ini sengaja sama persis dengan yang dipakai untuk Devin 1, sehingga
> semua sesi konsisten.

---

```
Repo: alviarts/perpustakaan-offline
Branch utama: main
Bahasa komunikasi: Indonesia. Bahasa commit/PR: English (conventional commits).

Saya migrasi full rewrite Perpustakaan Offline dari Python+customtkinter ke modern stack (Tauri 2.0 + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Zustand + Vite + pnpm + Vitest + Playwright). Total 12 sesi Devin sequential. Sesi yang kamu kerjakan ditentukan otomatis berdasarkan state repo.

== PROTOKOL ==

STEP 1 — Sync state
1. `git clone https://github.com/alviarts/perpustakaan-offline.git` (atau pull kalau sudah ada)
2. `cd perpustakaan-offline && git checkout main && git pull origin main`
3. Cek `docs/migration-v2/PROGRESS.md`:
   - Tidak ada → kamu Devin 1, lanjut STEP 2A.
   - Ada → kamu Devin 2-12, lanjut STEP 2B.

Folder `docs/migration-v2/references/` berisi 36 screenshot dengan INDEX.md. Pelajari image yang relevan sebelum ngerjakan revisi.

STEP 2A — Devin 1 (bootstrap, NO KODE, dokumen saja)
Bikin 7 set file di `docs/migration-v2/`:

1. `REVISION_BACKLOG.md` — 26 revisi dengan struktur: ID, judul, kategori (UI/UX/Bug/Asset/Logic), scope detail (file v1, lokasi v2), dependency, prioritas P0/P1/P2, link ke `references/revision-NN-*.png`, definition of done.

2. `STACK_DECISION.md` — analisis Tauri 2.0 vs Electron + rekomendasi (default Tauri 2.0). Sub-decision: DB strategy (better-sqlite3 vs sqlx vs Python sidecar), state mgmt (Zustand vs Redux Toolkit), routing (TanStack Router vs React Router).

3. `ARCHITECTURE.md` — diagram arsitektur v2: Frontend (React+TS+Tailwind+shadcn+Zustand), IPC (Tauri command/event), Backend (Rust + Tauri plugins sqlite/fs/dialog/printer), DB layer reuse schema v1, file structure (`apps/desktop/`, `apps/web/`, `packages/shared/`), build pipeline (Vite + Tauri CLI + GitHub Actions).

4. `ASSETS_REUSE.md` — REUSE: SQLite schema (`src/perpustakaan/db.py`), business logic patterns (`services/*.py`), i18n strings → JSON, test fixtures, seed data DDC/ISO 639. BUANG: customtkinter UI (`gui/`), procedural illustrations/animations, build.spec, installer.iss. PORT: phosphor icons → `@phosphor-icons/react`. MIGRATE: Devin 12 bikin script .db v1 → v2.

5. `PROGRESS.md` — YAML/markdown table machine-parseable, 12 sesi:
   - id, title, status (PENDING/IN_PROGRESS/COMPLETED), pr (URL atau PENDING), completed_at, dependencies (list of session ids).
   - Sesi 1 = COMPLETED setelah PR ini merge.

6. `sessions/SESSION_01.md` ... `SESSION_12.md` — per file: Goal, Scope, Revisi tercover, Dependency, Tasks breakdown, Deliverables (file/test/UI), Definition of done. Breakdown:
   - 01: Bootstrap migration plan (no kode)
   - 02: Scaffolding Tauri+React+TS+Tailwind+shadcn project + setup CI/CD baru + reuse SQLite schema + login screen + theme system + i18n. Covers #5, #8, #10, #25 partial.
   - 03: Layout shell (sidebar collapsible + header + window responsive + identitas sync foundation). Covers #7, #11, #13, #22.
   - 04: Data Anggota CRUD + autocomplete + live search + dropdown styled. Covers #15, #17 (anggota), #19, #20 (anggota).
   - 05: Data Buku CRUD + Master Data komplit (DDC/Kategori/Bahasa/Jurusan/Kelas/Agama). Covers #16, #17 full.
   - 06: Peminjaman + Pengembalian (date picker, panel info, validasi, print nota). Covers #12, #21.
   - 07: Kunjungan redesign (transparent illustrations, quick stats, filter date range). Covers #18.
   - 08: Dashboard modern dengan charts (3 hero card + donut + bar + featured row). Covers #9.
   - 09: Laporan komplit (Grafik/Top Peminjam/Top Buku/Kas/Backup). Covers #23.
   - 10: KTA system komplit (template editor + barcode + auto-fill + print). Covers #14.
   - 11: Settings comprehensive 12 kategori + manual book HTML + audit wording final. Covers #4, #24, #25 full.
   - 12: Installer Tauri MSI (logo, license, no language picker, scrollbar polish, asset bundle) + release v1.0.0. Covers #1, #2, #3, #6, #26.

7. `INSTRUCTION_TEMPLATE.md` — copy-paste prompt universal yang lagi kamu baca ini.

Lalu:
- Branch: `devin/<unix-timestamp>-migration-v2-bootstrap`
- Commit: `docs(migration-v2): bootstrap migration plan + 12 session breakdown`
- Push, bikin PR title `docs(migration-v2): bootstrap migration plan` body berisi ringkasan + link tiap file + footer "Devin session 1/12".
- Tunggu CI pass.
- Final message ke user: link PR + minta merge supaya Devin 2 bisa lanjut.

STEP 2B — Devin 2-12 (eksekusi sesi berikutnya)
1. Baca `docs/migration-v2/PROGRESS.md`. Cari sesi pertama dengan status PENDING.
2. Baca `docs/migration-v2/sessions/SESSION_NN.md`.
3. Verifikasi dependency semua COMPLETED. Kalau belum, STOP, kasih tau user.
4. Branch: `devin/<unix-timestamp>-session-NN-<short-name>`.
5. Eksekusi tasks sampai semua deliverables tercapai.
6. Pastikan tests pass + lint/typecheck pass.
7. Update `PROGRESS.md`: sesi NN PENDING → COMPLETED dengan tanggal + PR placeholder.
8. Commit: `feat(session-NN): <judul singkat>`.
9. Push, bikin PR title `feat(session-NN): <judul>` body berisi: Goal sesi, Revisi tercover, Deliverables checklist, Tests added, Screenshot/recording untuk UI, footer "Devin session NN/12".
10. Tunggu CI pass via `git_pr` action pr_checks wait_mode=all.
11. CI fail → fix max 3 attempt, masih fail eskalasi ke user.
12. Final message ke user: link PR + minta merge.

== ATURAN GLOBAL ==
- JANGAN merge PR sendiri (review gate user).
- JANGAN modify file di sesi lain (fokus scope sesi sekarang).
- JANGAN skip update PROGRESS.md.
- JANGAN force push ke main atau bypass branch protection.
- WAJIB pull main dulu sebelum mulai.
- WAJIB push branch + bikin PR sebelum stop.
- WAJIB tunggu CI pass sebelum minta merge.
- Pakai `git_pr` tool untuk PR (bukan gh CLI).

== 26 REVISI (ringkasan, detail di REVISION_BACKLOG.md Devin 1) ==
1. Logo installer + .exe icon (Start Menu/Search/Taskbar)
2. Hapus Select Setup Language di installer
3. License custom kredit "alvi arts / vwrks" + replace CD/box wizard graphic dengan logo Nusantara
4. Manual book HTML responsif gantikan README.md
5. Redesign login modern minimal (2-kolom, gradient, smooth animation)
6. Asset quality high-res dari unDraw/Storyset/DrawKit (1024px+ PNG, no procedural)
7. Sidebar collapsible (chevron toggle, persist state, Ctrl+B, tooltip on-hover, auto-collapse <1024px)
8. Theme switcher dropdown (icon button + popover 3 row, fade-in)
9. Redesign dashboard modern (3 hero card + donut + bar + featured row, replace Treeview)
10. "Ingat Saya" auto-login (token bcrypt + AES, expire 30 hari)
11. Sync identitas perpustakaan ke sidebar/header/dashboard hero/KTA/laporan/login/manual/About
12. Date picker calendar popup (locale ID, range tahun configurable, "Hari Ini")
13. Fix glitch fullscreen + responsive + animated resize (breakpoint 768/1280)
14. Sistem KTA komplit (fix font path, template editor visual, auto-fill, barcode QR untuk peminjaman cepat)
15. Live search instant debounced 200ms apply ke semua list view
16. Fix layout Data Buku (master/detail, fix bounce_book empty state)
17. Dropdown master data DDC/Kategori/Bahasa/Jurusan/Kelas/Agama dengan CRUD di Settings, seed online (Dewey, ISO 639)
18. Fix Kunjungan animasi bg transparent + quick stat card + filter date range
19. Style dropdown match width (popup full = trigger, animasi, keyboard nav)
20. Autocomplete anggota & buku (2-line item, fuzzy match, smart suggest)
21. Redesign Peminjaman komplit (autocomplete, date range, panel info anggota+buku, validasi, print nota, quick stats)
22. Window resize fleksibel + tombol/menu tidak hidden saat windowed (resizable + minsize 800×600)
23. Redesign Laporan (sidebar nav + filter + Grafik/Top Peminjam/Top Buku/Kas/Backup dengan charts)
24. Settings 12 kategori mirip Google (search bar, tooltip, reset to default)
25. Audit wording (rename Transaksi → Aturan Peminjaman, sweep semua label/dialog/error/i18n)
26. Mouse wheel scroll global + smooth scroll + scrollbar fade auto-hide

Mulai eksekusi STEP 1 sekarang. Tentukan Devin keberapa kamu, lanjut STEP 2A atau 2B.
```

---

## Catatan pakai

- Prompt di atas **idempotent**: aman dijalankan berulang. Devin akan otomatis
  pilih sesi sesuai state `PROGRESS.md`.
- Kalau mau force sesi tertentu (misal mau redo), bilang ke Devin: _"Skip
  state check, langsung kerjakan SESSION_05"_.
- Untuk sesi Devin 1 (bootstrap), prompt sama saja — Devin akan tahu kalau
  `docs/migration-v2/PROGRESS.md` belum ada.
