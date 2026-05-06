# v1.1.0 Handoff — Master Prompt

> **Audience:** the user (`@alviarts`) and the next Devin session that
> picks up the v1.1.0 batch.
>
> **Purpose:** ship v1.1.0 with the eight items listed in `PROGRESS.md`
> and tag the release the same way v1.0.10 / v1.0.11 / v1.0.12 were
> shipped (push tag → `release-v2` workflow → installer + GitHub release).

---

## TL;DR — paste this prompt to a fresh Devin session to start

```
Pick up the v1.1.0 batch on alviarts/perpustakaan-offline in continuous
autonomous mode.

## Setup

1. The repo is already cloned to /home/ubuntu/repos/perpustakaan-offline
   (per the org snapshot). If not, clone via plain HTTPS — the proxy
   handles auth.
2. Read these 4 files end-to-end, in order:
     .devin/handoff/v1.1.0/SESSION_HANDOFF.md  (this file)
     .devin/handoff/v1.1.0/WORKFLOW.md
     .devin/handoff/v1.1.0/PROGRESS.md
     .devin/handoff/v1.1.0/SESSIONS.md
3. Read the spec for the item you claim from BUGS.md as needed.
   Don't pre-read all 8 specs.
4. Verify GITHUB_PAT_ALVIARTS is present (org-scoped). Run the
   4-test PAT verification from WORKFLOW.md "Authentication" section.
   Rotate via the `secrets` tool if expired.

## Item selection (loop)

5. From PROGRESS.md, pick the first row where ALL of these are true:
     - status == "OPEN"
     - all rows in `depends_on` have status == "DONE"
     - no IN_PROGRESS_BY_* lock younger than 24 hours
6. Claim:
     - On the v110-handoff branch, edit PROGRESS.md row OPEN →
       IN_PROGRESS_BY_<your-session-id>:<ISO-timestamp>
     - Append a SESSIONS.md entry: STARTED + your session-id +
       item-id + started_at.
     - Commit `chore(handoff): claim <item-id> as <session-id>`.
     - Push to v110-handoff via PAT.

## Implementation

7. Read the corresponding section in BUGS.md for the item you
   claimed. Each section has full file paths, acceptance criteria,
   risks.
8. Create a NEW feature branch from main:
     git checkout main && git pull
     git checkout -b devin/<unix-ts>-<short-slug>
   Feature branches always branch from main, NOT from v110-handoff.
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
14. On v110-handoff branch:
      - Edit PROGRESS.md row IN_PROGRESS_BY_* → IN_PR + pr: #NNN.
      - Update SESSIONS.md entry → PR_OPEN + pr: #NNN.
      - Commit + push.
15. Squash-merge using the alviarts PAT (the user has authorized
    Devin to merge directly — see WORKFLOW.md "Merge policy").
16. On v110-handoff branch:
      - PROGRESS.md row IN_PR → DONE + completed_at.
      - SESSIONS.md entry → COMPLETED + completed_at.
      - Commit + push.
17. Loop back to step 5.

## Release (after all 8 items DONE)

18. Bump versions to 1.1.0 in:
      apps/desktop/package.json
      apps/desktop/src-tauri/tauri.conf.json
      apps/desktop/src-tauri/Cargo.toml
      apps/desktop/src-tauri/Cargo.lock (perpustakaan-desktop entry)
    Add a `## [1.1.0]` entry to CHANGELOG.md summarising all 8
    items. Open a release PR titled `chore(release): v1.1.0`,
    wait for CI green, squash-merge.
19. Push tag v1.1.0:
      git tag -a v1.1.0 -m "v1.1.0 — <summary>"
      git push origin v1.1.0  (use the PAT URL — see WORKFLOW.md)
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
    - All 8 items done + v1.1.0 published.
- Always include PR / branch URLs.
- Indonesian or English both fine. Be terse.
```

---

## What's already DONE before this handoff

- **v1.0.12** is shipped. Tag `v1.0.12` is on `main`. The release-v2
  workflow has built the Windows installer and published the GitHub
  release. See <https://github.com/alviarts/perpustakaan-offline/releases/tag/v1.0.12>.
- The session that wrote this handoff started v1.0.13 (a single-item
  release for "Sirkulasi scan input also searches anggota + buku") and
  drafted `apps/desktop/src/features/sirkulasi/ScanSearchInput.tsx`
  but did **not** wire it into `SirkulasiPage` or write tests. That
  WIP file is committed to the v110-handoff branch under a `wip:`
  commit so the next Devin can decide whether to finish it as part
  of `FEAT-Sirkulasi-Search` (recommended) or scrap it and re-design.

## Why a handoff instead of finishing in-session

The previous Devin session had quota left to finish v1.0.13 alone,
but the user redirected to a larger v1.1.0 batch (8 items, including
OPAC + dashboard + database changes). That scope exceeds a single
session's reliable working window, so we lock the spec down in
`BUGS.md` and let two or more parallel Devins burn through the
items.

---

## v1.1.0 scope summary (8 items)

| # | id | summary |
|---|----|---------|
| 1 | `BUG-Pengembalian-DendaDup` | Detail Pengembalian shows duplicate "Rp 5.000 / 10.000 / 15.000" buttons because `DENDA_QUICK_MULTIPLIERS` × `dendaPerHari` collides with `DENDA_FIXED_PRESETS`. Dedupe. |
| 2 | `FEAT-Peminjaman-DendaInline` | Add the same Bayar Denda + quick presets UI from PengembalianPage to PeminjamanDetail's "Daftar Buku" section so librarians can collect a partial denda without opening Pengembalian. |
| 3 | `FEAT-Dashboard-Clickable-KPI` | KpiCard + InsightCard become clickable links: Total Anggota → /anggota, Total Buku → /buku, Buku Dipinjam → /peminjaman?status=aktif, Buku Terlaris → /buku/{id}, Peminjam Teraktif → /anggota/{id}. |
| 4 | `FEAT-Dashboard-Quotes-2min` | Lower `QUOTE_ROTATE_MS` from 5 min to 2 min. Make sure the slide-up keyframe is symmetric and visible. Add a manual "next" arrow button so users can advance. |
| 5 | `FEAT-Quotes-Library` | Append ≥ 30 new quotes about perpustakaan / buku / literasi to `apps/desktop/src/content/quotes.json`. Diverse authors (Indonesian + foreign). No duplicates. |
| 6 | `FEAT-Sirkulasi-Search` | Continue the v1.0.13 WIP: wire `ScanSearchInput.tsx` into SirkulasiPage (replacing the plain Input + Kirim form), add tests, support both pinjam (anggota + buku) and kembalikan (anggota only) modes. |
| 7 | `FEAT-OPAC-PostScanProfile` | After scan KTA: surface active loans, outstanding denda, recent history; auto-create a `kunjungan` row (attendance log); add reservasi when 0 eksemplar tersedia. New schema: `reservasi(id, buku_id, anggota_id, status, requested_at, fulfilled_at?, expires_at)`. |
| 8 | `FEAT-OPAC-Scan-Locked` | If the OPAC member banner is showing (someone is still logged in) when "Scan KTA Saya" is clicked, intercept with a dialog: "Anggota lain masih login (X) — klik Logout untuk pindah anggota." Logout button clears `member`, then opens the scan flow. |

See `BUGS.md` for full specs.

## Cross-session continuity guarantees

| Concern | Guarantee | Mechanism |
| --- | --- | --- |
| Lost code on session crash | None lost | Continuous push policy |
| Two Devins on same item | Cannot happen | PROGRESS.md lock annotation |
| Stale lock blocking work | Auto-expire 24 h | Next Devin checks timestamp |
| User pause loses context | None lost | Pause protocol commits WIP + pickup notes |
| PROGRESS.md merge conflicts | Avoided | All PROGRESS.md edits go to v110-handoff branch only |
| PAT expires mid-session | Reported | Push fails → next Devin reports → user rotates |

---

## How to use as the user

### Start the batch

Paste the master prompt above to a fresh Devin session. Devin will
pick the first OPEN item from PROGRESS.md and ship it.

### Run multiple Devins in parallel

Items 1, 2, 3, 4, 5 are independent and can be picked up in parallel
(different feature branches, different files). Item 6 depends on the
v1.0.13 WIP file already in the branch. Item 7 introduces a new
schema migration (reservasi table) and should be a single Devin.
Item 8 depends on `OpacApp.tsx` only and is small.

### Pause / resume

Type `pause` (or `stop` / `berhenti` / `estafet`) → current Devin
saves WIP, opens or updates draft PR, marks PROGRESS.md row PAUSED.
Resume by pasting the master prompt to a new session.

### Redirect priorities

"Kerjakan FEAT-X dulu" → Devin pauses current and re-claims the
specified item.

### Monitor

- `PROGRESS.md` — status table.
- `SESSIONS.md` — audit log.
- GitHub PRs list — drafts + ready PRs.
- Devin webapp Sessions tab — live view.
