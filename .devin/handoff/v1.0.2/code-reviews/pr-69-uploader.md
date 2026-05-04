# Code Review — PR #69: Photo + Cover + Logo File Picker

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/69
**Branch:** `devin/1777894097-photo-uploader-deferred` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 20 files, +1019 / -40 (net +979)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve with comments**

This is a thoughtful, defensively-coded asset uploader. The path-traversal protections are explicit and tested, the storage layout is sane, the frontend has proper race-condition handling, and the legacy-data passthrough preserves existing v1 absolute paths in the DB. Three observations to record — none block merge, two are pure heads-ups for future maintenance.

---

## What this PR does

Closes the deferred "photo + cover + logo" inputs from session 5. Previously `anggota.foto_path`, `buku.cover_path`, and `identity.logo_path` were free-form text fields. This PR replaces them with a real OS file dialog → save-under-app-data → preview pipeline.

### Backend (`apps/desktop/src-tauri/src/commands/assets.rs`, 402 lines)

3 new Tauri commands (registered in `lib.rs:99–101`):

1. **`assets_save(category, src_path) → SaveResult { relPath, absPath }`** — copies the source file under `<app_data_dir>/uploads/<category>/<slug>-<timestamp_ms>.<ext>` and returns the relative path that gets persisted in SQLite plus the absolute path so the frontend can immediately render a preview.
2. **`assets_resolve(rel_path) → String`** — turns a stored relative path into an absolute filesystem path for `convertFileSrc()` consumption. Legacy absolute paths in DB pass through unchanged.
3. **`assets_delete(rel_path) → ()`** — best-effort delete of an upload that lives under `<app_data>/<rel_path>`. Absolute / legacy paths intentionally left untouched.

### Validation layers (defense-in-depth)

- **Category allow-list** (`validate_category`, `commands/assets.rs:59–73`): exactly one of `anggota`, `buku`, `identitas`; ASCII alphanumeric / `-` / `_`; ≤ 32 chars.
- **Extension allow-list** (`ALLOWED_EXTS`, line 31): `png, jpg, jpeg, webp, gif, svg, bmp`. Caller-provided extension is lowercased before check.
- **Max file size** (`MAX_BYTES`, line 37): 10 MiB. Documented as well below the WebView2 / `asset://` rendering limit.
- **Path traversal** (`validate_rel_path`, line 76):
  - Rejects `..` anywhere in the path
  - Rejects absolute paths (leading `/` or `\`)
  - Rejects Windows drive-letter prefixes (`C:\`)
- **Slugify** (`slugify_stem`, line 97): ASCII alphanumeric only; collapses runs of non-alnum chars to `-`; trims trailing `-`; max 40 chars; fallback to `"file"` for fully-stripped input.

### Storage layout

```
<app_data_dir>/
  uploads/
    anggota/<slug>-<timestamp_ms>.<ext>
    buku/<slug>-<timestamp_ms>.<ext>
    identitas/<slug>-<timestamp_ms>.<ext>
```

The DB stores the relative path (e.g. `"uploads/anggota/andi-1777894097.jpg"`) so the data is portable across OS-specific app-data locations.

### Tauri configuration (`tauri.conf.json:24–32`)

- Enables `assetProtocol` with scope tightly limited to `$APPDATA/uploads/**` + `$APPLOCALDATA/uploads/**`. The pre-existing CSP already had `asset:` and `https://asset.localhost` allowed in `img-src`.

### Cargo (`apps/desktop/src-tauri/Cargo.toml:14, 35–37`)

- `tauri` features expanded: `+ "image-png"`, `+ "protocol-asset"`.
- New dev-dep: `tempfile = "3"` (for the pure-helper unit tests).

### Frontend

- **`FilePickerInput.tsx`** (186 lines) — a reusable component owning the dialog → save → preview pipeline. Callers see a single `value: string | null` in/out. Includes:
  - Preview thumbnail (square or rounded for member photos)
  - Busy state with `Loader2` spinner
  - Race-protection via `requestId.current` so a fast `value` change doesn't write a stale preview URL
  - Best-effort cleanup of the prior file when the user replaces a photo
  - testid hooks (`<id>-pick`, `<id>-clear`, `<id>-preview`)
- **`assets.ts`** lib — wrapper over Tauri commands with a browser-mode mock that returns synthetic `mock://` URIs. Mock state is in-memory only.
- **Integrations:**
  - `AnggotaForm.tsx` (line ~252): replaces the `Input` for `fotoPath` with `<FilePickerInput category="anggota" rounded />`
  - `BukuForm.tsx` (line ~221): replaces the `Input` for `coverPath` with `<FilePickerInput category="buku" />`
  - `IdentitasPage.tsx` (line ~33): replaces the `Input` for `logoPath` with `<FilePickerInput category="identitas" />`

### i18n

- New `filePicker.{pick,clear}` keys in `common.{en,id}.json`
- Updated `fields.fotoPathHint`, `fields.coverPathHint` etc. to reflect the new picker UX
- `sections.identitas.logoPath*` strings updated

### Tests

- **Rust:** 9 `#[test]` cases in `commands/assets.rs:255+` covering:
  - `validate_category` happy path + path-char rejection
  - `validate_rel_path` rejects traversal + absolute + drive paths
  - `save_inner` success, missing source, oversize source, unsupported extension, slug-only filename fallback
  - `resolve_inner` relative join, absolute passthrough, traversal rejection
  - `delete_inner` no-op for empty/absolute/missing files, success on real file
- **Frontend:** 9 `it()` blocks in `tests/unit/filePickerInput.test.tsx` covering pick happy path, dismiss, replace + cleanup, clear, race-protection, busy state, accessibility labels.

---

## Strengths

1. **Path traversal is defended explicitly with tests.** `validate_rel_path` rejects `..`, leading `/` or `\`, and Windows drive prefixes. `validate_rel_path_rejects_traversal_and_absolutes` (line 279) verifies all four cases. This is the highest-stakes area of the PR and it's done right.
2. **Allow-list, not denylist, for both categories and extensions.** Categories are 3 hardcoded options; extensions are 7. Adding a new category or extension requires touching both the Rust allow-list and the TypeScript `AssetCategory` union (per the docstring at `lib/assets.ts:8–13`), so the contract is explicit.
3. **Slugify is rigorous.** `slugify_stem` collapses arbitrary input into safe ASCII, caps at 40 chars to fit Windows MAX_PATH on deeply nested AppData layouts, has fallback `"file"` for empty input, and trims trailing dashes after truncation. All edge cases handled.
4. **assetProtocol scope is tight.** `$APPDATA/uploads/**` + `$APPLOCALDATA/uploads/**` only — Tauri's asset bridge can't reach anything outside the uploads dir even if the frontend tries.
5. **Pure helpers + `tempfile`.** `save_inner / resolve_inner / delete_inner` take a `&Path` for `app_data` instead of an `AppHandle`, so they're cheap to unit-test against a `TempDir`. Clean separation between Tauri integration and business logic.
6. **Race-protection in `FilePickerInput`.** `requestId.current` tracks in-flight `resolve` calls so a fast `value` change after a slow filesystem resolve doesn't paint a stale preview. Subtle but correct.
7. **Best-effort cleanup of replaced files.** When the user picks a new file over an existing one, the old file gets deleted (`handlePick` at line 99–110). Failure is swallowed since a leftover file is harmless.
8. **Legacy absolute path passthrough.** v1 data in the DB with absolute paths still resolves correctly. No forced migration. `resolve_inner` line 195: `if candidate.is_absolute() { return Ok(rel_path.to_string()); }`.
9. **Browser-mode mock returns `mock://` URIs** that fail to load in `<img>`, so the placeholder icon renders. UI testable without Tauri.
10. **Filename uses `<slug>-<timestamp_ms>.<ext>`** — single-user offline app, collision basically impossible.

---

## Concerns

### 🟡 1. No magic-byte / content-type validation

The extension allow-list is enforced on the *filename*, not the file content. An attacker (or a confused user) could rename `evil.exe` to `evil.png` and the backend will happily copy it.

**Risk in this app's threat model:** very low. The file is stored under `app_data/uploads/`, never executed, only loaded via `<img src=...>`. WebView2 / Chromium will refuse to render a non-image stream as an image, so the worst case is a broken thumbnail. There is no path that hands these files to a child process or `Command::new(...)`.

**Suggestion (defense-in-depth, low priority):** the [`infer`](https://crates.io/crates/infer) crate can magic-byte-detect images in 7 lines. Adding it would catch the rename trick and fail loudly at upload time instead of silently producing a broken preview. Not a blocker.

### 🟡 2. SVG is in the allow-list

SVG files can contain `<script>` tags. The current rendering surface is `<img src=...>`, which DOES NOT execute scripts in SVG (browsers correctly sandbox image-loaded SVG). But if a future change ever embeds these via `<object>`, `<iframe>`, or directly inlines via `dangerouslySetInnerHTML`, the scripts would run.

**Risk today:** zero. **Risk for future maintainers:** a footgun.

**Suggestion (low priority):** either drop `svg` from `ALLOWED_EXTS` (cover/photo/logo are basically always raster anyway), or add a comment in `lib/assets.ts:14` next to `IMAGE_EXTS` warning future devs not to ever render these via anything other than `<img>`.

### 🟡 3. `Cargo.lock` shared with PR #70

PR #70 (anggota Excel export) also adds a Rust dep (`rust_xlsxwriter`). Both PRs modify `Cargo.toml` (line 17 / dependencies block) and produce `Cargo.lock` deltas. Whichever merges second will need to re-run `cargo build` to regenerate `Cargo.lock` — GitHub usually surfaces this as a merge conflict on the lockfile.

**Mitigation:** pure mechanical fix. The PR that rebases just runs `cargo update --workspace --offline` (or `cargo check`) to regenerate `Cargo.lock` cleanly. No actual code conflict.

### 🟢 4. `MAX_STEM_LEN = 40` + path layout fits Windows MAX_PATH

The doc-comment at `commands/assets.rs:39–41` calls out the MAX_PATH consideration. Worst case length:

```
%APPDATA%\id.alviarts.perpustakaan\uploads\anggota\<40-char-slug>-<13-digit-ts>.jpeg
```

≈ 60 chars from the user profile down. Plus the user profile prefix (e.g. `C:\Users\NameWithSomeLength\AppData\Roaming\`) ≈ 50 chars on a typical Windows install. Total ≈ 110 chars. Well under MAX_PATH 260. Fine.

### 🟢 5. Mock browser-mode `mock://` URIs are intentionally broken

`mockRpc.pickAndSave` returns paths with `mock://` scheme that won't load in any browser. This is by design (browser-mode can't read user files), and the component falls back to the placeholder icon. Just noting that anyone debugging "why is my preview blank in `pnpm dev` mode?" will find the answer in `lib/assets.ts:60–65`.

---

## Coordination with other open PRs

### 🟡 Cargo.toml / Cargo.lock — shared with PR #70

Both PRs add Rust dependencies. After whichever merges first, the other rebases its dep additions and regenerates Cargo.lock. Standard mechanical resolution.

### 🟢 `tauri::generate_handler!` (`lib.rs`) — shared with #70, #74, #75, #76

PR #69 adds 3 commands (`assets_save`, `assets_resolve`, `assets_delete`). All are additive at end-of-list. Subsequent PRs rebase by re-adding their lines.

### 🟢 `commands/mod.rs` — shared with #70, #75, #76

PR #69 adds `pub mod assets;`. Additive line. Mechanical rebase.

### 🟢 i18n JSON additions

- `common.{en,id}.json` — shared with #72 (Ctrl+K). Additive keys, end of object.
- `anggota.{en,id}.json` — shared with #70. Additive.
- `settings.{en,id}.json` — shared with #74, #76. Additive.

All resolutions are mechanical (combine both new key blocks).

### 🟢 No semantic conflicts

Unlike PR #76 ↔ PR #84, PR #69 plays nicely with everything else. Merge order does not change correctness.

---

## Summary recommendation

1. **Merge #69 — it's ready.** Path traversal defenses are correct and tested, allow-lists are tight, race conditions are handled, and the legacy-data passthrough means no migration is required.
2. **Optional follow-ups (not blockers, file separately if desired):**
   - Add magic-byte content sniffing via `infer` crate to catch extension-spoofed uploads at upload time.
   - Either drop `svg` from `IMAGE_EXTS` or comment-document the "render via `<img>` only" rule.
3. **Expect Cargo.lock conflict with PR #70.** Mechanical resolution by re-running `cargo check` post-rebase.
4. **No coordination friction** beyond the standard additive rebases against other Rust feature PRs.
