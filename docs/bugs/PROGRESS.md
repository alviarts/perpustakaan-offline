# Post-v1.0.0 Bug Progress

Machine-parseable status table — single source of truth for which bug is next
in queue. Companion to [`POST_V1_BUGS.md`](./POST_V1_BUGS.md) (full detail) and
[`INSTRUCTION_TEMPLATE.md`](./INSTRUCTION_TEMPLATE.md) (Devin-session protocol).

## How to read this

- A future Devin session picks the **first row with `status: OPEN`** in the
  triage order below, fixes it, opens a PR, and updates the row to
  `status: IN_PR` + the `pr` URL. After the user merges, update to
  `status: DONE` + `completed_at`.
- `BUG-008` is `BLOCKED` until the user records a design decision in
  `POST_V1_BUGS.md`.
- Update the row order only if the user redirects priorities — keep it stable
  otherwise.

## Status table

| id      | title                                                          | severity     | status   | pr                                                                | completed_at | depends_on |
|---------|----------------------------------------------------------------|--------------|----------|-------------------------------------------------------------------|--------------|------------|
| BUG-009 | Buku Manual blank + cannot be closed (Windows prod CSP)        | HIGH         | IN_PR    | https://github.com/alviarts/perpustakaan-offline/pull/53          | —            | —          |
| BUG-001 | `buku_create` does not insert eksemplar rows                   | HIGH         | OPEN     | —                                                                 | —            | —          |
| BUG-005 | `kta_templates` empty on fresh install                         | HIGH         | OPEN     | —                                                                 | —            | —          |
| BUG-002 | Peminjaman error toast renders `[object Object]`               | MEDIUM       | OPEN     | —                                                                 | —            | —          |
| BUG-003 | Anggota Kelas/Jurusan dropdowns sourced from `anggota_distinct`| MEDIUM       | OPEN     | —                                                                 | —            | —          |
| BUG-004 | DDC master table empty on fresh install                        | MEDIUM       | OPEN     | —                                                                 | —            | —          |
| BUG-006 | Header breadcrumb stays on "Dashboard" for sub-routes          | MINOR        | OPEN     | —                                                                 | —            | —          |
| BUG-007 | Backup tab shows the wrong DB path                             | MINOR        | OPEN     | —                                                                 | —            | —          |
| BUG-008 | Dashboard "Total Buku" counts eksemplar, not titles            | LOW / DESIGN | BLOCKED  | —                                                                 | —            | user decision |

## Companion PRs (not bugs but landed during this work)

| pr  | title                                              | status   |
|-----|----------------------------------------------------|----------|
| #52 | docs(skills): add smoke-test-v2 SKILL.md           | open     |
| #53 | fix(manual): externalize CSS/JS for Tauri 2 prod CSP (BUG-009) | open     |
