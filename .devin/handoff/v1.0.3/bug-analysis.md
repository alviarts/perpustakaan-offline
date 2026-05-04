# v1.0.3 Bug analysis — code-level investigation

This file pairs with [`backlog.md`](backlog.md) and captures the code
investigation done while triaging the 16 reported items. Each section
links the relevant source files and notes the leading hypothesis +
proposed fix.

---

## #1 FilePickerInput preview

**Files involved:**

- `apps/desktop/src/components/shared/FilePickerInput.tsx`
- `apps/desktop/src/lib/assets.ts`
- `apps/desktop/src-tauri/src/commands/assets.rs`
- `apps/desktop/src-tauri/tauri.conf.json` (`app.security.assetProtocol`)

**Pipeline:**

1. User clicks "Pilih foto…" → `assetsApi.pickAndSave(category)` opens
   the OS dialog (Tauri `plugin-dialog`).
2. The Rust `assets_save` command copies the file to
   `<app_data_dir>/uploads/<category>/<slug>-<ts>.<ext>` and returns
   `{ relPath, absPath }`.
3. `FilePickerInput.handlePick` calls `onChange(result.relPath)`. The
   parent form re-renders with the new `value` prop.
4. The `useEffect` watching `[value]` calls
   `assetsApi.resolve(value)` (i.e. the Rust `assets_resolve` command),
   which joins `app_data_dir` + `relPath` and returns the absolute
   path.
5. The hook calls `convertFileSrc(absPath)` and stores the result as
   `previewUrl`. The `<img src={previewUrl}>` is rendered.

**Why is the preview broken?**

The screenshots show the broken-image glyph (Logo Perpustakaan, Cover
Buku) — that means the `<img>` element rendered with a non-empty src,
i.e. step 5 produced a URL, but the WebView refused to load it.

The most likely root cause is the **asset-protocol scope**. In
`tauri.conf.json`:

```jsonc
"assetProtocol": {
  "enable": true,
  "scope": ["$APPDATA/uploads/**", "$APPLOCALDATA/uploads/**"]
}
```

In Tauri 2 the scope variables expand to:

- `$APPDATA` → `app.path().app_data_dir()` — `~/.local/share/<id>` on
  Linux, `%APPDATA%/Roaming/<id>` on Windows.
- `$APPLOCALDATA` → `app.path().app_local_data_dir()` —
  `~/.local/share/<id>` on Linux (same), `%APPDATA%/Local/<id>` on
  Windows.

The Rust side uses `app.path().app_data_dir()`, so on Windows the
files land in `%APPDATA%/Roaming/<id>/uploads/<category>/...`. The
first scope entry (`$APPDATA/uploads/**`) matches that path, so the
scope check should pass on paper.

**Hypothesis to verify in dev mode (Tauri devtools):** the Rust path
joining produces a Windows-style absolute path (backslashes,
`\\?\` prefix on long paths) that `convertFileSrc` URL-encodes
character-by-character, but the scope matcher compares with forward
slashes. If that's the case the fix is one of:

- Normalise the absolute path to forward slashes inside `resolve_inner`
  before returning it (`path.to_string_lossy().replace('\\\\', '/')`).
- Or add a more permissive scope entry, e.g.
  `["**/uploads/**"]` scoped to the app_data dir.

**Sub-finding for "cover buku tidak bisa upload":** the user reports
they cannot pick a file at all on the buku form. The
`BukuForm.tsx`/`AnggotaForm.tsx`/`IdentitasPage.tsx` integrations all
look identical, so this is unlikely to be a buku-specific bug — more
likely the Tauri `dialog` plugin failed at runtime (e.g. a permission
error from a recent OS update). Reproduce in dev mode and read the
console logs before adding a workaround.

**Test plan:**

- `cargo test --lib` in `apps/desktop/src-tauri` exercises
  `save_inner` / `resolve_inner` / `delete_inner` directly — no asset
  protocol involved.
- Add a Vitest case in `FilePickerInput.test.tsx` that mocks
  `assetsApi.resolve` and asserts the `<img>` `src` updates.
- Manual reproduction in dev mode is required to confirm the scope
  hypothesis.

---

## #2 Tooltips on icon-only buttons

**Files involved:**

- `apps/desktop/src/components/ui/tooltip.tsx` (existing shadcn primitive
  — confirmed via `grep`).
- `apps/desktop/src/components/layout/Header.tsx`
- `apps/desktop/src/components/layout/LanguageSwitcher.tsx`
- `apps/desktop/src/components/layout/ThemeSwitcher.tsx`
- Per-feature row-action buttons in `AnggotaList.tsx`, `BukuList.tsx`,
  `PeminjamanList.tsx`, etc.

**Plan:** wrap every `<Button>` whose visible content is a Lucide icon
with `<Tooltip><TooltipTrigger asChild>...</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>`.
Add an i18n key per tooltip in `i18n/{id,en}/common.json` so the label
respects the language toggle.

---

## #3 Auto-compress photos on upload

**Files involved (proposed):**

- `apps/desktop/src/components/shared/FilePickerInput.tsx` (extend the
  pipeline so the picked file is processed client-side before
  `assets_save`).
- New helper: `apps/desktop/src/lib/imageCompression.ts` — pure browser
  Canvas pipeline (`createImageBitmap` → resize → `toBlob('image/jpeg',
  0.82)`).
- `assets.ts` — `pickAndSave` accepts an optional `process` callback.
- Rust `assets_save` already enforces `MAX_BYTES = 10 MiB`, so reducing
  the size client-side will be transparently accepted.

**Caveats:**

- SVG / GIF should bypass the resize (canvas would rasterise SVG and
  drop GIF animation). The existing `IMAGE_EXTS` whitelist includes
  both — switch on extension before deciding to process.
- Track `metadata.compressed = true` on the saved row so admins know
  the original was downsampled. Optional v1.0.4 work.

---

## #4 Date input calendar icon

**Files involved:**

- `apps/desktop/src/components/ui/date-picker.tsx` — the shared
  DatePicker (used by Peminjaman, Pengembalian, reports filters,
  Kunjungan filter).
- `apps/desktop/src/features/anggota/AnggotaForm.tsx` — has two
  hand-rolled `<input type="date">` rows (TANGGAL LAHIR, TANGGAL
  DAFTAR) that don't use the shared DatePicker.

**Two-part fix:**

1. **Drop the duplicated Lucide calendar icon** in DatePicker — keep
   only the browser's native `::-webkit-calendar-picker-indicator`
   anchored on the right. (The current code stacks both, which is
   what produces the "double calendar" look in the screenshots.)
2. **Theme the picker indicator:** add a Tailwind utility (in
   `apps/desktop/src/index.css` or via a `dark:` selector) such as:

   ```css
   input[type="date"]::-webkit-calendar-picker-indicator {
     filter: invert(0); /* default: black */
     cursor: pointer;
   }
   .dark input[type="date"]::-webkit-calendar-picker-indicator {
     filter: invert(1);
   }
   ```

3. Migrate the two raw inputs in `AnggotaForm.tsx` to the shared
   `DatePicker` so they pick up #5's responsive fix for free.

---

## #5 Peminjaman date row not responsive

**Files involved:**

- `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx` (lines
  187, 272 — two nested `grid-cols-2` containers).

**Why it overflows:** on viewports where the outer `lg:grid-cols-2`
splits the page into two columns and the inner `sm:grid-cols-2`
splits the date row into two columns, each date column ends up
~200–240 px wide. The `DatePicker` flex layout is
`[date-input flex-1] gap-2 [Hari Ini Button]` with the button having
no `shrink-0`, so it eventually wraps to a second line and gets
clipped by the parent card.

**Fix:**

- Stack the date fields vertically below `lg`: use
  `grid grid-cols-1 lg:grid-cols-2` for the outer, and
  `grid grid-cols-1 md:grid-cols-2` for the inner — only split the
  date row when there is room.
- Mark the "Hari Ini" button `shrink-0` so it never wraps.
- Either way, audit the rest of the Peminjaman form for similar
  cramped rows once the dates are fixed.

---

## #6 Sinkronisasi Google Sheets — investigation needed

**Files to inspect (TODO):**

- `apps/desktop/src/features/settings/SinkronisasiPage.tsx` (the form
  visible in the screenshot).
- Anywhere in `apps/desktop/src-tauri/src/` that still has a
  `sheets_sync_*` command. Per
  `.devin/handoff/v1.0.2/comparison-v1.0.1-vs-v1.0.2.md` these were
  removed during v2 migration; need to confirm.

**Two branches:**

- **(A) Backend dropped:** the form is a placeholder. Either (a) hide
  the tab behind a feature flag with a "Coming soon" banner, or (b)
  delete the tab outright and add the tutorial to the manual instead.
- **(B) Backend partially alive:** add a markdown tutorial directly
  below the form explaining how to obtain the Spreadsheet ID and an
  API key, and configure sharing.

The fix can't be scoped until this question is answered, so #6 is
deferred until the investigation is done.

---

## #7 Hak Akses table

**Files involved:**

- `apps/desktop/src/features/settings/HakAksesPage.tsx` (or wherever
  the matrix is rendered — confirm path during the fix).

**Plan:**

- Add zebra striping via `even:bg-muted/50` rows.
- Insert a 2-px right border on the last ADMIN column so the role
  groups visually separate.
- Add `hover:bg-accent/50` row highlight.
- Make the first column sticky with `sticky left-0 bg-background`.

No schema change.

---

## #8 CRUD form max-width

**Files involved (sample):**

- `apps/desktop/src/routes/_authed/anggota/$id.tsx`
- `apps/desktop/src/routes/_authed/anggota/new.tsx`
- and probably every other CRUD route that wraps its form in
  `<div className="container mx-auto max-w-3xl p-6 md:p-8">`.

**Fix:** introduce a `<FormShell>` layout wrapper used by every CRUD
route:

```tsx
<div className="container mx-auto max-w-3xl xl:max-w-5xl 2xl:max-w-7xl p-6 md:p-8">
```

so the form widens at xl/2xl breakpoints but still has a sensible
maximum on truly enormous monitors. Consistency across forms is a
separate goal — track every route to make sure no form is left at
`max-w-3xl` after the change.

---

## #9 Cetak KTA — open output folder

**Files involved:**

- `apps/desktop/src/features/kta/CetakKtaPage.tsx`
- `@tauri-apps/plugin-shell` is already a dependency (see
  `apps/desktop/package.json`).

**Plan:** after the export resolves, store the output folder path in
state, render a "Buka Folder Hasil" button next to "Mencetak X KTA",
and on click call `await invoke('plugin:shell|open', { path: dir })`
(or the higher-level helper). Use `revealItemInDir` semantics if
available so Explorer / Finder highlights the file.

---

## #10 KTA Template Library

Designed as its own milestone (v1.0.5). High-level breakdown lives in
[`backlog.md`](backlog.md#10--kta-template-library-10-designs--customisation).

---

## #11 Laporan Kas — editable entries

**Files to inspect during the fix:**

- `apps/desktop/src/features/laporan/KasPage.tsx`
- `apps/desktop/src-tauri/src/commands/laporan.rs` (or wherever the
  `kas_*` commands live).
- `apps/desktop/src-tauri/migrations/` for the existing `kas` table
  schema.

**Plan:**

- Add `kas_create` / `kas_update` / `kas_delete` Tauri commands and
  matching migrations:
  - Add `manually_adjusted` `INTEGER NOT NULL DEFAULT 0` to `kas`.
  - Add a `kas_audit` table with `(id, kas_id, action, before, after,
    changed_by, changed_at)`.
- Add edit / delete row actions to the Kas table.
- Add a "+ Tambah Kas" button that opens a new-entry dialog.

---

## #12 Dashboard quote-of-the-day + clock

**Files involved (proposed):**

- New: `apps/desktop/src/data/quotes.json` (~365 entries × 2 langs).
- `apps/desktop/src/features/dashboard/DashboardHeader.tsx` —
  display the quote + a `useEffect` interval clock.
- `apps/desktop/src/lib/quoteOfTheDay.ts` — pure helper that returns
  `quotes[dayOfYear % quotes.length]`.

No schema change, no native deps.

---

## #13 Modern custom title bar

**Files involved:**

- `apps/desktop/src-tauri/tauri.conf.json` (`decorations: false`).
- `apps/desktop/src-tauri/capabilities/default.json` (need to grant
  `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`).
- New: `apps/desktop/src/components/layout/TitleBar.tsx`.
- `apps/desktop/src/components/layout/AppShell.tsx` to mount the title
  bar at the top.

**Caveats:**

- Native window snapping (Aero Snap on Windows) requires extra config
  — confirm during the fix that drag + Aero Snap still work.
- macOS handles "traffic light" buttons natively; if we ever build for
  macOS we'll need the
  `titleBarStyle: "Overlay"` Tauri 2 config to keep them visible.

---

## #14 NSIS / WiX installer artwork

**Files involved:**

- `apps/desktop/src-tauri/icons/source/{nsis-sidebar,nsis-header,wix-banner,wix-dialog}.bmp`

**Plan:**

- Re-export each bitmap from a vector master at the exact required
  pixel dimensions (no upscaling).
- Add a tiny `scripts/build-installer-art.mjs` that takes an SVG
  master and writes the four BMPs at the right sizes via `sharp` or
  `playwright`'s screenshot API.
- Snapshot the rendered installer screens via the CI workflow if
  possible (or at least verify visually post-merge).

---

## #15 Brand rename

**Files to update:**

- `apps/desktop/src-tauri/tauri.conf.json` — `productName`, window
  `title`, `bundle.shortDescription`, `bundle.longDescription`.
- `apps/desktop/src/i18n/{id,en}/*.json` — every "Perpustakaan
  Offline" → "Perpustakaan Nusantara" string.
- `apps/desktop/src/components/layout/AppShell.tsx` / `Sidebar.tsx`
  for the sidebar header.
- `apps/desktop/src/routes/_authed/index.tsx` for the dashboard
  greeting.
- `apps/desktop/src/routes/login/login.tsx`.
- `README.md`, `docs/manual.md`, `apps/desktop/index.html`'s
  `<title>`.
- Installer bitmaps (#14) need the new product name baked in.

**Bundle identifier left at `id.alviarts.perpustakaan`** so existing
v1 / v1.0.x users keep their database. If we ever decide to flip the
identifier we'll need a one-shot migration that copies the SQLite DB
+ uploads dir from the old identifier path to the new one on first
launch.

---

## #16 User profile dialog

**Files to update / add:**

- New migration: add `nama_lengkap`, `foto_path`, `tanggal_lahir`,
  `tempat_lahir`, `no_telepon`, `email`, `alamat`, `jenis_kelamin`,
  `agama` columns to the `users` table.
- New Tauri command: `users_update_profile(user_id, payload)` with
  audit logging.
- New: `apps/desktop/src/features/profile/ProfilePage.tsx` (or a
  modal) reachable via the header dropdown's "Profil" item.
- `apps/desktop/src/components/layout/Header.tsx` — render the user's
  foto + display name in the avatar slot.

Username remains the auth key — no changes to login flow.
