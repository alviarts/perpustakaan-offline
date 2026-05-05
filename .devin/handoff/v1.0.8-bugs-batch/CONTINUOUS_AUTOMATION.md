# v1.0.8 Continuous Automation — Master Prompt & Protocol

> **Audience:** the user (`@alviarts`) — copy-paste this prompt to a fresh Devin session at any time to (re)start the v1.0.8 batch in autonomous continuous mode.
>
> **Purpose:** make the batch self-perpetuating. Each Devin session picks the next available item, ships it, marks it done, picks the next one. Pauses gracefully when the user says "pause".

---

## Master prompt — copy-paste this to start a fresh Devin session

```
Continue the v1.0.8 batch on the alviarts/perpustakaan-offline repo
in continuous autonomous mode.

## Setup

1. Clone https://github.com/alviarts/perpustakaan-offline if not present in your VM.
   Checkout main, pull latest.
2. Verify GITHUB_PAT_ALVIARTS env var is present (org-scoped, auto-injected).
   Run the 4-test PAT verification from WORKFLOW.md "Authentication" section
   to confirm identity, repo access, PR read, and rate limit. If any test fails:
     - PAT is expired/revoked. Request new one via `secrets` tool with
       should_save=true, save_scope=org, secret_name=GITHUB_PAT_ALVIARTS.
     - Send blocking message_user with link to https://github.com/settings/tokens
       and the required scopes. Wait for user to paste new PAT.
     - Re-run the 4-test verification to confirm rotation worked.
     - Append SESSIONS.md entry: "PAT rotated <date>, prefix <ghp_xxx>".
3. Read these 4 files in order, end-to-end:
   - .devin/handoff/v1.0.8-bugs-batch/SESSION_HANDOFF.md
   - .devin/handoff/v1.0.8-bugs-batch/WORKFLOW.md
   - .devin/handoff/v1.0.8-bugs-batch/PROGRESS.md
   - .devin/handoff/v1.0.8-bugs-batch/SESSIONS.md
4. Read BUGS.md selectively as items become relevant — don't pre-read all 14 specs.

## Item selection (loop)

5. From PROGRESS.md, pick the first row where ALL of these are true:
   - status == "OPEN" (not IN_PROGRESS_BY_*, not PAUSED, not IN_PR, not DONE)
   - all rows in `depends_on` column have status == "DONE"
   - no IN_PROGRESS_BY_* lock younger than 24 hours

6. Claim the item:
   - On the v108-handoff branch (devin/<ts>-v108-bugs-handoff, the SAME branch
     that holds these handoff docs):
     - Edit PROGRESS.md: status "OPEN" → "IN_PROGRESS_BY_<your-devin-session-id>:<ISO-timestamp>"
     - Append to SESSIONS.md: a new entry with status=STARTED, your session-id,
       item-id, started_at timestamp.
   - Commit: `chore(handoff): claim <item-id> as <session-id>`
   - Push to v108-handoff branch via PAT (see WORKFLOW.md "Authentication" section).
   - This makes the lock visible to other Devins / the user immediately.

## Implementation

7. Read the corresponding section in BUGS.md for the item you claimed.
   This has the full spec, files affected, acceptance criteria, risks.
8. Create a NEW feature branch from main: `devin/<ts>-<short-slug>`.
   (NOT off the v108-handoff branch — feature branches always branch from main.)
9. Implement the item following the spec.
10. **Continuous push policy**: after every local-gates-green checkpoint
    (typecheck + lint + i18n:lint + test + build all pass), commit + push
    to your feature branch immediately. WIP commits OK with `wip:` prefix.
    Do NOT accumulate uncommitted code locally.
11. **Open DRAFT PR early**: as soon as you have 1+ commit pushed, open a
    draft PR via curl with `"draft": true`. Title = final intended title.
    Body = "Work in progress, see TODO at bottom" + checklist of remaining sub-tasks.
    This makes progress visible to the user even before the item is done.
12. Iterate. Each meaningful sub-task done → commit + push. Update PR body
    TODO checklist as you go.

## Completion

13. When the item is fully implemented + all local gates clean + PR description
    complete:
    - Convert draft → ready-for-review via `curl PATCH` with `"draft": false`.
    - Wait for CI green via `git pr_checks`. Iterate on failures.
14. On the v108-handoff branch:
    - Edit PROGRESS.md row: status "IN_PROGRESS_BY_*" → "IN_PR", add pr: #NNN.
    - Update SESSIONS.md entry: status=PR_OPEN, pr: #NNN.
    - Commit + push.
15. Send a non-blocking message_user with: PR link + 1-line summary
    ("Item FEAT-NN ready for review: <PR link>"). Do NOT block on user.

## After merge

16. Periodically (e.g. every 30-60 min) check via `git view_pr` if your PR is merged.
    If yes:
    - On v108-handoff branch: PROGRESS.md row IN_PR → DONE + completed_at.
    - SESSIONS.md entry: status=COMPLETED + completed_at.
    - Commit + push.
17. Loop back to step 5: pick the next OPEN item.

## Pause handling

18. If at any point the user sends a message with words: "pause" / "stop" /
    "berhenti" / "stop dulu" / "estafet" / "handoff" / "tunggu dulu":
    - STOP. Do not start any new edits.
    - Commit any uncommitted code with `wip(<scope>): pause-handoff at <context>`.
    - Push to your feature branch.
    - Open or update a draft PR with full pickup instructions
      (see WORKFLOW.md "Pause protocol" section for template).
    - On v108-handoff branch: PROGRESS.md row → PAUSED, add pr: #NNN (draft).
    - Append SESSIONS.md entry: status=PAUSED + paused_at + pickup instructions.
    - Commit + push handoff updates.
    - Send single blocking message_user with branch + PR + summary +
      pickup instructions link. Use block_on_user=true.

## Edge cases

19. If the user sends a message that is NOT a pause and NOT a redirect:
    - Acknowledge briefly (1-2 sentences) via non-blocking message_user.
    - Continue the current item. Don't context-switch unless the message
      is an explicit redirect ("ubah", "ganti", "skip ini", "kerjakan X dulu").
20. If the user redirects priorities ("kerjakan FEAT-X dulu"):
    - Apply pause protocol to current item (if any).
    - Then claim the redirected item directly. Update PROGRESS.md / SESSIONS.md
      to reflect the priority change.
21. If you genuinely cannot proceed (design ambiguity not in BUGS.md, or need
    a credential you don't have):
    - Block on user with a specific question + content_type=user_question
      with concrete options. Don't block with vague "what should I do?".
22. If gates fail after 3 iterations: send a non-blocking message_user
    explaining the failure + paste error logs. Continue trying solutions —
    don't stop unless asked.

## Termination

23. When all 14 rows + RELEASE row in PROGRESS.md are DONE:
    - Ship the release PR following WORKFLOW.md "Release PR" section.
    - After release tag pushed and v1.0.8 published on GitHub Releases:
      - Final blocking message_user with release URL + installer asset list.
      - Done.

## Communication style

- Send non-blocking message_user when:
  - You complete an item (PR ready for review).
  - You merge an item and start the next one.
  - You hit a non-fatal issue and have a workaround.
- Use block_on_user=true ONLY when:
  - User explicitly paused.
  - You need a credential / design decision you genuinely can't resolve.
  - All items are done and v1.0.8 is shipped.
- Be terse. Indonesian or English both fine.
- Always include PR/branch URLs in messages.
```

---

## Why this works

1. **Self-perpetuating**: each Devin claims, ships, picks next. No human in the loop except for merges + final release tag.
2. **No duplicate work**: PROGRESS.md lock annotations + SESSIONS.md audit log make claims atomic and visible.
3. **No lost work**: continuous push policy ensures every WIP state is reflected in GitHub. If a session crashes / context-overflows / user pauses → next Devin sees exactly where the work stopped.
4. **Graceful pause**: explicit pause protocol means the user can interrupt at any time and the batch resumes cleanly later. No "lost session state".
5. **PAT persistence**: org-scoped secret saved once, inherited by every future Devin in the org. Zero credential setup per session.

---

## How to use as the user

### Start the batch

After this handoff PR is merged (or immediately on the handoff branch), start a new Devin session and paste the master prompt above. Devin will pick up the first item and start.

### Run multiple Devins in parallel

Phase 1 has 12 independent items. You can run 2-4 Devin sessions in parallel — each will claim a different item via the lock policy. Phase 2 (FEAT-26 Sheets sync) is a single large item; assign one Devin and let it cook.

### Pause / resume

Type `pause` (or stop / berhenti / estafet) → current Devin saves state cleanly. To resume, paste the master prompt to a new Devin session. It will see PROGRESS.md `PAUSED` rows + SESSIONS.md pickup instructions and resume.

### Redirect priorities

If you want a specific item next out of order: tell the current Devin "kerjakan FEAT-XX dulu". It will pause current work and re-claim the redirected item.

### Monitor progress

- **PROGRESS.md** — status table (which items DONE / IN_PR / IN_PROGRESS_BY / PAUSED / OPEN).
- **SESSIONS.md** — audit log (which Devin worked on what, when, status).
- **GitHub PRs list** — all draft + ready PRs visible.
- **Devin webapp Sessions tab** — live view of every active session.

---

## Cross-session continuity guarantees

| Concern | Guarantee | Mechanism |
| --- | --- | --- |
| Lost code on session crash | None lost | Continuous push policy (every gate-green = push) |
| Two Devins working on same item | Cannot happen | Lock annotation in PROGRESS.md + SESSIONS.md before claim |
| Stale locks blocking work forever | Auto-expire 24h | Next Devin checks timestamp, claims if >24h |
| User pause loses context | None lost | Pause protocol commits WIP + writes pickup instructions |
| PR feedback applied to wrong commit | Cannot happen | Each Devin works on its own feature branch from main |
| PROGRESS.md merge conflicts | Avoided | All PROGRESS.md edits go to v108-handoff branch only, NOT feature PR branches |
| PAT expires mid-session | Reported | Push fails → Devin reports to user → user generates new PAT |

---

## Frequently revised sections

This document and `WORKFLOW.md` may evolve as the batch progresses. If a Devin discovers a workflow improvement (e.g. better gate order, new CI quirk), they should:

1. Apply the improvement.
2. Update `WORKFLOW.md` or `CONTINUOUS_AUTOMATION.md` in the same PR.
3. Update SESSIONS.md note: "Discovered <X>, updated WORKFLOW.md section <Y>".

This keeps the protocol live and accurate.
