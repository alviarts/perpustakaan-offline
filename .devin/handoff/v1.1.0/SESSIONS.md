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
