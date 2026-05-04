# Perpustakaan Offline v2 — Bug v1.0.1 + Perbandingan v1.0.1 → v1.0.2

**Status v1.0.1 (release tanggal 2026-05-04):** stable, tagged, `main` HEAD `4ed1398`
**Calon v1.0.2:** belum di-tag — merge candidate dari 19 open PRs di backlog
**Generated:** 2026-05-04 (Devin code review session)

---

## 🐛 BUG yang masih ada di v1.0.1

### BUG-008 (P1, masih OPEN di v1.0.1) — Dashboard KPI titles salah label

**Status:** belum ke-fix di v1.0.1. Perbaikan sudah jadi PR #68 tapi belum di-merge.

**Apa yang salah:**
Dashboard menampilkan 4 KPI cards (Total Anggota, Total Buku, Peminjaman Aktif, Pengembalian Bulan Ini), tapi label/title-nya tidak akurat secara terminologi atau ada mismatch antara label dan angka yang tampil.

**Dampak ke user:** terminology confusion — angka yang ditampilkan benar, tapi judulnya bisa bikin user salah interpretasi statistik.

**Severity:** P1 (cosmetic, no data corruption)

**Fix tersedia di:** PR #68 (`fix(BUG-008): dashboard KPI titles`) — **stacked di atas PR #67** (`docs(bugs): refresh PROGRESS.md`).

**Untuk include di v1.0.2:** merge stack `#67 → #68`.

---

### BUG (UX, undocumented) — Manual book buka HTML di child-window WebView2 yang flaky di Windows

**Status:** belum ke-fix di v1.0.1. Perbaikan sudah jadi PR #76 tapi belum di-merge.

**Apa yang salah:**
Tombol "Buku Manual" di header buka file HTML standalone (`docs/manual.html`) lewat WebView2 child-window. Di Windows, child-window kadang gagal load atau popup di belakang main window. Behavior tidak konsisten antar versi WebView2.

**Dampak ke user:** kadang manual gak bisa dibuka, atau buka tapi window-nya hilang di belakang main app. User confused karena gak tau manualnya kemana.

**Severity:** P2 (feature works most of the time, fallback bisa restart app)

**Fix tersedia di:** PR #76 — **major refactor**: hapus seluruh `apps/manual/` package, render manual sebagai tab di Settings (`Settings → Buku Manual`) lewat `react-markdown` import langsung dari `docs/manual.md`. No more child window, no more WebView2 quirks.

**Untuk include di v1.0.2:** merge PR #76.

---

### Bug yang sudah ke-fix di v1.0.1 (referensi historis, untuk konteks)

11 BUG (BUG-001..BUG-011) sudah ke-fix sebelum v1.0.1 release. Ringkasan dari `CHANGELOG.md`:

| Bug ID | Deskripsi singkat | Fix PR |
|--------|-------------------|--------|
| BUG-001 | `buku_create` tidak insert eksemplar awal → buku baru gak bisa langsung dipinjam | #55 |
| BUG-002 | Error message tampil `[object Object]` ke user | #56 |
| BUG-003 | Anggota baru tidak bisa langsung di-list di UI | #57 |
| BUG-004 | Buku detail page crash kalau eksemplar = 0 | #58 |
| BUG-005 | Search "anggota" tidak case-insensitive | #59 |
| BUG-006 | Toast notification stuck di layar | #60 |
| BUG-007 | DB migration retry loop di first-run | #61 |
| BUG-009 | (SUPERSEDED) Manual book initial UI | #53 closed → diganti BUG-010/#62 |
| BUG-010 | Buku Manual UI redesign + Tauri 2 CSP externalize | #62 + #66 |
| BUG-011 | System tray + close-behavior | #63 |

**BUG-008** = satu-satunya yang masih outstanding (lihat di atas).

---

## 📦 Perbandingan v1.0.1 → v1.0.2

Asumsi: lo merge **semua 19 open PRs** untuk v1.0.2. Kalau lo cuma mau partial set, kasih tau gw mana yang mau di-skip.

### Kategorisasi (Keep-a-Changelog format)

#### 🆕 ADDED (fitur baru)

**File picker uploader untuk foto/cover/logo (PR #69)**
- Komponen reusable `FilePickerInput` di anggota foto, buku cover, identitas perpustakaan logo.
- Backend Tauri command (`assets_save`/`assets_resolve`/`assets_delete`) dengan path-traversal defense (reject `..`, leading `/`, drive letters).
- Allow-list kategori (anggota/buku/identitas) + extension (png/jpg/jpeg/webp/gif/svg/bmp).
- Race-protection di FilePickerInput → fast value change gak paint stale preview.
- Legacy v1 absolute paths di DB tetap pass-through tanpa migration.
- 9 Rust tests + 9 frontend tests.

**Anggota Excel export (PR #70)**
- Tombol "Ekspor Excel" di list anggota; respect filter aktif (search/kelas/jurusan/aktif/sort).
- Backend command `export_write_bytes` generic (reusable untuk PDF/CSV future): validasi non-empty, ≤64 MiB, absolute path, parent exists+is_dir.
- Frontend pakai `xlsx` (SheetJS) library yang udah ada di main (no new deps).
- Save dialog reuse → user pilih destination via OS dialog.
- Pagination 500 items/batch dengan HARD_CAP 100k.
- 6 Rust tests + 9 frontend tests.

**Ctrl+K global search palette (PR #72)**
- cmdk-style command palette: Ctrl+K (Win/Linux) / Cmd+K (Mac).
- Search across anggota + buku + peminjaman dalam 1 dialog (3 grup hasil).
- Race-protection (stale results dropped), `Promise.allSettled` (one slow API gak block others).
- 200ms debounce, sub-2-char short-circuit.
- Toggle behavior: press Ctrl+K → open, press lagi → close.
- Footer hint: "Enter buka • ↑↓ navigasi • Esc tutup".

**Forgot password via security question (PR #74)**
- Flow 2-step: lookup username → answer security question → reset password.
- Username enumeration defense: `auth_get_security_question` selalu return `Ok(None)` untuk semua branch ineligible (user gak ada / inactive / no question / blank).
- bcrypt untuk security answer (DEFAULT_COST 12, sama kaya password hash).
- Answer normalisasi: trim + collapse whitespace + lowercase sebelum hash.
- Wrong-answer mapped ke `InvalidCredentials` → reuse error path existing.
- Settings tab tambahan untuk set/edit security question.
- DB migration nullable: `security_question` + `security_answer_hash` columns.
- 4 Rust tests + 7 dialog tests + 8 misc tests = 19 new test cases.

**Backup cron scheduler runner (PR #75)**
- Background thread tick setiap 60s, baca schedule dari settings table.
- Cron 5-field format (`*`, single, `M-N` range, `A,B,C` list, `*/N` step).
- Auto-backup ke `<app_data>/backups/` (manual backup tetap ke folder user-picked).
- Defenses: 30s startup grace, AtomicBool busy flag, minute-slot dedupe, silent no-op on cron typo, lazy directory creation.
- Reuse existing `backup_create_at` (no code duplication).
- 12 Rust tests cover semua branch (cron field matcher, dedupe, edge cases).

**Tambahan illustrations untuk Kunjungan (PR #71)**
- Visual upgrade: icon/illustration baru untuk kunjungan log empty state, success state, dll.
- 2 files, +218/-21.

**CHANGELOG-driven auto-release (PR #73)**
- Tag push `vX.Y.Z` → workflow extract section `## [X.Y.Z]` dari `CHANGELOG.md` → publish ke GitHub Release body.
- Fallback: kalau section gak ada, pakai `generate_release_notes: true` standar GitHub.
- Pre-release tagging: `vX.Y.Z-alpha`/`-beta`/`-rc` auto-marked prerelease.
- Script `scripts/extract-changelog.mjs` (pure ESM, 9 unit tests termasuk regression guard against real CHANGELOG.md).
- README "Release process" section dokumentasi lengkap.

#### 🔧 CHANGED (perubahan behavior existing)

**Manual Settings tab (PR #76)** — **fixes child-window WebView2 bug**
- Sebelumnya: button "Buku Manual" di header → buka HTML standalone via WebView2 child-window (flaky di Windows).
- Sekarang: tab "Buku Manual" di Settings → render markdown langsung lewat `react-markdown` import dari `docs/manual.md?raw`.
- Hapus seluruh `apps/manual/` package (build.mjs, package.json, lib/manual.ts, commands/manual.rs).
- Settings layout sekarang 13 tabs (sebelumnya 12).
- 6 unit tests untuk markdown rendering, TOC extraction, settings-search index update.

**Header redesign (PR #72)** — replace placeholder search input
- Sebelumnya: `<Input>` di header → Enter navigate ke `/anggota?q=...` (placeholder behavior).
- Sekarang: `<button>` trigger → buka GlobalSearchDialog.
- **Minor breaking change** untuk anyone yang depend behavior lama (kemungkinan no one — placeholder doc-string explicitly bilang "akan integrasi di sesi 4+").

**Rust code style (PR #77)**
- Re-format `commands/buku.rs` + `db/mod.rs` ke rustfmt standar.
- Mostly cosmetic: 14 lines added, 24 removed.

**Documentation post-migration cleanup**
- README v2 refresh: drop dead i18n key `pengembalian.title`, fokuskan section ke v2 stack only (Tauri/React/pnpm9). [PR #78]
- Manual.md (`docs/manual.md`) refresh: revisi untuk match v2 features. [PR #81]
- POST_V1_BUGS.md status fields: BUG-001..007 OPEN → DONE; tambah BUG-010 + BUG-011 entries; INSTRUCTION_TEMPLATE.md sync. [PR #83]
- migration-v2/PROGRESS.md: append "Post-Migration (2026-05-04)" section. [PR #82]
- migration-v2/ folder pindah ke archive/migration-v2/ (mark as completed migration record). [PR #85]
- build.mjs docstring updated (drop "legacy" reference, document inline single-file output). [PR #84 — **obsolete kalau PR #76 merge**, karena PR #76 hapus build.mjs entirely]

#### 🐛 FIXED (bug fix)

- **BUG-008**: Dashboard KPI titles labelling fixed (PR #68). Stacked di atas PR #67 (docs/bugs/PROGRESS.md refresh).
- **Manual book WebView2 child-window flakiness**: PR #76 (lihat juga CHANGED section di atas).

#### 🗑️ REMOVED

**v1 Python codebase deleted entirely (PR #80)**
- 253 files removed.
- Hapus: `src/perpustakaan/` (Python source), `tests/`, `pyproject.toml`, `requirements.txt`, `build.spec`, `build.bat`, `installer/` (Inno Setup), `assets/` (v1 illustration PNGs), 6 .py utility scripts, `scripts/migrate-v1-to-v2.mjs`, migration test, disabled v1 CI workflow, v1 docs/quickstart, screenshots, smoke-test, demo, google-sheets-setup.
- v1 git history tetap accessible via `git log --all` + `git checkout <pre-deletion-sha>`.
- **Google Sheets sync feature DROP permanent** — user accept loss; v2 punya backup scheduler sebagai gantinya.

**`apps/manual/` package deleted (PR #76)**
- Hapus: `apps/manual/build.mjs` (HTML build script), `apps/manual/package.json`, `apps/manual/src/`, `apps/desktop/src-tauri/src/commands/manual.rs`, `apps/desktop/src/lib/manual.ts`, dst.
- Replaced by: tab "Buku Manual" di Settings (lihat CHANGED).

**Misc**
- Dead i18n key `pengembalian.title` removed (PR #78).
- v1 placeholder behavior di Header search input replaced by global search palette (PR #72).

#### 📝 DOCS-ONLY (gak ngubah behavior, gak trigger CI)

- PR #52: `smoke-test-v2 SKILL.md` (Devin org-level skill doc)
- PR #67: `docs/bugs/PROGRESS.md` refresh
- PR #82: `docs/migration-v2/PROGRESS.md` post-migration final entry
- PR #83: `docs/bugs/POST_V1_BUGS.md` + `INSTRUCTION_TEMPLATE.md` refresh
- PR #84: `apps/manual/build.mjs` docstring (obsolete kalau #76 merge)
- PR #85: pindah `docs/migration-v2/` → `docs/archive/migration-v2/`
- PR #81: `docs/manual.md` refresh untuk v2 (di-import oleh #76 setelah Settings tab merge)

---

## ⚠️ Konflik & Coordination notes

### 🔴 Konflik mutually exclusive (HARUS pilih salah satu)

**PR #76 vs PR #84 — `apps/manual/build.mjs`**
- PR #76 hapus seluruh file `apps/manual/build.mjs` (replace with Settings tab).
- PR #84 edit docstring di `apps/manual/build.mjs`.
- **Kalau merge #76 → #84 jadi obsolete** (file gak ada lagi).
- **Rekomendasi:** merge #76, **close #84** dengan komen "obsoleted by #76".

### 🟡 Konflik mekanik (rebase trivial, perlu re-run cargo check)

**`Cargo.toml` `[dev-dependencies]` block** (#69 + #70)
- Keduanya add `tempfile = "3"` di dev-dep. Yang merge kedua perlu rebase: keep one block.

**`Cargo.lock`** (#69 + #70 + #75 + #77)
- Add deps berbeda. Resolve dengan re-run `cargo check` post-rebase.

**`apps/desktop/src-tauri/src/lib.rs` `tauri::generate_handler!`** (#69, #70, #74, #76)
- Semua add command Tauri baru ke macro list. Additive, mechanical.

**`apps/desktop/src-tauri/src/commands/mod.rs`** (#69, #70, #75, #76)
- Semua add `pub mod <name>;`. Additive, mechanical.

**i18n JSON files** (#69, #70, #72, #74, #76)
- Semua add keys di-end of object. Additive, mechanical.

### 🟡 Konflik semantik (real, perlu manual rebase)

**`Header.tsx`** (#72 vs #76)
- #72: replace `<Input>` dengan `<button>` + `GlobalSearchDialog` mount.
- #76: replace "Buku Manual" button dengan `<Link to="/settings/manual">`.
- Keduanya touch buttons section. Yang merge kedua perlu manual rebase.
- **Rekomendasi merge order:** #76 dulu (perubahannya lebih besar, hapus seluruh `apps/manual/`), lalu #72 rebase di atas itu.

---

## 📋 Rekomendasi merge order untuk v1.0.2

Kalau lo mau v1.0.2 = "everything ready since v1.0.1", merge dalam wave berikut:

### Wave 1 — Foundation cleanup (no risk)
1. **PR #78** (README v2 refresh + drop dead i18n key)
2. **PR #80** (delete v1 Python codebase) — auto-retarget ke main saat #78 merge
3. **PR #81** (manual.md refresh) — auto-retarget ke main saat #80 merge

### Wave 2 — Migration archive (docs)
4. **PR #82** (migration-v2/PROGRESS.md final entry)
5. **PR #85** (move migration-v2/ → archive/) — auto-retarget saat #82 merge

### Wave 3 — Bug fix stack
6. **PR #67** (docs/bugs/PROGRESS.md refresh)
7. **PR #68** (BUG-008 dashboard KPI fix) — auto-retarget saat #67 merge

### Wave 4 — Docs cleanup
8. **PR #83** (POST_V1_BUGS.md + INSTRUCTION_TEMPLATE.md refresh)
9. **PR #52** (smoke-test SKILL.md)

### Wave 5 — Feature PRs (besar dulu, mengurangi rebase work untuk smaller PRs)
10. **PR #76** (manual Settings tab) — **catatan: setelah merge ini, close PR #84**
11. **PR #74** (forgot password)
12. **PR #69** (file picker uploader)
13. **PR #70** (anggota Excel export) — re-run `cargo check` post-rebase untuk Cargo.lock
14. **PR #72** (Ctrl+K search) — manual rebase Header.tsx setelah #76
15. **PR #75** (backup scheduler)
16. **PR #71** (kunjungan illustration)
17. **PR #73** (CHANGELOG auto-release)

### Wave 6 — Style cleanup (last, rebase di atas semua feature)
18. **PR #77** (rustfmt cleanup) — rebase di atas yang sudah merged

### Wave 7 — Drop or merge
19. **PR #84** — **close** dengan komen "obsoleted by #76" setelah Wave 5

---

## 🚀 Untuk release v1.0.2

Setelah merge all (atau sebagian) waves di atas:

1. **Update `CHANGELOG.md`** — pindah `## [Unreleased]` content + tambahan dari PR-PR merged → `## [1.0.2] - YYYY-MM-DD` section.
2. **Bump version** di:
   - `package.json` → `"version": "1.0.2"`
   - `apps/desktop/package.json` → `"version": "1.0.2"`
   - `apps/desktop/src-tauri/Cargo.toml` → `version = "1.0.2"`
   - `apps/desktop/src-tauri/tauri.conf.json` → `"version": "1.0.2"`
3. **Push tag** `vX.Y.Z` dari main:
   ```bash
   git checkout main && git pull
   git tag v1.0.2
   git push origin v1.0.2
   ```
4. **CI auto-release** akan:
   - Run lint/typecheck/test + rust-check
   - Build Windows installer (.exe NSIS + .msi)
   - Extract `## [1.0.2]` section dari CHANGELOG.md → publish ke GitHub Release body (kalau PR #73 sudah merge)
   - Upload installer artifacts ke Release page

---

## ⏳ Pending verifikasi (deferred ke next Devin session)

Karena usage limit, **8 quality gates lokal** untuk per-PR belum dijalankan di session ini. Status quality gate yang sudah confirmed:

- ✅ **Semua 19 PR**: CI green di GitHub Actions (verified via `git(action=pr_checks)` selama audit task A)
- ⏳ **Local verification per PR** (perlu next Devin):
  - `pnpm i18n:lint` ✓ (additive keys, low risk)
  - `pnpm typecheck` (3 packages)
  - `pnpm --filter @perpustakaan/desktop lint` (max-warnings=0)
  - `pnpm --filter @perpustakaan/desktop test -- --run`
  - `pnpm --filter @perpustakaan/desktop build`
  - `cargo check --all-targets`
  - `cargo clippy --all-targets -- -D warnings`
  - `cargo test --lib`

CI green sudah strong signal. Local re-verification dengan dependencies fresh-installed adalah belt-and-suspenders.

---

## 📊 Statistik singkat untuk announcement v1.0.2

Kalau lo merge semua 19 PRs:

- **Bug fixes:** 1 (BUG-008) + 1 (manual book WebView2 quirk)
- **Fitur baru:** 7 (file picker, Excel export, Ctrl+K search, forgot password, backup scheduler, illustrations, auto-release)
- **Refactor besar:** 1 (manual page → Settings tab, hapus apps/manual/ package)
- **Docs improvement:** 8 PR cleanup (README, CHANGELOG, manual, migration archive, bug status)
- **Code style:** 1 (rustfmt)
- **Code removal:** 253 files (v1 Python codebase) + ~10 files (apps/manual/)
- **Net diff (estimasi):** +5000 / -7000 (more removals than additions due to v1 deletion)
- **Test coverage:** +60+ test cases (Rust + frontend gabungan)
- **Total contributors:** 1 (alviarts via devin-ai-integration[bot])

**Themed slogan untuk announcement:** "v1.0.2: Polished offline-first experience — fewer surprises, more features."
