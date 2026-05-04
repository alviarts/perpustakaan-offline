# v1.0.3 / v1.0.4 / v1.0.5 scope proposal

The 16 items in [`backlog.md`](backlog.md) are too many to land in one
release. Proposed split:

## Milestone v1.0.3 — "post-launch bug bash" (target: same week)

Focus: visible regressions and quick UX wins. Each one fits in a
focused PR (S–M scope), so the review queue stays manageable.

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 1 | FilePickerInput preview broken | S–M | Fix scope / path normalisation; add Vitest. |
| 2 | Tooltips on icon-only buttons | S | Sweep the icon buttons across the app. |
| 4 | Date input calendar icon (position + theme-aware) | S | Touches DatePicker + AnggotaForm. |
| 5 | Peminjaman date row not responsive | S | Adjust grid breakpoints. |
| 8 | CRUD form max-width on fullscreen | S | Introduce a shared layout wrapper. |
| 14 | Installer artwork stretched | S | Re-export the four BMPs. |

Optional add-on if time permits:

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 9 | Cetak KTA — open output folder | S | Wires up an existing dependency. |

## Milestone v1.0.4 — "UX polish + brand"

Focus: features that are larger but still well-scoped.

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 3 | Auto-compress photos | M | Build on the fixed FilePicker from #1. |
| 7 | Hak Akses table readability | S | Pure CSS / structure refactor. |
| 11 | Laporan Kas editable + manual entries | L | Schema migration + new Tauri commands. |
| 12 | Dashboard quote-of-the-day + clock | S | Bundled JSON + interval. |
| 13 | Modern custom title bar | M | Tauri config + capabilities + new component. |
| 15 | Brand rename → "Perpustakaan Nusantara" | M | Cross-cutting string update. |
| 16 | User profile dialog (admin biodata) | L | Schema migration + new route. |

## Milestone v1.0.5 — "KTA template library"

| # | Item | Scope | Notes |
|---|------|-------|-------|
| 10 | KTA Template Library (10 designs + customiser) | XL | Own milestone; large surface. |

## Deferred / blocked on user input

| # | Item | Blocker |
|---|------|---------|
| 6 | Sinkronisasi Google Sheets — tutorial | Need to confirm whether the backend was dropped in v2 or is still partially wired. The fix differs depending on the answer (placeholder vs full tutorial). See [`bug-analysis.md`](bug-analysis.md#6-sinkronisasi-google-sheets). |

## Why this split?

- v1.0.3 is **only bug fixes + tiny polish**, so it can ship fast and
  be tested by vielz immediately. Every item there is reproducible in
  the v1.0.2 build that's already published.
- v1.0.4 bundles the **medium-scope features**. Each is self-contained
  and can land on its own PR, with the milestone existing mainly as a
  release-prep umbrella once the work is done.
- v1.0.5 is the **major feature** (KTA template library). Big enough
  to justify its own scope discussion before any code is written.
- Item #6 (Google Sheets sync) is held until the question of
  "is the backend still alive?" is answered — otherwise we'd be
  designing a tutorial for a non-functional form.

The user can override any of this. The tables are sorted by reported
order, not priority — feel free to re-prioritise.
