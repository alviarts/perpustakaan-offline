# v1.1.0 — Workflow Reference

This file is the operational reference for the v1.1.0 batch. The
master prompt in `SESSION_HANDOFF.md` cites specific sections here
("see WORKFLOW.md 'Authentication' section"), so all the operational
details live in one place.

---

## Authentication

### PAT secret

The user has saved a personal access token to the org as
`GITHUB_PAT_ALVIARTS`. It's auto-injected as an environment variable
into every Devin session in the org.

Required scope: `repo` (full control of private repos). Anything less
will fail squash-merge or release-tag push.

### 4-test PAT verification

Run these four checks at the start of every session before doing any
git work:

```bash
# 1. Identity check
curl -sf -H "Authorization: Bearer ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/user | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['login'])"
# Expect: alviarts

# 2. Repo access
curl -sf -H "Authorization: Bearer ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/repos/alviarts/perpustakaan-offline | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d['full_name'], d['permissions'])"
# Expect: alviarts/perpustakaan-offline {'admin': True, ...}

# 3. PR read
curl -sf -H "Authorization: Bearer ${GITHUB_PAT_ALVIARTS}" \
  "https://api.github.com/repos/alviarts/perpustakaan-offline/pulls?state=all&per_page=1" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('pulls:', len(d))"
# Expect: pulls: 1

# 4. Rate limit
curl -sf -H "Authorization: Bearer ${GITHUB_PAT_ALVIARTS}" \
  https://api.github.com/rate_limit | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('remaining:', d['resources']['core']['remaining'])"
# Expect: remaining: > 100
```

### When the PAT is expired / revoked

```
HTTP 401 Bad credentials
```

Procedure:
1. Use the `secrets` tool with `action="request"`,
   `secret_name=GITHUB_PAT_ALVIARTS`, `should_save=true`,
   `save_scope=org`. Pair it with a blocking `message_user` linking
   <https://github.com/settings/tokens> and saying scope `repo` is
   required.
2. After the user pastes the new PAT, re-run the 4-test verification.
3. Append a SESSIONS.md entry: "PAT rotated <date>, prefix
   <ghp_xxxx>".

---

## Push, PR, merge

### Pushing branches

The default `origin` URL routes through Devin's git proxy
(`git-manager.devin.ai`). Devin's bot account does **not** have push
access to `alviarts/perpustakaan-offline`, so plain
`git push origin <branch>` fails 403.

Push using the alviarts PAT directly:

```bash
git push -u "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" <branch>
```

The push sets the upstream to a URL that embeds the PAT — that's a
side-effect of using a credential URL. The next session will see the
embedded PAT in `git config`, but the PAT proxy auto-rotates and
the URL is harmless to anyone with read-only branch access. Do **not**
print the URL in PR descriptions or chat messages.

If the upstream needs to be reset to the proxy URL (e.g. for the
`git_pr` tool to find the branch), run:

```bash
git fetch origin
git branch --set-upstream-to=origin/<branch> <branch>
```

### Opening a PR

`git_pr action="create"` and `action="update"` use the Devin bot PAT
which **cannot** create PRs on alviarts repos. Always create PRs
via curl + the alviarts PAT:

```bash
python3 - <<'PY'
import json, os, urllib.request
body = open('/tmp/pr-body.md').read()
payload = {
  'title': '<PR title>',
  'head': '<feature-branch>',
  'base': 'main',
  'body': body,
  'draft': True,           # always start draft, flip ready when CI clean
}
req = urllib.request.Request(
  'https://api.github.com/repos/alviarts/perpustakaan-offline/pulls',
  data=json.dumps(payload).encode(),
  headers={
    'Authorization': f"Bearer {os.environ['GITHUB_PAT_ALVIARTS']}",
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  },
  method='POST',
)
data = json.loads(urllib.request.urlopen(req).read())
print('PR_NUMBER=', data['number'])
print('PR_URL=', data['html_url'])
PY
```

### PR template

Use the repo's `pull_request_template.md`. Fetch via
`git_pr action="fetch_template"`. The template requires `## Summary`
and `## Review & Testing Checklist for Human` sections.

### Marking PR ready for review

Devin bot PAT can't toggle draft state on alviarts repos either.
Use GraphQL via the alviarts PAT:

```bash
python3 - <<'PY'
import json, os, urllib.request
PR=143  # change
req = urllib.request.Request(
  f'https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/{PR}',
  headers={'Authorization': f"Bearer {os.environ['GITHUB_PAT_ALVIARTS']}", 'Accept':'application/vnd.github+json'},
)
node_id = json.loads(urllib.request.urlopen(req).read())['node_id']
gql = {'query':'mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest{ isDraft } } }', 'variables': {'id': node_id}}
req2 = urllib.request.Request('https://api.github.com/graphql',
  data=json.dumps(gql).encode(),
  headers={'Authorization': f"Bearer {os.environ['GITHUB_PAT_ALVIARTS']}", 'Accept':'application/vnd.github+json', 'Content-Type':'application/json'},
  method='POST')
print(urllib.request.urlopen(req2).read().decode())
PY
```

### Merge policy

The user has explicitly authorized Devin to squash-merge v1.1.0
items directly using the alviarts PAT. (See user message
"squash-merge sendiri pakai PAT" from v1.0.11 / v1.0.12 sessions.)

```bash
python3 - <<'PY'
import json, os, urllib.request
PR=143  # change
payload = {'merge_method':'squash', 'commit_title':'<short-desc> (#<NNN>)'}
req = urllib.request.Request(
  f'https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/{PR}/merge',
  data=json.dumps(payload).encode(),
  headers={'Authorization': f"Bearer {os.environ['GITHUB_PAT_ALVIARTS']}", 'Accept':'application/vnd.github+json', 'Content-Type':'application/json'},
  method='PUT')
print(urllib.request.urlopen(req).read().decode())
PY
```

Don't merge if any required check is red.

### CI

Four checks run on every PR + tag push:
1. **Lint + Typecheck + Unit Test (Node 20)** — runs on all PRs.
2. **Rust check (Tauri backend)** — runs on all PRs.
3. **Build Windows installer (Tauri MSI + NSIS)** — runs **only on
   tag push** (skipped on PRs, reported as "skipped").
4. **Publish v2 GitHub Release** — runs **only on tag push**.

Wait for green via `git pr_checks(repo, pull_number, wait_mode="all")`.
On failure, fetch logs via `git ci_job_logs(repo, job_id)` (job_id
from pr_checks output).

---

## Local gates

Run from `apps/desktop`:

```bash
pnpm typecheck
pnpm lint
pnpm i18n:lint   # NB: run from repo root, not apps/desktop
pnpm test        # vitest run
pnpm build       # tsc --noEmit && vite build
```

Or from repo root:

```bash
pnpm i18n:lint
cd apps/desktop && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

If any gate fails, fix and re-run. Do **not** push without all gates
green.

---

## Versions

`apps/desktop/package.json`, `src-tauri/tauri.conf.json`, and
`src-tauri/Cargo.toml` (plus the `perpustakaan-desktop` entry in
`Cargo.lock`) all carry the same version. Bump them together in the
release PR.

Current version on `main` after v1.0.12 ship: `1.0.12`. Target for
this batch: `1.1.0`.

---

## Release flow

After all 8 items are merged to `main`:

1. Verify `main` is fully green (all 4 CI jobs).
2. Create release branch `chore/release-v1.1.0`, bump versions, add
   `## [1.1.0]` entry to CHANGELOG.md.
3. Open PR `chore(release): v1.1.0`, wait for CI green, squash-merge.
4. Pull main locally, push tag:
   ```bash
   git fetch origin && git checkout main && git pull
   git tag -a v1.1.0 -m "v1.1.0 — <one-line summary>"
   git push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" v1.1.0
   ```
5. Wait for the `release-v2` workflow to publish the Windows
   installer (`PerpustakaanNusantara_1.1.0_x64-setup.exe` and
   `PerpustakaanNusantara_1.1.0_x64_en-US.msi`). Watch the workflow
   at <https://github.com/alviarts/perpustakaan-offline/actions>.
6. Final blocking `message_user` to the user with:
   - Release URL: `https://github.com/alviarts/perpustakaan-offline/releases/tag/v1.1.0`
   - Installer asset list with sizes.
   - One-line summary of what shipped.

---

## Branch naming

- **Handoff branch** (this batch's manifest):
  `devin/<unix-ts>-v110-handoff`. The first session in the batch
  creates this and PROGRESS.md / SESSIONS.md edits all go here. Don't
  branch features off it.
- **Feature branches**: `devin/<unix-ts>-<short-slug>` from `main`.
  Examples:
  - `devin/1778099608-bug-denda-dup`
  - `devin/1778099608-feat-peminjaman-denda-inline`
  - `devin/1778099608-feat-dashboard-clickable`
  - `devin/1778099608-feat-quotes-2min`
  - `devin/1778099608-feat-quotes-library`
  - `devin/1778099608-feat-sirkulasi-search`
  - `devin/1778099608-feat-opac-postscan`
  - `devin/1778099608-feat-opac-scan-locked`

Never push to `main` directly. Never amend / force-push merged
commits. `--force-with-lease` on your own feature branch is allowed.

---

## Pause protocol

Pause keywords (from the user): `pause`, `stop`, `berhenti`,
`estafet`, `handoff`, `tunggu dulu`.

On pause:

1. Stop all edits immediately.
2. If there are uncommitted local changes:
   ```bash
   git add -A
   git commit -m "wip(<scope>): pause-handoff at <one-line context>"
   git push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" HEAD
   ```
3. Open or update a draft PR with body:
   ```
   ## Status
   PAUSED. The user requested a pause at <ISO timestamp>.

   ## What's done
   - <bullet>
   - <bullet>

   ## What's left (TODO)
   - [ ] <task>
   - [ ] <task>

   ## Pickup
   1. Check out this branch: `git checkout <branch>`
   2. Run `pnpm install` from repo root.
   3. Read .devin/handoff/v1.1.0/BUGS.md section <ITEM-ID>.
   4. Continue from "<one-line context>".
   ```
4. On v110-handoff branch:
   - PROGRESS.md row → `PAUSED:<session-id>:<ISO-timestamp>`, add
     `pr: #NNN`.
   - Append SESSIONS.md entry → PAUSED + paused_at + pickup link.
   - Commit + push.
5. Single blocking `message_user` with:
   - Branch URL.
   - Draft PR URL.
   - One-paragraph summary.
   - Link to the pickup instructions in the PR body.

---

## When CI fails 3+ times

After 3 attempts to make CI green on the same item:

1. Send a non-blocking `message_user` listing the failure with the
   relevant log excerpt + your hypothesis.
2. Continue trying — don't stop unless explicitly asked.
3. If the failure is environmental (e.g. flaky test, network), retry.
   If structural (e.g. test asserting old behavior), update the test
   only if the user already approved or the test is your own.
