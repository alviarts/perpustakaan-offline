# Post-v1.0.0 Bug Backlog

Source of truth for all bugs found **after** the 12-session migration to v2 was merged
(commit `46750cc`, tagged `v1.0.0`, PRs #35–#51). Maintained in this repo so any
future Devin session (or human) can pick up the next open bug without re-discovering
context from scratch.

> **Status (2026-05-04):** All P0/P1/P2 bugs from the initial smoke test are
> resolved (BUG-001..007, BUG-009..011 merged via PRs #55–#63 and #66). Only
> **BUG-008** (LOW / DESIGN) remains in flight via PR
> [#68](https://github.com/alviarts/perpustakaan-offline/pull/68). This file is
> in maintenance mode — use it as a historical catalog. New bug discoveries
> should append entries below + add a row to
> [`PROGRESS.md`](./PROGRESS.md).

- **Smoke test report (Linux dev, full repro details + screenshots):** session
  attachment `test-report.md` from the smoke-test session. The bug entries below
  are derived from that report and from a Windows production-installer test.
- **Companion machine-parseable status table:** [`PROGRESS.md`](./PROGRESS.md).
- **Companion protocol / copy-paste prompt for the next Devin session:**
  [`INSTRUCTION_TEMPLATE.md`](./INSTRUCTION_TEMPLATE.md).

## Bug catalog

### BUG-001 — `buku_create` does not insert `eksemplar` rows

| Field | Value |
|---|---|
| Severity | **HIGH** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| Reproduces in | Linux dev, presumed Windows prod (same code path) |
| PR | [#55](https://github.com/alviarts/perpustakaan-offline/pull/55) (merged 2026-05-04) |

**Where**

- `apps/desktop/src-tauri/src/commands/buku.rs:243–288` (`buku_create`).

**Trigger**

1. Open the app, log in (`admin` / `admin123`).
2. Buku → Tambah Buku → fill any title, set `Jumlah Eksemplar = 2`, Save.
3. Peminjaman → Pinjam Baru → autocomplete the new buku → Submit.

**Observed**

- Buku list shows "Tersedia 2/2".
- `SELECT count(*) FROM eksemplar` = **0**, `SELECT count(*) FROM buku` = **1**.
- `peminjaman_create` rejects with "tidak ada eksemplar tersedia untuk buku id=1"
  (which surfaces as `[object Object]` in the toast — see BUG-002).

**Expected**

When `jumlah_eksemplar = N` is sent to `buku_create`, the same transaction must
insert `N` rows into `eksemplar` with auto-generated `kode_eksemplar` (e.g.
`B0001-01`, `B0001-02`, …) and `status = 'tersedia'`. The `eksemplar_create`
command exists for the manual route but the bulk-on-create case is not wired.

**Suggested fix**

In `buku_create`, after the buku INSERT and inside the same transaction:

```rust
let buku_id = conn.last_insert_rowid();
for n in 1..=jumlah_eksemplar {
    let kode_eksemplar = format!("{}-{:02}", kode_buku, n);
    conn.execute(
        "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, ?2, 'tersedia')",
        params![buku_id, kode_eksemplar],
    )?;
}
```

Use the same numbering scheme as the existing manual `eksemplar_create` flow.
Validate that `jumlah_eksemplar >= 0` (the column allows `0` for catalog-only
entries).

**Definition of done**

- [ ] Creating a buku with `jumlah_eksemplar = N` results in exactly `N` rows in
      `eksemplar` with the expected `kode_eksemplar` pattern.
- [ ] Existing `buku_update` continues to work; if `jumlah_eksemplar` is
      increased on update, additional eksemplar rows are appended (out of scope
      for this bug — track separately if needed).
- [ ] New unit test in `apps/desktop/src-tauri/src/commands/buku.rs` covering the
      0, 1, 5 cases.
- [ ] Smoke flow: fresh DB → create buku with 2 eksemplar → peminjaman succeeds
      end-to-end without any sqlite3 workaround.

---

### BUG-002 — Peminjaman error toast renders `[object Object]`

| Field | Value |
|---|---|
| Severity | **MEDIUM** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#57](https://github.com/alviarts/perpustakaan-offline/pull/57) (merged 2026-05-04) |

**Where**

- `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx:158–164` — pattern
  `description: err instanceof Error ? err.message : String(err)`.
- The same `String(err)` fallback is repeated in `PeminjamanList.tsx`,
  `PeminjamanDetail.tsx`, and the kembalikan/print flows.

**Trigger**

Any failure from a Tauri `invoke()` whose Rust side returns `AppError::Validation
/ NotFound / Conflict / Internal` (e.g. peminjaman with no available eksemplar
when BUG-001 fires).

**Observed**

Toast title says "Gagal membuat peminjaman" — fine — but the description shows
the literal string `[object Object]` instead of the validation message. Users
have no idea what went wrong.

**Why**

Tauri `invoke()` rejects with a serialized `AppError` object (e.g. `{ Validation:
"tidak ada eksemplar tersedia ..." }`), not an `Error` instance. The fallback
`String(err)` on a plain object returns `"[object Object]"`.

**Suggested fix**

Add a shared helper in `apps/desktop/src/lib/errors.ts`:

```ts
export type TauriAppError =
  | { Validation: string }
  | { NotFound: string }
  | { Conflict: string }
  | { Internal: string };

export function formatTauriError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    for (const key of ['Validation', 'NotFound', 'Conflict', 'Internal'] as const) {
      const v = (err as Record<string, unknown>)[key];
      if (typeof v === 'string') return v;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
```

Then sweep all `description: ... String(err)` call sites and replace with
`description: formatTauriError(err)`.

**Definition of done**

- [ ] Helper added with unit tests in `apps/desktop/tests/unit/`.
- [ ] All `String(err)` and `err instanceof Error ? err.message : String(err)`
      patterns inside `apps/desktop/src/features/**` and `apps/desktop/src/routes/**`
      replaced with the helper.
- [ ] Manual repro: trigger a peminjaman validation error → toast description
      shows the actual Rust message, not `[object Object]`.

---

### BUG-003 — Anggota Kelas / Jurusan dropdowns sourced from `anggota_distinct`, not master tables

| Field | Value |
|---|---|
| Severity | **MEDIUM** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#58](https://github.com/alviarts/perpustakaan-offline/pull/58) (merged 2026-05-04) |

**Where**

- `apps/desktop/src/routes/_authed/anggota/new.tsx:23–29`
- `apps/desktop/src/routes/_authed/anggota/$id.tsx`
- `apps/desktop/src/features/anggota/AnggotaForm.tsx:33` (the
  `FALLBACK_AGAMA = ['Islam', ...]` constant that masks the bug for agama).

```ts
// new.tsx
anggotaApi.distinct('kelas').then(setKelas).catch(() => undefined),
anggotaApi.distinct('jurusan').then(setJurusan).catch(() => undefined),
anggotaApi.distinct('agama').then(setAgama).catch(() => undefined),
```

**Trigger**

Open Tambah Anggota on a fresh DB.

**Observed**

- Kelas dropdown opens, "Tidak ada hasil".
- Jurusan dropdown also empty.
- Agama works **only** because of the hardcoded `FALLBACK_AGAMA` constant.
- DB has 18 kelas, 6 jurusan, 6 agama rows seeded by `seed_default_data` — none
  of them surface in the form.

**Expected**

Sources should be `master_list({ kind: 'kelas' })`, `master_list({ kind:
'jurusan' })`, `master_list({ kind: 'agama' })` — the master-data commands that
revisi #17 was supposed to wire up. `anggota_distinct(field)` values can be
merged on top for backward compat with already-stored free-text values.

**Suggested fix**

```ts
// new.tsx — pseudo
const [kelasMaster, kelasDistinct] = await Promise.all([
  masterApi.list({ kind: 'kelas' }),
  anggotaApi.distinct('kelas'),
]);
setKelas([...new Set([...kelasMaster.map((m) => m.nama), ...kelasDistinct])]);
```

Apply same pattern to jurusan and agama. Drop `FALLBACK_AGAMA` once master is
the source of truth (still keep it as a guard for catastrophic DB seed
failures).

**Definition of done**

- [ ] Fresh DB → Tambah Anggota → Kelas dropdown shows the seeded master list
      (e.g. `7-A`, `7-B`, …, `12-IPS`).
- [ ] Adding a new kelas in Settings → Master Data → Kelas → reload Tambah
      Anggota → new kelas appears.
- [ ] Free-text kelas values that already exist on anggota rows still appear
      (merged in).

---

### BUG-004 — DDC master table is empty on fresh install

| Field | Value |
|---|---|
| Severity | **MEDIUM** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#59](https://github.com/alviarts/perpustakaan-offline/pull/59) (merged 2026-05-04) |

**Where**

- `apps/desktop/src-tauri/src/db/mod.rs` `seed_default_data` — DDC is **not**
  seeded (only agama, kategori, kelas, jurusan, bahasa are).

**Trigger**

Tambah Buku → "Kode DDC" picker → search.

**Observed**

Dropdown shows "Tidak ada hasil" (creatable autocomplete, same component as
kelas). DB confirms `SELECT count(*) FROM ddc` = 0.

**Expected**

Per session 5 deliverable ("Master Data komplit (DDC/Kategori/Bahasa/Jurusan/
Kelas/Agama) ... seed online (Dewey, ISO 639)"), DDC should ship with at least
the 10 main classes (000–900) seeded, ideally the 100 divisions.

**Suggested fix**

Add a `DDC_MAIN_CLASSES: &[(&str, &str)]` constant in
`apps/desktop/src-tauri/src/db/seed_data.rs` (or wherever the existing seed
arrays live) with at least:

```
("000", "Karya Umum")
("100", "Filsafat & Psikologi")
("200", "Agama")
("300", "Ilmu Sosial")
("400", "Bahasa")
("500", "Sains Murni")
("600", "Teknologi & Sains Terapan")
("700", "Kesenian, Hiburan, Olahraga")
("800", "Sastra")
("900", "Sejarah & Geografi")
```

Wire it into `seed_default_data` with the same idempotency check as the other
master arrays (insert only if `SELECT count(*) FROM ddc` = 0).

**Definition of done**

- [ ] Fresh install → `SELECT count(*) FROM ddc` >= 10.
- [ ] Buku form → Kode DDC → list shows the 10 main classes.
- [ ] Idempotency: re-running `seed_default_data` does not duplicate rows.

---

### BUG-005 — `kta_templates` is empty; KTA print preview has nothing to use

| Field | Value |
|---|---|
| Severity | **HIGH** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#56](https://github.com/alviarts/perpustakaan-offline/pull/56) (merged 2026-05-04) |

**Where**

- `apps/desktop/src-tauri/src/db/mod.rs` `seed_default_data` — no `kta_templates`
  seed.
- Frontend: `apps/desktop/src/features/anggota/CetakKtaDialog.tsx` (or wherever
  the "Pilih template" dropdown lives).

**Trigger**

Anggota → "Cetak KTA" button → click "Pilih template".

**Observed**

Dropdown opens, no options. "Cetak" button stays disabled because no template
is selected. DB confirms `SELECT count(*) FROM kta_templates` = 0.

**Expected**

A default landscape KTA template should be seeded (id 1, `is_default = 1`,
sensible field positions for nama/kode/kelas/foto/QR) so users can immediately
print a card. Session 10 promised "template editor visual, auto-fill, barcode QR
untuk peminjaman cepat" — the editor exists but nothing is preinstalled.

**Suggested fix**

In `seed_default_data`, idempotently insert a single default template with the
field positions used by the Python v1 (`src/perpustakaan/services/kta.py`) for
visual continuity, OR ship a sane default landscape layout (85.6mm × 53.98mm
ID-1 card, 600 DPI safe area, fields: nama, kelas, kode, foto, QR for kode).
Mark `is_default = 1`. Make sure the existing "Reset ke template default"
button in the editor restores this seed.

**Definition of done**

- [ ] Fresh install → `SELECT count(*) FROM kta_templates` >= 1; one row has
      `is_default = 1`.
- [ ] Anggota → Cetak KTA → "Pilih template" dropdown defaults to the seeded
      template, "Cetak" button is enabled.
- [ ] Print preview renders without crashing; field auto-fill (nama, kelas,
      kode, QR) works.

---

### BUG-006 — Header breadcrumb stays on "Dashboard" for sub-routes

| Field | Value |
|---|---|
| Severity | **MINOR** (cosmetic) |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#60](https://github.com/alviarts/perpustakaan-offline/pull/60) (merged 2026-05-04) |

**Where**

- Probably `apps/desktop/src/components/layout/Header.tsx` or the route-tree
  integration in `apps/desktop/src/routes/_authed/`.

**Trigger**

Navigate to `/anggota/new`, `/buku/new`, `/peminjaman/new`, `/laporan/...` —
any non-list deeper route.

**Observed**

Breadcrumb shows e.g. `Perpustakaan Sekolah / Dashboard` while the page heading
correctly reads "Tambah Anggota Baru" or "Laporan". On the **list** pages
(`/anggota`, `/buku`, `/peminjaman`) the breadcrumb correctly shows the section,
so the bug is on `_authed/<feature>/<sub>` routes only.

**Suggested fix**

Replace the static "Dashboard" fallback with a route-tree-aware lookup. With
TanStack Router this is usually `useMatches()` → walk to the deepest match with
a `staticData.crumb` field, and join. Example:

```ts
const matches = useMatches();
const crumbs = matches
  .map((m) => m.staticData?.crumb)
  .filter(Boolean);
```

Then add `staticData: { crumb: 'Anggota' }` etc. on each route definition.

**Definition of done**

- [ ] On `/anggota/new`, breadcrumb is `Perpustakaan Sekolah / Anggota / Tambah`
      (or similar).
- [ ] On `/laporan/grafik`, breadcrumb is `... / Laporan / Grafik`.
- [ ] On `/dashboard`, breadcrumb is unchanged (`... / Dashboard`).

---

### BUG-007 — Backup tab shows the wrong DB path

| Field | Value |
|---|---|
| Severity | **MINOR** |
| Status | `DONE` |
| Discovered | Linux dev smoke test |
| PR | [#61](https://github.com/alviarts/perpustakaan-offline/pull/61) (merged 2026-05-04) |

**Where**

- `apps/desktop/src/features/laporan/Backup.tsx` (or wherever the
  "FILE DB AKTIF" string is rendered).

**Observed**

UI shows `/home/ubuntu/.local/share/id.alviarts.perpustakaan/perpustakaan.db`
(the v1 filename) but the actual file in use is `perpustakaan-v2.db`. The
displayed path is hardcoded / not pulled from the same `resolve_db_path` that
the runtime uses.

**Suggested fix**

Add a Tauri command `backup_db_path() -> AppResult<String>` (one already exists
in `apps/desktop/src-tauri/src/lib.rs:90` — `backup::backup_db_path`. Verify it
returns the v2 path and that the frontend actually invokes it instead of
displaying a hardcoded string.) If the command is correct but the frontend
isn't wired, fix the frontend.

**Severity note**

Cosmetic for the displayed string, but **verify** the backend `db_backup`
command actually writes to the correct v2 file. The smoke-test session did not
click "Backup Sekarang" because that's destructive.

**Definition of done**

- [ ] Backup tab shows the actual runtime DB path, ending in
      `perpustakaan-v2.db`.
- [ ] Clicking "Backup Sekarang" produces a backup file of the correct DB.

---

### BUG-008 — Dashboard "Total Buku" counts eksemplar, not titles

| Field | Value |
|---|---|
| Severity | **LOW / DESIGN** |
| Status | `IN_PR` |
| Discovered | Linux dev smoke test |
| PR | [#68](https://github.com/alviarts/perpustakaan-offline/pull/68) |

**Where**

- `apps/desktop/src-tauri/src/commands/dashboard.rs` (`dashboard_kpi` query).

**Observed**

With 1 buku that has `jumlah_eksemplar = 2`, the dashboard shows
**"Total Buku: 2"**.

**Decision (2026-05-04, recorded by user)**

**Opsi 3 — show both metrics on a single KPI card.** The headline number on
the "Total Buku" card is the count of distinct **titles** (`COUNT(*) FROM buku`)
and a small muted sub-line directly underneath shows the number of **physical
copies** as `"{{count}} eksemplar"`. Rationale: school-library staff care
primarily about catalog breadth (titles), but losing visibility into physical
inventory would regress the existing v1.0.0 dashboard. Surfacing both metrics
on the same card preserves all information without adding a fourth KPI tile or
re-shuffling the dashboard layout.

The label stays `"Total Buku"` in both locales — only the displayed number and
its sub-line change.

**Definition of done**

- [x] Decision recorded in this file (Opsi 3).
- [x] `DashboardKpi.totalBuku` switched to `COUNT(*) FROM buku` (titles).
- [x] New `DashboardKpi.totalEksemplar` field carries the previous
      `SUM(jumlah_eksemplar)` value and is rendered as the KPI sub-line.
- [x] `delta_buku_pct` recomputed against title creation, matching the headline
      KPI semantics so the trend arrow describes titles added per month, not
      eksemplar churn.
- [x] DDC donut + DDC bar already used `COUNT(*) FROM buku GROUP BY kelas`
      (titles) on `main`, so no further chart changes were needed — sanity
      check verified.
- [x] Rust unit tests cover the title vs. eksemplar split, fresh-DB zeroes,
      `buku_dipinjam` correctness, and the `aktif=1` filter on `total_anggota`.
- [x] Vitest suite asserts the mock RPC carries both fields with `copies >=
      titles`.

---

### BUG-009 — Buku Manual blank + cannot be closed (Windows production)

| Field | Value |
|---|---|
| Severity | **HIGH** |
| Status | `SUPERSEDED` |
| Discovered | Windows production install |
| PR | [#53](https://github.com/alviarts/perpustakaan-offline/pull/53) closed without merge; superseded by **BUG-010** in [#62](https://github.com/alviarts/perpustakaan-offline/pull/62) + Windows follow-up [#66](https://github.com/alviarts/perpustakaan-offline/pull/66) (merged 2026-05-04) |

**Where**

- `apps/manual/build.mjs` (generated `apps/desktop/public/manual/index.html`
  embedded inline `<style>` and `<script>`).
- `apps/desktop/src-tauri/src/commands/manual.rs` (defensive window flags).

**Trigger**

After installing the v1.0.0 Windows installer: log in → Settings → Tentang →
click **Buku Manual**.

**Observed**

Webview window opens with totally blank white content, no interactive
elements, and the X button on the manual window does not respond — the user
must use Task Manager to close it.

**Root cause**

Tauri 2's production CSP rewriter computes hashes/nonces only for the main
entry HTML processed by Vite (`apps/desktop/index.html`). Static files in
`public/` (including `manual/index.html`) are copied verbatim with no
nonce/hash. Per CSP spec, the presence of any nonce in the runtime CSP causes
browsers (and Windows WebView2) to ignore `'unsafe-inline'`, so the manual
page's inline `<style>` and `<script>` are silently blocked. With the script
blocked the page stalls at load, and on Windows WebView2 close events are not
processed while the page is in that stalled state.

References:

- Tauri 2 CSP docs: <https://tauri.app/security/csp>
- Related upstream issue: <https://github.com/tauri-apps/tauri/issues/8476>

**Fix (already in PR #53)**

1. `apps/manual/build.mjs` now writes three sibling files instead of one
   self-contained HTML: `index.html`, `style.css`, `app.js`. The HTML
   references them with `<link rel="stylesheet" href="./style.css">` and
   `<script src="./app.js"></script>`. Same-origin external assets are allowed
   by `default-src 'self'` without any hash/nonce plumbing.
2. `apps/desktop/src-tauri/src/commands/manual.rs` now sets `closable`,
   `minimizable`, `maximizable`, `decorations`, and `visible` explicitly on the
   `WebviewWindowBuilder` (defensive — these match Tauri's documented defaults
   but pinning them rules out platform-specific drift).

**Definition of done**

- [ ] PR #53 reviewed + merged.
- [ ] Rebuild Windows installer → install fresh → Settings → Tentang → Buku
      Manual.
- [ ] Manual window renders fully styled with TOC + search + theme toggle.
- [ ] X button closes the manual window without Task Manager.
- [ ] Theme toggle button in the manual works.
- [ ] Search filter inside the manual works.

---

### BUG-010 — Buku Manual UI redesign + Tauri 2 CSP externalize

| Field | Value |
|---|---|
| Severity | **HIGH** |
| Status | `DONE` |
| Discovered | Windows production install (filed during BUG-009 review) |
| Supersedes | BUG-009 |
| PR | [#62](https://github.com/alviarts/perpustakaan-offline/pull/62) (merged 2026-05-04); Windows follow-up [#66](https://github.com/alviarts/perpustakaan-offline/pull/66) inlined CSS+JS to fully fix the blank-window regression |

**Where**

- `apps/manual/build.mjs` (manual HTML generator).
- `apps/desktop/public/manual/` (generated artefacts — gitignored).
- `apps/desktop/src-tauri/src/commands/manual.rs` (window builder flags).

**Summary**

Replaces the original BUG-009 fix (PR #53, closed without merge) with a
larger redesign of the Buku Manual surface plus the Tauri 2 production-CSP
workaround. PR #62 splits the manual into `index.html` + external `style.css`
+ `app.js` and refreshes the visual layout. PR #66 follow-up inlines CSS/JS
back into a single HTML to fully eliminate the Windows WebView2 blank-window
edge case under Tauri 2's runtime CSP.

**Definition of done**

- [x] Manual window renders fully styled on Windows production install.
- [x] X button closes the manual window without Task Manager.
- [x] Theme toggle + search filter work in the manual.
- [x] No regression to dev-mode manual rendering.

---

### BUG-011 — System tray + close-behavior setting + clean process exit

| Field | Value |
|---|---|
| Severity | **HIGH** |
| Status | `DONE` |
| Discovered | Windows production install |
| PR | [#63](https://github.com/alviarts/perpustakaan-offline/pull/63) (merged 2026-05-04) |

**Where**

- `apps/desktop/src-tauri/src/lib.rs` (window event handler, system tray).
- `apps/desktop/src/features/settings/...` (close-behavior preference).

**Summary**

The Windows install left orphaned background processes when the main window
was closed via the X button (the app icon stayed in the system tray but the
window could not be re-opened, and Task Manager showed the process still
running). PR #63 adds a system tray icon with a proper context menu
(Show / Quit), introduces a close-behavior setting ("close to tray" vs.
"quit on close"), and ensures the process exits cleanly when the user picks
"Quit".

**Definition of done**

- [x] System tray icon shows on Windows + Linux with Show/Quit menu.
- [x] Close-behavior setting persists in DB; default is "close to tray".
- [x] Quitting via tray menu fully terminates the process (no orphans).
- [x] Manual smoke on Windows installer confirms the regression is gone.

---

## Operational note — git auth

Devin's GitHub App lacks `Contents: write` + `Pull requests: write` on this
repo, so PRs from a Devin session require a user-supplied PAT (sent via the
secrets UI). As of 2026-05-04, the org-level secret is named **`GITHUB_PAT`**
(classic, scope `repo`) and is auto-injected as an env var into all Devin
sessions in the org. To push or create PRs, sessions use:

```bash
git push https://x-access-token:${GITHUB_PAT}@github.com/alviarts/perpustakaan-offline.git <branch>
GH_TOKEN=$GITHUB_PAT gh api repos/alviarts/perpustakaan-offline/pulls -X POST ...
```

To unblock future sessions permanently without a PAT, the user can grant the
Devin GitHub App write access at
<https://github.com/alviarts/perpustakaan-offline> →
Settings → Integrations → GitHub Apps → Devin → Configure.

---

## Triage / priority

In recommended fix order before shipping the next installer:

1. **BUG-001** (HIGH) — borrow flow is unusable on every fresh install.
2. **BUG-005** (HIGH) — KTA print disabled on every fresh install.
3. **BUG-009** (HIGH) — already in PR #53; merge first.
4. **BUG-002** (MEDIUM) — error UX is hostile; small surface, high impact.
5. **BUG-003** (MEDIUM) — Settings → Master Data is currently pointless.
6. **BUG-004** (MEDIUM) — DDC seeding closes the loop on revisi #17.
7. **BUG-006 / BUG-007** (MINOR) — cosmetic; opportunistic.
8. **BUG-008** (LOW / DESIGN) — design decision recorded above (Opsi 3); fix in PR #68.
