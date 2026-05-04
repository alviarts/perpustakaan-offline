# Handoff v1.0.3 — Post-v1.0.2 bug bash

After v1.0.2 published (2026-05-04), the user (vielz) ran a hands-on smoke
test and reported 16 bug + UX + feature items in succession. This folder
captures the full backlog so the work can be re-analyzed and split across
multiple PRs / sessions instead of being attempted as one mega-PR.

## Files

- [`backlog.md`](backlog.md) — the 16 reported items with screenshots,
  user quotes, and an initial scope estimate per item.
- [`bug-analysis.md`](bug-analysis.md) — code-level investigation of
  the bugs (where the code lives, hypothesised root causes, and proposed
  fixes).
- [`scope-proposal.md`](scope-proposal.md) — proposed split of the 16
  items into v1.0.3 / v1.0.4 / v1.0.5 milestones.
- [`screenshots/`](screenshots/) — the screenshots vielz attached to
  each bug report (renamed for easy cross-referencing from the docs).

## Critical path

1. Land this handoff PR on `main` so future sessions / reviewers can see
   the full backlog.
2. Re-validate the bug analysis against the live app where reasonable
   (e.g. quickly start dev mode and confirm the Tauri asset protocol
   scope guess for bug #1).
3. Open the v1.0.3 milestone with the items agreed in
   `scope-proposal.md`.
4. Land each item as its own PR (one bug per PR where feasible) so the
   review queue stays manageable.
5. Once the v1.0.3 scope items are merged, run the same release prep +
   tag push flow used for v1.0.2 (CHANGELOG `[1.0.3]` section + bump
   four version files + tag push triggers CI auto-release).

## Decision points the user has already answered

- Repository: same as v1.0.2 — `alviarts/perpustakaan-offline`.
- Quality gates: the same eight gates documented in
  `.devin/handoff/v1.0.2/handoff.md` still apply. `/home/ubuntu/run-gates.sh`
  on the Devin VM runs them in order.
- Communication style: Bahasa Indonesia informal for chat updates,
  English for PR bodies / commit messages / code comments / docs.
- Review flow: the user is happy for Devin to merge their own PRs after
  CI is green and quality gates pass. They reserve the option to ask
  for a manual merge per-item.
