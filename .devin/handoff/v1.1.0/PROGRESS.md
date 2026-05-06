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
| BUG-Pengembalian-DendaDup       | Dedupe denda quick-button presets                        | —          | OPEN   |     |            |              |
| FEAT-Peminjaman-DendaInline     | Inline Bayar Denda + presets at PeminjamanDetail         | —          | OPEN   |     |            |              |
| FEAT-Dashboard-Clickable-KPI    | KpiCard + InsightCard become clickable links             | —          | OPEN   |     |            |              |
| FEAT-Dashboard-Quotes-2min      | Quote rotate every 2 min + manual next button            | —          | OPEN   |     |            |              |
| FEAT-Quotes-Library             | +30 perpustakaan/literasi quotes appended                | —          | OPEN   |     |            |              |
| FEAT-Sirkulasi-Search           | Wire ScanSearchInput, anggota+buku search dropdown       | —          | OPEN   |     |            |              |
| FEAT-OPAC-PostScanProfile       | Post-scan profile (loans, denda, kunjungan, reservasi)   | —          | OPEN   |     |            |              |
| FEAT-OPAC-Scan-Locked           | Scan KTA blocks if member already logged in              | FEAT-OPAC-PostScanProfile | OPEN | | | |
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
- **RELEASE** — version bump + tag push. ~30 minutes once all PRs
  are merged.

---

## Parallelism

Items 1, 2, 3, 4, 5, 6 can run in parallel (different files, no
schema overlap).

Item 7 (FEAT-OPAC-PostScanProfile) introduces SQL schema changes —
serialize. Item 8 depends on 7 and should be the last feature
before RELEASE.
