# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release section is delimited by a heading of the form `## [VERSION] - DATE`.
The `release-v2` job in `.github/workflows/ci-v2.yml` runs
`scripts/extract-changelog.mjs <tag>` on tag push and uses the matching section
as the GitHub Release body. If a tag has no matching section, the workflow falls
back to GitHub's auto-generated release notes.

## [Unreleased]

## [1.0.2] - 2026-05-04

### Added

- **File picker uploader** for anggota photo, buku cover, and identitas logo
  via a reusable `FilePickerInput` component. Backed by Tauri commands
  (`assets_save` / `assets_resolve` / `assets_delete`) with path-traversal
  defenses, an allow-list of categories (anggota / buku / identitas) and
  extensions (png / jpg / jpeg / webp / gif / svg / bmp), and race-protection
  against fast successive picks. Legacy v1 absolute paths in the DB still
  pass through without migration. (#69)
- **Anggota Excel export** — "Ekspor Excel" button on the member list
  respects the active filters (search / kelas / jurusan / aktif / sort) and
  writes via a generic `export_write_bytes` Tauri command (validates
  non-empty, ≤ 64 MiB, absolute path, parent exists). Pagination uses
  500 items per batch with a 100 000-row hard cap. Reuses the existing
  `xlsx` (SheetJS) dependency. (#70)
- **Ctrl+K global search palette** — cmdk-style command palette
  (Ctrl+K / Cmd+K) searches anggota, buku, and peminjaman in a single
  dialog with three result groups, race-protection, `Promise.allSettled`
  fan-out, 200 ms debounce, and a sub-2-character short-circuit. Toggling
  Ctrl+K opens and closes the palette. (#72)
- **Forgot password** flow via security question — two-step lookup
  (username → security question → reset). `auth_get_security_question`
  always returns `Ok(None)` for ineligible branches (missing user /
  inactive / no question / blank) to defend against username enumeration.
  Security answers are bcrypt-hashed (cost 12) after trim + whitespace
  collapse + lowercase normalization. Wrong answers are mapped to
  `InvalidCredentials` to reuse the existing error path. New Settings tab
  lets users set or edit their security question. DB migration adds
  nullable `security_question` and `security_answer_hash` columns. (#74)
- **Backup cron scheduler** runs in a background thread that ticks every
  60 s, reads the schedule from the `settings` table, and supports cron
  5-field syntax (`*`, single, `M-N`, `A,B,C`, `*/N`). Auto-backups go to
  `<app_data>/backups/`; manual backups still go to a user-picked folder.
  Hardened with a 30 s startup grace window, an `AtomicBool` busy flag,
  minute-slot dedupe, silent no-op on cron typos, and lazy directory
  creation. Reuses the existing `backup_create_at` command. (#75)
- **Manual book as Settings tab** — replaces the flaky child-window
  WebView2 build of the manual with a `Settings → Buku Manual` tab that
  renders `docs/manual.md` inline via `react-markdown` + `remark-gfm`,
  with a generated table of contents. The Settings layout now has 13
  tabs (was 12), and the header "Buku Manual" button links to
  `/settings/manual`. (#76)
- **Richer kunjungan illustrations** — theme-aware vector art for the
  kunjungan empty state and supporting screens. (#71)
- **CHANGELOG-driven auto-release** — tag pushing `vX.Y.Z` now extracts
  the matching `## [X.Y.Z]` section from `CHANGELOG.md` via
  `scripts/extract-changelog.mjs` and uses it as the GitHub Release body,
  falling back to GitHub's auto-generated notes when no section matches.
  Pre-release tags (`-alpha` / `-beta` / `-rc`) are auto-marked as
  prereleases. README gains a "Release process" section documenting the
  flow end-to-end. (#73)
- **README v2 refresh** — README.md now documents the actual v2
  Tauri / React / pnpm 9 stack, monorepo layout, per-OS Tauri prereqs,
  build commands, data paths, and the 8 quality-gate command lineup.
  Drops the dead `pengembalian.placeholder` i18n key. (#78)
- **Manual.md v2 refresh** — `docs/manual.md` now documents v2 install
  flows (MSI + NSIS on Windows, `.deb` on Linux, `.dmg` on macOS),
  Tauri data paths, the actual Settings tab list (Identitas / KTA /
  Akun / Hak Akses / Aturan Peminjaman / Master Data / Tampilan /
  Bahasa / Backup / Sinkronisasi / Audit Log / Tentang), the in-app
  "Lupa Password?" flow, and v2 troubleshooting. (#81)
- **POST_V1_BUGS.md & PROGRESS.md status refresh** — status fields
  flipped to DONE for fixed bugs, BUG-010 / BUG-011 added,
  `INSTRUCTION_TEMPLATE.md` synced, and PROGRESS.md gains a
  post-v1.0.1 status section plus a post-migration cleanup section
  in the migration record. (#67, #82, #83)
- **Smoke-test-v2 SKILL.md** — agent-facing skill notes for smoke
  testing the v2 Tauri app. (#52)

### Changed

- **Header search** — replaces the placeholder input that navigated to
  `/anggota?q=...` on Enter with a `<button>` that opens the new
  `GlobalSearchDialog` (Ctrl+K). (#72)
- **Rust formatting** — `commands/buku.rs` and `db/mod.rs` re-formatted
  with rustfmt; cosmetic only. (#77)
- **Cargo.toml** — deduplicated the `[dev-dependencies]` block on `main`
  after PR #69 and PR #70 each appended `tempfile = "3"` and squash-merge
  produced a duplicate key that broke `cargo check` / `clippy` / `test`. (#87)
- **Migration archive** — `docs/migration-v2/` moved to
  `docs/archive/migration-v2/` to mark the migration as completed. (#85)
- **`release-v2` CI job** — extracts the release body from `CHANGELOG.md`
  before calling `softprops/action-gh-release@v2`, falling back to
  auto-generated notes when no section matches the tag. (#73)

### Fixed

- **BUG-008** — Dashboard "Total Buku" KPI now shows the actual book
  titles plus the eksemplar sub-line instead of the previous mislabeled
  count. (#68)
- **Manual book WebView2 child-window flakiness** — replaced the
  child-window approach with the inline Settings tab so the manual
  always renders, regardless of WebView2 version. (#76)

### Removed

- **v1 Python codebase** deleted entirely (253 files, ~24 500 lines):
  `src/perpustakaan/` Python source, `tests/` pytest suite, `pyproject.toml`,
  `requirements.txt`, `build.spec`, `build.bat`, `installer/` Inno Setup,
  `assets/` v1 illustration PNGs, six Python utility scripts,
  `scripts/migrate-v1-to-v2.mjs` and its test, the disabled v1 CI workflow,
  and v1 docs (`quickstart.md` / `quickstart.pdf`, screenshots, smoke-test
  report, demo screencast, google-sheets-setup). v1 history remains
  accessible via `git log --all`. The Google Sheets sync feature is gone
  permanently — v2 ships the backup scheduler instead. (#80)
- **`apps/manual/` package** removed (`build.mjs`, `package.json`,
  `commands/manual.rs`, `lib/manual.ts`, etc.) — superseded by the
  Settings → Manual tab. (#76)
- **Dead i18n key** `pengembalian.placeholder` removed from `id` and `en`
  locale files. (#78)

## [1.0.1] - 2026-05-04

### Fixed

- **BUG-001**: `buku_create` now inserts the initial eksemplar row so freshly
  created books are immediately borrowable.
- **BUG-002**: introduced `formatTauriError` helper and swept all call sites
  so users see actionable messages instead of `[object Object]`.
- **BUG-003**: Anggota dropdowns (Kelas / Jurusan / Agama) now read from the
  master tables and merge distinct values from existing rows.
- **BUG-004**: fresh installs seed all 10 DDC main classes so the buku form
  dropdown is populated on first launch.
- **BUG-005**: a default KTA template row is seeded on first launch so "Cetak
  KTA" is usable without manually creating a template first.
- **BUG-006**: header breadcrumb now tracks sub-routes (e.g.
  `Laporan / Backup`) instead of only the top-level segment.
- **BUG-007**: Backup tab + `backup_create` now point at `perpustakaan-v2.db`
  (the runtime DB) instead of the legacy v1 filename.
- **BUG-010 / BUG-009**: Buku Manual window redesigned and CSS/JS externalized
  to comply with Tauri 2 CSP. Inline assets bundled into the HTML so the
  manual window also renders correctly on Windows.
- **BUG-011**: system tray + close-behavior setting + clean process exit so
  closing the X button no longer leaves zombie WebView2 processes.

## [1.0.0] - 2026-05-03

### Added

- Initial v2 stable release, completing the 12-session migration from
  Python + customtkinter (v1) to **Tauri 2 + React 18 + TypeScript +
  Tailwind 3 + shadcn/ui + Zustand + Vite + pnpm + Vitest + Playwright**.
- Full feature parity with v1 plus modernized UI: login, dashboard, anggota
  CRUD with autocomplete, buku CRUD with master data, peminjaman/pengembalian
  with date pickers, kunjungan tracking, laporan (grafik / top peminjam /
  top buku / kas / backup), KTA template editor with QR + auto-fill, and
  Settings (12 categories) including audit log viewer and bilingual ID/EN.
- Tauri MSI + NSIS Windows installer with logo, license, and asset bundle.
- CI v2 pipeline: lint + typecheck + Vitest, Rust check + clippy, Windows
  installer build, and GitHub Release publish on tag push.
