# Code Review — PR #73: CHANGELOG-Driven Auto-Release

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/73
**Branch:** `devin/1777897427-auto-release-changelog` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 5 files, +365 / -38 (net +327)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve**

The cleanest of all the feature PRs reviewed so far. Self-contained CI hardening that improves release-note quality without changing any application behaviour. The script is small, well-documented, has 9 tests against both synthetic input and the real `CHANGELOG.md`, and the fallback path (auto-generated notes) means a regression here can't actually break a release. No coordination friction with other open PRs.

---

## What this PR does

Currently, when a `vX.Y.Z` tag is pushed to `main`, the `release-v2` job in `.github/workflows/ci-v2.yml` calls `softprops/action-gh-release@v2` with `generate_release_notes: true`, which produces a generic "list of merged commits" body. This PR replaces that with a curated body extracted from `CHANGELOG.md`, with auto-generated notes as the fallback if no matching section is found.

### New script (`scripts/extract-changelog.mjs`, 111 lines)

ESM Node script with two exported pure functions:

- **`normalizeVersion(input)`** — strips a single leading `v` (case-insensitive), trims whitespace, returns `''` for nullish input.
- **`extractSection(markdown, version)`** — parses CHANGELOG body, finds heading `## [<version>]` (with optional `- DATE`), returns text between that heading and the next `## [` heading (or EOF), with surrounding blank lines trimmed.

CLI invocation:

```bash
node scripts/extract-changelog.mjs v1.0.1
node scripts/extract-changelog.mjs 1.0.1 --file=CHANGELOG.md
```

Exit codes:
- `0` — section found, body printed to stdout
- `1` — section not found
- `2` — argument error

Heading regex: `^##\s*\[<version>\](\s|$)` — anchors `[VERSION]` exactly, allows trailing whitespace or `-` on the same line, doesn't trip over partial-match versions (e.g. searching `1.0.1` won't accidentally match `1.0.10`).

### New `CHANGELOG.md` (68 lines)

Bootstrap content:

- Top-of-file note explaining the format + how the workflow consumes it
- `## [Unreleased]` section listing what this PR adds
- `## [1.0.1] - 2026-05-04` section back-filling the v1.0.1 release with all 11 BUG-001..BUG-011 fixes
- `## [1.0.0] - 2026-05-03` section for the initial v1.0 release

### Workflow change (`.github/workflows/ci-v2.yml`, +29 functional lines)

In the `release-v2` job, before calling `softprops/action-gh-release@v2`:

1. **Setup Node** (added) — `actions/setup-node@v4` with Node 20.
2. **Extract release notes** (added, `id: changelog`) — bash step that:
   - Runs `node scripts/extract-changelog.mjs "${GITHUB_REF_NAME}"`
   - On exit 0: sets `found=true`, captures body via heredoc-delimited GITHUB_OUTPUT
   - On exit ≥1: sets `found=false`, leaves body empty, emits `::warning::` so the CI summary flags the missing section
3. **Create / update GitHub Release** — modified inputs:
   - `body: ${{ steps.changelog.outputs.body }}` (new)
   - `generate_release_notes: ${{ steps.changelog.outputs.found != 'true' }}` (toggled — now a fallback rather than the default)

The rest of the workflow file diff (53 lines) is **Prettier reformatting double-quoted YAML strings to single quotes** — purely stylistic, no functional change.

### README change

Replaces the "manual upload `.exe` to Release page (auto-release workflow di Jalur A masih TODO)" line with a full **"Release process"** section documenting:

- Step-by-step: edit CHANGELOG → bump version files → merge → push tag
- What CI does on tag push (lint-typecheck-test, rust-check, build-windows-installer, release-v2 with extract-changelog)
- Fallback behavior (auto-generated notes if section missing)
- Pre-release tagging (`-alpha`/`-beta`/`-rc` automatically marked prerelease)

Most of the rest of the README diff is **Prettier reformatting the existing v0.x history table** (column alignment / padding). The actual functional changes are concentrated in 2 spots (~35 lines).

### Tests (`apps/desktop/tests/unit/extractChangelog.test.ts`, 91 lines, 9 cases)

Three test groups:

**`normalizeVersion`:**
- `it('strips leading v and trims')`
- `it('handles nullish input')`

**`extractSection (synthetic)`** — uses inline `SAMPLE` fixture:
- `it('returns body between heading and next ## [ heading')`
- `it('accepts bare version without leading v')`
- `it('extracts the trailing section all the way to EOF')`
- `it('throws for a missing section')`
- `it('matches Unreleased heading literally')`

**`extractSection (real CHANGELOG.md)`** — reads actual file from disk:
- `it('finds the v1.0.1 section and includes BUG-001 line')` — also asserts no bleed (`expect(out).not.toMatch(/^## \[/m)`)
- `it('finds the v1.0.0 section and ends at EOF without leak')`

The "real CHANGELOG.md" group is particularly strong — it's a **regression guard** that fails if anyone ever malforms the CHANGELOG in a way that breaks the extraction contract.

---

## Strengths

1. **Pure-function script.** `normalizeVersion` and `extractSection` are pure, exported, and tested independently. The CLI wrapper is 20 lines at the bottom that isn't tested directly, but it just glues `readFileSync` + `extractSection` + `process.stdout.write`.
2. **Tested against both synthetic + real fixtures.** The synthetic tests pin behavior; the real-CHANGELOG tests catch malformed-on-merge regressions. Best of both.
3. **No-bleed guard** in the v1.0.1 test (`expect(out).not.toMatch(/^## \[/m)`) is a smart assertion — it fails loud if a future edit accidentally produces a section that swallows the next release's content.
4. **Heredoc-delimited GITHUB_OUTPUT** uses `__CHANGELOG_EOF__` sentinel — robust against multi-line bodies with arbitrary characters (including normal `EOF` text). Avoids the classic "first line of CHANGELOG breaks GHA output" footgun.
5. **`set -euo pipefail`** in the bash step. Errors fail loudly instead of silently producing empty output.
6. **Graceful fallback.** If extraction fails, `generate_release_notes` flips to `true` and the release still ships with auto-generated notes. Plus a `::warning::` so the CI summary visibly flags the missing section. **Cannot break a release.**
7. **Heading regex anchors `[VERSION]` precisely.** `^##\s*\[<v>\](\s|$)` — won't false-match `## [1.0.1.0]` (extra digits inside brackets) or `## [v1.0.1]` (the `v` is normalized away separately). Won't false-match `1.0.10` when searching for `1.0.1` because the regex requires a closing `]` immediately after.
8. **Exit codes are documented and used by CI.** `0`/`1`/`2` distinct codes mean future scripts can branch on them too.
9. **Pre-release detection preserved.** `prerelease: ${{ contains(github.ref_name, 'alpha') || ... }}` from main is unchanged. Tags like `v1.1.0-rc1` still publish as pre-release.
10. **Documentation-first.** README "Release process" section + CHANGELOG self-explanation header mean future maintainers don't have to spelunk through `.github/workflows/` to understand the flow.
11. **CHANGELOG bootstrap is high-quality.** `[Unreleased]` + `[1.0.1]` + `[1.0.0]` follow Keep-a-Changelog convention with `### Added` / `### Changed` / `### Fixed` subsections. The v1.0.1 section back-fills BUG-001..BUG-011 with line-item descriptions.

---

## Concerns

### 🟢 1. README diff has heavy Prettier reformatting noise

About 90% of the README diff is the existing v0.x history table getting Prettier-reformatted (column padding) in addition to the new "Release process" section. Hard to read in PR view.

**Risk:** zero — Prettier-reformatted tables render identically.

**Suggestion (cosmetic, not blocking):** in future similar PRs, run `pnpm format` once on `main` so the formatter pass is committed separately and feature PRs only show their actual changes. Not actionable here.

### 🟢 2. CI workflow file diff has heavy Prettier reformatting noise

53 of the 64 line-changes in `ci-v2.yml` are double-quotes → single-quotes. The actual functional changes are 11 lines (added Setup Node step + Extract step + 2 input changes on the gh-release action).

Same comment as #1 — zero risk, just review-friction.

### 🟢 3. The new "Setup Node" step uses Node 20 implicitly via `actions/setup-node@v4` default

Looking at the diff:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: 20
```

Other jobs in `ci-v2.yml` use Node 20 (`lint-typecheck-test`). Pinning Node 20 here is consistent. Just noting for completeness — there's no `.nvmrc` or `engines.node` in `package.json` that the script depends on, so anyone running `node scripts/extract-changelog.mjs` locally with Node 18+ should also work (the script uses standard ESM + `fs/promises` patterns).

### 🟢 4. `extractSection` doesn't handle CHANGELOG entries with no trailing newline at EOF

If `CHANGELOG.md` ends without a trailing `\n`, the final section's last line still gets captured because `lines.slice(start, end).join('\n').replace(/^\s+|\s+$/g, '')` trims trailing whitespace. So this works correctly. Not actually a concern; just noting it was something I checked.

### 🟢 5. No CI integration test that the workflow YAML actually runs

The script has 9 unit tests, but the workflow itself can't be unit-tested. A typo in the YAML (e.g., wrong heredoc delimiter) wouldn't be caught until the next tag push.

**Suggestion (optional, low priority):** could add a `workflow_dispatch` trigger to `release-v2` so it can be manually run on-demand for testing. Or use [act](https://github.com/nektos/act) locally. Out of scope for this PR; mentioning for awareness.

### 🟢 6. `## [Unreleased]` section is human-maintained

The CHANGELOG bootstraps `## [Unreleased]` with the contents of this PR. Future PRs will need to manually update `## [Unreleased]` before merge, then move it to `## [X.Y.Z] - YYYY-MM-DD` at release time. Standard Keep-a-Changelog discipline. The README section explicitly calls this out.

**Could automate** with conventional-changelog or release-please at some point, but those are bigger investments. The manual flow is fine for v1.

---

## Coordination with other open PRs

### 🟢 No file overlap with any other open PR

Files touched:
- `.github/workflows/ci-v2.yml` — only this PR touches it
- `CHANGELOG.md` — net-new file, no conflicts
- `README.md` — only this PR touches it (PR #78 also refreshes README, but that branch is in a different stack `#78→#80→#81` and addresses different sections / the v2 section)
- `scripts/extract-changelog.mjs` — net-new file
- `apps/desktop/tests/unit/extractChangelog.test.ts` — net-new file

### 🟡 Minor: README.md could conflict with PR #78

PR #78 ("docs: refresh README for v2 stack") also touches README.md. This PR adds a new "Release process" section. Need to check whether they overlap.

Looking at audit data:
- PR #78 touches README.md to refresh v2 stack info (Tauri + React + pnpm9)
- PR #73 touches README.md to add "Release process" section + step 8 update

These are likely in different parts of the file, but a manual rebase may be needed. **Mechanical resolution.** Audit report flagged this as low-risk overlap.

### 🟢 No semantic conflicts.

---

## Summary recommendation

1. **Merge #73 — it's ready.** The script is small, well-tested (9 cases including real-CHANGELOG regression guards), the workflow fallback ensures it can't break a release, and the documentation is thorough.
2. **No coordination friction.** Only minor mechanical overlap with PR #78 on README.md (different sections of the file).
3. **Optional follow-ups (low priority, file separately):**
   - Consider `workflow_dispatch` trigger on `release-v2` for ad-hoc manual testing.
   - Consider release-please / conventional-changelog automation in v1.x or v2 if manual `## [Unreleased]` discipline becomes a burden.
   - Run `pnpm format` once on main and commit separately, so future feature PRs don't carry Prettier reformatting noise.
4. **This PR can be merged independently** — no stack relationship, no Rust deps, no semantic conflicts. Lowest-risk merge of the entire backlog.
