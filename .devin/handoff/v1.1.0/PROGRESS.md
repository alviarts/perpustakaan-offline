# v1.1.0 — Progress Table

This table is the source of truth for batch state. The next Devin
session reads this first and picks the first OPEN row whose
`depends_on` are all DONE.

**Edit policy:** every row update goes through a commit on the
`devin/<ts>-v110-handoff` branch (NOT a feature branch). This keeps
status changes serialized and avoids merge conflicts.

**Locking:** when claiming an item, replace `OPEN` with
`IN_PROGRESS_BY_<session-id>:<ISO-8601 timestamp>`. The next session
treats locks older than 24 h as stale and may take over.

**Status values:** `OPEN`, `IN_PROGRESS_BY_<sid>:<ts>`, `IN_PR`,
`PAUSED:<sid>:<ts>`, `DONE`.

| id                              | summary                                                  | depends_on | status | pr  | started_at | completed_at |
|---------------------------------|----------------------------------------------------------|------------|--------|-----|------------|--------------|
| BUG-Pengembalian-DendaDup       | Dedupe denda quick-button presets                        | —          | DONE   | #145 | 2026-05-06 | 2026-05-06   |
| FEAT-Peminjaman-DendaInline     | Inline Bayar Denda + presets at PeminjamanDetail         | —          | DONE   | #146 | 2026-05-06 | 2026-05-06   |
| FEAT-Dashboard-Clickable-KPI    | KpiCard + InsightCard become clickable links             | —          | OPEN   |     |            |              |
| FEAT-Dashboard-Quotes-2min      | Quote rotate every 2 min + manual next button            | —          | OPEN   |     |            |              |
| FEAT-Quotes-Library             | +30 perpustakaan/literasi quotes appended                | —          | OPEN   |     |            |              |
| FEAT-Sirkulasi-Search           | Wire ScanSearchInput, anggota+buku search dropdown       | —          | OPEN   |     |            |              |
| FEAT-OPAC-PostScanProfile       | Post-scan profile (loans, denda, kunjungan, reservasi)   | —          | OPEN   |     |            |              |
| FEAT-OPAC-Scan-Locked           | Scan KTA blocks if member already logged in              | FEAT-OPAC-PostScanProfile | OPEN | | | |
| A1-CommandPalette               | Extend GlobalSearchDialog with route + action commands   | —          | OPEN   |     |            |              |
| A2-SkeletonScreens              | Replace spinners with skeleton placeholders in tables    | —          | OPEN   |     |            |              |
| C1-LaporanEksekutifPDF          | One-click executive monthly report PDF                   | —          | OPEN   |     |            |              |
| D1-SystemHealthWidget           | Dashboard card: DB size, backups, reservasi, version     | —          | OPEN   |     |            |              |
| D5-SandboxDemoMode              | Toggle to switch app to a sandboxed demo DB              | —          | OPEN   |     |            |              |
| E1-OPACBukuPilihan              | OPAC featured-books carousel (admin-pinned, auto-rotate) | —          | OPEN   |     |            |              |
| RELEASE                         | Bump versions to 1.1.0, push tag, publish release        | (all above) | OPEN   |     |            |              |

---

## Notes per item

- **BUG-Pengembalian-DendaDup** — small, contained. ~30 minutes.
  No new tests needed beyond a tiny check that buttons are unique.
- **FEAT-Peminjaman-DendaInline** — touches PeminjamanDetail.tsx
  + reuses helpers from PengembalianPage. ~1 hour.
- **FEAT-Dashboard-Clickable-KPI** — KpiCard becomes a
  conditionally-clickable wrapper. ~45 minutes.
- **FEAT-Dashboard-Quotes-2min** — 1-line constant change + small
  UI add. ~30 minutes.
- **FEAT-Quotes-Library** — content-only edit + i18n parity check
  not relevant. ~30 minutes.
- **FEAT-Sirkulasi-Search** — biggest UI piece. Wire existing WIP
  ScanSearchInput, write tests for search debounce + USB scanner
  behavior + keyboard nav. ~3-4 hours.
- **FEAT-OPAC-PostScanProfile** — biggest by far: introduces a
  schema migration (reservasi table), Rust RPCs, OPAC profile UI,
  active-loans query, kunjungan auto-create. ~4-6 hours. Strongly
  recommended to assign one Devin and let it cook end-to-end.
- **FEAT-OPAC-Scan-Locked** — small. Depends on
  FEAT-OPAC-PostScanProfile so the "logout flow" matches. ~45 min.
- **A1-CommandPalette** — extends existing `GlobalSearchDialog` with
  route + action groups, plus a registry file for future actions.
  ~3-5 hours.
- **A2-SkeletonScreens** — shared `TableSkeleton` + `CardSkeleton`,
  wired into 5 list pages + OPAC grid. ~2-3 hours.
- **C1-LaporanEksekutifPDF** — new pdf module, monthly executive
  report with cover + trends + action items. ~4-5 hours. Reuse
  existing pdf-lib stack from `apps/desktop/src/lib/pdf/`.
- **D1-SystemHealthWidget** — dashboard card + thin RPC. ~2-3 hours.
- **D5-SandboxDemoMode** — schema migration, sandbox.rs cmd, settings
  page, global banner. ~5-6 hours. Schema-touching: serialize with
  E1 migration but additive so order-agnostic.
- **E1-OPACBukuPilihan** — `buku_pilihan` table + admin page +
  OPAC carousel. ~3-4 hours. Schema-touching.
- **RELEASE** — version bump + tag push. ~30 minutes once all PRs
  are merged.

---

## Parallelism

Items 1, 2, 3, 4, 5, 6 (original v1.1.0 batch) can run in parallel
(different files, no schema overlap).

Item 7 (FEAT-OPAC-PostScanProfile) introduces SQL schema changes —
serialize. Item 8 depends on 7.

Items A1, A2, C1, D1 (new from "biar mantap" batch) are independent
and can run in parallel with items 1-8.

Items D5 (sandbox) and E1 (buku_pilihan) introduce additive schema
migrations — they can run in parallel with FEAT-OPAC-PostScanProfile,
but each pair of schema-touching items must rebase main once the
sister migration merges so migration ordering is stable.

RELEASE depends on all 14 feature rows.
