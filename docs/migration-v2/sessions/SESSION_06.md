# SESSION 06 — Peminjaman + Pengembalian

> **Devin session 6/12.** Transaksi inti: pinjam, kembalikan, denda, print
> nota. Pakai date picker custom + autocomplete dari sesi sebelumnya.

## Goal

- Date picker reusable (revisi #12): popup kalender, locale ID, range tahun
  configurable, "Hari Ini".
- Halaman Peminjaman (revisi #21): autocomplete anggota+buku, panel info,
  validasi, print nota, quick stats.
- Halaman Pengembalian: scan/select pinjaman aktif, hitung denda otomatis,
  update eksemplar.

## Revisi tercover

- #12 (date picker) — full
- #21 (Peminjaman komplit) — full

## Dependencies

- Sesi 4 COMPLETED (autocomplete anggota).
- Sesi 5 COMPLETED (autocomplete buku + master data).

## Tasks breakdown

### 1. Date picker (revisi #12)

- `src/components/ui/date-picker.tsx`:
  - Bungkus shadcn `Popover` + `Calendar` (react-day-picker).
  - Locale `id` dari `date-fns/locale`.
  - Props: `value`, `onChange`, `yearRange?`, `disabled?`.
  - Footer: button "Hari Ini" (set value ke today + close popup).
  - Keyboard nav built-in dari react-day-picker.
- `src/components/ui/date-range-picker.tsx`:
  - 2 calendar side-by-side (from-to).
  - Preset: "7 hari terakhir", "30 hari", "Bulan ini", "Tahun ini".

### 2. Backend Rust commands

- `src-tauri/src/commands/peminjaman.rs`:
  - `peminjaman_list(filter_status, query, limit, offset)`
  - `peminjaman_get(id)` (include items + anggota + denda calc)
  - `peminjaman_create(anggota_id, buku_ids[], tgl_pinjam, tgl_jatuh_tempo)`
    - Validasi: anggota tidak overdue / belum capai limit; eksemplar
      available.
  - `peminjaman_kembalikan(peminjaman_id, items[])` (sebagian / semua)
    - Hitung denda = max(0, hari_telat * tarif).
    - Update eksemplar status → tersedia.
    - Insert kas record (denda).
  - `peminjaman_quick_stats()` → { aktif_hari_ini, aktif_minggu_ini,
    overdue_count }
- `src-tauri/src/commands/pengembalian.rs`:
  - `pengembalian_search(query)` — autocomplete pinjaman aktif via NIS atau
    judul.

### 3. Halaman Peminjaman (revisi #21)

- `src/routes/_authed/peminjaman.tsx`:
  - Header: quick stats 3 card (Aktif Hari Ini / Aktif Minggu Ini / Overdue).
  - Layout 2-kolom:
    - Kiri: form input
      - Autocomplete Anggota (revisi #20).
      - Autocomplete Buku (multi-select up to N).
      - Date range picker (tgl pinjam, tgl jatuh tempo).
      - Validasi inline.
      - Submit + Print Nota toggle.
    - Kanan: panel info
      - Anggota terpilih: foto, nama, kelas, riwayat pinjam (mini-list).
      - Buku terpilih: cover, judul, eksemplar tersedia.
- `src/routes/_authed/peminjaman/list.tsx`:
  - Tabel pinjaman aktif/lalu.

### 4. Halaman Pengembalian

- `src/routes/_authed/pengembalian.tsx`:
  - Autocomplete (search NIS / judul / kode pinjaman).
  - Tampil card detail: anggota, buku-buku, tgl pinjam, tgl jatuh tempo,
    denda calculated.
  - Tombol "Kembalikan Semua" / "Kembalikan Sebagian" (checkbox per item).
  - Konfirmasi → submit → toast success + tombol "Print Nota Pengembalian".

### 5. Print nota

- `src/lib/pdf/nota.ts`:
  - Generate PDF mini (5×7cm thermal atau A5).
  - Pakai `pdf-lib`.
  - Header: identitas perpustakaan (revisi #11 — pakai `identityStore`).
  - Body: anggota, list buku, tgl pinjam, jatuh tempo, total denda.
- Print via:
  - Save → buka di default PDF viewer (cross-platform).
  - Atau `tauri-plugin-printer` direct print (kalau available).

### 6. Tests

- Unit:
  - `denda.test.ts` (hitung hari telat × tarif).
  - `peminjaman-validation.test.ts` (limit per anggota, eksemplar
    available).
  - `date-picker.test.tsx` (locale, "Hari Ini" works).
- E2E:
  - `peminjaman.spec.ts`: pinjam → autocomplete → submit → print → kembalikan.
  - `pengembalian.spec.ts`: search → kembalikan partial.

### 7. Update PROGRESS.md

- Sesi 6 → COMPLETED.

## Deliverables

- File:
  - `src/components/ui/{date-picker,date-range-picker}.tsx`
  - `src-tauri/src/commands/{peminjaman,pengembalian}.rs`
  - `src/routes/_authed/peminjaman.tsx` + nested
  - `src/routes/_authed/pengembalian.tsx`
  - `src/lib/pdf/nota.ts`
  - i18n keys
- Tests: 3+ unit, 2 e2e.
- Recording: peminjaman happy path + pengembalian dengan denda.

## Definition of Done

- [ ] Date picker locale ID, "Hari Ini" works.
- [ ] Pilih anggota → panel info muncul (foto, nama, kelas, riwayat).
- [ ] Pilih buku → panel info muncul (cover, judul, eksemplar count).
- [ ] Validasi block: anggota overdue, eksemplar 0.
- [ ] Submit → record dibuat + nota PDF generated.
- [ ] Pengembalian: hitung denda otomatis, update eksemplar status.
- [ ] Quick stats real-time.
- [ ] CI pass.
- [ ] PROGRESS.md updated.
