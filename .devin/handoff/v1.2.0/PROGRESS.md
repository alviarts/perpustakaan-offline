# v1.2.0 — Progress Table

This table is the source of truth for batch state. The next Devin
session reads this first and picks the first OPEN row whose
`depends_on` are all DONE.

**Edit policy:** every row update goes through a commit on the
`devin/<ts>-v120-handoff` branch (NOT a feature branch). This keeps
status changes serialized and avoids merge conflicts.

**Locking:** when claiming an item, replace `OPEN` with
`IN_PROGRESS_BY_<session-id>:<ISO-8601 timestamp>`. The next session
treats locks older than 24 h as stale and may take over.

**Status values:** `OPEN`, `IN_PROGRESS_BY_<sid>:<ts>`, `IN_PR`,
`PAUSED:<sid>:<ts>`, `DONE`.

| id        | summary                                              | depends_on  | status | pr  | started_at | completed_at |
|-----------|------------------------------------------------------|-------------|--------|-----|------------|--------------|
| RELEASE   | Bump versions to 1.2.0, push tag, publish release    | (all above) | OPEN   |     |            |              |

> **Note**: v1.2.0 starts empty. Items will be appended above the
> RELEASE row by `@alviarts` (or by Devin acting on a user report)
> as v1.1.0 is dogfooded in production. Format each new row exactly
> like the rows in `.devin/handoff/v1.1.0/PROGRESS.md` — id +
> summary + depends_on + status + pr (filled when PR opened) +
> started_at + completed_at.

---

## Notes per item

_(none yet — append spec notes here as items are added)_

---

## Phase ordering

When items are added, group them roughly into:

- **Phase 1: Bug fixes from v1.1.0 dogfooding** — ship first, no deps.
- **Phase 2: Quality-of-life polish** — small UX wins discovered while testing.
- **Phase 3: New features** — anything substantial that the user requests beyond bug fixes.

Items inside the same phase should be `depends_on = —` so they can be
claimed in parallel by multiple Devins. Cross-phase deps only when
truly needed (schema migrations that future items depend on, etc).
