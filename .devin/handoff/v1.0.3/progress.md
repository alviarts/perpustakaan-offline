# v1.0.3 Progress & Handoff to Next Devin Session

> Last updated: end of session 2 (paused by user). Continue where this leaves off.

## Decided scope (from `scope-proposal.md`)

User picked the **default v1.0.3 set**:

- ☑ #1 FilePickerInput preview broken (Logo / Foto Anggota / Cover Buku)
- ☑ #2 Tooltips on icon-only buttons
- ☑ #4 Date input calendar icon (position + theme-aware)
- ☑ #5 Peminjaman date row not responsive
- ☑ #8 CRUD form max-width responsive on fullscreen
- ☑ #14 Installer artwork (NSIS + WiX BMPs) — fix stretching
- ☐ #9 Cetak KTA "Buka Folder Hasil" — optional, only if time permits

Everything else (#3, #6, #7, #10, #11, #12, #13, #15, #16) defers to v1.0.4 / v1.0.5
per the original split in `scope-proposal.md`. Do NOT pick those up unless the user
re-scopes.

## What's already shipped this session

| # | PR | Status | Notes |
|---|----|--------|-------|
| #2 | [PR #90](https://github.com/alviarts/perpustakaan-offline/pull/90) | open, CI running | Tooltip wrapper sweep over 7 components. Gates 1-8 ALL OK locally. |
| #4 + #5 | [PR #91](https://github.com/alviarts/perpustakaan-offline/pull/91) | open, CI running | `color-scheme` + filter-invert fallback for date pickers; flex-wrap so "Hari Ini" can drop below; Peminjaman dates `xl:grid-cols-2`. Gates 1-8 ALL OK locally. |
| #8 | [PR #92](https://github.com/alviarts/perpustakaan-offline/pull/92) | open, **gate 5 interrupted** | `max-w-3xl xl:max-w-5xl 2xl:max-w-7xl` on Anggota/Buku new+edit routes. Gates 1-4 OK locally, build was running when user paused. CI must verify. |
| handoff | [PR #89](https://github.com/alviarts/perpustakaan-offline/pull/89) | open, **DO NOT MERGE YET** | Backlog + analysis + scope-proposal docs. This file lives here. |

## Still to ship for v1.0.3 (in order of priority)

### A. PR #14 — Installer artwork (NSIS + WiX BMPs)

User screenshots show the book/lamp logo stretched in the NSIS sidebar and the
WiX banner. Plan:

- **Re-export 4 bitmap files** at exact target resolutions (no upscaling):
  - `nsis-sidebar.bmp` — 164 × 314 px (NSIS Welcome / Finish)
  - `nsis-header.bmp` — 150 × 57 px (NSIS in-progress header)
  - `wix-banner.bmp` — 493 × 58 px (MSI top banner)
  - `wix-dialog.bmp` — 493 × 312 px (MSI dialog background)
- Source: build a master SVG with the existing brand mark proportioned correctly
  (book icon over lamp), gradient blue → white background, then render to BMP
  via headless Chromium / ImageMagick. **Do NOT** stretch a single asset across
  4 aspect ratios — that's exactly the bug.
- Files in repo:
  - `apps/desktop/src-tauri/installer/` — current BMP sources here. Replace.
  - `apps/desktop/src-tauri/tauri.conf.json` — NSIS / WiX paths referenced here.
- After re-export, rebuild the Windows installer in CI and check the resulting
  `.exe` / `.msi` artwork visually before merge.

Risk: medium — installer-only, bad output won't break the app, but the visual
reviewer must look at a screenshot of the actual installer (not just the BMP).

### B. PR #1 — FilePickerInput preview broken (Logo / Foto Anggota / Cover Buku)

This is a **bug**, not a feature. User reported all three categories don't render
the preview after upload, and Cover Buku additionally fails to upload at all.

Investigation hypothesis (from `bug-analysis.md`):

- The `FilePickerInput` component reads bytes, calls Tauri `assets_save` to copy
  the file into appdata, and then resolves the saved path back to an `asset:`
  URL via `assets_resolve`. Likely culprits:
  1. `assets_resolve` returns a path that's outside the asset protocol scope, so
     the WebView refuses to render it. Check `apps/desktop/src-tauri/tauri.conf.json`
     `app.security.assetProtocol.scope` — the saved path must be inside it.
  2. State race: the component sets `value=path` before the resolved asset URL
     is ready, so the `<img src>` falls back to the raw filesystem path which
     the WebView blocks.
  3. Cover Buku "tidak bisa upload" — the BukuForm field might be writing to a
     different store key than the one BukuList/BukuDetail reads from.

Steps to repro on dev box:
1. `pnpm tauri:dev`
2. Login → Settings → Identitas → upload Logo. Observe.
3. Open Anggota → New → upload Foto. Observe.
4. Open Buku → New → upload Cover. Observe.
5. Note exact errors in the WebView devtools network + console.

Fix scope: usually a one-line scope adjustment + an effect-ordering fix. After
the fix, **also enable client-side compression** (item #3) **only if the user
explicitly green-lights it during this PR** — otherwise defer. The handoff
proposal keeps #3 in v1.0.4, but if the user wants it bundled with the
FilePicker fix it's a reasonable add-on.

Risk: amber — touches a multi-consumer component (Identitas, Anggota, Buku).
Test all three flows manually before merge.

### C. PR #9 — Cetak KTA "Buka Folder Hasil" (OPTIONAL)

Skip if running low on time. Otherwise:

- Add a button "Buka Folder Hasil" to `CetakKtaPage` after a successful generate.
- Use `@tauri-apps/plugin-shell` (already a dependency) `open(folderPath)`.
- The folder path is what `cetak_kta` already returns / writes to. Look at the
  Tauri command body to find the exact path.

Risk: green — additive button, no schema change.

## Release v1.0.3 (after all six items merged)

1. Bump versions in:
   - `package.json` (root + `apps/desktop/package.json`)
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
2. Move `## [Unreleased]` content in `CHANGELOG.md` into a new `## [1.0.3] — YYYY-MM-DD` section. The release-please flow used for v1.0.2 should still work — verify with a dry-run if uncertain.
3. Open the version-bump PR, merge after CI green.
4. Tag: `git tag v1.0.3 && git push origin v1.0.3`
5. Verify the GitHub Release auto-publishes the Windows installers.
6. Then merge PR #89 (these handoff docs become permanent project docs).

## Quality gates

`/home/ubuntu/run-gates.sh <label>` runs all 8 gates:

1. `pnpm i18n:lint`
2. `pnpm typecheck`
3. `pnpm --filter @perpustakaan/desktop lint`
4. `pnpm --filter @perpustakaan/desktop test --run`
5. `pnpm --filter @perpustakaan/desktop build`
6. `cargo check --all-targets`
7. `cargo clippy --all-targets -- -D warnings`
8. `cargo test --lib`

All must pass before push.

## Auth note for next session

The user's GitHub PAT is saved at org scope as `GITHUB_PAT_ALVIARTS`. Use it for
push when the devin git-manager proxy returns 403 (it has been intermittent on
this repo):

```bash
git push https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git <branch>:<branch>
```

For PR creation when `git_pr(action="create")` says *"Resource not accessible by
personal access token"*, fall back to the GitHub REST API:

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d @/tmp/pr-body.json \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls
```

Then call `git_pr(action="take_over", repo, pull_number)` to rehydrate the PR
state into the session.

## Branch naming

`devin/$(date +%s)-<kebab-name>` per `~/.devin/skills/git-workflow/SKILL.md`.

## Things that bit me this session

- A leftover `apps/desktop/public/manual/index.html` (1082 lines) appeared as
  *untracked* and got swept into PR #90 by `git add -A`. I had to file a
  follow-up commit to drop it. The manual is in-app via `?raw` import; never
  commit anything under `apps/desktop/public/manual/`.
- `pnpm tauri:dev` in this VM has no display, so manual UI testing for the
  FilePickerInput bug (#1) is hard. The next session should bring up the dev
  server and use the desktop GUI to repro before patching.
