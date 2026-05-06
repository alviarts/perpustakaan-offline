# v1.1.0 — Session Audit Log

Append-only log of every Devin session that touched this batch.
Serves as the "who did what when" for cross-session debugging.

**Format:**

```
- session_id: devin-<uuid>
  status:    STARTED | PR_OPEN | PAUSED | COMPLETED | PAT_ROTATED
  item:      <ITEM-ID> | RELEASE | (none)
  pr:        #NNN | -
  started_at:   <ISO-8601 UTC>
  paused_at:    <ISO-8601 UTC>          # only on PAUSED
  completed_at: <ISO-8601 UTC>          # only on COMPLETED
  notes:     <one-line free-form>
```

---

## Entries

- session_id: devin-7ade6502dcdd44d7a8e8a7103ff82a54
  status:    HANDOFF_AUTHORED
  item:      (none)
  pr:        -
  started_at:   2026-05-06T19:00Z
  notes:     Wrote v1.1.0 handoff after shipping v1.0.12. The session
             also drafted apps/desktop/src/features/sirkulasi/ScanSearchInput.tsx
             as the v1.0.13 starter; that file is committed under a
             wip: prefix on this branch and is the seed for
             FEAT-Sirkulasi-Search.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      BUG-Pengembalian-DendaDup
  pr:        #145
  started_at:   2026-05-06T20:48Z
  completed_at: 2026-05-06T20:57Z
  notes:     Extracted apps/desktop/src/lib/dendaPresets.ts helper +
             refactored PengembalianPage + added 7-test unit file at
             apps/desktop/tests/unit/dendaPresets.test.ts. Local gates
             green (typecheck/lint/i18n:lint/test 512✓/build), CI green
             (Lint+Typecheck+Test + Rust check), squash-merged via PAT.
             Helper is exported with default constants ready for
             FEAT-Peminjaman-DendaInline to import.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    SCOPE_EXPANDED
  item:      (none)
  pr:        -
  started_at:   2026-05-06T21:05Z
  notes:     User redirected mid-batch to add 6 "biar mantap" features
             before release. Appended A1-CommandPalette, A2-SkeletonScreens,
             C1-LaporanEksekutifPDF, D1-SystemHealthWidget, D5-SandboxDemoMode,
             E1-OPACBukuPilihan to PROGRESS.md (between item 8 and RELEASE),
             added full spec sections to BUGS.md, updated SESSION_HANDOFF.md
             scope summary table from 8 → 14 items + parallelism notes.
             Scope-expansion-only commit; no code changes. Resumed claim
             flow on FEAT-Peminjaman-DendaInline next.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Peminjaman-DendaInline
  pr:        '#146'
  started_at:   2026-05-06T21:08Z
  completed_at: 2026-05-06T21:21Z
  notes:     Implemented as a shared <DendaQuickPresetRow> component
             rather than duplicating JSX. PengembalianPage migrated to
             the shared component (testids preserved verbatim from
             #145); PeminjamanDetail mounts it under the existing
             peminjaman-bayar Input, gated by activeItems.length > 0.
             New tests at apps/desktop/tests/unit/dendaQuickPresetRow.test.tsx
             cover dendaPerHari = 5000 / 2000 / 0, onSelect payload
             for both kinds, and testidPrefix isolation. Local gates
             clean (typecheck/lint/i18n:lint/build + 519 tests, +7 new).
             CI green (Lint+Typecheck+Test + Rust check). Squash-merged
             via alviarts PAT (commit d67ae1c).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Dashboard-Clickable-KPI
  pr:        '#147'
  started_at:   2026-05-06T21:24Z
  completed_at: 2026-05-06T21:30Z
  notes:     Added optional href to KpiCard + InsightCard. When set
             AND loading=false, the card is wrapped in a TanStack
             <Link to={href} aria-label={label}>; loading-state
             skeletons stay non-clickable. Wired Total Anggota /
             Total Buku / Buku Dipinjam to /anggota /buku /peminjaman.
             Buku terlaris and Peminjam teraktif Insights link to the
             detail page of the top item (null-data falls back to
             read-only card). Static averages keep their non-clickable
             presentation. Spec note about ?status=aktif is left as a
             follow-up since the route doesnt validate search params.
             New tests at apps/desktop/tests/unit/kpiCard.test.tsx
             mock the Link to a plain anchor and cover all four
             href / loading combinations. Local gates clean (523
             tests, +4 new). CI green. Squash-merged via PAT
             (commit fd587a8).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Dashboard-Quotes-2min
  pr:        '#148'
  started_at:   2026-05-06T21:32Z
  completed_at: 2026-05-06T21:48Z
  notes:     Lowered QUOTE_ROTATE_MS from 5 min to 2 min per user
             feedback. Refactor: extracted rotation state machine to
             a useQuoteRotation hook (apps/desktop/src/features/dashboard/
             useQuoteRotation.ts) with re-entrant-safe advance() guarded
             by a leave-timeout ref. Hook returns { quoteIndex,
             quoteLeaving, advance } and is fully unit-tested with
             vitest fake timers. Added a ghost ChevronRight icon-button
             next to the quote that calls advance(); same animation
             phases as the auto-rotate. Added i18n key dashboard:quote.next
             (id+en). Local gates clean (529 tests, +6 new). CI green.
             Squash-merged via PAT (commit 698eb65).
