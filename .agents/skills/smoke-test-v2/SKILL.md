---
name: smoke-test-v2
description: How to run a smoke test of the Perpustakaan Offline v2 Tauri app — default credentials, DB location, known fresh-install data-seeding gotchas, sqlite3 workarounds, and the recording flow. Use whenever a user asks to smoke test, regression test, or verify the v2 app end-to-end.
---

# Smoke testing the v2 Tauri app

The app is `apps/desktop` (Tauri 2.0 + React 18 + TS + Tailwind + shadcn/ui + Zustand + TanStack Router) backed by Rust + rusqlite + a SQLite db.

## Setup

1. Repo has no pre-commit hooks (verified). Commits pass without `--no-verify`.
2. **Linux deps** (already in environment.yaml `initialize`): `libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev sqlite3 wmctrl` + `rustup update stable` (the `time v0.3.47` crate needs `edition2024` ⇒ Rust ≥ 1.85; default rustup `stable` is current enough).
3. **JS deps** (already in environment.yaml `maintenance`): `pnpm install --frozen-lockfile` then `pnpm --filter @perpustakaan/desktop exec tsr generate` (TanStack Router route tree).
4. **Static checks** before any runtime testing:
   ```
   pnpm lint && pnpm typecheck && pnpm i18n:lint && pnpm test && pnpm build
   ```
   `pnpm test` runs Vitest, ~129 tests last seen; all should pass on a clean main.
5. **Run the app**: `pnpm tauri:dev`. First run compiles Rust deps (~5 min). Vite serves on `http://localhost:1420`. The Tauri webview window opens automatically.

## Default credentials

Fresh `seed_default_admin` (`apps/desktop/src-tauri/src/db/mod.rs:9-10`):

- username: `admin`
- password: `admin123`

The seed runs once when `users` table is empty. After first login, password is bcrypt-hashed at cost `bcrypt::DEFAULT_COST`.

## SQLite db location & inspection

`~/.local/share/id.alviarts.perpustakaan/perpustakaan-v2.db` (Linux). Note the `-v2` suffix — the v1 path was `perpustakaan.db` without it.

Useful inspection queries:
```
DB="$HOME/.local/share/id.alviarts.perpustakaan/perpustakaan-v2.db"
sqlite3 "$DB" ".tables"
sqlite3 "$DB" "SELECT id, kode_buku, judul, jumlah_eksemplar, jumlah_tersedia FROM buku;"
sqlite3 "$DB" "SELECT count(*) FROM eksemplar;"
sqlite3 "$DB" "SELECT count(*) FROM kta_templates;"
sqlite3 "$DB" "SELECT count(*) FROM ddc;"
```

Master data tables seeded by `seed_default_data`: `agama` (6), `kategori` (8), `kelas` (18), `jurusan` (6), `bahasa` (10). NOT seeded: `ddc`, `kta_templates`, `eksemplar`.

## Known fresh-install gotchas (as of `v1.0.0` / commit `46750cc`)

These block the happy-path smoke flow on a clean DB. Document the failure in the bug report instead of fixing the test plan — they are real bugs.

1. **`buku_create` does NOT insert eksemplar rows** even when `jumlah_eksemplar=N` is sent. The buku row is created with `jumlah_tersedia=N` (so the UI lies), but `eksemplar` table stays empty. Result: every `peminjaman_create` after a fresh `buku_create` fails with `tidak ada eksemplar tersedia untuk buku id=...`.

   **Workaround for testing only** (do NOT do this as a fix — fix `buku_create` instead):
   ```
   sqlite3 "$DB" "INSERT INTO eksemplar(buku_id, kode_eksemplar, status) VALUES (1, 'B0001-01', 'tersedia'), (1, 'B0001-02', 'tersedia');"
   ```

2. **Peminjaman error toast renders `[object Object]`**. Tauri `invoke()` rejects with a plain object (e.g. `{Validation: "..."}`); the form uses `String(err)` as fallback. Source: `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx:158-164`. To see the actual error, look in the Tauri dev shell output or in `commands/peminjaman.rs` AppError::Validation strings.

3. **Anggota form Kelas/Jurusan dropdowns are empty on a fresh DB**. They source from `anggota_distinct(field)` (existing values), NOT from the `kelas_list` / `jurusan_list` master_data commands. Agama works only because of a `FALLBACK_AGAMA` hardcoded constant in `AnggotaForm.tsx:33`. The autocomplete is creatable (`Gunakan "X-A"`) so testers can still proceed by typing freeform values.

4. **DDC table is empty** — `seed_default_data` doesn't seed Dewey codes. The Buku form's DDC picker shows "Tidak ada hasil". Same creatable autocomplete pattern as kelas — typeable workaround.

5. **`kta_templates` is empty** — no default template. Cetak KTA dropdown is empty, Cetak button stays disabled. To exercise the KTA flow, you must first create a template via the Settings → Kartu Tanda Anggota editor.

## Recommended smoke flow (14 steps)

This flow chains every major Tauri command so a single failure exposes downstream regressions:

1. Login `admin` / `admin123` → expect `/dashboard` redirect, greeting `Halo, Administrator`.
2. Empty dashboard → expect onboarding state `Mulai isi data perpustakaan` + CTAs (NOT `0 / 0 / 0` KPI cards — empty state replaces KPIs).
3. Anggota → Tambah → fill `A0001` `Budi Santoso`, agama=Islam (from FALLBACK), kelas/jurusan via creatable autocomplete (typing `X-A` / `TKJ`). Save.
4. Buku → Tambah → fill `B0001` `Atomic Habits` `James Clear` 2018, kategori=Fiksi (real master data), bahasa=id, Jumlah Eksemplar=2. Save. **Then run the eksemplar workaround above** (BUG-001 above).
5. Peminjaman → Pinjam Baru → autocomplete anggota=`Budi`, buku=`Atomic`, default dates → Simpan & Pinjam. Expect detail page with `PJ-YYYYMMDD-0001`.
6. Dashboard → expect KPI Anggota:1 / Buku:2 / Dipinjam:1; Top Peminjam = Budi; Top Buku = Atomic; auto-kunjungan visible.
7. Pengembalian → search `Budi` → tick eksemplar → Kembalikan 1 item → confirm.
8. Kunjungan → expect 1 row, sumber=Pinjam, keperluan=`Peminjaman buku` (auto-logged from step 5).
9. Laporan → Grafik / Top Peminjam / Top Buku / Kas / Backup tabs all render.
10. Anggota → click Cetak KTA — will fail empty-template-list (BUG-005), so document and skip if not yet fixed.
11. Settings → Identitas Perpustakaan → change Nama → Save → expect immediate sidebar header update (revisi #11 sync).
12. Theme switcher (top-right monitor icon) → Gelap → expect dark mode applied.
13. Language switcher (globe icon) → English → expect sidebar/labels translate (Anggota → Members, etc.).
14. User menu → Logout → expect `/login` redirect.

## Recording the smoke test

1. Maximize the Tauri window before starting:
   ```
   wmctrl -a "Perpustakaan Offline" && wmctrl -r "Perpustakaan Offline" -b add,maximized_vert,maximized_horz
   ```
2. `recording_start(hide_cursor=false)` so the user can see clicks.
3. Use structured `annotate_recording` calls — one `test_start` per step from the 14-flow, then a single high-signal `assertion` after each verifies the result. Group related checks into one assertion.
4. `recording_stop` with title ≤5 words and a 1–4 sentence summary leading with PASS/FAIL count.

## Reporting

Always write `test-report.md` in the repo root with:
- result table (one row per test step, PASS / PASS-with-workaround / FAIL)
- per-bug detail block: WHERE (file:line) / TRIGGER / OBSERVED / EXPECTED / SEVERITY / suggested fix
- inline screenshots (uploaded via `upload_attachment`)
- a "NOT tested" section listing what's deferred (Windows installer, v1→v2 migration, Excel import, etc.)

Attach: `test-report.md`, the recording `.mp4`, and key screenshots.
