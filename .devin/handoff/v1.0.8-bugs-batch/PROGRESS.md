# v1.0.8 Bug & Feature Batch — Progress Tracker

Single source of truth for which item is next. Companion to [`BUGS.md`](./BUGS.md) (full detail) and [`WORKFLOW.md`](./WORKFLOW.md) (Devin-session protocol).

## How to read this

- A future Devin session picks the **first row with `status: OPEN`** that has all of its `depends_on` items in `status: DONE`.
- After opening a PR, update the row to `status: IN_PR` and add the `pr` URL.
- After the user merges, update to `status: DONE` + `completed_at`.
- Update the row order ONLY if the user redirects priorities.
- Update PROGRESS.md on the `v108-handoff` branch (NOT on the feature PR branch). This avoids merge conflicts when multiple PRs are in flight. Same convention as the v1.0.7 batch.

## Status table

| id      | pr_group | title                                                                              | severity | status | pr  | completed_at | depends_on |
| ------- | -------- | ---------------------------------------------------------------------------------- | -------- | ------ | --- | ------------ | ---------- |
| BUG-19  | A        | KTA PDF export: foto gepeng (stretch ke aspect ratio slot, tidak preserve)        | HIGH     | PAUSED | #127 (draft) | —            | —          |
| FEAT-16 | A        | KTA: tambah 10 desain template baru (total ~20)                                    | MEDIUM   | PAUSED | #127 (draft) | —            | —          |
| FEAT-17 | B        | Peminjaman: perpanjangan otomatis (1-klik extend, max N× configurable)            | HIGH     | IN_PROGRESS_BY_devin-e87e91dd1b25420eb46e75b6d779fb27:2026-05-05T21:16:54Z | —   | —            | —          |
| FEAT-18 | B        | Buku: reservasi/booking (antrian saat buku sedang dipinjam)                       | MEDIUM   | IN_PROGRESS_BY_devin-e87e91dd1b25420eb46e75b6d779fb27:2026-05-05T21:16:54Z | —   | —            | —          |
| FEAT-19 | C        | Anggota: bulk import dari Excel/CSV (template + validasi NIS unik)                | HIGH     | OPEN   | —   | —            | —          |
| FEAT-20 | C        | Buku: bulk import via ISBN (Open Library / Google Books fetch metadata)           | MEDIUM   | OPEN   | —   | —            | —          |
| FEAT-21 | D        | Anggota: cetak surat keterangan bebas pustaka (auto-generate PDF saat eligible)   | MEDIUM   | OPEN   | —   | —            | —          |
| FEAT-22 | D        | Wishlist anggota: request pengadaan buku (admin queue review)                     | LOW      | OPEN   | —   | —            | —          |
| FEAT-23 | E        | Stocktake/Opname mode: scan barcode batch + report buku missing                   | MEDIUM   | OPEN   | —   | —            | —          |
| FEAT-24 | E        | Backup enhancement: tambah cloud target (Drive/Dropbox) + history list            | LOW      | OPEN   | —   | —            | —          |
| FEAT-25 | F        | Dashboard analytics extended: chart trend mingguan/bulanan + heatmap waktu pinjam | LOW      | OPEN   | —   | —            | —          |
| FEAT-28 | J        | Sirkulasi scanner: overlay aiming + ROI decode + preprocessing + multi-decoder    | HIGH     | OPEN   | —   | —            | —          |
| FEAT-26 | G        | Google Sheets bidirectional sync (push+pull delta + scheduler + conflict resolve) | HIGH     | OPEN   | —   | —            | —          |
| FEAT-27 | H        | OPAC public-mode: kiosk fullscreen, dual-UI, scan KTA optional, admin-pwd unlock  | HIGH     | OPEN   | —   | —            | FEAT-26    |

## Phase legend

- **Phase 1 (A–F + J, items BUG-19, FEAT-16…FEAT-25, FEAT-28)** — independent, parallel-able. Pick any.
- **Phase 2 (G, FEAT-26)** — Google Sheets sync. Multi-device backbone.
- **Phase 3 (H, FEAT-27)** — OPAC public-mode. Hard-depends on FEAT-26 for multi-device functionality (can ship with same-device-only mode as fallback if FEAT-26 not ready).

## Release plan

When all rows above are DONE:

| id      | title                                               | status | pr  | completed_at |
| ------- | --------------------------------------------------- | ------ | --- | ------------ |
| RELEASE | chore(release): bump versions to v1.0.8 + CHANGELOG | OPEN   | —   | —            |

Release process (see WORKFLOW.md "Release PR" section for full detail):

1. Bump version `1.0.7 → 1.0.8` in 4 files: `package.json` (root), `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`. `Cargo.lock` updates automatically.
2. Update `CHANGELOG.md` with `[1.0.8]` section summarising all 13 items (mirror v1.0.7 entry format).
3. Open release PR, merge once CI green.
4. Tag `v1.0.8` (annotated) on merged main commit, push tag → release-v2 workflow auto-builds Windows installers (MSI + NSIS) and creates GitHub Release.
