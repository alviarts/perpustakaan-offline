# v1.2.0 Handoff — Master Prompt

> **Audience:** the user (`@alviarts`) and the next Devin session that
> picks up the v1.2.0 batch.
>
> **Purpose:** ship v1.2.0 with the items listed in `PROGRESS.md` and
> tag the release the same way v1.1.0 / v1.0.12 / v1.0.11 / v1.0.10
> were shipped (push tag → `release-v2` workflow → installer + GitHub
> release).

---

## **CURRENT PICKUP STATE — read this first** (updated 2026-05-07)

**v1.2.0 batch is OPEN and EMPTY.**

The user is dogfooding v1.1.0 (released 2026-05-06, tag `v1.1.0`) and
will report bugs / paper-cuts / feature requests directly. As reports
come in, append rows to `PROGRESS.md` and spec sections to `BUGS.md`,
then claim them normally.

| # | id      | status              | PR |
|---|---------|---------------------|----|
| - | RELEASE | OPEN (last in queue)| —  |

### Immediate next steps

1. **Wait for user input.** Do not invent items. The user owns the
   priority list for v1.2.0. When they report a bug or request a
   feature:
   - Append a new row in `PROGRESS.md` *above* the RELEASE row.
   - Add a `## <item-id>` section in `BUGS.md` with full spec (files
     affected, acceptance criteria, risks).
   - Commit + push to the v120-handoff branch with message
     `chore(handoff): add <item-id> to v1.2.0 backlog`.
   - Then claim the item normally per the loop below.
2. **Once at least 1 item is shipped**, run RELEASE row anytime the
   user wants a quick patch release (don't have to wait for a "full
   batch").

### Environment notes (saves you time)

- **System packages required for Rust check** (`apt-get install -y
  pkg-config libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev`).
  Likely already cached in your snapshot — verify with
  `pkg-config --version`.
- **Rust toolchain**: stable (`rustup default stable`). The pinned
  `dlopen2_derive 0.4.1` in `Cargo.lock` keeps the build green on
  Rust < 1.85.
- **PAT**: `GITHUB_PAT_ALVIARTS` is org-scoped and saved. If absent,
  request via `secrets` tool with `should_save=true`,
  `save_scope=org`, `secret_name=GITHUB_PAT_ALVIARTS`.

---

## TL;DR — paste this prompt to a fresh Devin session to start

```
Pick up the v1.2.0 batch on alviarts/perpustakaan-offline in continuous
autonomous mode.

>>> READ THIS FIRST — DO NOT SKIP <<<
Open .devin/handoff/v1.2.0/SESSION_HANDOFF.md and read the
"CURRENT PICKUP STATE" block at the very top. v1.2.0 starts EMPTY —
items are added by @alviarts as they dogfood v1.1.0.

If the user has just reported a bug / feature in chat:
  1. Append a row to PROGRESS.md with status=OPEN
  2. Write a `## <item-id>` section in BUGS.md (files, criteria, risks)
  3. Commit + push to v120-handoff branch
  4. Then claim it via the normal lock protocol

If no items are open yet, wait for user input. Do NOT invent items.
>>> END READ-FIRST BLOCK <<<

## Setup

1. The repo is already cloned to /home/ubuntu/repos/perpustakaan-offline
   (per the org snapshot). If not, clone via plain HTTPS — the proxy
   handles auth.
2. Read these 4 files end-to-end, in order:
     .devin/handoff/v1.2.0/SESSION_HANDOFF.md  (this file)
     .devin/handoff/v1.2.0/WORKFLOW.md
     .devin/handoff/v1.2.0/PROGRESS.md
     .devin/handoff/v1.2.0/SESSIONS.md
3. Read the spec for the item you claim from BUGS.md as needed.
4. Verify GITHUB_PAT_ALVIARTS is present (org-scoped). Run the
   4-test PAT verification from WORKFLOW.md "Authentication" section.
   Rotate via the `secrets` tool if expired.

## Item selection (loop)

5. From PROGRESS.md, pick the first row where ALL of these are true:
     - status == "OPEN"
     - all rows in `depends_on` have status == "DONE"
     - no IN_PROGRESS_BY_* lock younger than 24 hours
6. Claim:
     - On the v120-handoff branch, edit PROGRESS.md row OPEN →
       IN_PROGRESS_BY_<your-session-id>:<ISO-timestamp>
     - Append a SESSIONS.md entry: STARTED + your session-id +
       item-id + started_at.
     - Commit `chore(handoff): claim <item-id> as <session-id>`.
     - Push to v120-handoff via PAT.

## Implementation

7. Read the corresponding section in BUGS.md for the item you
   claimed.
8. Create a NEW feature branch from main:
     git checkout main && git pull
     git checkout -b devin/<unix-ts>-<short-slug>
   Feature branches always branch from main, NOT from v120-handoff.
9. Implement the item.
10. Continuous push policy: every time local gates are green
    (typecheck, lint, i18n:lint, test, build all pass), commit + push
    to your feature branch. WIP commits OK with `wip:` prefix.
11. Open DRAFT PR early (after first push). Title = final intended
    title. Body = "Work in progress, see TODO at bottom" + checklist
    of remaining sub-tasks.
12. Iterate. Each meaningful sub-task done → commit + push. Update
    PR body TODO checklist as you go.

## Completion

13. When the item is fully implemented + all local gates clean:
      - Convert draft → ready-for-review (curl PATCH or GraphQL).
      - Wait for CI green via `git pr_checks`.
14. On v120-handoff branch:
      - Edit PROGRESS.md row IN_PROGRESS_BY_* → IN_PR + pr: #NNN.
      - Update SESSIONS.md entry → PR_OPEN + pr: #NNN.
      - Commit + push.
15. Squash-merge using the alviarts PAT (the user has authorized
    Devin to merge directly — see WORKFLOW.md "Merge policy").
16. On v120-handoff branch:
      - PROGRESS.md row IN_PR → DONE + completed_at.
      - SESSIONS.md entry → COMPLETED + completed_at.
      - Commit + push.
17. Loop back to step 5.

## Release (after items ready to ship)

18. Bump versions to 1.2.0 in:
      package.json (root)
      apps/desktop/package.json
      apps/desktop/src-tauri/tauri.conf.json
      apps/desktop/src-tauri/Cargo.toml
      apps/desktop/src-tauri/Cargo.lock (perpustakaan-desktop entry — run `cargo update -p perpustakaan-desktop`)
    Add a `## [1.2.0]` entry to CHANGELOG.md summarising shipped
    items. Open a release PR titled `release: v1.2.0`,
    wait for CI green, squash-merge.
19. Push tag v1.2.0:
      git tag -a v1.2.0 -m "v1.2.0 — <summary>"
      git push origin v1.2.0  (use the PAT URL — see WORKFLOW.md)
    The release-v2 workflow auto-builds installer + publishes
    GitHub Release.
20. Final blocking message_user with release URL + installer
    asset list.

## Pause / redirect handling

- Pause keywords: "pause", "stop", "berhenti", "estafet", "handoff",
  "tunggu dulu". On pause: commit `wip(<scope>): pause-handoff at
  <context>`, push, open or update a draft PR with full pickup
  instructions, mark PROGRESS.md row PAUSED, blocking message_user.
- Redirect ("kerjakan FEAT-X dulu"): pause current item, claim the
  redirected item directly.
- Non-pause non-redirect chat: acknowledge briefly via non-blocking
  message_user, continue current item.

## Communication

- Non-blocking message_user when:
    - Item PR ready for review.
    - Item merged + starting next.
    - Non-fatal issue with a workaround.
- Blocking message_user only when:
    - User explicitly paused.
    - Genuinely unresolvable design decision or missing credential.
    - All items done + v1.2.0 published.
- Always include PR / branch URLs.
- Indonesian or English both fine. Be terse.
```

---

## What's already DONE before this batch

- **v1.0.0 → v1.0.12** shipped progressively. See releases page.
- **v1.1.0** shipped 2026-05-06 with **14 items** (PR #145–#158):
  - Bug: BUG-Pengembalian-DendaDup
  - Feat: Peminjaman-DendaInline, Dashboard-Clickable-KPI,
    Dashboard-Quotes-2min, Quotes-Library, Sirkulasi-Search,
    OPAC-PostScanProfile, OPAC-Scan-Locked
  - Polish: A1-CommandPalette, A2-SkeletonScreens
  - Reporting: C1-LaporanEksekutifPDF
  - Admin: D1-SystemHealthWidget, D5-SandboxDemoMode
  - OPAC: E1-OPACBukuPilihan
  - Tag: <https://github.com/alviarts/perpustakaan-offline/releases/tag/v1.1.0>

## v1.2.0 scope summary

_To be filled in as the user reports items. Maintain the table in
`PROGRESS.md` as the single source of truth — this section is just a
narrative pointer._

When you add a new item:
1. **id**: pick a stable kebab-case slug (e.g. `BUG-OPAC-CarouselFlicker`,
   `FEAT-Sirkulasi-Bulk-Return`, `POLISH-Dashboard-RowGap`).
2. **summary**: 1-line description of the user-visible behaviour change.
3. **depends_on**: usually `—`. Only set when there's a real dep (schema
   migration that future items rely on, etc).
4. **PR linkage**: leave blank when status=OPEN, fill when status=IN_PR.

Suggested tags / prefixes (not enforced):

- `BUG-` — production bug discovered while dogfooding v1.1.0.
- `FEAT-` — new functionality not in v1.1.0.
- `POLISH-` — paper-cut UX fix (no behaviour change, just visual / a11y).
- `PERF-` — measurable performance improvement.
- `DOCS-` — docs-only change (README, manual.md, etc).
- `INFRA-` — CI / build / release pipeline change.
