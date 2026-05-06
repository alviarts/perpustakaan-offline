# v1.0.8 Sessions Log — append-only audit trail

> **Purpose:** track every Devin session that worked on the v1.0.8 batch.
> Append a new entry at the END of this file when you claim an item, when you open a PR, when you complete an item, and when you pause.
> NEVER edit existing entries — append new ones instead. This is the audit log.

---

## Format

Each entry is a markdown section with frontmatter-like fields:

```
### <session-id> — <item-id>

- **session_id**: devin-<uuid> (your session ID, visible in URL bar)
- **item_id**: BUG-NN | FEAT-NN
- **branch**: devin/<ts>-<slug>
- **pr**: #NNN or — (none)
- **started_at**: ISO-8601 timestamp
- **status**: STARTED | PR_OPEN | COMPLETED | PAUSED | ABANDONED
- **paused_at** / **completed_at**: ISO-8601 (when applicable)
- **notes**: 1-3 sentence summary of what was done / left to do.
- **pickup**: (when status=PAUSED) concrete steps for next Devin to resume.
```

---

## Entries

### devin-159bdc498990452ba6f4e38dec2ff5f3 — handoff doc

- **session_id**: `devin-159bdc498990452ba6f4e38dec2ff5f3`
- **item_id**: HANDOFF (meta — write the handoff doc itself, not a v1.0.8 batch item)
- **branch**: `devin/1778011820-v108-bugs-handoff`
- **pr**: TBD (will be opened when this commit pushed)
- **started_at**: 2026-05-05T19:30:00+00:00
- **status**: STARTED
- **notes**: Wrote SESSION_HANDOFF.md, PROGRESS.md, BUGS.md (14 items spec), WORKFLOW.md (continuous push + lock + pause policies), CONTINUOUS_AUTOMATION.md (master prompt), and seeded this SESSIONS.md. Scope locked with user via 12+ rounds of clarification:
  - Foto gepeng PDF + auto-smart-fit pipeline (BUG-19)
  - 10 desain KTA baru (FEAT-16)
  - Perpanjangan + Reservasi (FEAT-17, FEAT-18)
  - Bulk import anggota + buku ISBN (FEAT-19, FEAT-20)
  - Surat bebas pustaka + Wishlist (FEAT-21, FEAT-22)
  - Stocktake + Backup enhancement (FEAT-23, FEAT-24)
  - Dashboard analytics extended (FEAT-25)
  - Google Sheets bidirectional sync (FEAT-26) — multi-device backbone
  - OPAC public-mode kiosk (FEAT-27) — depends on FEAT-26
  - Sirkulasi scanner overlay + decoder v2 (FEAT-28) — manual scan button + ROI + preprocessing
- **pickup**: First Devin to take over after this PR merges should follow `CONTINUOUS_AUTOMATION.md` master prompt to claim Phase 1 items.

---

<!-- Append new entries below this line. Newest at the bottom. -->

### devin-159bdc498990452ba6f4e38dec2ff5f3 — PAT rotation

- **session_id**: `devin-159bdc498990452ba6f4e38dec2ff5f3`
- **item_id**: META (PAT rotation, not a v1.0.8 batch item)
- **rotated_at**: 2026-05-05T20:50:00+00:00
- **status**: COMPLETED
- **notes**: User rotated `GITHUB_PAT_ALVIARTS` org-scoped secret. Old prefix `ghp_zGSXKE...` → new prefix `ghp_c1xaCP...` (length 40, classic PAT). Verified via 4 endpoint tests:
  - `/user` → login: alviarts ✓
  - `/repos/alviarts/perpustakaan-offline` → permissions admin/maintain/push/triage/pull all true ✓
  - `/pulls/126` → state: open, mergeable: true ✓
  - `/rate_limit` → limit: 5000, remaining: 4995 ✓
- **WORKFLOW.md updated**: added 4-test verification block + last-rotated date.
- **CONTINUOUS_AUTOMATION.md updated**: added PAT-rotation fallback flow at setup step 2.
- **next devin**: PAT siap dipakai. Tidak perlu request ulang sampai expiration berikutnya. Cek `Last rotated` date di WORKFLOW.md kalau curiga PAT expired.

---

### devin-b879714a60e242ffa66120093f0b7265 — PR A (BUG-19 + FEAT-16)

- **session_id**: `devin-b879714a60e242ffa66120093f0b7265`
- **item_id**: BUG-19 + FEAT-16 (PR A — KTA foto fit + 10 desain baru)
- **branch**: `devin/1778013996-pr-a-kta-foto-fit-and-presets`
- **pr**: #127 (draft)
- **started_at**: 2026-05-05T20:46:00Z
- **status**: STARTED → DRAFT_PR_OPEN → PAUSED
- **paused_at**: 2026-05-05T21:13:00Z
- **paused_by_user_message**: "pause, push semua"
- **notes**: Claimed PR A per master prompt. **BUG-19 fully implemented** across 3 commits:
  - `5e95804` Layer 2 — frontend cover-fit canvas pre-crop in `pdf.ts` via new `lib/imageFit.ts` helpers (281 tests pass).
  - `8df59fd` Layer 1 — backend `smart_fit_to_portrait_bytes` + `assets_refit_anggota_photos` Tauri command + 10 new backend tests (138 backend tests pass, up from 128).
  - `326df6a` Layer 1c — admin "Re-fit semua foto" UI panel in `KtaSettingsPage.tsx` + `assetsApi.refitAnggotaPhotos()` binding + 8 i18n keys (parity ID/EN).
  - All gates green at pause point: typecheck ✓ lint ✓ i18n:lint ✓ test 281✓ build N/A cargo check ✓ cargo clippy ✓ cargo test 138✓.
- **pickup_instructions**:
  - Branch: `devin/1778013996-pr-a-kta-foto-fit-and-presets` (HEAD = `326df6a`).
  - Remaining work: **FEAT-16** — add 10 new KTA preset layouts to `apps/desktop/src/features/kta/presets.ts` and update `apps/desktop/tests/unit/ktaPresets.test.ts` from `toHaveLength(10)` → `toHaveLength(20)`. Spec for the 10 preset IDs/themes is in PR #127 body (TODO checklist) and `BUGS.md` PR A section.
  - After FEAT-16: re-run all gates, update PR body (drop the PAUSED preamble + add test plan), `curl PATCH /pulls/127 {"draft": false}`, wait CI green via `git pr_checks`, then on this v108-handoff branch flip PROGRESS.md PR A rows from `PAUSED` → `IN_PR` and update SESSIONS.md.

---

### devin-e87e91dd1b25420eb46e75b6d779fb27 — PAT rotation #2

- **session_id**: `devin-e87e91dd1b25420eb46e75b6d779fb27`
- **item_id**: META (PAT rotation, not a v1.0.8 batch item)
- **rotated_at**: 2026-05-05T21:16:54Z
- **status**: COMPLETED
- **notes**: User rotated `GITHUB_PAT_ALVIARTS` org-scoped secret again (auto-injection was missing at session start, length 0). New PAT: **fine-grained** type (prefix `github_pat_`, length 93) — different format from previous classic PAT (`ghp_c1xaCP...`, length 40). Both formats are accepted by the curl-based push/PR flow; no WORKFLOW.md change needed (the existing 4-test verification block already documents both length 40 + 90+ as valid).
- **4-test verification PASSED**:
  - `/user` → login: alviarts ✓
  - `/repos/alviarts/perpustakaan-offline` → permissions admin/maintain/push/triage/pull all true ✓
  - `/pulls/127` → state: open, draft: True (PR A still paused, expected) ✓
  - `/rate_limit` → limit: 5000, remaining: 4980 ✓
- **next devin**: PAT siap dipakai untuk semua sisa Phase 1 items. Cek `Last rotated` date di WORKFLOW.md kalau curiga PAT expired (current rotation: 2026-05-05).

---

### devin-e87e91dd1b25420eb46e75b6d779fb27 — PR B (FEAT-17 + FEAT-18) claim

- **session_id**: `devin-e87e91dd1b25420eb46e75b6d779fb27`
- **item_id**: FEAT-17 + FEAT-18 (PR B — Peminjaman: perpanjangan + reservasi)
- **branch**: `devin/1778015814-pr-b-peminjaman-extend-and-reserve`
- **pr**: #128 (DRAFT) — https://github.com/alviarts/perpustakaan-offline/pull/128
- **started_at**: 2026-05-05T21:16:54Z
- **first_push_at**: 2026-05-05T22:35:00Z (commit ea44e7d — backend + 12 unit tests, 143/143 cargo green)
- **status**: PR_OPEN (ready-for-review; backend + frontend complete; awaiting CI + user merge)
- **ready_for_review_at**: 2026-05-05T22:00:00Z
- **notes**: Picked PR B per master prompt — first OPEN row group with no `depends_on` and no live IN_PROGRESS_BY lock. PR A (BUG-19 + FEAT-16) is PAUSED with PR #127 (draft), so it is explicitly skipped per the "Active PR in flight / PAUSED rows" lock policy. FEAT-17 + FEAT-18 backend landed in commit ea44e7d (143/143 backend tests pass). Frontend landed in commits 97957b0 + 534d909: lib wrappers, PerpanjangDialog on PeminjamanDetail, ReservasiPage with admin filters + ConfirmDialogs, CreateReservasiDialog (anggota+buku autocomplete), reservasi-promoted toast in PeminjamanDetail.kembalikan, sidebar nav, full id+en reservasi i18n namespace + peminjaman keys. Vitest 290/290 (+18 net), typecheck/lint/i18n:lint/build all green. Skipped from PR scope: BukuList row Reservasi button (admin can use ReservasiPage create dialog) and AturanPeminjamanPage 2 settings UI (backend reads with default; can be a tiny follow-up PR). Draft → ready-for-review converted via GraphQL `markPullRequestReadyForReview`.
- **plan**:
  - Backend (Rust): additive migration adds `peminjaman.kali_perpanjangan`, `peminjaman.tanggal_perpanjangan_terakhir`; new `reservasi_buku` table; new commands `peminjaman_perpanjang(loan_id, days?)`, `reservasi_create/cancel/list_by_buku/list_by_anggota/mark_diambil/check_expired_tick`; settings keys `peminjaman.max_perpanjangan` (default 1, range 0-3) + `peminjaman.block_perpanjangan_jika_denda` (default false). Audit log entry on each extend.
  - Frontend (TS/React): `PerpanjangDialog.tsx` + Perpanjang button on `PeminjamanList.tsx` row; `ReservasiPage.tsx` route + sidebar link; conditional Reservasi button on `BukuList.tsx` row when buku status `dipinjam`; Pengembalian return-flow toast showing `slot_rak` + nama anggota berikutnya; `AturanPeminjamanPage.tsx` 2 new fields.
  - i18n: id+en parity for all new strings.
  - Tests: vitest + cargo test (target: net positive new tests).
- **pickup**: if pause: branch `devin/1778015814-pr-b-peminjaman-extend-and-reserve`, draft PR (TBD). Master prompt + this entry are sufficient context.

---

### devin-e87e91dd1b25420eb46e75b6d779fb27 — PR C (FEAT-19 + FEAT-20) claim

- **session_id**: `devin-e87e91dd1b25420eb46e75b6d779fb27`
- **item_id**: FEAT-19 + FEAT-20 (PR C — Bulk import: anggota Excel/CSV + buku via ISBN)
- **branch**: `devin/1778028075-pr-c-bulk-import-anggota-buku` (TBD)
- **pr**: #TBD
- **started_at**: 2026-05-06T00:41:15Z
- **status**: STARTED (claimed in parallel while #128 awaits user merge)
- **notes**: Claiming PR group C in parallel because PR #128 (PR group B) has been ready-for-review for 3+ hours with no merge action and no user response. Per master prompt's "Run multiple Devins in parallel" allowance + autonomous-mode persistence principle, claiming the next OPEN group is the productive path. Will continue polling #128 every ~10 min in background and switch back to update PROGRESS.md the moment merge is detected. PR group A (BUG-19 + FEAT-16) is PAUSED with #127 (draft), explicitly skipped.
- **plan**:
  - Backend (Rust): add `calamine = "0.x"` for Excel parsing. New `commands/anggota_import.rs` (`anggota_parse_file`, `anggota_bulk_insert`, optional overwrite-mode). New `commands/buku_import.rs` (`buku_isbn_fetch` via reqwest, `buku_bulk_insert_with_covers`). Both wrap insert in transaction for atomicity.
  - Frontend (TS/React): `AnggotaImportDialog.tsx` (drag-drop file + preview table + status badges + "Import N" button). `BukuImportDialog.tsx` (textarea ISBN paste + fetch metadata table + editable + "Import N" button). Trigger buttons on `AnggotaPage.tsx` and `BukuPage.tsx`. Public asset: `apps/desktop/public/templates/anggota-import-template.xlsx`.
  - i18n: id+en parity for all new strings.
  - Tests: vitest for parse/preview/validation logic + cargo test for bulk_insert atomicity + ISBN parsing.
- **pickup**: if pause: branch `devin/1778028075-pr-c-bulk-import-anggota-buku`, draft PR (TBD). Master prompt + this entry are sufficient context.

---

### devin-6b5acc6f8e4a4e778d85e9e626fccb1a — PAT rotation #3

- **session_id**: `devin-6b5acc6f8e4a4e778d85e9e626fccb1a`
- **item_id**: META (PAT rotation, not a v1.0.8 batch item)
- **rotated_at**: 2026-05-06T07:21:00Z
- **status**: COMPLETED
- **notes**: Previous PAT (`github_pat_...` length 93, rotated 2026-05-05T21:16Z) returned `401 Bad credentials` at session start. User generated a new fine-grained PAT (prefix `github_pat_`, length 93) via `secrets request` UI with `should_save=true, save_scope=org`. 4-test verification passed:
  - `/user` → login: alviarts ✓
  - `/repos/alviarts/perpustakaan-offline` → permissions admin/maintain/push/triage/pull all true ✓
  - `/pulls/128` → state: open, mergeable: True ✓
  - `/rate_limit` → limit: 5000, remaining: 4998 ✓
- **next devin**: PAT siap. Cek `Last rotated` di WORKFLOW.md (perlu refresh ke 2026-05-06).

---

### devin-6b5acc6f8e4a4e778d85e9e626fccb1a — PR D (FEAT-21 + FEAT-22) claim

- **session_id**: `devin-6b5acc6f8e4a4e778d85e9e626fccb1a`
- **item_id**: FEAT-21 + FEAT-22 (PR D — Surat bebas pustaka + Wishlist)
- **branch**: `devin/1778052067-pr-d-anggota-surat-and-wishlist`
- **pr**: #TBD
- **started_at**: 2026-05-06T07:21:07Z
- **status**: STARTED
- **notes**: Picked PR D per master prompt — first OPEN row group with no `depends_on` and no live IN_PROGRESS_BY lock. Skipped:
  - PR A (#127, BUG-19+FEAT-16) — PAUSED, draft (master prompt step 5 only auto-claims `OPEN` rows).
  - PR B (#128, FEAT-17/18) — IN_PR ready-for-review, awaiting user merge.
  - PR C (#129, FEAT-19/20) — IN_PROGRESS by `devin-e87e91dd1b25420eb46e75b6d779fb27` claimed 2026-05-06T00:41:15Z (~6.7h ago, lock active <24h).
  - PR E/F/J — also OPEN with no deps but executed in PROGRESS.md row order.
- **plan**:
  - **FEAT-21 — Surat bebas pustaka**:
    - Backend: additive migration adds `surat_log` table + 5 settings keys (`surat.template_html`, `surat.nomor_terakhir`, `surat.format_nomor`, `surat.kepala_sekolah_nama`, `surat.kepala_sekolah_ttd_path`). New `commands/surat.rs` with `surat_check_eligibility(anggota_id) -> SuratEligibility { eligible, active_loans, outstanding_denda }`, `surat_generate(anggota_id, petugas_id) -> SuratGenerateResult { nomor_surat, anggota, ... }` (server-side eligibility re-check + atomic nomor increment + audit log + insert into `surat_log`), `surat_log_list(anggota_id?, limit?, offset?)`. Default Indonesian template seeded.
    - Frontend: `lib/surat.ts` wrapper; `features/anggota/SuratBebasPustakaDialog.tsx` (eligibility check then preview then download); button "Cetak Surat Bebas Pustaka" on `AnggotaDetailPage.tsx`. `features/settings/SuratPage.tsx` + sidebar/settings link with template editor (textarea HTML for now, document available placeholders). PDF rendering in `lib/suratPdf.ts` using existing jsPDF stack.
    - i18n: `surat.json` namespace id+en parity.
    - Tests: cargo unit tests for eligibility + nomor sequencing; vitest for lib + dialog state.
  - **FEAT-22 — Wishlist anggota**:
    - Backend: additive migration adds `wishlist_buku` table. New `commands/wishlist.rs` with `wishlist_create(anggota_id, judul, pengarang?, isbn?, alasan?)`, `wishlist_list(status?, limit?, offset?)`, `wishlist_update_status(id, status, catatan_admin?, buku_id?)`, `wishlist_upvote(id)`, `wishlist_delete(id)`.
    - Frontend: `lib/wishlist.ts`; `features/wishlist/WishlistAdminPage.tsx` (admin queue with filters per status + per-row actions setujui/tolak/sudah_diadakan + ConfirmDialog); `WishlistCreateDialog.tsx` (admin submits on behalf of anggota). Sidebar nav entry under common.menu.wishlist.
    - i18n: `wishlist.json` namespace id+en parity.
    - Tests: cargo unit tests for status transitions + upvote idempotency; vitest for browser-mock + dialog state.
- **pickup**: if pause: branch `devin/1778052067-pr-d-anggota-surat-and-wishlist`, draft PR (TBD). Master prompt + this entry sufficient.

### 2026-05-06T07:55:00Z — devin-6b5acc6f8e4a4e778d85e9e626fccb1a — PR D draft opened
- session: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- items: FEAT-21, FEAT-22 (PR D)
- status: PR_OPEN (draft)
- pr: #130
- branch: devin/1778052067-pr-d-anggota-surat-and-wishlist
- notes: backend complete (22 new cargo tests, 150 total); frontend in progress.

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — FEAT-23 (started)

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- item_id: FEAT-23 (Stocktake/Opname mode)
- started_at: 2026-05-06T07:55:00Z
- status: STARTED
- branch: devin/$(date +%s)-stocktake (will be created)

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — claim release FEAT-23 + claim PR A (FEAT-16)

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- released: FEAT-23 (rolled back to OPEN — never started implementation)
- claimed: BUG-19 + FEAT-16 (PR A — resume PAUSED PR #127)
- claimed_at: 2026-05-06T08:00:00Z
- branch: devin/1778013996-pr-a-kta-foto-fit-and-presets (existing)
- status: STARTED
- notes: User instructed to finish items bertahap (step-by-step) without skipping.
  Resuming PR A's PAUSED state per WORKFLOW.md "Pause protocol" — pickup
  instructions in PR #127 description. Only FEAT-16 remains (BUG-19 done).

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — PR A (FEAT-16) ready

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- item_id: BUG-19 + FEAT-16 (PR A — resumed PAUSED)
- branch: devin/1778013996-pr-a-kta-foto-fit-and-presets
- pr: #127 (ready-for-review)
- pr_opened_at: 2026-05-06T08:08:00Z
- status: PR_OPEN
- notes: 10 KTA preset baru ditambah ke `KTA_PRESETS` (total 20). Local
  gates clean (typecheck/lint/i18n:lint/test=282/build/cargo check). CI
  green (Rust + Node lint+typecheck+test). Awaiting user merge.

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — claim FEAT-23 (PR E)

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- item_id: FEAT-23 (PR E — Stocktake/Opname mode)
- started_at: 2026-05-06T08:10:00Z
- status: STARTED
- notes: Picked next OPEN row after PR A finalised. Skipped:
  - #129 (FEAT-19/20) — locked by devin-e87e91dd1b25420eb46e75b6d779fb27 since
    2026-05-06T00:41Z (~7.5h ago, lock <24h).
  Will revisit #129 take-over if lock expires (>24h) without progress.
- branch: TBD (will create devin/<ts>-pr-e-stocktake-opname from main)

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — FEAT-23 (PR E) ready

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- item_id: FEAT-23 (PR E — Stocktake/Opname mode)
- branch: devin/1778054856-pr-e-stocktake-opname
- pr: #131 (ready-for-review)
- pr_opened_at: 2026-05-06T08:30:00Z
- status: PR_OPEN
- notes: Stocktake / Opname mode lengkap — backend (7 commands, 6 unit
  tests = 134 backend total) + frontend (RPC layer + StocktakePage + PDF
  report + i18n + sidebar + route + 18 frontend tests = 291 frontend
  total). Local gates clean (typecheck/lint/test/build/cargo check/clippy/
  test). CI green (Rust + Node). Awaiting user merge.

## Session devin-6b5acc6f8e4a4e778d85e9e626fccb1a — claim FEAT-24 (PR E continued)

- session_id: devin-6b5acc6f8e4a4e778d85e9e626fccb1a
- item_id: FEAT-24 (PR E — Backup enhancement: history + encryption + cloud)
- started_at: 2026-05-06T08:35:00Z
- status: STARTED
- notes: Picked next OPEN row in order (bertahap per user instruction).
  Skipped: #129 still locked <24h.
  Scope plan: implement what's feasible without external OAuth credentials —
    1) backup_history table + history list UI + restore-from-history.
    2) Encrypted backup (.db.enc, AES-256 from user-set password).
    3) Notification toast after scheduled backup.
    4) Cloud target via local rclone CLI invocation (user installs rclone
       separately, app just calls binary). Drive/Dropbox direct API
       deferred to v1.0.9 because OAuth refresh-token flow needs UX
       extensive testing + user-supplied credentials.
- branch: TBD (will create devin/<ts>-pr-e-backup-enhancement from main)

## Session devin-f10a64e2bf1643febf5c99f96b707373 — claim FEAT-28 (PR J)

- session_id: devin-f10a64e2bf1643febf5c99f96b707373
- item_id: FEAT-28 (PR J — Sirkulasi scanner overlay + ROI decode + preprocessing + multi-decoder)
- started_at: 2026-05-06T10:20:19Z
- status: STARTED
- branch: TBD (will create devin/1778062819-pr-j-sirkulasi-scanner-v2 from main)
- notes: Picked next OPEN row per master prompt — FEAT-28 is the only OPEN row with no `depends_on` and no live IN_PROGRESS_BY lock. Skipped:
  - PR #127 (PR A, BUG-19+FEAT-16) — IN_PR ready-for-review.
  - PR #128 (PR B, FEAT-17/18) — IN_PR ready-for-review.
  - PR #129 (PR C, FEAT-19/20) — IN_PR draft, locked by devin-e87e91dd1b25420eb46e75b6d779fb27.
  - PR #130 (PR D, FEAT-21/22) — IN_PR draft.
  - PR #131 (PR E, FEAT-23) — IN_PR ready-for-review.
  - PR #132 (PR E, FEAT-24) — IN_PR.
  - PR #133 (PR G, FEAT-26) — IN_PR.
  - PR #134 (PR F, FEAT-25) — IN_PR.
  - FEAT-27 (PR H) — depends on FEAT-26 (still IN_PR, not DONE).
  - PAT auto-injection was missing at session start; user re-provisioned org-scoped GITHUB_PAT_ALVIARTS (classic ghp_, length 40, prefix ghp_c1xaCP — same PAT as 2026-05-05 rotation). 4-test verification all green.
- plan:
  - Frontend (TS/React): major rewrite of `apps/desktop/src/features/sirkulasi/useBarcodeScanner.ts` (currently 263 LOC, single-format @zxing decoder). Add overlay aiming guide on `SirkulasiPage.tsx` <video> element + ROI decode + preprocess pipeline + manual scan button + multi-format decode + optional torch. Existing dep `@zxing/browser` already supports multi-format via `MultiFormatReader` + DecodeHints (no library switch needed if @zxing covers EAN+Code128+QR+DataMatrix).
  - New utilities under `apps/desktop/src/lib/scanner/`:
    - `overlay.ts` — compute ROI rect from video dimensions (70% W × 30% H, centered, landscape barcode shape), render bracket corners math.
    - `preprocess.ts` — Canvas filter pipeline (grayscale, contrast +30%, sharpen kernel) with pure functions for testability.
    - `decoder.ts` — multi-format wrapper around `@zxing/browser` BrowserMultiFormatReader + DecodeHintType.POSSIBLE_FORMATS, exposing `decodeOnce(canvas)`, `decodeContinuous(video, onResult, onError)`, manual `decodeWithRetry(canvas, 3 variants)`.
  - i18n: id+en parity for new strings (overlay label, scan-now button, toast messages, torch label).
  - Tests: vitest unit tests for `overlay.ts` (ROI rect math), `preprocess.ts` (Canvas filter pure transforms with mock ImageData), `decoder.ts` (mock @zxing reader → assert hint formats + retry order).
  - No backend/Tauri changes needed.
- pickup: if pause: branch `devin/1778062819-pr-j-sirkulasi-scanner-v2`, draft PR (TBD). Master prompt + this entry sufficient.
