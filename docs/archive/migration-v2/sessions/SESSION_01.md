# SESSION 01 — Bootstrap migration plan

> **Devin session 1/12.** Foundation only. NO kode aplikasi.

## Goal

Set up dokumentasi migrasi v2 lengkap supaya 11 sesi berikutnya punya
single source of truth: scope, stack decision, arsitektur, mapping aset,
breakdown per sesi, dan mekanisme tracking progress.

## Scope

- **Tidak ada kode aplikasi** (no React, Rust, Tauri config).
- **Tidak menyentuh** v1 source (`src/perpustakaan/`, `tests/`, dll.).
- Hanya menambah file di:
  - `docs/migration-v2/*.md`
  - `docs/migration-v2/sessions/*.md`
  - `docs/migration-v2/references/INDEX.md` (placeholder, image dropped by user)

## Revisi tercover

— (sesi 1 tidak mengeksekusi revisi apa pun; hanya merencanakan)

## Dependencies

— (sesi paling awal)

## Tasks breakdown

1. Clone repo + branch baru `devin/<unix-ts>-migration-v2-bootstrap`.
2. Tulis `REVISION_BACKLOG.md` (26 revisi, format ID + judul + kategori +
   scope detail + dependency + prioritas + reference + DoD).
3. Tulis `STACK_DECISION.md` (analisis Tauri vs Electron + sub-decisions
   DB / state mgmt / routing).
4. Tulis `ARCHITECTURE.md` (file structure, IPC layer, DB layer, build
   pipeline, CI/CD).
5. Tulis `ASSETS_REUSE.md` (REUSE / BUANG / PORT / MIGRATE matrix).
6. Tulis `PROGRESS.md` machine-parseable (12 sesi, deps, status).
7. Tulis `sessions/SESSION_01.md` ... `SESSION_12.md` (file ini + 11 lainnya).
8. Tulis `INSTRUCTION_TEMPLATE.md` (universal copy-paste prompt).
9. Tulis `references/INDEX.md` (catatan: image dropped manually by user;
   include daftar 36 file pattern + binding ke revisi).
10. Commit conventional + push branch.
11. Buat PR (fetch template dulu) — title `docs(migration-v2): bootstrap migration plan`.
12. Tunggu CI pass (legacy Python CI, harus tetap pass karena cuma nambah md).
13. Final message ke user (link PR + instruksi merge).

## Deliverables

- File:
  - `docs/migration-v2/REVISION_BACKLOG.md`
  - `docs/migration-v2/STACK_DECISION.md`
  - `docs/migration-v2/ARCHITECTURE.md`
  - `docs/migration-v2/ASSETS_REUSE.md`
  - `docs/migration-v2/PROGRESS.md`
  - `docs/migration-v2/INSTRUCTION_TEMPLATE.md`
  - `docs/migration-v2/sessions/SESSION_01.md` ... `SESSION_12.md`
  - `docs/migration-v2/references/INDEX.md`
- PR: 1 PR ke `main`, body lengkap dengan link ke tiap file.
- Tests: tidak ada (docs only).

## Definition of Done

- [ ] Semua 7 set file di-commit.
- [ ] PR dibuat dan CI pass.
- [ ] PROGRESS.md sesi 1 berstatus IN_PROGRESS dengan PR link.
- [ ] User notifikasi via final message untuk merge.
- [ ] Setelah PR merge: user (atau Devin 2) update PROGRESS.md sesi 1 →
      COMPLETED + completed_at.

## Notes

- File `references/` mengharapkan 36 PNG screenshot revisi yang diberikan
  oleh user secara manual (Devin tidak bisa generate referensi visual).
  Kalau belum ada saat sesi 2 mulai, Devin 2 cukup pakai `docs/screenshots/`
  v1 sebagai baseline + skip referensi visual yang belum ada.
- Devin 1 TIDAK mengubah `PROGRESS.md` sesi 1 → COMPLETED. Itu di-handle
  saat PR sesi 1 di-merge: Devin 2 di awal sesinya akan baca state baru
  dan optionally bisa flip status sesi 1 → COMPLETED. Atau user merge
  langsung dan Devin 2 update sebagai bagian PR-nya.
