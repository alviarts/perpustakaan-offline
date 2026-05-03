# SESSION 05 — Data Buku CRUD + Master Data komplit

> **Devin session 5/12.** Halaman Buku + 6 master data (DDC, Kategori,
> Bahasa, Jurusan, Kelas, Agama).

## Goal

- CRUD Buku lengkap (judul, ISBN, DDC, kategori, bahasa, eksemplar).
- Layout master/detail fix (revisi #16) tanpa empty state nyangkut.
- Master Data CRUD page di Settings (revisi #17 full):
  - DDC, Kategori, Bahasa, Jurusan, Kelas, Agama.
- Migration tabel baru (kategori, bahasa, jurusan, agama).
- Seed data: DDC dari `assets/ddc-source.txt`, Bahasa dari ISO 639-1
  (10 bahasa umum), Agama (6 agama resmi Indonesia), Kelas default 7A..12C.

## Revisi tercover

- #16 (fix layout Data Buku) — full
- #17 (dropdown master data + CRUD) — full

## Dependencies

- Sesi 4 COMPLETED.

## Tasks breakdown

### 1. Migration baru

- `src-tauri/src/db/migrations/002_master_data.sql`:
  - `kategori`, `bahasa`, `jurusan`, `agama` (lihat ARCHITECTURE.md §4).
  - Seed default values.
- `src-tauri/src/db/migrations/003_kta_templates.sql` (untuk Devin 10).
- Update migration runner di `main.rs`.

### 2. Backend Rust commands

- `src-tauri/src/commands/buku.rs`:
  - `buku_list(query, limit, offset, filter_ddc, filter_kategori, ...)`
  - `buku_get(id)` (sertakan eksemplar list)
  - `buku_create(payload)`, `buku_update(id, payload)`, `buku_delete(id)`
  - `buku_import_excel(file_path)`
  - `eksemplar_create(buku_id, kode_unik)`, `eksemplar_delete(id)`
- `src-tauri/src/commands/master_data.rs`:
  - generic CRUD untuk 6 master data (atau per-tabel kalau lebih clear).
  - `ddc_list`, `kategori_list`, ... (read by FE dropdown).

### 3. Halaman Buku (revisi #16)

- `src/routes/_authed/buku.tsx`:
  - Layout master/detail pakai `ResizablePanelGroup` (shadcn).
  - Panel kiri: tabel buku + search + filter.
  - Panel kanan: detail buku terpilih (cover, judul, ISBN, DDC, eksemplar
    list dengan barcode).
  - Empty state (no row picked): SVG illustration + CTA.
- Form add/edit buku: dialog (modal) atau side sheet.
  - Dropdown DDC (autocomplete pakai #20), Kategori, Bahasa.
  - Upload cover (Tauri file dialog → save ke
    `%AppData%/PerpustakaanOffline/covers/`).
- Import Excel buku (sama pattern dengan anggota).

### 4. Master Data CRUD (revisi #17)

- `src/routes/_authed/settings/master-data.tsx`:
  - Tabs 6 kategori: DDC, Kategori, Bahasa, Jurusan, Kelas, Agama.
  - Tiap tab: tabel + tombol Add/Edit/Delete (dialog form).
  - Validasi: nama unique per tabel.
- Pasang search di tiap tab (live search debounced).

### 5. Seed data

- `src-tauri/src/db/seed.rs` (atau ke migration):
  - DDC: import dari `apps/desktop/src-tauri/resources/seed/ddc.txt` (copy
    dari `assets/ddc-source.txt`).
  - Bahasa: array 10 ISO 639-1 (id, en, ar, jw, su, jv, zh, ja, fr, de).
  - Agama: ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].
  - Kelas: 7A..7C, 8A..8C, ..., 12A..12C (configurable later via Settings).
- Run on first launch (jika tabel masih kosong).

### 6. Tests

- Unit Vitest:
  - `master-data.test.ts` (CRUD logic).
  - `buku.test.ts` (zod schema validation).
- E2E Playwright:
  - `buku.spec.ts`: add buku + 3 eksemplar, edit, delete.
  - `master-data.spec.ts`: add kategori, edit, delete.

### 7. Update PROGRESS.md

- Sesi 5 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/db/migrations/002_master_data.sql`
  - `src-tauri/src/commands/{buku,master_data}.rs`
  - `src-tauri/src/db/seed.rs` (atau setara)
  - `src/routes/_authed/buku.tsx` + nested
  - `src/routes/_authed/settings/master-data.tsx`
  - `src/features/buku/components/{BookList,BookDetail,BookForm}.tsx`
  - i18n keys tambahan
- Tests: 2+ unit, 2 e2e.
- Screenshot: master/detail layout, master data tabs.

## Definition of Done

- [ ] Add buku + 3 eksemplar → tampil di list dengan badge "3/3 tersedia".
- [ ] Layout master/detail: pilih row → detail muncul; no row → empty state.
- [ ] 6 master data CRUD-able dari Settings.
- [ ] Dropdown DDC/Kategori/Bahasa di form buku auto-pull dari master data.
- [ ] Migration v2 jalan otomatis di first launch.
- [ ] Seed data masuk.
- [ ] CI pass.
- [ ] PROGRESS.md updated.
