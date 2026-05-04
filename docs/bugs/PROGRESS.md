# Post-v1.0.0 Bug Progress

Machine-parseable status table — single source of truth for which bug is next
in queue. Companion to [`POST_V1_BUGS.md`](./POST_V1_BUGS.md) (full detail) and
[`INSTRUCTION_TEMPLATE.md`](./INSTRUCTION_TEMPLATE.md) (Devin-session protocol).

## How to read this

- A future Devin session picks the **first row with `status: OPEN`** in the
  triage order below, fixes it, opens a PR, and updates the row to
  `status: IN_PR` + the `pr` URL. After the user merges, update to
  `status: DONE` + `completed_at`.
- Update the row order only if the user redirects priorities — keep it stable
  otherwise.

## Status table

| id      | title                                                                  | severity     | status  | pr                                                       | completed_at | depends_on    |
| ------- | ---------------------------------------------------------------------- | ------------ | ------- | -------------------------------------------------------- | ------------ | ------------- |
| BUG-009 | Buku Manual blank + cannot be closed (Windows prod CSP)                | HIGH         | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/62 | 2026-05-04   | —             |
| BUG-001 | `buku_create` does not insert eksemplar rows                           | HIGH         | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/55 | 2026-05-04   | —             |
| BUG-005 | `kta_templates` empty on fresh install                                 | HIGH         | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/56 | 2026-05-04   | —             |
| BUG-002 | Peminjaman error toast renders `[object Object]`                       | MEDIUM       | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/57 | 2026-05-04   | —             |
| BUG-003 | Anggota Kelas/Jurusan dropdowns sourced from `anggota_distinct`        | MEDIUM       | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/58 | 2026-05-04   | —             |
| BUG-004 | DDC master table empty on fresh install                                | MEDIUM       | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/59 | 2026-05-04   | —             |
| BUG-006 | Header breadcrumb stays on "Dashboard" for sub-routes                  | MINOR        | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/60 | 2026-05-04   | —             |
| BUG-007 | Backup tab shows the wrong DB path                                     | MINOR        | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/61 | 2026-05-04   | —             |
| BUG-010 | Buku Manual UI redesign + Tauri 2 CSP externalize (supersedes BUG-009) | HIGH         | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/62 | 2026-05-04   | BUG-009       |
| BUG-011 | System tray + close-behavior setting + clean process exit              | HIGH         | DONE    | https://github.com/alviarts/perpustakaan-offline/pull/63 | 2026-05-04   | —             |
| BUG-008 | Dashboard "Total Buku" counts eksemplar, not titles                    | LOW / DESIGN | IN_PR   | https://github.com/alviarts/perpustakaan-offline/pull/68 | —            | —             |

> **Hotfix follow-up:** PR [#66](https://github.com/alviarts/perpustakaan-offline/pull/66)
> (`fix(manual): inline CSS+JS into HTML`) merged on 2026-05-04 as a Windows-only
> follow-up to BUG-010 — externalized assets from #62 still left the manual
> window blank under Windows WebView2; inlining the CSS/JS proved more reliable
> than the same-origin externalization approach. Both BUG-009 and BUG-010 are
> resolved end-to-end after #66.

## Companion PRs (not bugs but landed during this work)

| pr  | title                                                                      | status                           |
| --- | -------------------------------------------------------------------------- | -------------------------------- |
| #52 | docs(skills): add smoke-test-v2 SKILL.md                                   | open                             |
| #53 | fix(manual): externalize CSS/JS for Tauri 2 prod CSP (BUG-009)             | closed (superseded by #62)       |
| #54 | docs(bugs): post-v1.0.0 bug backlog + Devin handoff template               | merged 2026-05-04                |
| #65 | chore(release): bump versions to 1.0.1                                     | merged 2026-05-04 (tag `v1.0.1`) |
| #66 | fix(manual): inline CSS+JS into HTML to fix blank manual window on Windows | merged 2026-05-04                |

## Release timeline

- `v1.0.0` (commit `46750cc`, PRs #35–#51) — initial v2 ship.
- `v1.0.1` (commit `4ed1398`, PRs #55–#66) — post-launch bug-fix bundle covering
  BUG-001..007, 009..011 (everything except the design-blocked BUG-008).
