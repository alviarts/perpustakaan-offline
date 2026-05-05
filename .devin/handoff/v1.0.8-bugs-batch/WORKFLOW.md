# v1.0.8 Bug & Feature Batch — Devin Workflow

**Audience:** future Devin sessions picking up unfinished work in this batch.
**Owner (user):** [@alviarts](https://github.com/alviarts).
**Status:** see [`PROGRESS.md`](./PROGRESS.md) for the per-item live status table.

---

## TL;DR for the next Devin

1. Read [`PROGRESS.md`](./PROGRESS.md). Pick the **first row with `status: OPEN`** that has all of its `depends_on` items in `status: DONE`.
2. Read the corresponding entry in [`BUGS.md`](./BUGS.md) for the full description, files affected, acceptance criteria, and risk notes.
3. Implement the fix on a new branch `devin/<unix-ts>-<short-slug>` off `main`.
4. Run gates locally (see "Gate checklist" below). All must pass.
5. Open a PR via `curl` to GitHub API (NOT the `git_pr` tool — see "Authentication" section below for why).
6. Wait for CI green via `git pr_checks`. Iterate on failures.
7. Update `PROGRESS.md` row to `status: IN_PR` + `pr` URL on the **v108-handoff branch** (NOT in the feature PR — same convention as v1.0.7).
8. When the user merges, update the row to `status: DONE` + `completed_at: YYYY-MM-DD` on the v108-handoff branch.
9. Pick the next OPEN row. Repeat until all DONE, then ship the release PR.

If the user redirects priorities, follow them and update `PROGRESS.md` to match. Do NOT re-order rows otherwise — the order *is* the priority.

---

## Phase ordering — IMPORTANT

The 13 items are grouped into 3 phases by dependency (full rationale in [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md)):

- **Phase 1** (PRs A–F, 11 items): independent, parallel-able. Multiple Devin sessions can chip away simultaneously.
- **Phase 2** (PR G, FEAT-26 Sheets sync): the multi-device backbone. Must finish before Phase 3.
- **Phase 3** (PR H, FEAT-27 OPAC): depends on FEAT-26 for real-time multi-device. Can ship with same-device-only fallback if Phase 2 incomplete.

The release PR (PR I) lands last after every item is merged.

---

## Authentication

GitHub PAT `GITHUB_PAT_ALVIARTS` is stored as an **org-scoped secret** and auto-injected into every Devin session. Verify with:

```bash
echo "${GITHUB_PAT_ALVIARTS:0:10}... (length: ${#GITHUB_PAT_ALVIARTS})"
# Expected: ghp_xxxxxxxx... (length: 40) for classic PAT
# Or:       github_pat_xxx... (length: 90+) for fine-grained PAT
```

**Last rotated:** 2026-05-05 (PAT prefix `ghp_c1xaCP...`). Permissions verified: full repo admin (admin/maintain/push/triage/pull = true). Rate limit: 5000 req/hour authenticated.

**4-test verification** (run at session start to catch expired/revoked PAT early):

```bash
# Test 1 — auth /user (PAT valid + identity correct):
curl -sS -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/user | python3 -c "import sys,json; d=json.load(sys.stdin); print('login:', d.get('login'))"
# Expected: login: alviarts

# Test 2 — repo access (PAT scoped to right repo + has write access):
curl -sS -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/repos/alviarts/perpustakaan-offline | python3 -c "import sys,json; d=json.load(sys.stdin); print('perms:', d.get('permissions'))"
# Expected: perms: {'admin': True, 'push': True, ...}

# Test 3 — PR read (sanity check):
curl -sS -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/126 | python3 -c "import sys,json; d=json.load(sys.stdin); print('PR #126:', d.get('state'))"

# Test 4 — rate limit (confirms quota OK + PAT scope readable):
curl -sS -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/rate_limit | python3 -c "import sys,json; d=json.load(sys.stdin)['rate']; print('limit:', d['limit'], 'remaining:', d['remaining'])"
# Expected: limit: 5000 (anything <100 means PAT is unauth or rate-limited)
```

If any test fails, the PAT is expired/revoked/scoped wrong. Request new one via the `secrets` tool with `should_save=true, save_scope=org` and ask user to provide it. Reference [`SESSIONS.md`](./SESSIONS.md) for last-known-good rotation date.

The built-in `git_pr action="create"` tool returns "Resource not accessible by personal access token" with this PAT (limitation of the PAT type vs the tool's expected GitHub App scope). **Workaround pakai `curl` ke API langsung:**

```bash
# 1) Push branch — bypass git-manager.devin.ai which doesn't see GITHUB_PAT_ALVIARTS:
git -c "http.extraheader=" -c "credential.helper=" \
  push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" \
  <branch>:<branch>

# 2) Build PR payload via Python (cleaner JSON escaping than bash heredoc):
python3 -c "import json; print(json.dumps({
  'title': 'feat(<scope>): <short title>',
  'head': '<branch>',
  'base': 'main',
  'body': open('/tmp/pr-body.md').read()
}))" > /tmp/pr-payload.json

# 3) Create PR:
curl -sS -X POST \
  -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -d @/tmp/pr-payload.json \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls

# 4) Merge PR (after CI green + user approval):
curl -sS -X PUT \
  -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"merge_method": "squash"}' \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/<NNN>/merge
```

For viewing PRs / CI status, the read-only `git` tool works fine (`git view_pr`, `git pr_checks`).

---

## Gate checklist

Run these locally **before** pushing. All must pass:

```bash
# Frontend (apps/desktop):
pnpm typecheck
pnpm lint                               # eslint --max-warnings=0
pnpm i18n:lint                          # parity id ↔ en
pnpm test                               # vitest, target ≥272 tests after v1.0.7
pnpm build                              # vite build

# Backend (apps/desktop/src-tauri):
cd apps/desktop/src-tauri
cargo check --all-targets
cargo clippy --all-targets -- -D warnings
cargo test --lib                        # 128+ tests after v1.0.7
```

Tauri Linux build deps (one-time, persisted in env config):
```bash
sudo apt-get install -y pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev \
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev librsvg2-dev libssl-dev
```

CI checks: 2 jalan tiap PR (Lint/Typecheck/Unit Test + Rust check). 2 lainnya skipped (Build Windows installer + Publish v2 GitHub Release) — keduanya cuma jalan pada tag push, tidak perlu di-tunggu untuk PR merges.

---

## PROGRESS.md update protocol (PENTING — gampang lupa)

`PROGRESS.md` lives on the **handoff branch** (this PR), NOT on the individual feature PR branches. This avoids merge conflicts when multiple PRs are in flight.

After your feature PR gets a number (e.g. `#NNN`):

1. `git checkout devin/<ts>-v108-bugs-handoff && git pull` (this branch).
2. Edit `.devin/handoff/v1.0.8-bugs-batch/PROGRESS.md` — change the row(s) for items in your PR:
   - `status: OPEN` → `IN_PR`
   - `pr: —` → `#NNN`
3. Commit: `docs(handoff): mark <items> as IN_PR (#NNN, PR <X>)`.
4. Push to `v108-handoff` branch via PAT (see Authentication section).

After the user merges your feature PR:
- Same flow, but `status: IN_PR` → `DONE` + `completed_at: YYYY-MM-DD`.

---

## Conventions

### Branches & commits

- Branch name format: `devin/<unix-ts>-<short-kebab-slug>` (matches existing repo pattern).
- Commit message format = Conventional Commits + scope, e.g.:
  - `fix(kta): preserve foto aspect ratio in PDF export with cover-fit math`
  - `feat(peminjaman): add 1-click extend with configurable max-extensions cap`
  - `feat(sync): bidirectional Google Sheets push for anggota table`
- Co-author line REQUIRED on every commit:
  ```
  Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>
  ```

### PR description

Required sections in body:
- **Summary** — one-paragraph context + what changed.
- **Detail per item** — for each BUG/FEAT in the PR: brief description + acceptance result.
- **Review checklist** — code-review hints (e.g. "files changed: X, look at handler logic in foo.rs:42").
- **Test plan** — manual repro steps (or "covered by unit tests" if applicable).
- **Notes** — any deferred work, known limitations, or follow-ups for v1.0.9+.

Use `git_pr action="fetch_template"` to grab the repo's PR template structure, then build the body manually with the sections above.

### File-edit etiquette

- Prefer minimal edits. The repo follows existing patterns — match them.
- Don't change unrelated lines / formatting in files you touch.
- Don't bump dependencies casually. If a new dep is needed (e.g. `calamine` for Excel parsing in FEAT-19), justify in the PR body.
- Bilingual i18n: every string added in `id` MUST have an `en` counterpart. Run `pnpm i18n:lint` to verify.
- Test coverage: add unit tests for any non-trivial new logic (target: regress unit count grows with each PR).

---

## Release PR (PR I)

Run only after all 13 items are merged:

1. Branch off `main`: `devin/<ts>-release-v1.0.8`.
2. Bump version `1.0.7 → 1.0.8` in 4 files:
   - `package.json` (root)
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
3. Run `cargo check` once to update `Cargo.lock` automatically.
4. Update `CHANGELOG.md`:
   - Add `## [1.0.8] - YYYY-MM-DD` section after `## [Unreleased]`.
   - Mirror the structure of `[1.0.7]`: `### Added`, `### Fixed`, `### Notes`.
   - Each item links its PR (e.g. `(#NNN)`) and references its v1.0.8 batch ID (e.g. `(BUG-19, PR A)`).
5. Run all gates locally (see "Gate checklist" above). All must pass.
6. Commit: `chore(release): v1.0.8` with the standard Co-authored-by trailer.
7. Push + open PR via the curl flow above. Title: `chore(release): v1.0.8`. Body: short summary + reference to CHANGELOG section.
8. Wait for CI green (only the 2 active checks; release-build / publish are gated to tag push and will show as "Skipped").
9. Merge release PR via curl (squash).
10. Pull merged `main`, create annotated tag, push to trigger release-v2 workflow:
    ```bash
    git fetch origin main && git checkout main && git pull --ff-only
    git tag -a v1.0.8 -m "v1.0.8"
    git -c "http.extraheader=" -c "credential.helper=" \
      push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" \
      v1.0.8
    ```
11. Wait for the release-v2 workflow to finish (4 jobs total: lint+typecheck+unit-test, rust check, build-windows-installer, release-v2). The workflow auto-extracts the `[1.0.8]` section from `CHANGELOG.md` via `scripts/extract-changelog.mjs <tag>` and creates a GitHub Release with both Windows installers attached.
12. Update `PROGRESS.md` `RELEASE` row to `DONE` + `completed_at`.
13. Final report to user with release URL + installer asset list.

---

## Continuous push policy (NEW for v1.0.8)

**Rule:** Never let work-in-progress sit on the local box. Push early, push often.

- **Push trigger**: setiap kali local gates green (typecheck + lint + i18n:lint + test + build all pass), `git push` immediately.
- **WIP commits OK**: kalau Anda harus berhenti tengah kerja (user pause, atau context window pressure), commit dengan message `wip(<scope>): <short note>` + Co-authored-by trailer + push. Don't accumulate uncommitted code.
- **Draft PR opened early**: setelah branch punya 1+ commit pushed, **immediately** open a DRAFT PR (curl `"draft": true`). Title = same as final, body = "Work in progress, see TODO at bottom" + checklist of remaining work.
- **Draft → Ready-for-review**: hanya saat (a) semua items dalam PR group implemented, (b) final local gates clean, (c) PR description complete. Update PR via `curl PATCH` dengan `"draft": false`.
- **Why**: ensures the next Devin can see exactly where you stopped. Avoids duplicate work + "rage-quit" loss when sessions are paused.

---

## Anti-duplication / lock policy (NEW for v1.0.8)

**Rule:** Before claiming any item from PROGRESS.md, mark it as locked with your session ID. Other Devins respect the lock.

**Claim flow:**

1. Pick first OPEN row that has all `depends_on` DONE.
2. Check the row for any `IN_PROGRESS_BY_<session-id>:<timestamp>` annotation in PROGRESS.md.
3. If no annotation, or annotation is older than 24 hours: claim.
4. To claim:
   - Edit the row's `status` to `IN_PROGRESS_BY_<your-devin-session-id>:<ISO-timestamp>`.
   - Append entry to `SESSIONS.md` with `status: STARTED`.
   - Commit + push to v108-handoff branch immediately (NOT to your feature branch — same convention as v1.0.7).
5. Now you may start coding on a new feature branch.

**Release flow:**

1. After your PR is opened: edit PROGRESS.md row `status: IN_PROGRESS_BY_<id>...` → `IN_PR`. Add `pr: #NNN`. Push.
2. Update SESSIONS.md entry to `status: PR_OPEN, pr: #NNN`.
3. After user merges your PR: edit PROGRESS.md row `IN_PR` → `DONE` + `completed_at: YYYY-MM-DD`. Push.
4. Update SESSIONS.md entry to `status: COMPLETED, completed_at: YYYY-MM-DD`.

**Conflict scenarios:**

- **Active lock by another session (<24h)**: pick a different OPEN row. Don't break the lock.
- **Stale lock (>24h, no PR)**: assume abandoned, can claim. Send a non-blocking message_user noting "I'm picking up <item>, previous session <id> didn't push a PR — assuming abandoned per the 24h policy".
- **Active PR in flight (`IN_PR`)**: NEVER touch. The other session is iterating on CI / review.

---

## Pause protocol (estafet handoff) (NEW for v1.0.8)

**Trigger:** User says "pause" / "stop" / "berhenti" / "stop dulu" / "estafet" / "handoff" / similar.

**Immediate actions** (do these in order, do NOT skip steps):

1. **Stop coding**. Do not start any new edit / tool call beyond what's needed for the handoff.
2. **Commit anything uncommitted**:
   - Run `git status`. If clean, skip to step 3.
   - Otherwise: `git add -u` (NOT `git add .` — avoid stray files), commit with `wip(<scope>): pause-handoff at <short context>` + Co-authored-by trailer.
3. **Push to current branch via PAT** (see Authentication section).
4. **Open or update draft PR**:
   - If no PR yet: open draft via curl, title = final intended title, body = pickup instructions (see template below).
   - If draft PR exists: update body via `curl PATCH` to add latest pickup instructions.
5. **Update PROGRESS.md** on v108-handoff branch:
   - Row's `status` → `PAUSED` (NOT `IN_PROGRESS_BY_<id>` — explicitly mark as paused so next Devin knows lock is voluntarily released).
   - Add `pr: #NNN (draft)` if PR exists.
6. **Append to SESSIONS.md** with `status: PAUSED, paused_at: <ISO-timestamp>` + a short "Pickup instructions" paragraph.
7. **Final message to user** (single message, blocking): contain branch URL, PR URL (draft), summary of what's left, link to SESSIONS.md entry. Use `block_on_user=true` since the session is intentionally ending.

**Pickup instructions template (in PR body & SESSIONS.md entry):**

```markdown
### Pickup instructions for next Devin

**Item:** FEAT-NN — <short title>
**Branch:** `devin/<ts>-<slug>` (last commit: `<sha>`)
**State:**
- [x] Done sub-task 1
- [x] Done sub-task 2
- [ ] **TODO** sub-task 3 — <next concrete step>
- [ ] TODO sub-task 4
- [ ] TODO local gates (typecheck/lint/test/build)
- [ ] TODO update PR body, mark draft → ready-for-review

**Files in flight:**
- `apps/desktop/src/.../foo.tsx` — half-implemented `FooDialog` component, needs <X>
- `apps/desktop/src-tauri/src/.../bar.rs` — TODO write the `bar_baz` command + tests

**Gotchas:**
- <any non-obvious thing the next Devin needs to know>

**Pick up by:** read this PR + SESSIONS.md entry, checkout branch, continue from "TODO sub-task 3".
```

---

## Master automation prompt

For continuous-mode autonomous batch processing, see [`CONTINUOUS_AUTOMATION.md`](./CONTINUOUS_AUTOMATION.md). User can copy-paste that prompt to a fresh Devin session at any time to resume the batch.

---

## Reference

- v1.0.7 batch precedent: PRs #119–#125 on `alviarts/perpustakaan-offline`. Same workflow, same patterns, same release flow. If anything in this WORKFLOW is unclear, look at the v1.0.7 PR commits as live examples.
- Knowledge note "PR creation via PAT (alviarts/perpustakaan-offline)" if it exists in your session — describes the curl protocol with the exact env-var names.
