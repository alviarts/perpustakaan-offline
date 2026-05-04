# SESSION 04 — Data Anggota CRUD + autocomplete + live search

> **Devin session 4/12.** Halaman Data Anggota lengkap: list, form add/edit,
> delete, import Excel, search debounced, autocomplete reusable.

## Goal

- CRUD anggota lengkap dengan tabel master/detail.
- Live search debounced 200ms (revisi #15) reusable hook.
- Autocomplete component (revisi #20) reusable, 2-line item, fuzzy match.
- Dropdown styled (revisi #19) match width, animasi, keyboard nav.
- Master data dropdown (kelas, jurusan, agama) hanya dari sisi consumer
  (CRUD master data full di Devin 5).

## Revisi tercover

- #15 (live search debounced) — full (hook reusable + apply ke Anggota)
- #17 (master data dropdown — sisi anggota) — partial (consume saja)
- #19 (dropdown styled) — full
- #20 (autocomplete anggota) — full

## Dependencies

- Sesi 3 COMPLETED.

## Tasks breakdown

### 1. Backend (Rust commands)

- `src-tauri/src/commands/anggota.rs`:
  - `anggota_list(query, limit, offset, sort_by, sort_dir)`
  - `anggota_get(id)`
  - `anggota_create(payload)`
  - `anggota_update(id, payload)`
  - `anggota_delete(id)`
  - `anggota_import_excel(file_path)` (validation + dry-run preview)
- Validasi di Rust: NIS unique, kelas exists, jurusan exists, agama exists.

### 2. Reusable components

- `src/hooks/use-debounced-search.ts` (revisi #15):
  - Debounce 200ms, return `{ query, debouncedQuery, setQuery, isPending }`.
- `src/components/shared/Autocomplete.tsx` (revisi #20):
  - Props: `items`, `getItemKey`, `renderItem` (2-line), `onSelect`,
    `placeholder`, `getMatchScore` (fuzzy).
  - Implementation: shadcn `Command` + `Popover`.
- `src/components/ui/select.tsx` (revisi #19):
  - Pakai shadcn `Select`, override style supaya popup width = trigger
    via `--radix-select-trigger-width` CSS var.
  - Animasi `data-state` open/close (slide-down 150ms).

### 3. Halaman Anggota

- `src/routes/_authed/anggota.tsx` (list page):
  - Toolbar: search input (use `useDebouncedSearch`), tombol "Tambah",
    "Import Excel", filter dropdown (kelas, jurusan).
  - DataTable: kolom (Foto, Nama, NIS, Kelas, Jurusan, Action).
  - Sort by column header click.
  - Pagination footer (limit 25/50/100).
  - Empty state: ilustrasi + CTA "Tambah Anggota".
- `src/routes/_authed/anggota/$id.tsx` (detail / edit):
  - Form react-hook-form + zod schema.
  - Field: Nama, NIS, Kelas (dropdown), Jurusan (dropdown), Agama
    (dropdown), Tanggal Lahir (date picker — placeholder Devin 6 nanti
    finalize), Foto (upload).
  - Tombol "Simpan", "Batal", "Hapus" (confirmation dialog).
- `src/routes/_authed/anggota/new.tsx` (form add).

### 4. Import Excel

- Tombol "Import Excel" → file picker (Tauri dialog).
- Parse pakai `xlsx` lib di TS.
- Show preview tabel + validasi error per row.
- Confirm → batch insert via Rust command.

### 5. Header global search

- Header search bar terhubung ke route global (e.g. ke `/anggota?q=...` saat
  user submit dari Header).

### 6. Tests

- Unit Vitest:
  - `use-debounced-search.test.ts` (timing).
  - `autocomplete.test.tsx` (render + select).
- E2E Playwright:
  - `anggota.spec.ts`: tambah, edit, delete, search, sort.

### 7. Update PROGRESS.md

- Sesi 4 → COMPLETED.

## Deliverables

- File:
  - `src-tauri/src/commands/anggota.rs`
  - `src/hooks/use-debounced-search.ts`
  - `src/components/shared/Autocomplete.tsx`
  - `src/components/ui/select.tsx` (style adjust)
  - `src/routes/_authed/anggota{.tsx,/index.tsx,/$id.tsx,/new.tsx}`
  - i18n key tambahan di `id/anggota.json`, `en/anggota.json`.
- Tests: 2+ unit, 1 e2e.
- Screenshot: list view, form, autocomplete dropdown.

## Definition of Done

- [ ] Tambah anggota → muncul di list.
- [ ] Edit anggota → update.
- [ ] Delete anggota → confirm dialog → remove.
- [ ] Search ketik 2 char → list filter dalam 200ms.
- [ ] Autocomplete 2-line (nama + NIS/kelas) muncul.
- [ ] Dropdown popup width = trigger.
- [ ] Import Excel: pilih file → preview → confirm → batch insert success.
- [ ] CI pass.
- [ ] PROGRESS.md updated.
