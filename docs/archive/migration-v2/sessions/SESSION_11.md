# SESSION 11 — Settings comprehensive + manual book + audit wording

> **Devin session 11/12.** Settings 12 sub-page final + Manual HTML +
> sweep wording terakhir.

## Goal

- Settings 12 sub-page (revisi #24): mirip Google Workspace settings, search
  bar global, tooltip, reset to default.
- Manual HTML responsif (revisi #4): generate dari Markdown, bundle ke
  resources, buka via tombol Header.
- Audit wording final (revisi #25): sweep semua label/dialog/error/i18n.

## Revisi tercover

- #4 (manual HTML) — full
- #24 (Settings 12 kategori) — full
- #25 (audit wording) — full sweep

## Dependencies

- Sesi 3 COMPLETED (header).
- Sesi 5 COMPLETED (master data).
- Sesi 10 COMPLETED (KTA template editor).

## Tasks breakdown

### 1. Settings layout

- `src/routes/_authed/settings.tsx` (parent layout):
  - Sidebar nav 12 sub-page (icon + label):
    1. Identitas Perpustakaan
    2. Aturan Peminjaman (rename dari "Transaksi")
    3. Master Data (sudah ada di Devin 5, integrasi sub-nav)
    4. KTA Template (sudah ada di Devin 10, integrasi sub-nav)
    5. Tampilan (theme, font scale, density)
    6. Bahasa (ID/EN)
    7. Akun & Pengguna (CRUD users + role)
    8. Hak Akses (Permissions matrix)
    9. Backup & Restore (sudah ada di Devin 9, integrasi sub-nav)
    10. Sinkronisasi (Google Sheets opsional)
    11. Audit Log
    12. Tentang
  - Search bar global di top sidebar nav (filter setting items real-time).
  - Tombol "Reset to default" per sub-page + global.

### 2. Tiap sub-page (yang belum dibuat sesi sebelumnya)

- **#1 Identitas**: form nama_perpustakaan, alamat, kepala, NPSN, logo
  upload.
  - Submit → emit Tauri event `identity:changed`.
- **#2 Aturan Peminjaman**: limit per anggota, durasi default, tarif denda
  per hari, hari libur.
- **#5 Tampilan**: theme dropdown (already #8), font scale slider, density
  (compact/comfortable).
- **#6 Bahasa**: select ID/EN.
- **#7 Akun & Pengguna**: tabel users CRUD (admin/pustakawan), reset password.
- **#8 Hak Akses**: matrix per-role permissions (checkbox per command).
- **#10 Sinkronisasi**: setup Google Sheets API key, tombol "Sync sekarang",
  status terakhir.
- **#11 Audit Log**: tabel filterable (user, action, target, timestamp).
- **#12 Tentang**: versi app, link GitHub, kredit "alvi arts / vwrks", tombol
  "Buka Manual" (link revisi #4).

### 3. Manual HTML (revisi #4)

- Source: split `docs/manual.md` (legacy) + content tambahan v2 →
  `docs/migration-v2/manual/*.md`.
  - Chapter: Pengantar, Setup, Login, Anggota, Buku, Peminjaman, Pengembalian,
    Kunjungan, Laporan, KTA, Settings, FAQ, Troubleshooting.
- Build:
  - Pakai static gen sederhana: VitePress / mdBook / Astro starter
    minimal.
  - Output `dist/` di-copy ke `apps/desktop/src-tauri/resources/manual/`.
  - Build step: `pnpm --filter manual build` (sub-package `apps/manual` atau
    integrated).
- Frontend:
  - Tauri command `open_manual()` → `shell.open(path/to/index.html)`.
  - Tombol "Manual" di Header membuka di browser default.
- Manual harus:
  - Responsif (breakpoint 768).
  - Search bar.
  - Dark mode toggle.
  - Header inject identitas perpustakaan (template).

### 4. Audit wording (revisi #25)

- Grep semua "Transaksi" → ganti "Aturan Peminjaman" di:
  - i18n JSON (id + en)
  - Component label
  - Toast / dialog
  - PDF/Excel header
- Sweep konsistensi:
  - Title Case untuk label utama
  - Sentence case untuk help text
  - Error message friendly (no "Foreign key constraint", dll.)
- Lint i18n: pastikan tidak ada key tidak terpakai (custom script
  `pnpm i18n:lint`).

### 5. Tests

- Unit: `i18n-coverage.test.ts` (semua key di id + en).
- Unit: `settings-search.test.ts` (filter logic).
- E2E: `settings.spec.ts`:
  - Search "denda" → muncul di "Aturan Peminjaman" hanya.
  - Reset to default → konfirmasi → revert.
  - Buka Manual → window/tab baru terbuka dengan URL manual.

### 6. Update PROGRESS.md

- Sesi 11 → COMPLETED.

## Deliverables

- File:
  - `src/routes/_authed/settings/*.tsx` (12 sub-page total)
  - `apps/manual/` (atau setara, generate HTML)
  - `apps/desktop/src-tauri/resources/manual/index.html` + assets
  - `apps/desktop/src-tauri/src/commands/manual.rs` (open command)
  - i18n full coverage
  - `scripts/i18n-lint.ts`
- Tests: 2+ unit + 1 e2e.
- Screenshot 12 sub-page settings + manual page.

## Definition of Done

- [ ] 12 sub-page nav works.
- [ ] Search bar real-time filter.
- [ ] Tooltip on-hover.
- [ ] Reset to default works (confirm dialog → revert).
- [ ] Manual HTML responsif + search + dark mode + identitas inject.
- [ ] Tombol Manual di Header membuka browser default.
- [ ] Tidak ada string "Transaksi" sebagai menu.
- [ ] i18n lint pass (no missing/orphan keys).
- [ ] CI pass.
- [ ] PROGRESS.md updated.
