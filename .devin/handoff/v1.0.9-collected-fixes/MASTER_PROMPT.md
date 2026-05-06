# v1.0.9 Continuous Automation — Master Prompt

> **Audience:** the user (`@alviarts`) — paste this to a fresh Devin session to
> complete the v1.0.9 release in one shot.
>
> **Tracking PR:** https://github.com/alviarts/perpustakaan-offline/pull/140
> (DRAFT, branch `devin/1778080235-fix-buku-import-eksemplar`).
>
> **Previous session:** https://app.devin.ai/sessions/66f0e55e455f413894a4e3ba6da395b3

---

## Master prompt — copy-paste this to start

```
Lanjutkan PR #140 di alviarts/perpustakaan-offline (branch
devin/1778080235-fix-buku-import-eksemplar) — release v1.0.9 collected
fixes. Semua dikerjakan di 1 PR, 1 branch.

## Setup

1. Clone https://github.com/alviarts/perpustakaan-offline if not present.
   Checkout branch `devin/1778080235-fix-buku-import-eksemplar`, pull latest.
2. Verify GITHUB_PAT_ALVIARTS env var (org-scoped, auto-injected).
   Quick test: `curl -sS -H "Authorization: token $GITHUB_PAT_ALVIARTS"
   https://api.github.com/repos/alviarts/perpustakaan-offline | jq .full_name`
   — must return "alviarts/perpustakaan-offline". If fails: request secret
   via `secrets` tool (secret_name=GITHUB_PAT_ALVIARTS, should_save=true,
   save_scope=org). Block on user for the value.
3. Read these files for context:
   - PR #140 body (view via `git view_pr` or curl GET the PR) — full scope
     table + per-section specs §2-§6.
   - `.devin/handoff/v1.0.8-bugs-batch/WORKFLOW.md` — authentication,
     gate order, push commands, merge via curl.
   - `.devin/handoff/v1.0.9-collected-fixes/MASTER_PROMPT.md` (this file).

## What's already done (subtask §1)

- PR #139 (stocktake `u.full_name` fix) — already merged to main.
- First commit on PR #140 branch: `fix(buku)` import seeds eksemplar +
  backfill_missing_eksemplar migration. 256/256 cargo tests pass, clippy clean.

## Remaining subtasks (implement in order)

### §2 — OPAC enhancements

Goal: OPAC landing page should default-show the FULL book catalog (like an
e-library), not an empty state. Each book card shows stats. Broken cover
images get a graceful fallback.

Implementation:
1. Find the OPAC landing page (likely `apps/desktop/src/features/opac/`).
   On mount, call `opac_search` (or `bukuApi.list()`) with no query — show
   all books by default, paginated.
2. Per book card, show: title, author, cover image (with onError fallback),
   badge "Tersedia" count, total eksemplar, total lifetime peminjaman.
   - `total_eksemplar` and `sisa_tersedia` already live in `buku` table.
   - Lifetime peminjaman: `SELECT COUNT(*) FROM peminjaman WHERE eksemplar_id
     IN (SELECT id FROM eksemplar WHERE buku_id = ?)`.
   - Either add a `views` counter (simplest: `buku.opac_views INTEGER DEFAULT
     0`, increment in the OPAC detail command) or skip if scope creep.
3. Cover fallback: wrap `<img>` with `onError` handler that hides the broken
   icon and shows the placeholder (book icon + "Tidak ada cover" text).
   Existing pattern: look for `LabelBukuPreview` or similar components that
   already handle missing covers.

### §3 — Bayar Denda preset buttons

Goal: on the Peminjaman detail / Pengembalian page, below the "Bayar Denda"
number input, show 3 quick-select buttons: Rp 5.000, Rp 10.000, Rp 15.000.
Clicking one sets the input value (replace).

Implementation:
1. Find the component that renders "Bayar Denda" input (search for
   `bayarDenda` or `bayar_denda` or `Bayar Denda` in .tsx files).
2. Add 3 `<Button variant="outline" size="sm">` below the input.
3. Each button label: `Rp 5.000`, `Rp 10.000`, `Rp 15.000`.
4. onClick: `setFieldValue('bayarDenda', 5000)` (or 10000 / 15000).
5. Use `Intl.NumberFormat('id-ID')` for display if needed.

### §4 — Sheets sync FEAT-26 extend

Goal: the Sheets sync feature (Settings → Sinkronisasi Google Sheets)
currently covers only the `anggota` table. Extend it to also support:
`buku`, `eksemplar`, `peminjaman`.

Implementation:
1. Find the sync engine: `apps/desktop/src-tauri/src/commands/sheets_sync.rs`
   (or similar). Study how `anggota` push/pull works — column mappings,
   upsert logic, conflict resolution.
2. Replicate the same pattern for:
   - **buku**: columns → kode_buku, judul, pengarang, penerbit, tahun_terbit,
     isbn, kategori, jumlah_eksemplar, bahasa, kode_ddc.
   - **eksemplar**: columns → kode_eksemplar, buku_id (resolve via kode_buku
     foreign-key lookup), status.
   - **peminjaman**: columns → kode_peminjaman, anggota_id (resolve via
     kode_anggota), eksemplar_id (resolve via kode_eksemplar),
     tanggal_pinjam, tanggal_kembali, status, denda.
3. Pull order (topological): anggota → buku → eksemplar → peminjaman.
   Enforce this order in the pull handler.
4. Update the Settings UI to show sync controls for all 4 tables (not just
   anggota). Remove the yellow notice "Catatan: PR ini meng-cover push &
   pull untuk tabel Anggota. Tabel lain (buku, eksemplar, peminjaman, ...)
   menyusul di rilis selanjutnya."
5. Add tests for each new table's push/pull round-trip.

### §5 — Layout responsive full-width

Goal: list pages (Anggota, Buku, Peminjaman, Pengembalian, Reservasi,
Wishlist, Stocktake, Kunjungan) should fill the full viewport width like
Dashboard does — no empty space on the right. Flexible between windowed
(~1024px) and fullscreen (1920px+).

Implementation:
1. Find the layout wrapper: `apps/desktop/src/components/layouts/` or the
   AppShell that wraps page content. Compare how Dashboard page is wrapped
   vs. how list pages are wrapped.
2. Likely fix: the list pages use a `max-w-*` constraint that Dashboard
   doesn't. Either remove `max-w-*` or replace with `w-full`.
3. Ensure the table columns stretch naturally (use `table-auto` or
   proportional `w-[x%]` on key columns).
4. Test at multiple viewport sizes (1024px, 1440px, 1920px). You can
   resize via Chrome DevTools or the Tauri window.

### §6 — Version bump + CHANGELOG + release

Only do this AFTER §2-§5 are complete and all gates pass.

1. Bump `1.0.8` → `1.0.9` in:
   - `package.json`
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/Cargo.toml`
   - `apps/desktop/src-tauri/tauri.conf.json`
2. Update `CHANGELOG.md` — add `## [1.0.9] - <YYYY-MM-DD>` above `[1.0.8]`:
   - **Fixed:** stocktake u.full_name (#139), buku_import eksemplar,
     broken cover image fallback, OPAC empty default
   - **Added:** OPAC stats per card, Bayar Denda preset buttons, Sheets
     sync for buku/eksemplar/peminjaman tables
   - **Changed:** Layout responsive full-width on list pages
3. Run full gates one final time.
4. Commit: `release: v1.0.9`
5. Push branch.

## Gate commands (run ALL before each push)

```bash
cd apps/desktop && pnpm typecheck && pnpm lint && pnpm i18n:lint && pnpm test && pnpm build
cd src-tauri && cargo check --all-targets && cargo clippy --all-targets -- -D warnings && cargo test --lib
```

## Push & merge protocol

Push:
```bash
git -c "http.extraheader=" -c "credential.helper=" \
  push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" \
  devin/1778080235-fix-buku-import-eksemplar:devin/1778080235-fix-buku-import-eksemplar
```

Flip draft → ready:
```bash
curl -sS -X PATCH \
  -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"draft": false}' \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/140
```

Wait CI green via `git(action="pr_checks", repo="alviarts/perpustakaan-offline", pull_number=140, wait_mode="all")`.

Squash-merge:
```bash
curl -sS -X PUT \
  -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"merge_method": "squash", "commit_title": "release: v1.0.9 — collected fixes + sheets sync expansion (#140)"}' \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls/140/merge
```

Tag + push (triggers release-v2.yml auto-build):
```bash
git fetch origin main && git checkout main && git pull --ff-only
git tag -a v1.0.9 -m "v1.0.9 — collected fixes + sheets sync expansion

Fixed: stocktake u.full_name (#139), buku_import eksemplar, OPAC cover fallback
Added: OPAC stats, Bayar Denda presets, Sheets sync buku/eksemplar/peminjaman
Changed: Layout responsive full-width on list pages"
git -c "http.extraheader=" -c "credential.helper=" \
  push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" v1.0.9
```

## Continuous push policy

After every local-gates-green checkpoint: commit + push immediately. WIP
commits OK with `wip:` prefix. Do NOT accumulate uncommitted code locally.
This ensures the user (and parallel Devins) can always see progress.

## Commit convention

- Conventional commits: `fix(scope): message`, `feat(scope): message`
- Always include trailer:
  `Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>`

## Communication style

- Non-blocking message_user when: a subtask is done and pushed.
- Block only when: all subtasks done + v1.0.9 released (final message with
  release URL + installer list), OR genuinely blocked on user for something.
- Terse. Indonesian or English both fine. Always include PR/branch URLs.

## Pause handling

If user says "pause" / "stop" / "berhenti":
1. Commit WIP with `wip(<scope>): pause at <context>`.
2. Push branch.
3. Update PR #140 body checklist (tick what's done, add notes for WIP items).
4. Block on user with branch + summary + where to resume.

## Termination

When §6 is done and v1.0.9 GitHub Release is published:
- Send final blocking message_user with release URL + installer asset list.
- Done.
```

---

## Quick reference

| Key | Value |
|-----|-------|
| Repo | `alviarts/perpustakaan-offline` |
| Branch | `devin/1778080235-fix-buku-import-eksemplar` |
| PR | #140 (DRAFT) |
| PAT secret | `GITHUB_PAT_ALVIARTS` (org-scoped, auto-injected) |
| Previous session | `devin-66f0e55e455f413894a4e3ba6da395b3` |
| Rust | 1.95.0 |
| Node/pnpm | >=20.0.0 / 9.15.1 |
| Release workflow | `.github/workflows/release-v2.yml` (triggers on tag `v*`) |
