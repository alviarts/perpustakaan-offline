# v1.0.8 Bugs & Features Batch — Session Handoff

> Welcome, future Devin. This is your starting point for the v1.0.8 batch.
> Read this file end-to-end before touching code.

**Reporter / owner:** [@alviarts](https://github.com/alviarts) (user `vielz883`)
**Reported:** 2026-05-05 (immediately after v1.0.7 release).
**Total scope:** 14 items (1 BUG + 13 FEAT).
**Companion docs:**
- [`BUGS.md`](./BUGS.md) — full spec per item (acceptance criteria, files, risks).
- [`PROGRESS.md`](./PROGRESS.md) — live status table.
- [`WORKFLOW.md`](./WORKFLOW.md) — branch / commit / push / PR protocol.

---

## TL;DR — what to do

1. Read [`PROGRESS.md`](./PROGRESS.md). Pick the **first row with `status: OPEN`** that has all of its dependencies in `status: DONE`.
2. Read the corresponding entry in [`BUGS.md`](./BUGS.md) for full spec.
3. Implement the fix on a new branch `devin/<unix-ts>-<short-slug>` off `main`.
4. Run gates locally (see WORKFLOW.md). All must pass.
5. Open a PR via `curl` to GitHub API (NOT `git_pr` tool — see WORKFLOW.md for why).
6. Update `PROGRESS.md` row to `status: IN_PR` + add `pr` URL on a separate `v108-handoff` branch (NOT in the feature PR — same convention as v1.0.7 to avoid merge conflicts).
7. Wait for CI green via `git pr_checks`. Iterate on failures.
8. After the user merges, update `PROGRESS.md` row to `status: DONE` + `completed_at` (still on the v108-handoff branch).
9. Pick the next item. Repeat.

When all rows are DONE, ship the release PR (see WORKFLOW.md "Release PR" section).

---

## Phase ordering — IMPORTANT

The 14 items have **explicit dependencies** that gate the execution order:

### Phase 1 — Independent items (12 items, parallel-able)

These items only touch local SQLite + UI on the admin side. They can be developed in parallel by separate Devin sessions without conflicts.

| PR group | Items | Branch suggestion |
| --- | --- | --- |
| **A** | BUG-19 (foto gepeng PDF + auto-smart-fit) + FEAT-16 (10 desain KTA baru) | `devin/<ts>-pr-a-kta-foto-fit-and-presets` |
| **B** | FEAT-17 (perpanjangan) + FEAT-18 (reservasi) | `devin/<ts>-pr-b-peminjaman-extend-and-reserve` |
| **C** | FEAT-19 (bulk import anggota) + FEAT-20 (bulk import buku ISBN) | `devin/<ts>-pr-c-bulk-import-anggota-buku` |
| **D** | FEAT-21 (surat bebas pustaka) + FEAT-22 (wishlist anggota basic) | `devin/<ts>-pr-d-anggota-surat-and-wishlist` |
| **E** | FEAT-23 (stocktake / opname) + FEAT-24 (backup enhancement) | `devin/<ts>-pr-e-operasional-stocktake-backup` |
| **F** | FEAT-25 (dashboard analytics extended) | `devin/<ts>-pr-f-dashboard-analytics` |
| **J** | FEAT-28 (sirkulasi scanner overlay + decoder reliability v2) | `devin/<ts>-pr-j-sirkulasi-scanner-v2` |

### Phase 2 — Multi-device backbone (1 item, must finish before Phase 3)

| PR group | Items | Branch suggestion |
| --- | --- | --- |
| **G** | FEAT-26 (Google Sheets bidirectional auto-sync) | `devin/<ts>-pr-g-sheets-bidirectional-sync` |

This is the **largest item in the batch**. Strongly consider splitting into G1 / G2 / G3 sub-PRs (push delta → pull delta → scheduler + conflict resolution UI). See [`BUGS.md`](./BUGS.md) FEAT-26 for the suggested split.

### Phase 3 — Public-facing OPAC (1 item, depends on Phase 2)

| PR group | Items | Branch suggestion |
| --- | --- | --- |
| **H** | FEAT-27 (OPAC public-mode + kiosk fullscreen + dual-UI) | `devin/<ts>-pr-h-opac-public-mode` |

OPAC depends on FEAT-26 because the multi-device use case (admin PC + tablet OPAC) requires Sheets sync as the data backbone. If FEAT-26 is partially shipped (push only), OPAC can launch with **same-device-only mode** as a fallback (UI works, multi-device deferred).

### Final

| PR group | Items | Branch suggestion |
| --- | --- | --- |
| **I** | release v1.0.8 (version bumps + CHANGELOG) | `devin/<ts>-release-v1.0.8` |

---

## Why this ordering

- **Phase 1 first** because no item blocks another. Multiple Devin sessions can chip away in parallel safely.
- **Sheets sync (FEAT-26) before OPAC (FEAT-27)** because the user explicitly chose Google Sheets as the multi-device sync mechanism (vs LAN HTTP). OPAC's value proposition (real-time catalog on a separate tablet) requires the sync working.
- **Release last** to bundle everything into one v1.0.8 GitHub release.

---

## Authentication & PR-creation protocol

GitHub PAT `GITHUB_PAT_ALVIARTS` is stored as an **org-scoped secret** and is auto-injected into every Devin session for this org. The built-in `git_pr action="create"` tool **does not work** with this PAT (returns "Resource not accessible by personal access token") — use `curl` to GitHub API directly. Full protocol in [`WORKFLOW.md`](./WORKFLOW.md).

---

## Risk register

- **Sheets API quota**: free tier = 100 read req per 100 sec per user. For a school-scale library (50-500 students, ~1000-5000 books), polling every 1-5 minutes is well within budget. But if 5+ devices poll simultaneously, design batched reads (single sheet fetch returns all tables).
- **Conflict resolution**: bidirectional sync with multiple writers needs deterministic conflict policy. Default proposed: **last-write-wins per row** with `updated_at` timestamps. Admin device gets tie-break priority on identical timestamps. Document this in FEAT-26 acceptance.
- **Kiosk lock on Windows**: disabling Alt-Tab / Ctrl-Alt-Del completely is impossible without admin Group Policy. OPAC kiosk should disable what's possible at the Tauri window level (F11, Alt+F4, Esc, decorations) and accept that a determined student can still escape via Ctrl-Alt-Del → Task Manager. Document this limitation in FEAT-27.
- **OPAC + Sheets sync = potential data leak**: Sheets is the cloud backbone; if a user's spreadsheet is publicly shared by mistake, all anggota data leaks. Document a **strong warning** in the Sinkronisasi setup wizard — recommend "Restricted (people with link can't access)" sharing setting.
- **Bulk import anggota** must validate `kode_anggota` (NIS) uniqueness — duplicate-prevention pre-check on the entire spreadsheet is required, otherwise insert errors mid-batch leave a half-imported state.
- **Bulk import buku ISBN** requires internet (Open Library / Google Books). If WiFi down at the school, the feature is unusable — show a clear "offline" indicator in the import dialog instead of timing out silently.

---

## Reference

- v1.0.7 batch as precedent: PRs #119–#125 on alviarts/perpustakaan-offline. Same workflow, same PROGRESS.md pattern, same release flow.
- Last main commit at handoff start: see PR for handoff doc itself.
- The release workflow `.github/workflows/ci-v2.yml` auto-extracts the `[1.0.8]` section from `CHANGELOG.md` on tag push and creates a GitHub Release with installer assets attached. No manual changelog extraction needed.
