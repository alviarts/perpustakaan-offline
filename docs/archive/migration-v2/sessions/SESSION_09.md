# SESSION 09 — Laporan komplit

> **Devin session 9/12.** 5 sub-page Laporan: Grafik, Top Peminjam, Top
> Buku, Kas, Backup.

## Goal

- Redesign Laporan (revisi #23):
  - Sidebar nav 5 sub-page.
  - Filter date range di tiap sub-page.
  - Grafik Kunjungan: line chart bulan/tahun.
  - Top Peminjam: tabel + bar chart 10 besar.
  - Top Buku: tabel + bar chart 10 besar.
  - Kas: tabel + line chart cumulative + breakdown denda vs manual.
  - Backup: backup full DB, restore, jadwal cron.
- Export PDF + Excel (header pakai identitas).

## Revisi tercover

- #23 (Laporan komplit) — full

## Dependencies

- Sesi 6, 7, 8 COMPLETED.

## Tasks breakdown

### 1. Backend

- `src-tauri/src/commands/laporan.rs`:
  - `laporan_grafik_kunjungan(date_from, date_to, granularity: 'day' | 'month' | 'year')`
  - `laporan_top_peminjam(date_from, date_to, limit)`
  - `laporan_top_buku(date_from, date_to, limit)`
  - `laporan_kas(date_from, date_to)` → { rows[], total_denda,
    total_manual, cumulative[] }
  - `laporan_export_pdf(jenis, date_from, date_to)` (return file path)
  - `laporan_export_xlsx(jenis, date_from, date_to)`
- `src-tauri/src/commands/backup.rs`:
  - `backup_create(target_dir)` → file `.db` + checksum SHA256.
  - `backup_restore(file_path)` (validation checksum).
  - `backup_schedule_get()`, `backup_schedule_set(cron, enabled)`.

### 2. Frontend

- `src/routes/_authed/laporan.tsx` (parent layout dengan sub-nav).
- `src/routes/_authed/laporan/grafik.tsx`
- `src/routes/_authed/laporan/top-peminjam.tsx`
- `src/routes/_authed/laporan/top-buku.tsx`
- `src/routes/_authed/laporan/kas.tsx`
- `src/routes/_authed/laporan/backup.tsx`

Tiap sub-page:
- Header: title + date range picker + tombol "Export PDF" + "Export Excel".
- Body: chart + tabel.

Backup page khusus:
- Tombol "Backup Sekarang" → Tauri dialog.save → pilih folder.
- Tombol "Restore" → file picker.
- Section "Jadwal": toggle on/off, cron expression input + preview ("setiap
  hari pukul 02:00").

### 3. Export PDF / Excel

- PDF pakai `pdf-lib` di TS:
  - Header: logo + nama perpustakaan + alamat + "Laporan <jenis> - <periode>".
  - Body: tabel.
  - Footer: tanggal generate + signature line.
- Excel pakai `xlsx` di TS:
  - Sheet "Data" dengan header.

### 4. Tests

- Unit: `laporan-aggregator.test.ts` (sum, group by month/year).
- E2E: `laporan.spec.ts`:
  - Filter range → tabel update.
  - Export PDF → file generated.
  - Backup → file `.db` di target dir + checksum match.

### 5. Update PROGRESS.md

- Sesi 9 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/commands/{laporan,backup}.rs`
  - `src/routes/_authed/laporan/*.tsx`
  - `src/lib/pdf/laporan.ts`
  - `src/lib/excel/laporan.ts`
  - i18n keys
- Tests: 2 unit + 1 e2e.
- Screenshot 5 sub-page.

## Definition of Done

- [ ] 5 sub-page nav works.
- [ ] Filter date range update chart + tabel.
- [ ] Export PDF → header pakai identitas perpustakaan.
- [ ] Export Excel → file `.xlsx` valid.
- [ ] Backup `.db` + SHA256 checksum.
- [ ] Restore validates checksum.
- [ ] Schedule cron runnable (test via Tauri scheduler atau cron-like).
- [ ] CI pass.
- [ ] PROGRESS.md updated.
