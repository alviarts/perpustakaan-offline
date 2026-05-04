# Code Review — PR #72: Ctrl+K Global Search Palette

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/72
**Branch:** `devin/1777896226-global-search` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 5 files, +472 / -41 (net +431)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve with comments**

Clean cmdk-style command palette integration. The state machine inside `GlobalSearchDialog` is non-trivial — debounce, race-protection, parallel-group fetching, open/close lifecycle — but the implementation is correct. The pure adapter functions (`anggotaToHit`, `bukuToHit`, `peminjamanToHit`) are well-factored. Two notable gaps: dialog-level test coverage is thin (only the pure helpers are tested, not the stateful component itself), and Header.tsx will conflict semantically with PR #76 since both refactor the same file.

---

## What this PR does

Replaces the placeholder `<Input>` in the header (which previously navigated to `/anggota?q=...` on Enter) with a cmdk-powered command palette opened via Ctrl+K / Cmd+K or by clicking the trigger button.

### New component (`apps/desktop/src/components/layout/GlobalSearchDialog.tsx`, 301 lines)

**Pure adapter functions (exported, tested):**

```ts
anggotaToHit(a: Anggota): GlobalSearchHit  // → { key: "anggota:42", primary: a.nama, secondary: "kode • kelas • jurusan", to: "/anggota/42" }
bukuToHit(b: Buku): GlobalSearchHit         // → { key: "buku:7", primary: b.judul, secondary: "kode • pengarang • tahun", to: "/buku/7" }
peminjamanToHit(p: PeminjamanRow): GlobalSearchHit // → { key: "peminjaman:13", primary: "nomor — anggota", secondary: "nomor • anggota • status", to: "/peminjaman/13" }
```

Each helper builds a stable `key`, drops null/missing optional fields from the subtitle (so we never render the literal "null"), and produces a route that lands on the entity's detail page.

**State machine inside `GlobalSearchDialog`:**

- `raw: string` — controlled input value
- `debouncedQuery: string` — 200ms debounce
- `results: SearchResults` — `{ anggota: Hit[], buku: Hit[], peminjaman: Hit[] }`
- `busy: boolean` — loading indicator
- `requestId.current: number` — race-protection ref

**Effects:**

1. Open-state reset (line 99): on `open` flip-false, clear all state for fresh next-open.
2. Debounce (line 110): start 200ms timeout, restart on each keystroke. Cleanup clears in-flight timer.
3. Search dispatcher (line 119): on `debouncedQuery` change, if length ≥ 2, increment `requestId.current` and fire 3 parallel `Promise.allSettled` calls. Stale responses (`myId !== requestId.current`) are dropped.

**Render branches** (in order):

- `raw.trim().length < 2` → "Type at least 2 characters" hint
- `busy` → spinner + "Searching…"
- `totalHits === 0` → empty state
- otherwise → 3 groups (anggota / buku / peminjaman) with `<CommandSeparator>` between non-empty groups

**Footer:**

- `Enter to open • ↑↓ to navigate • Esc to close` + `⌃K` kbd pill — discoverable affordance.

### Header.tsx refactor (`apps/desktop/src/components/layout/Header.tsx`, ~70/-41 lines)

Functional changes (filtering out Tailwind class reorder noise):

- Drop `useRef<HTMLInputElement>` + `searchRef.current?.focus()` (no longer needed)
- Drop `searchValue` controlled state + `onKeyDown=Enter→/anggota?q=...` placeholder behavior
- Add `searchOpen: boolean` state + `<GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />`
- Ctrl+K / Cmd+K binding switches from `searchRef.current?.focus()` to `setSearchOpen((v) => !v)` (toggle: press once to open, press again to close)
- Inline `<Input>` replaced with a `<button>` that opens the dialog on click

Update comment goes from `// (placeholder; akan integrasi dengan global search di sesi 4+)` → `// → open the global search command palette`.

### i18n (`common.{en,id}.json`)

11 new keys under `globalSearch.*`: `title`, `placeholder`, `hint`, `busy`, `empty`, `groupAnggota`, `groupBuku`, `groupPeminjaman`, `footerHint`. Both en + id.

### Tests (`tests/unit/globalSearchDialog.test.tsx`, 120 lines, 5 cases)

All 5 tests target the pure adapter functions:

- `anggotaToHit` builds key + primary + route
- `anggotaToHit` drops null kelas/jurusan from subtitle
- `bukuToHit` builds key + primary + route
- `bukuToHit` omits null pengarang + missing tahunTerbit
- `peminjamanToHit` builds primary line that combines nomorPinjam + anggotaNama

### Pre-existing UI (already in main)

- `apps/desktop/src/components/ui/command.tsx` — cmdk wrapper (already in main)
- `cmdk@^1.1.1` already in `package.json`

So this PR doesn't touch lockfile or add npm deps. Clean.

---

## Strengths

1. **Race-protection via `requestId.current`** — same pattern as PR #69 (`FilePickerInput`). Stale responses get dropped via `if (myId !== requestId.current) return`. Fast typing won't paint stale results.
2. **`Promise.allSettled` not `Promise.all`** — one slow/failed source doesn't block the others. If `peminjamanApi.list` hangs, `anggota` and `buku` results still render.
3. **`shouldFilter={false}` on `<Command>`** — disables cmdk's internal substring filter because the **backend already filtered**. Avoids the double-filter bug where backend matches `LIKE '%q%'` (case-insensitive) but cmdk uses substring (case-sensitive) and throws away half the results.
4. **State reset on close** — `useEffect(() => { if (!open) { setRaw(''); ... } }, [open])` makes reopening a fresh slate, which matches user expectation for a transient palette.
5. **Sub-2-character short-circuit** — `q.length < 2` skips the API call entirely. Saves the DB from `WHERE col LIKE '%a%'`-style queries that would scan everything.
6. **Cmd+K / Ctrl+K toggle behavior** — `setSearchOpen((v) => !v)` means second press closes the dialog. Standard cmdk UX (matches Linear, GitHub, Slack).
7. **`<DialogTitle className="sr-only">`** — Radix Dialog accessibility requires a title; using `sr-only` keeps it invisible but discoverable to screen readers. Correct.
8. **Group separators are conditional** — `<CommandSeparator />` only rendered between non-empty adjacent groups. No "leading" or "trailing" separators that look broken.
9. **Navigate-after-close ordering** — `onOpenChange(false)` runs before `navigate({to: hit.to})`. Post-navigation focus lands on the new page, not on the now-closed dialog (which would be a focus-trap bug).
10. **Stable `key` includes the kind prefix** — `anggota:42` vs `buku:42` won't collide as React keys, even though the DB IDs come from different tables.
11. **Pure adapter functions are exported and tested** — `anggotaToHit`/`bukuToHit`/`peminjamanToHit` separately tested for null-handling. Good factoring.

---

## Concerns

### 🟡 1. Dialog-level test coverage is thin

The 5 frontend tests cover **only the pure adapter functions**. Zero tests for the `GlobalSearchDialog` component itself:

- No test for the open/close lifecycle reset effect
- No test for the debounce
- No test for race-protection (stale request → fresh request)
- No test for the sub-2-char short-circuit
- No test for keyboard activation → navigate
- No test for `Promise.allSettled` partial-failure (one source rejects, others succeed)

This is a **~200-line stateful component with three interacting `useEffect` hooks**. The pure helpers are 30 lines and have 5 tests; the component is the bulk of the logic and has 0.

**Suggestion:** add at least 4 component-level tests using `vi.mock` for `anggotaApi`/`bukuApi`/`peminjamanApi` and `@testing-library/react`:

- `it('shows hint when query < 2 chars')`
- `it('calls all 3 APIs after 200ms debounce')`
- `it('drops stale results when a faster query overtakes')`
- `it('still renders surviving groups when one API rejects')`

Not a blocker for merge, but the dialog has enough stateful complexity that it's worth shoring up before someone refactors and breaks a subtle case.

### 🟡 2. Semantic conflict with PR #76 in `Header.tsx`

Both PR #72 and PR #76 substantially refactor `apps/desktop/src/components/layout/Header.tsx`:

- PR #72 replaces the `<Input>` with a `<button>` that opens `<GlobalSearchDialog>`
- PR #76 (manual settings tab) modifies the same Header to swap `openManual` button for `<Link to="/settings/manual">`

These edits target overlapping regions (the buttons section). Whichever merges first, the other will need a non-trivial rebase that re-applies its conceptual change to the new shape of Header.

This conflict was already flagged in the PR audit (`/tmp/pr-audit-report-2026-05-04.md`) as medium-risk. Not a blocker for either PR individually, but coordinate-aware reviewers should expect a manual rebase.

### 🟢 3. PER_GROUP_LIMIT = 5 is hardcoded

5 hits per group is a reasonable default but isn't configurable. Small libraries might want 10; very large libraries might want 3 + a "show more" footer. Out of scope for v1; flag for future tuning.

### 🟢 4. Old "Enter → /anggota?q=..." behavior is removed

The pre-existing Header.tsx had a placeholder: typing in the input + Enter navigated to `/anggota?q=...`. This is removed in favor of the dialog. Anyone who depended on the old behavior (probably no one — the placeholder comment said "akan integrasi dengan global search di sesi 4+") now has to use the dialog instead.

This is a **minor breaking change** but appears intentional. Worth a one-line note in the PR description.

### 🟢 5. Three parallel API calls per query

Each query fires `anggotaApi.list`, `bukuApi.list`, `peminjamanApi.list` in parallel. For SQLite over Tauri IPC that's 3 round-trips per debounced keystroke. The 200ms debounce keeps it manageable, and `Promise.allSettled` means slow sources don't block the UI.

For larger libraries, a future optimization could be a single backend `search_global(q)` command that does the union query in one trip. Not a blocker; optimization for if/when latency becomes noticeable.

### 🟢 6. Tailwind class reordering noise in `Header.tsx`

Same artifact as PR #69, #74, #75, #76. Not actionable.

---

## Coordination with other open PRs

### 🔴 `Header.tsx` — semantic conflict with PR #76

Both PRs refactor the buttons section of Header.tsx. Real conflict, manual rebase required for whichever merges second. See Concern #2.

### 🟢 `i18n/common.{en,id}.json` — additive, shared with PR #69

PR #72 adds `globalSearch.*` keys; PR #69 adds `filePicker.*` keys. Both append to end of object. Mechanical resolution.

### 🟢 No other shared files

PR #72 doesn't touch `lib.rs`, `commands/mod.rs`, `Cargo.toml`, or any other Rust file. It's frontend-only and the only frontend file shared with another open PR is Header.tsx (above).

### 🟢 No semantic conflicts beyond Header.tsx.

---

## Summary recommendation

1. **Merge #72 — it's ready.** State machine is correct, race-protection works, accessibility (DialogTitle sr-only) is right, and the cmdk integration follows standard patterns.
2. **Highly suggested follow-up (not a blocker):** add 3–4 component-level tests for the dialog itself. The pure helpers are well-tested, but the stateful component (~200 lines, 3 effects) deserves at least smoke coverage of: < 2 char hint, debounce timing, stale-request drop, partial-API-failure rendering.
3. **Coordinate Header.tsx merge order with PR #76.** Whichever merges first dictates the rebase work for the other. Recommend merging the smaller diff first if both are otherwise green; #72's Header.tsx delta is smaller (~30 functional lines vs ~30 in #76).
4. **Optional follow-ups (file separately):**
   - Make `PER_GROUP_LIMIT` configurable (settings or feature flag).
   - Consolidate to a single backend `search_global(q)` command if 3 parallel IPC calls become a bottleneck.
   - Note the breaking change (Enter → /anggota?q=… removed) in CHANGELOG when v1.1 ships.
