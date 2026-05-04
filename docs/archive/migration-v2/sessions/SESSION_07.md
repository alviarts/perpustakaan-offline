# SESSION 07 — Kunjungan redesign

> **Devin session 7/12.** Halaman Kunjungan modern: ilustrasi transparan,
> quick stats, filter date range.

## Goal

- Redesign Kunjungan (revisi #18):
  - Bg ilustrasi transparent (asset SVG, theme-aware).
  - 3 quick stat card (hari ini, minggu ini, bulan ini).
  - Filter date range (pakai date picker dari Devin 6).
  - Live search debounced (Devin 4 hook).
  - Tabel kunjungan (Nama, Kelas, Jam Masuk, Tujuan).
  - Tombol "Tambah Kunjungan" (autocomplete anggota → 1-click insert).

## Revisi tercover

- #18 (Kunjungan redesign) — full

## Dependencies

- Sesi 3 COMPLETED (layout shell).
- Sesi 4 COMPLETED (autocomplete anggota + live search hook).

## Tasks breakdown

### 1. Backend

- `src-tauri/src/commands/kunjungan.rs`:
  - `kunjungan_list(date_from, date_to, query, limit, offset)`
  - `kunjungan_create(anggota_id, tujuan)` — auto set jam masuk = now.
  - `kunjungan_quick_stats()` → { hari_ini, minggu_ini, bulan_ini }.

### 2. Frontend

- `src/routes/_authed/kunjungan.tsx`:
  - Header: 3 quick stat card (icon + angka besar + label).
  - Toolbar: search input + date range picker + tombol "Tambah Kunjungan".
  - Bg ilustrasi transparent SVG (placeholder, swap di Devin 12 #6).
  - Tabel kunjungan dengan kolom Nama, Kelas, Jam Masuk, Tujuan, Action.

### 3. Modal "Tambah Kunjungan"

- Autocomplete anggota.
- Dropdown tujuan (opsi: Membaca, Pinjam Buku, Tugas, Lainnya).
- Submit → insert + close + refresh tabel.

### 4. Tests

- Unit: `quick-stats.test.ts` (date range calc).
- E2E: `kunjungan.spec.ts`:
  - Tambah kunjungan → quick stat hari ini +1.
  - Filter range tanggal → tabel update.

### 5. Update PROGRESS.md

- Sesi 7 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/commands/kunjungan.rs`
  - `src/routes/_authed/kunjungan.tsx`
  - `src/features/kunjungan/components/*`
  - i18n keys
- Tests: 1 unit + 1 e2e.
- Screenshot kunjungan light + dark.

## Definition of Done

- [ ] 3 quick stat real-time.
- [ ] Filter date range update tabel.
- [ ] Bg ilustrasi transparent (light + dark variant).
- [ ] Tambah kunjungan satu-klik via autocomplete.
- [ ] Live search ketik 2+ char → filter dalam 200ms.
- [ ] CI pass.
- [ ] PROGRESS.md updated.
