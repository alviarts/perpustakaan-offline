# SESSION 10 — KTA system komplit

> **Devin session 10/12.** Kartu Tanda Anggota: template editor visual,
> auto-fill, barcode QR, print batch.

## Goal

- Sistem KTA (revisi #14):
  - Fix font path (bundle TTF di Tauri resources).
  - Template editor visual (drag-drop area, font size/color picker).
  - Field auto-fill: `[nama]`, `[nis]`, `[kelas]`, `[foto]`, `[barcode_qr]`.
  - Barcode QR berisi `member_id` → scan di Peminjaman langsung auto-fill.
  - Print: 1 anggota / batch (semua anggota terpilih).

## Revisi tercover

- #14 (KTA system) — full

## Dependencies

- Sesi 4 COMPLETED (anggota CRUD).
- Sesi 5 COMPLETED (master data + migration `kta_templates`).

## Tasks breakdown

### 1. Backend

- `src-tauri/src/commands/kta.rs`:
  - `kta_template_list()`, `kta_template_get(id)`, `kta_template_create()`,
    `kta_template_update()`, `kta_template_delete()`.
  - `kta_template_set_default(id)`.
  - `kta_render(anggota_id, template_id)` — return PDF bytes.
  - `kta_render_batch(anggota_ids[], template_id)` — return PDF multi-page.

### 2. Bundle font

- `apps/desktop/src-tauri/resources/fonts/`:
  - Inter (regular, semibold, bold) untuk teks.
  - JetBrains Mono untuk NIS/barcode label.
  - Code39 / IDAutomation HC39M (bila perlu untuk barcode 1D).
- Load via `tauri::path::resolve_path` di Rust, atau kalau pakai pdf-lib di
  TS: `fs.readBinaryFile` lewat Tauri.

### 3. Template editor (frontend)

- `src/routes/_authed/settings/kta.tsx`:
  - Canvas editor (HTML/CSS based, bukan native canvas) — pakai
    `react-rnd` atau `dnd-kit` untuk drag-drop field.
  - Toolbar: tambah field (nama, nis, kelas, foto, qr), set font/size/color,
    background, dimensi (default ID-1: 85.6×53.98mm).
  - Save layout JSON ke `kta_templates`.
  - Set default toggle.
  - Tombol "Preview" → render PDF inline.

### 4. PDF render (backend or frontend)

- Pilihan A (frontend `pdf-lib`):
  - Lebih portable.
  - Render layout JSON → PDF.
- Pilihan B (backend Rust `printpdf`):
  - Native, akurat ukuran.
  - Bundle size kecil tambahan.
- Default: A (`pdf-lib`), fallback B kalau perlu.

### 5. Barcode QR

- `src/lib/barcode.ts`:
  - QR code pakai `qrcode` lib (TS).
  - Embed `member:<id>` URL scheme atau JSON `{member_id}`.
  - Render ke PNG → embed di PDF.
- Reader di Peminjaman:
  - Input listener (USB scanner emulasi keyboard) atau kamera (skip kamera
    untuk MVP).
  - Parse → autofocus → autofill anggota field.

### 6. Print

- Sub-page "Cetak KTA" di Settings atau dari halaman Anggota:
  - Pilih anggota (multi-select dari list).
  - Pilih template.
  - Tombol "Cetak" → render PDF → buka di OS print dialog atau
    `tauri-plugin-printer`.

### 7. Tests

- Unit: `kta-template-render.test.ts` (parse layout JSON → PDF dimensions).
- Unit: `barcode-qr.test.ts` (encode → decode round-trip).
- E2E: `kta.spec.ts`:
  - Edit template → simpan.
  - Render KTA satu anggota → file PDF generated.

### 8. Update PROGRESS.md

- Sesi 10 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/commands/kta.rs`
  - `src-tauri/resources/fonts/*`
  - `src/routes/_authed/settings/kta.tsx`
  - `src/features/kta/components/{TemplateEditor,FieldDraggable,Preview}.tsx`
  - `src/lib/pdf/kta.ts`
  - `src/lib/barcode.ts`
  - i18n keys
- Tests: 2+ unit + 1 e2e.
- Screenshot template editor + KTA preview.

## Definition of Done

- [ ] Template editor: drag field, ubah font/size, save.
- [ ] Render KTA satu anggota → PDF file dengan barcode QR.
- [ ] Render batch (e.g. 10 anggota) → PDF multi-page.
- [ ] Scan QR di Peminjaman → autofill.
- [ ] Font path stable (test build production).
- [ ] CI pass.
- [ ] PROGRESS.md updated.
