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

### Added

- `CHANGELOG.md` plus `scripts/extract-changelog.mjs` so future `vX.Y.Z` tag
  pushes publish a curated GitHub Release body instead of auto-generated notes.
- README "Release process" section that documents the tag-driven auto-release
  flow end-to-end.

### Changed

- `release-v2` job in `.github/workflows/ci-v2.yml` now extracts the release
  body from the matching `CHANGELOG.md` section before calling
  `softprops/action-gh-release@v2`. Auto-generated notes remain the fallback
  when the section is missing.

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
