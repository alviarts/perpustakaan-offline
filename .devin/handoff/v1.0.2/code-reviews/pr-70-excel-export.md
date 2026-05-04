# Code Review — PR #70: Anggota Excel Export

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/70
**Branch:** `devin/1777895293-anggota-excel-export` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 10 files, +579 / -11 (net +568)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve with comments**

Clean, small, well-tested .xlsx export with a generic backend write helper that's reusable for future export formats. The architecture (frontend builds the bytes, backend writes them after validation) is the right shape: it keeps the file-write capability narrow on the Rust side and centralizes path/size validation. One pre-existing security caveat about the `xlsx` (SheetJS) library is worth flagging — but it doesn't affect this PR's surface area.

---

## What this PR does

Adds an "Ekspor Excel" button to the anggota list that respects the current filter (search query, kelas, jurusan, aktif status, sort order), paginates the full result set into memory, builds an in-memory workbook in JS, and persists it to disk via a generic Rust write helper.

### Backend (`apps/desktop/src-tauri/src/commands/export.rs`, 128 lines)

One Tauri command (registered in `lib.rs`):

- **`export_write_bytes(dest_path: String, bytes: Vec<u8>) → u64`** — generic helper for writing any binary blob from frontend to a user-chosen path.

The docstring explicitly motivates the design: "Centralising the write here means we never sprinkle `fs:allow-write-file` permissions across the capability set and we get a single place to enforce path / size validation." Good architectural choice — future PDF / CSV exports can reuse this same helper.

### Validation in `write_bytes_inner` (lines 22–58)

- **Non-empty payload** — rejects `bytes.is_empty()`.
- **Max payload size** (`MAX_EXPORT_BYTES = 64 MiB`, line 14) — sized for "every member + book row in a school" per docstring.
- **Absolute path required** — rejects relative paths.
- **Parent directory must exist** — early return with friendly error.
- **Parent must be a directory** (not a regular file or symlink-to-file).
- **Final write** uses `fs::write` (overwrites if exists, creates with default perms — standard "save as" semantics).

### Cargo (`apps/desktop/src-tauri/Cargo.toml:35–37`)

Just one new dev-dep: `tempfile = "3"` (for the unit tests). **No new runtime Rust dependency** — this surprised me; the .xlsx generation is entirely on the JS side.

### Frontend

- **`apps/desktop/src/lib/anggotaExport.ts`** (147 lines) — workbook builder + orchestrator:
  - `toExportRow(anggota)` flattens an Anggota into 14 stringified columns
  - `buildAnggotaWorkbookBytes(items)` uses `xlsx` (SheetJS) `utils.aoa_to_sheet` + `book_new` + `book_append_sheet` + `write({type: 'array'})` to produce a Uint8Array
  - `defaultExportFilename()` zero-pads `anggota-YYYYMMDD-HHMM.xlsx`
  - `fetchAllAnggota(filters)` paginates 500 at a time with HARD_CAP 100k as a runaway-loop guard
  - `runAnggotaExport(filters)` orchestrates: paginate → build → save dialog → invoke `export_write_bytes`. Browser-mode fallback returns synthetic `/tmp/...` path for vitest.
- **`apps/desktop/src/features/anggota/AnggotaList.tsx`** (87 lines modified):
  - Adds `<Download>` icon button with busy-state spinner
  - `handleExport` callback wires current filter state into `runAnggotaExport`
  - Toast on success (with file path) / failure (with formatted Tauri error)

### i18n

- New keys in `anggota.{en,id}.json`: `actions.export`, `feedback.exportSuccess` (with `{{count}}`), `feedback.exportError`.

### Tests

- **Rust:** 6 `#[test]` cases in `export.rs:67+` covering:
  - `rejects_empty_payload`
  - `rejects_oversize_payload`
  - `rejects_relative_path`
  - `rejects_missing_parent`
  - `writes_bytes_to_disk_byte_for_byte` (1 KB round-trip, byte equality)
  - `overwrites_existing_file`
- **Frontend:** 9 `it()` blocks in `tests/unit/anggotaExport.test.ts`:
  - 3 for `toExportRow` (snake_case mapping, "Aktif"/"Nonaktif" label, null → empty string)
  - 3 for `buildAnggotaWorkbookBytes` (PK signature, header+data rows, empty list)
  - 1 for `defaultExportFilename` (zero-padding)
  - 2 for `fetchAllAnggota` (paginates until short page, single-short-page short-circuit)

---

## Strengths

1. **Architectural separation is right.** Frontend builds the bytes (where the structured data lives) → backend writes them (where the OS-level file API + permissions live). Generic `export_write_bytes` reuses for future export formats. Avoids opening a "frontend can write files" hole in the capability config.
2. **Validation is exhaustive for the threat model.** Empty payload, oversize, relative path, missing parent, parent-not-directory — all explicitly checked with friendly error messages. Each path has a unit test.
3. **64 MiB cap is sensible.** Docstring justifies it: "every member + book row in a school". A single 64 MiB workbook is implausible for this app's data scale.
4. **Reuses Tauri save dialog.** User picks the destination through the OS file dialog (always returns absolute path). Frontend can't smuggle in a directory the user didn't choose.
5. **Pure helpers + `tempfile`.** `write_bytes_inner` takes `&Path` and `&[u8]`, so all 6 Rust tests run in `tempdir()` without any AppHandle.
6. **`fetchAllAnggota` is bounded.** `HARD_CAP = 100_000` prevents infinite loop even if backend mis-reports the result count. Paginates 500 at a time — reasonable batch size for IPC overhead.
7. **Filter state correctly captured.** `handleExport` reads `debouncedQuery`, `kelas`, `jurusan`, `aktifFilter`, `sort?.key`, `sort?.dir` — exports exactly what the user is currently looking at, not the whole table.
8. **Browser-mode fallback for vitest.** `runAnggotaExport` returns a synthetic `/tmp/...` path when `!isTauri()`, so the test can verify the orchestration without a real save dialog.
9. **Cancel-aware.** `runAnggotaExport` returns `null` when the user dismisses the save dialog; `handleExport` quietly returns without showing a toast. Correct UX.
10. **Tests cover both happy and edge paths.** Empty list → header-only workbook; overwrite-existing-file → second `write_bytes_inner` succeeds.

---

## Concerns

### 🟡 1. SheetJS `xlsx@^0.18.5` is on npm but no longer maintained (PRE-EXISTING)

The `xlsx` package on npm is at 0.18.5 (last published 2023-04-12). SheetJS Community Edition has since moved off npm to their own CDN at `cdn.sheetjs.com`. The npm version still has [CVE-2023-30533](https://www.cve.org/CVERecord?id=CVE-2023-30533) (Prototype Pollution in `read`/`readFile`).

**Important context:**
- This PR's path uses **only the write side** (`utils.aoa_to_sheet`, `utils.book_new`, `utils.book_append_sheet`, `write({type:'array'})`). The CVE affects `read`/`readFile` parsing of untrusted .xlsx — that's the **import** flow, which already exists in `main` via `ImportExcelDialog` (pre-existing code, not introduced by this PR).
- Workbook bytes here come from data already in the user's own SQLite DB. No untrusted input enters the SheetJS pipeline.

**Risk in this PR's surface area:** zero.

**Pre-existing risk in `main` (import flow):** present, but out of scope for this PR.

**Suggestion (separate issue, not a blocker for #70):** consider migrating `ImportExcelDialog` (and reusing for future read paths) from `xlsx@0.18.5` to either:
  - SheetJS's own pinned tarball at `cdn.sheetjs.com`, or
  - A maintained alternative like `exceljs` (no known recent CVEs, actively maintained, slightly heavier API).

This is documentation-worthy for the user's awareness but doesn't block #70.

### 🟡 2. `Cargo.toml` `[dev-dependencies]` block conflicts with PR #69

Both PR #69 and PR #70 add an identical `[dev-dependencies]` block at the end of `Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"
```

Whichever merges first introduces the block; the second PR will hit a 3-line conflict that's mechanically resolved by accepting the (already-merged) version. `Cargo.lock` will also drift slightly — fix with a fresh `cargo check` post-rebase.

**Mitigation:** trivial. Whoever rebases second runs `git rebase main` → resolve `Cargo.toml` (keep one block) → `cargo check` to regenerate `Cargo.lock`.

### 🟡 3. Frontend → Backend transfer encodes bytes as JSON `number[]`

In `anggotaExport.ts:138`:

```ts
const written = await invoke<number>('export_write_bytes', {
  destPath: target,
  bytes: Array.from(bytes),
});
```

Tauri 2 IPC over JSON serialises `number[]` as a JSON array of integers. For a 64 MiB workbook (the cap), that's ~3–4× expansion to ~250 MiB of JSON, then parsed back to `Vec<u8>` in Rust. Practically fine for typical exports (a few hundred members → tens of KB), but inefficient at the cap.

**Suggestion (optimization, low priority):** Tauri 2 supports binary IPC via `ArrayBuffer` directly. Could change the command signature to accept `tauri::ipc::InvokeBody::Raw(Vec<u8>)` for large blobs. Adds complexity; defer until someone actually exports a big workbook and complains about slowness.

### 🟢 4. No path traversal check in `write_bytes_inner`

`write_bytes_inner` doesn't reject `..` in `dest`. Reasoning is sound: `dest` always comes from a Tauri save dialog (returns the user's literal chosen path). The user is the one choosing where to save; they can write anywhere they have OS permissions for. This is exactly what "Save As..." does.

If the command were ever invoked from a less-trusted source, `..` should be canonicalised. Today it's fine. Worth adding a docstring note saying "this command assumes `dest_path` came from a save dialog" so future callers don't bypass that assumption.

### 🟢 5. Date formatting is local-time

`defaultExportFilename` uses `now.getFullYear()` etc. — local time. For a single-user offline app this is the right choice (the user expects "today's date" in their timezone). Just noting that filenames will differ if users in different timezones export the same workbook at the same UTC instant.

---

## Coordination with other open PRs

### 🟡 `Cargo.toml` `[dev-dependencies]` block — shared with PR #69

Both add the same `tempfile = "3"` dev-dep. Mechanical conflict, see Concern #2 above.

### 🟡 `Cargo.lock` — shared with PR #69, #75, #77

PR #69 adds a runtime dep tree (`protocol-asset`) plus the `tempfile` dev-dep, so its `Cargo.lock` delta is bigger (40 lines vs. 33). Whichever merges second runs `cargo check` to regenerate cleanly.

### 🟢 `tauri::generate_handler!` (`lib.rs`) — shared with #69, #74, #75, #76

PR #70 adds 1 command (`export_write_bytes`). All other feature PRs add commands too. Additive at end-of-list.

### 🟢 `commands/mod.rs` — shared with #69, #75, #76

PR #70 adds `pub mod export;`. Mechanical rebase.

### 🟢 `anggota.{en,id}.json` — shared with #69

PR #70 adds `actions.export`, `feedback.exportSuccess`, `feedback.exportError`. PR #69 also adds anggota i18n keys. Additive, mechanical resolution.

### 🟢 No semantic conflicts.

---

## Summary recommendation

1. **Merge #70 — it's ready.** Validation surface is tight, tests are thorough, the architectural choice (generic backend writer) future-proofs additional export formats.
2. **Pre-existing concern worth filing separately:** SheetJS `xlsx@0.18.5` on npm has a known prototype-pollution CVE in the `read`/`readFile` path. This PR's surface area is unaffected (write-only), but the import flow in `main` is exposed. Not a blocker for #70 but worth a follow-up issue to migrate to SheetJS CDN tarball or `exceljs`.
3. **Expect mechanical conflict** on `Cargo.toml` `[dev-dependencies]` block + `Cargo.lock` with PR #69. Resolve by keeping a single `[dev-dependencies]` block and regenerating `Cargo.lock` via `cargo check`.
4. **Suggest adding a docstring note** on `export_write_bytes` documenting the "dest_path must come from a save dialog" assumption — so future callers don't accidentally bypass that trust boundary.
