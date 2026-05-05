# v1.0.8 Bug & Feature Batch — Full Detail

**Reporter:** [@alviarts](https://github.com/alviarts) (user `vielz883`)
**Reported:** 2026-05-05 (immediately after v1.0.7 release).
**Status table:** [`PROGRESS.md`](./PROGRESS.md)
**Workflow / process:** [`WORKFLOW.md`](./WORKFLOW.md)
**Automation prompt:** [`CONTINUOUS_AUTOMATION.md`](./CONTINUOUS_AUTOMATION.md)

This file is the durable record of every bug/feature in the v1.0.8 batch. Each section is self-contained — a future Devin should be able to pick it up and ship it without re-asking the user.

---

## PR A — KTA: foto fit + 10 desain baru

### BUG-19 — KTA PDF export: foto anggota gepeng (stretch ke aspect ratio slot, tidak preserve)

**Severity:** HIGH (output PDF tampak unprofessional, foto kelihatan peyot)

**Repro:**

1. Anggota → pilih anggota dengan foto landscape (lebar > tinggi, mis. foto group cropped jadi single).
2. Cetak KTA → Export PDF.
3. Buka PDF di reader. Foto di slot KTA tampak melar/gepeng (proportions tidak natural).

**Expected:** foto preserve aspect ratio. Pakai cover-fit math (fill slot, crop overflow ke center) — UX standard untuk avatar / ID-card slot.

**Observed:** `drawFotoField()` di `apps/desktop/src/features/kta/pdf.ts:152-173` panggil `doc.addImage(fotoUrl, 'AUTO', fx, fy, fw, fh, undefined, 'FAST')` — meskipun comment di kode bilang `'AUTO'` "preserves aspect ratio", behavior actual jsPDF adalah **stretch** ke `fw×fh` regardless. Comment-nya menyesatkan (mungkin warisan asumsi yang tidak terverifikasi).

**Suspected root cause:**

- jsPDF `addImage(data, format, x, y, w, h)` selalu scale image to exact w×h. Format 'AUTO' cuma untuk format auto-detect (PNG vs JPG), bukan aspect-fit.
- Untuk preserve aspect ratio, harus compute fit-rectangle manually:
  - Load image → get naturalWidth / naturalHeight
  - Compute scale untuk cover (max ratio) atau contain (min ratio)
  - Adjust dx/dy/dw/dh dan crop kalau perlu

**Fix plan (2-layer):**

**Layer 1 — Backend smart-fit pipeline (Tauri assets command)**:
- File: `apps/desktop/src-tauri/src/commands/assets.rs`
- Existing fn `maybe_compress` cuma cap long-edge + JPG quality. Tambah parameter / new fn `smart_fit_to_portrait(src_path, target_aspect=3/4)`:
  - Load image via `image` crate
  - Detect orientation (landscape vs portrait)
  - Center-crop ke target aspect ratio (default portrait 3:4 untuk KTA slot)
  - Save as JPG (or PNG if alpha) ke same location, atau ke variant suffix
- Trigger: saat foto di-upload via `anggota_set_foto` command, panggil `smart_fit_to_portrait` dulu sebelum simpan.
- Backward compat: foto existing tidak diubah otomatis (preserve user data); admin punya opsi "Re-fit semua foto" di Pengaturan → Anggota → Foto Tools (one-time batch).

**Layer 2 — Frontend cover-fit math di PDF render**:
- File: `apps/desktop/src/features/kta/pdf.ts`
- Refactor `drawFotoField` jadi:
  ```ts
  async function drawFotoField(doc, field, rect, fotoUrl): Promise<void> {
    const fx = rect.x + (field.x / 100) * rect.width;
    const fy = rect.y + (field.y / 100) * rect.height;
    const fw = (field.width / 100) * rect.width;
    const fh = (field.height / 100) * rect.height;

    if (!fotoUrl) { /* placeholder fill */ return; }

    // NEW: load image to get natural dimensions
    const img = await loadImage(fotoUrl);
    const fit = computeCoverFit(img.naturalWidth, img.naturalHeight, fw, fh);
    // computeCoverFit returns { dx, dy, dw, dh } where dw/dh maintain
    // source aspect ratio and crop overflow centered

    try {
      doc.addImage(fotoUrl, 'AUTO', fx + fit.dx, fy + fit.dy, fit.dw, fit.dh, undefined, 'FAST');
    } catch { /* placeholder fallback */ }
  }
  ```
- Apply same logic ke `drawTtdField` (TTD usually deserves contain-fit, not cover — TTD tidak boleh ke-crop).

**Files affected:**

- `apps/desktop/src-tauri/src/commands/assets.rs` (new `smart_fit_to_portrait` + integration ke `anggota_set_foto`)
- `apps/desktop/src/features/kta/pdf.ts` (rewrite `drawFotoField`, `drawTtdField`)
- `apps/desktop/src/features/kta/print.ts` (sudah pakai CSS `object-fit:cover` untuk preview, audit ulang konsistensi)
- New utility: `apps/desktop/src/lib/imageFit.ts` exporting `computeCoverFit(srcW, srcH, dstW, dstH): {dx, dy, dw, dh}` dan `computeContainFit(...)` — dipakai di pdf.ts + print.ts + KtaPreview.tsx supaya 1 source of truth.
- Unit tests: `apps/desktop/tests/unit/imageFit.test.ts` (deterministik, no DOM needed) + new test fixture untuk `assets.rs::smart_fit_to_portrait`.

**Acceptance:**

- Upload foto landscape (mis. 1280×720) → backend auto-crop ke portrait (mis. 540×720). Saved file aspect = 3:4.
- PDF export: foto tampak natural, no gepeng/stretch. Center-crop saat photo lebih landscape dari slot.
- Preview di Template Editor + Cetak KTA = identical visual ke PDF (regression check).
- Existing foto tidak di-mutate otomatis; admin trigger via "Re-fit semua foto" di settings.
- TTD pakai contain-fit (no crop, fit dengan ratio asli) — TTD signature tidak boleh di-clip.

**Risk:**

- Backend `smart_fit_to_portrait` butuh `image` crate (sudah di Cargo? cek `apps/desktop/src-tauri/Cargo.toml`. Kalau belum, tambah).
- PDF rendering jadi async (loadImage promise) — pastikan call site di-`await` properly.

---

### FEAT-16 — KTA: tambah 10 desain template baru (total ~20)

**Severity:** MEDIUM (improves user choice)

**Context:** v1.0.5 ship 10 preset (`klasik-polos`, `strip-atas-teal`, `sidebar-rail-navy`, `minimalis-modern`, `sash-diagonal-rose`, `portrait-tengah-emerald`, `tradisional-amber`, `pelajar-modern-indigo`, `emas-eksklusif-gold`, `qr-forward-cyan`). User minta 10 lagi untuk variasi.

**Reference design** (user attached): klasik ID-card landscape — header band warna + logo kecil + foto portrait di kiri-tengah + biodata table di kanan + footer info kontak. Style "ICHASOFT".

**Suggested 10 new designs** (mix klasik + modern + tematik):

| # | ID slug | Theme |
| --- | --- | --- |
| 1 | `ichasoft-klasik-blue` | Mirror reference user — header navy + foto portrait + biodata table + footer alamat sekolah. |
| 2 | `simple-flat-coral` | Flat coral + putih, header tipis, semua text lowercase, vibe modern minimal. |
| 3 | `corporate-grey-monochrome` | Grayscale corporate — formal, untuk sekolah swasta high-end. |
| 4 | `gradient-sunset-purple` | Header gradient purple→orange, vibe siswa SMK kreatif. |
| 5 | `wave-bottom-aqua` | Wave SVG di bawah card, foto float kanan, vibe casual tropical. |
| 6 | `kotak-grid-mustard` | Background grid dot mustard, foto kotak hard-edge, vibe arsitektur. |
| 7 | `kartu-batik-merah` | Pattern batik subtle red, header "KARTU PERPUSTAKAAN" calligraphy ID. |
| 8 | `vertikal-strip-mint` | Strip vertikal kiri mint + putih, foto kanan + biodata stack vertikal. |
| 9 | `polkadot-pastel-pink` | Background polkadot pink pastel, vibe SD/MI. |
| 10 | `monoline-line-art-black` | Black & white line-art frame, vibe sekolah seni. |

**Files affected:**

- `apps/desktop/src/features/kta/presets.ts` — definisikan 10 layout baru (mirror struktur preset existing). Setiap preset punya: `id`, `nama`, `deskripsi`, `layout: KtaLayout`. Layout = array of `KtaField` (id, kind, x%, y%, width%, height%, text styling, fill color, border, dll).
- `apps/desktop/tests/unit/presets.test.ts` — extend existing preset suite untuk validate 10 baru (no overlap field, all kind valid, all percentages 0-100, total 20 presets in `KTA_PRESETS`).
- Optional: screenshots di `.devin/handoff/v1.0.8-bugs-batch/preset-screenshots/` (mockup PNG masing-masing preset, dibuat dari Template Editor live preview).

**Acceptance:**

- 10 preset baru muncul di `Pengaturan → KTA → Galeri Template`.
- Setiap preset render benar di Preview + Cetak + PDF.
- Existing preset (10 dari v1.0.5) tetap utuh.
- `pnpm test` lulus dengan jumlah preset ≥20.

**Risk:**

- Bilingual nama: `nama_id` + `nama_en` kalau pattern existing pakai i18n. Cek pattern di `presets.ts` dulu.
- Color contrast WCAG AA: foto biodata harus kebaca di setiap background — verifikasi visual.

---

## PR B — Peminjaman: perpanjangan + reservasi

### FEAT-17 — Perpanjangan peminjaman (1-klik extend)

**Severity:** HIGH (kebutuhan operasional umum, sekarang harus return + pinjam ulang manual)

**Spec:**

- Di list peminjaman aktif: tiap row tambah tombol "Perpanjang" (icon: refresh/clock).
- Klik → confirm dialog "Perpanjang peminjaman X sampai tanggal Y? (extend N hari)".
- Server-side: extend `tanggal_jatuh_tempo += N hari`, increment counter `kali_perpanjangan` di table `peminjaman`, log di `audit_log`.
- Limit: configurable di Pengaturan → Aturan Peminjaman → "Maksimum perpanjangan per peminjaman" (default 1×, range 0-3).
- Block kalau:
  - `kali_perpanjangan >= max_perpanjangan_setting`
  - Status sudah `dikembalikan` atau `hilang`
  - Anggota punya denda > 0 (configurable: "Blokir perpanjangan kalau ada denda" boolean default false)
  - Buku sudah ada reservasi aktif (after FEAT-18 implemented — kalau ada antrian, tidak boleh extend)

**Schema change:**
```sql
ALTER TABLE peminjaman ADD COLUMN kali_perpanjangan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE peminjaman ADD COLUMN tanggal_perpanjangan_terakhir TEXT;
```

Plus `apps/desktop/src-tauri/src/db/mod.rs::apply_additive_migrations` menambah ALTER guarded by column-exists check.

**Files affected:**

- `apps/desktop/src-tauri/src/db/schema.sql` (new columns)
- `apps/desktop/src-tauri/src/db/mod.rs` (additive migration)
- `apps/desktop/src-tauri/src/commands/peminjaman.rs` (new command `peminjaman_perpanjang(loan_id, days)`)
- `apps/desktop/src-tauri/src/commands/settings.rs` (new key `peminjaman.max_perpanjangan` + `peminjaman.block_perpanjangan_jika_denda`)
- `apps/desktop/src/lib/peminjaman.ts` (frontend API wrapper)
- `apps/desktop/src/features/peminjaman/PeminjamanPage.tsx` (tambah tombol di row)
- `apps/desktop/src/features/peminjaman/PerpanjangDialog.tsx` (new component)
- `apps/desktop/src/features/settings/AturanPeminjamanPage.tsx` (tambah field di settings)
- Unit tests (Rust + Vitest)

**Acceptance:**

- Klik Perpanjang → tanggal jatuh tempo extend N hari, counter naik 1.
- Block setelah max reached → toast "Sudah tidak bisa diperpanjang (max N×)".
- Denda block (kalau setting on) → toast "Lunasi denda dulu sebelum perpanjang".
- Reservation block (setelah FEAT-18) → toast "Buku sudah dipesan oleh anggota lain — tidak bisa diperpanjang".
- Audit log entry: `aksi: "perpanjang_peminjaman"`, `metadata: { loan_id, old_tanggal, new_tanggal, kali_ke }`.

**Risk:** integration dengan FEAT-18 (reservasi) — kalau FEAT-18 belum merge, tambahkan fallback "Buku sudah dipesan = false always" supaya FEAT-17 bisa ship duluan.

---

### FEAT-18 — Reservasi buku (antrian saat dipinjam orang lain)

**Severity:** MEDIUM

**Spec:**

- Anggota A pinjam buku X. Anggota B mau pinjam buku X yang sama → buku X status "dipinjam" → di list buku, button "Pinjam" jadi "Reservasi" (orange).
- Klik Reservasi → input anggota B → konfirmasi → row baru di table `reservasi_buku` (anggota_id, buku_id, tanggal_request, urutan_antrian).
- Saat anggota A return buku X → cek `reservasi_buku` table → kalau ada antrian:
  - Toast popup: "Buku ini di-reserve oleh: [nama_b], simpan di rak reservasi (slot R-NN)".
  - Update status: reservasi paling depan jadi `siap_diambil`, `tanggal_siap_diambil = today`, `expired_at = today + 3 hari`.
  - Anggota B dapat notif (di profil mereka — atau email kalau FEAT-WhatsApp/Email reminder ada di v1.0.9+).
- Auto-expire: kalau anggota B tidak ambil dalam 3 hari, status → `expired`, antrian skip ke berikutnya.
- Cancel: anggota B bisa cancel reservasi mereka sendiri (kembalikan ke "Pinjam" available).

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS reservasi_buku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id INTEGER NOT NULL,
    buku_id INTEGER NOT NULL,
    -- urutan antrian per buku (1 = paling depan)
    urutan INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'menunggu', -- menunggu | siap_diambil | diambil | expired | dibatalkan
    slot_rak TEXT,                           -- R-01, R-02 ...
    tanggal_request TEXT NOT NULL DEFAULT (date('now')),
    tanggal_siap_diambil TEXT,
    expired_at TEXT,
    catatan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id) REFERENCES buku(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reservasi_buku_status ON reservasi_buku(buku_id, status);
CREATE INDEX IF NOT EXISTS idx_reservasi_anggota ON reservasi_buku(anggota_id);
```

**Files affected:**

- `apps/desktop/src-tauri/src/db/schema.sql` + `db/mod.rs` (new table)
- `apps/desktop/src-tauri/src/commands/reservasi.rs` (new file: `reservasi_create`, `reservasi_cancel`, `reservasi_list_by_buku`, `reservasi_list_by_anggota`, `reservasi_mark_diambil`, `reservasi_check_expired_tick`)
- `apps/desktop/src-tauri/src/commands/peminjaman.rs` (after return: check reservasi table, fire toast event)
- `apps/desktop/src/lib/reservasi.ts` (new API wrapper)
- `apps/desktop/src/features/buku/BukuPage.tsx` (tampilkan tombol Reservasi conditional)
- `apps/desktop/src/features/anggota/AnggotaDetailPage.tsx` (tampilkan list reservasi anggota)
- `apps/desktop/src/features/peminjaman/PengembalianPage.tsx` (toast dengan slot rak setelah return kalau ada antrian)
- New page: `apps/desktop/src/features/reservasi/ReservasiPage.tsx` (list semua reservasi aktif untuk admin overview)
- Sidebar route + nav link

**Acceptance:**

- Buku dipinjam → tombol di card buku jadi "Reservasi (Antri)". Klik → masuk antrian.
- Return buku → toast jelas tampilkan slot rak + nama anggota berikutnya.
- Anggota B login di OPAC (FEAT-27) → lihat reservasi mereka di profil + countdown expired.
- Auto-expire setelah 3 hari → next antrian otomatis di-promote.

**Risk:** scheduler untuk check expired tiap N jam — pakai existing `backup_runner` pattern (cron-like Tauri thread).

---

## PR C — Bulk import (anggota + buku)

### FEAT-19 — Bulk import anggota dari Excel/CSV

**Severity:** HIGH (awal tahun ajaran, admin sering input 200-500 siswa baru manual)

**Spec:**

- Anggota → tombol baru "Import dari Excel/CSV".
- Dialog: drag-drop file `.xlsx` / `.csv` / link ke "Download template Excel".
- Template Excel sudah ada header standar:
  ```
  kode_anggota | nama | jenis_kelamin | kelas | jurusan | tempat_lahir | tanggal_lahir | no_telp | email | alamat
  ```
- Setelah file di-upload:
  1. Backend parse via `calamine` crate (Excel) atau native csv (CSV).
  2. Pre-validation: cek `kode_anggota` unique di file (no duplicates dalam file) + cek tidak conflict dengan db existing.
  3. Tampilkan preview tabel dengan badge: hijau (valid), merah (invalid: missing required field, duplicate, dll).
  4. Admin klik "Import N anggota valid" → batch insert dalam single transaction. Kalau ada satu fail, rollback semua + tampilkan error.
  5. Optional: "Update existing kalau kode_anggota sama" toggle (overwrite mode).
- Foto anggota tidak di-import via Excel (terlalu besar) — admin upload manual setelah, atau via FEAT-Bulk-Foto-Import (defer ke v1.0.9+).

**Files affected:**

- `apps/desktop/src-tauri/Cargo.toml` (add `calamine = "0.x"` for Excel parsing)
- `apps/desktop/src-tauri/src/commands/anggota_import.rs` (new file: `anggota_parse_file`, `anggota_bulk_insert`)
- `apps/desktop/src/features/anggota/AnggotaImportDialog.tsx` (new)
- `apps/desktop/src/features/anggota/AnggotaPage.tsx` (button trigger)
- Public assets: `apps/desktop/public/templates/anggota-import-template.xlsx`
- Tests: parse + validation + transaction rollback

**Acceptance:**

- Upload file 500-row → preview semua valid/invalid dalam <2 detik.
- Klik Import → semua valid masuk db, atomicity preserved.
- Toast "Import berhasil: 487 anggota dimasukkan, 13 di-skip (lihat detail)".
- Kalau file format invalid → error jelas "Header tidak match template".

**Risk:** memory usage untuk file 1000+ rows. `calamine` lazy-iter, OK. Frontend preview pakai virtual list kalau >100 rows.

---

### FEAT-20 — Bulk import buku via ISBN (Open Library / Google Books)

**Severity:** MEDIUM

**Spec:**

- Buku → tombol "Import via ISBN".
- Dialog: textarea untuk paste list ISBN (1 per baris, atau comma-separated). Plus opsi "Scan ISBN dari kamera" (reuse FEAT-28 scanner).
- Klik "Fetch metadata":
  1. Untuk setiap ISBN → call Open Library API `https://openlibrary.org/api/books?bibkeys=ISBN:NNN&format=json&jscmd=data` (free, no auth).
  2. Fallback: Google Books API `https://www.googleapis.com/books/v1/volumes?q=isbn:NNN` (free tier, no key needed for read).
  3. Tampilkan tabel preview: judul, pengarang, penerbit, tahun, kategori (auto-derive dari subjects), cover URL.
  4. Admin edit per row kalau ada koreksi.
  5. Klik "Import N buku" → batch insert + download cover ke `data/covers/`.

**Files affected:**

- `apps/desktop/src-tauri/Cargo.toml` (add `reqwest` jika belum ada)
- `apps/desktop/src-tauri/src/commands/buku_import.rs` (new: `buku_isbn_fetch`, `buku_bulk_insert_with_covers`)
- `apps/desktop/src/features/buku/BukuImportDialog.tsx` (new)
- `apps/desktop/src/lib/isbnLookup.ts` (frontend fetch wrapper, optional caching)
- Tests: mock HTTP responses, batch insert atomicity

**Acceptance:**

- Paste 50 ISBN → fetch metadata <30 detik (rate-limit OL ~1 req/sec).
- Preview editable per row.
- Cover image downloaded ke `data/covers/<isbn>.jpg`.
- Offline mode: clear error "Tidak bisa fetch ISBN — periksa koneksi internet".

**Risk:**

- Open Library data quality varied — banyak buku Indonesia tidak ada. Fallback ke Google Books, lalu manual entry kalau both kosong.
- Rate limiting: throttle 1 req/sec ke OL, exponential backoff on 429.

---

## PR D — Anggota: surat bebas pustaka + wishlist

### FEAT-21 — Surat keterangan bebas pustaka (auto-generate PDF)

**Severity:** MEDIUM (kebutuhan akhir tahun untuk siswa kelas 12 / lulus)

**Spec:**

- Anggota → klik anggota → tombol "Cetak Surat Bebas Pustaka".
- Eligibility check (server-side):
  - Tidak ada peminjaman aktif (semua loan status `dikembalikan`).
  - `total_denda - total_bayar` di semua loan = 0.
  - Anggota status `aktif`.
- Kalau eligible: generate PDF dengan template surat (header sekolah, "Yang bertanda tangan…", body keterangan, TTD pustakawan + kepala sekolah, tanggal, nomor surat auto-generated).
- Template editable di Pengaturan → Surat → "Template Surat Bebas Pustaka" (rich-text editor, support placeholder `{nama}`, `{nis}`, `{tanggal}`, `{nomor_surat}`).
- Kalau tidak eligible: dialog merah "Tidak bisa: ada N loan aktif / Rp X denda belum dibayar — selesaikan dulu". Tidak generate PDF.
- Audit log: setiap surat dicetak entry di `audit_log` dengan nomor surat.

**Schema:**
```sql
ALTER TABLE settings ADD ... -- via additive migration
-- Settings keys baru:
-- surat.template_html (TEXT, rich text content)
-- surat.nomor_terakhir (INTEGER, auto-increment per cetak)
-- surat.format_nomor (TEXT, e.g. "{tahun}/{bulan}/SBP-{nomor:04d}")
-- surat.kepala_sekolah_nama (TEXT)
-- surat.kepala_sekolah_ttd_path (TEXT, foto TTD)

CREATE TABLE IF NOT EXISTS surat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id INTEGER NOT NULL,
    nomor_surat TEXT NOT NULL UNIQUE,
    tanggal_cetak TEXT NOT NULL DEFAULT (datetime('now')),
    pdf_path TEXT,
    petugas_id INTEGER,
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE RESTRICT,
    FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Files affected:**

- `apps/desktop/src-tauri/src/db/schema.sql` + migration
- `apps/desktop/src-tauri/src/commands/surat.rs` (new: `surat_check_eligibility`, `surat_generate`, `surat_log_list`)
- `apps/desktop/src/features/anggota/AnggotaDetailPage.tsx` (button trigger)
- `apps/desktop/src/features/anggota/SuratBebasPustakaDialog.tsx` (new)
- New: `apps/desktop/src/features/settings/SuratPage.tsx` (template editor)
- `apps/desktop/src/lib/suratPdf.ts` (jsPDF render dari template HTML — pakai `html2canvas` atau parse manual)
- Default template seed di `seed_master_data` (Indonesian formal Surat Keterangan style)
- Tests

**Acceptance:**

- Anggota tanpa loan aktif + tanpa denda → klik tombol → PDF download dengan nomor surat auto.
- Anggota dengan loan aktif → dialog merah block.
- Template editable di settings, placeholders di-substitute correctly.
- Nomor surat sequential (no skip, no duplicate).

---

### FEAT-22 — Wishlist anggota (request pengadaan buku)

**Severity:** LOW (nice-to-have, integrasi bagus dengan OPAC FEAT-27)

**Spec:**

- Anggota (admin atau OPAC) bisa submit "saya ingin baca buku X" (judul + penulis + alasan opsional).
- Admin queue: list semua wishlist pending → admin tandai status `disetujui` (akan diadakan), `ditolak` (alasan), `sudah_diadakan` (link ke buku ID setelah dibeli).
- Vote system optional: kalau anggota lain submit judul yang sama, increment counter. Top-voted dapat priority pengadaan.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS wishlist_buku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id INTEGER NOT NULL,
    judul TEXT NOT NULL,
    pengarang TEXT,
    isbn TEXT,
    alasan TEXT,
    -- pending | disetujui | ditolak | sudah_diadakan
    status TEXT NOT NULL DEFAULT 'pending',
    catatan_admin TEXT,
    buku_id INTEGER,                -- linked saat sudah_diadakan
    upvote_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id) REFERENCES buku(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist_buku(status);
```

**Files affected:**

- Schema + migration
- `apps/desktop/src-tauri/src/commands/wishlist.rs` (new)
- New page `apps/desktop/src/features/wishlist/WishlistAdminPage.tsx` (admin queue)
- Anggota submit form (admin-side untuk Phase 1; OPAC-side di FEAT-27)
- Sidebar nav link

**Acceptance:**

- Admin submit wishlist → row created.
- Admin queue page → semua pending → setujui/tolak per row.
- Auto-link buku saat status berubah ke `sudah_diadakan` + buku_id assigned → wishlist anggota itu auto-dapat notif (atau email kalau ada).

---

## PR E — Operasional: stocktake + backup enhancement

### FEAT-23 — Stocktake / Opname mode (scan barcode batch + report missing)

**Severity:** MEDIUM (kegiatan tahunan mandatory)

**Spec:**

- New page: `apps/desktop/src/features/stocktake/StocktakePage.tsx`.
- Tombol "Mulai Sesi Stocktake" → buat new row di `stocktake_session` (id, tanggal_mulai, status='berlangsung').
- Mode scan: input barcode (pakai webcam scanner FEAT-28 atau USB scanner) → setiap scan, mark eksemplar status `ditemukan` di table `stocktake_item`.
- Realtime counter di UI: `Total: 1234 | Sudah scan: 456 (37%)`.
- Saat selesai → klik "Selesaikan & Tampilkan Hasil":
  - List buku missing (eksemplar yang tidak di-scan dalam sesi).
  - Export PDF report: header sekolah + tanggal + tabel "Eksemplar | Judul | Lokasi | Status".
- Bisa pause/resume sesi: data persisted di table.
- Bisa multiple sesi paralel (tergantung admin) — setiap sesi independent.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS stocktake_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal_mulai TEXT NOT NULL DEFAULT (datetime('now')),
    tanggal_selesai TEXT,
    status TEXT NOT NULL DEFAULT 'berlangsung', -- berlangsung | selesai | dibatalkan
    catatan TEXT,
    petugas_id INTEGER,
    FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS stocktake_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    eksemplar_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'belum_scan', -- belum_scan | ditemukan | tidak_ditemukan
    tanggal_scan TEXT,
    catatan TEXT,
    UNIQUE(session_id, eksemplar_id),
    FOREIGN KEY (session_id) REFERENCES stocktake_session(id) ON DELETE CASCADE,
    FOREIGN KEY (eksemplar_id) REFERENCES eksemplar(id) ON DELETE CASCADE
);
```

**Files affected:**

- Schema + migration
- `apps/desktop/src-tauri/src/commands/stocktake.rs` (new)
- New feature folder: `apps/desktop/src/features/stocktake/`
- PDF report renderer (reuse jsPDF pattern from KTA)
- Sidebar nav link

**Acceptance:**

- Mulai sesi → semua eksemplar di-list dengan status `belum_scan`.
- Scan eksemplar → status update real-time, counter naik.
- Selesaikan → list missing terdiri dari eksemplar yang masih `belum_scan` saat sesi closed.
- Export PDF: format formal untuk laporan ke kepala sekolah.
- Resume sesi yang `berlangsung` → resume dari last state.

---

### FEAT-24 — Backup enhancement (cloud target + history list)

**Severity:** LOW (existing backup feature dasar sudah ada, ini extend)

**Existing:** `apps/desktop/src/features/laporan/BackupSubPage.tsx` + `commands/backup.rs` — manual backup ke folder, schedule cron, restore from .db file.

**Enhancements:**

1. **Cloud backup target**: opsi simpan backup ke Google Drive / Dropbox (pakai `rclone` CLI invocation, atau direct API). Setting: `backup.cloud.provider`, `backup.cloud.folder_id`, `backup.cloud.access_token`.
2. **Backup history list**: table `backup_history` (id, path, ukuran, sha256, tanggal, dest_type='lokal'|'gdrive'|'dropbox', status). Tampilkan list di backup page dengan filter date range + restore-from-history.
3. **Encrypted backup** (optional): encrypt .db dengan AES-256 dari password yang user set, simpan sebagai `.db.enc`. Restore minta password.
4. **Notification**: setelah scheduled backup berhasil/gagal, toast desktop notification.

**Files affected:**

- Schema + migration: `backup_history` table
- `apps/desktop/src-tauri/src/commands/backup.rs` (extend)
- New: `apps/desktop/src-tauri/src/commands/backup_cloud.rs` (Drive/Dropbox API calls)
- `apps/desktop/src/features/laporan/BackupSubPage.tsx` (extend UI: history list, cloud setting)
- Tests

**Acceptance:**

- Toggle cloud backup → schedule juga upload ke Drive folder configured.
- History list tampilkan semua backup dengan timestamp + size + checksum.
- Restore dari history (lokal atau cloud) — download + verify checksum + replace db.
- Encrypted backup `.db.enc` — restore minta password, decrypt, verify, apply.

**Risk:** Drive/Dropbox API auth flow — OAuth refresh tokens persistence + UX setup. Mungkin pakai user-supplied service account JSON sebagai shortcut (less UX-friendly tapi lebih simpel implementation).

---

## PR F — Dashboard analytics extended

### FEAT-25 — Dashboard analytics extended (chart trend mingguan/bulanan + heatmap)

**Severity:** LOW

**Existing:** `DashboardPage.tsx` punya `ChartPie` (DDC distribution) + `ChartBar` (kunjungan). `LaporanLayout` punya `GrafikSubPage`, `TopPeminjamSubPage`, `TopBukuSubPage`.

**Enhancements:**

1. **Trend chart peminjaman** (line chart): X = minggu/bulan, Y = jumlah peminjaman. Toggle: 7 hari / 30 hari / 6 bulan / 1 tahun.
2. **Heatmap waktu populer**: grid 7-hari × 24-jam, color intensity = jumlah peminjaman per jam. Untuk lihat kapan jam paling rame perpustakaan.
3. **Insights cards**: "Buku terlaris bulan ini: X (123 pinjam)", "Peminjam teraktif: Y (45 pinjam)", "Rata-rata buku per anggota: 3.2".
4. **Drill-down**: klik chart → navigate ke laporan detail.

**Files affected:**

- `apps/desktop/src/features/dashboard/DashboardPage.tsx` (tambah widget)
- New: `apps/desktop/src/components/shared/ChartLine.tsx` (kalau belum ada)
- New: `apps/desktop/src/components/shared/Heatmap.tsx`
- `apps/desktop/src-tauri/src/commands/dashboard.rs` (new aggregation queries)
- Tests

**Acceptance:**

- Chart line: data 30 hari terakhir tampil, smooth, interactive tooltip.
- Heatmap: 168 cells (7×24), color scale visible, tooltip per cell.
- Insights cards: 3-4 stat cards dengan ikon + angka prominent.

---

## PR J — Sirkulasi scanner overlay + decoder reliability v2

### FEAT-28 — Sirkulasi (Webcam) scanner: overlay aiming + ROI decode + manual scan button + decoder reliability

**Severity:** HIGH (core flow scanner masih kurang akurat di v1.0.7)

**Reference screenshot:** [`screenshot-feat-28-sirkulasi-no-overlay.png`](./screenshot-feat-28-sirkulasi-no-overlay.png) — current state shows raw webcam feed without aiming guide; barcode ditaruh in middle background = banyak noise from interior ruangan.

**Baseline (v1.0.7 fix BUG-18):** camera 1280×720 + facingMode=environment + decoder default. Insufficient — user report masih susah baca barcode.

**Enhancements:**

1. **Overlay aiming guide** (visual):
   - Rectangular box di tengah video, ukuran ~70% width × 30% height (landscape barcode shape).
   - Sudut kotak di-highlight dengan corner brackets (kotak putus-putus + sudut tebal — UX standard mobile scanner).
   - Label di atas kotak: "Arahkan barcode ke dalam kotak".
   - Garis horizontal merah animated (scanning line) di tengah kotak — pure cosmetic untuk affordance.
   - Background di luar kotak gelap (overlay 50% black) untuk highlight ROI.

2. **ROI decode** (performance + accuracy):
   - Saat decode, crop video frame ke region kotak overlay → kirim cuma pixel itu ke decoder.
   - Lebih cepat (¼ pixel) + lebih akurat (no background noise dari rak buku, dinding, dll).
   - Pakai Canvas `getImageData(roiX, roiY, roiW, roiH)` → pass ke decoder.

3. **Image preprocessing** (better decode rate):
   - Sebelum decode, apply Canvas filter pipeline:
     - Grayscale (decoder lebih cepat di grayscale)
     - Contrast +30% (boost edge)
     - Optional: sharpen kernel kalau decoder masih miss
   - Try decode 3× per click manual: normal → contrast → grayscale-only. Return first hit.

4. **Manual "Scan" button**:
   - Tombol "Scan Sekarang" (icon: focus/camera-shutter) di bawah kotak overlay.
   - Klik → trigger single-frame decode (continuous decode tetap jalan).
   - Loading spinner 200-500ms → toast "Berhasil: <kode>" atau "Tidak terdeteksi — coba ulangi atau ketik manual".
   - Useful kalau continuous decode miss karena lighting tricky tapi user yakin barcode terlihat di frame.

5. **Multi-format scan**:
   - Decoder enable: EAN-13, EAN-8, Code-128, Code-39, QR Code, Data Matrix sekaligus.
   - Saat ini library kemungkinan cuma 1-2 format. Audit dulu library yang dipakai (`@zxing/library` ke `@zxing/browser`?) — kalau perlu, switch ke `@ericblade/quagga2` yang multi-format default.

6. **Decode rate**:
   - Continuous decode loop pakai `requestAnimationFrame` (native ~60Hz) instead of throttled `setInterval`.
   - Kalau decoder slow (>16ms per decode), skip frame dengan throttle adaptive.

7. **Optional torch button**:
   - Detect `track.getCapabilities().torch` — kalau true, tampilkan tombol senter di pojok video.
   - Kalau false, tombol hidden (laptop webcam tidak punya torch).

8. **Diagnostic mode** (opt-in, defer ke later kalau scope terlalu besar):
   - Setting "Simpan gambar gagal-decode untuk diagnostik" → kalau ON, save frame yang gagal decode ke `debug/scanner/<timestamp>.jpg`. Untuk troubleshoot sekolah dengan lighting buruk.

**Files affected:**

- `apps/desktop/src/features/sirkulasi/SirkulasiScanner.tsx` (existing scanner component — major rewrite)
- New utility: `apps/desktop/src/lib/scanner/overlay.ts` (compute ROI rectangle, render bracket corners)
- New utility: `apps/desktop/src/lib/scanner/preprocess.ts` (Canvas filters: grayscale, contrast, sharpen)
- New utility: `apps/desktop/src/lib/scanner/decoder.ts` (multi-format wrapper + 3-pass retry on manual scan)
- Possible dep change: `package.json` (kalau switch dari @zxing ke quagga2 atau add quagga2 fallback)
- Tests: unit test untuk preprocess functions (input image → expected output Canvas pixels)
- E2E test: smoke-test mode dengan static frame → verify decode success

**Acceptance:**

- Overlay kotak visible di video feed, label hint visible.
- Barcode framed dalam kotak → decode succeeds dalam ≤2 detik (continuous mode).
- Manual "Scan" button: klik → 1 attempt, retry 3× variants, total <1 detik. Hasil di toast.
- Background di luar kotak tidak interfere dengan decode (verified dengan barcode + cluttered background).
- Multi-format: scan QR + EAN + Code-128 semua works.
- No regression: existing flow Sirkulasi (member scan + book scan) tetap kerja.

**Risk:**

- Library switch (kalau perlu) bisa breaking — audit decoder library compatibility dulu.
- Canvas preprocessing CPU-intensive di laptop low-spec — profile dengan WebKit Inspector kalau ada lag.
- ROI cropping math bisa salah di video aspect ratios non-16:9.

---

## PR G — Google Sheets bidirectional sync (multi-device backbone)

### FEAT-26 — Google Sheets bidirectional auto-sync

**Severity:** HIGH (multi-device backbone — required by FEAT-27)

**Existing:** `apps/desktop/src/features/settings/SinkronisasiPage.tsx` punya UI form (spreadsheet ID + API key) tapi `syncNow()` cuma update `lastSync` timestamp — placeholder, tidak push apa pun ke Sheets.

**Spec:**

**Architecture:**

- Each Sheet = 1 tab per table: `anggota`, `buku`, `eksemplar`, `peminjaman`, `peminjaman_item`, `wishlist_buku`, `reservasi_buku`. Header row = column names dari schema. Setiap row di db = row di sheet.
- **Push (admin → Sheets)**: setiap N menit (default 5), iterate tables, find rows dengan `updated_at > last_push_at`, batch update Sheets. Plus tombstones: row deleted di db → mark sheet row dengan `_deleted: TRUE` column.
- **Pull (Sheets → admin/OPAC)**: setiap N menit, fetch tabs, find rows dengan `_updated_at > last_pull_at`, apply ke local db. Conflict resolution: last-write-wins per row by `updated_at`. Tie-break: admin wins.
- **Auth**: Service Account JSON (admin generate di Google Cloud Console, paste ke app). Pakai `google-sheets4` Rust crate atau direct REST.

**Sub-PR split (recommended):**

- **G1**: schema + sync metadata (`sync_state` table dengan `last_push_at`, `last_pull_at` per table) + Service Account auth + push-only untuk `anggota`.
- **G2**: extend push ke semua tables. Pull skeleton + apply for `anggota`.
- **G3**: pull for all tables. Conflict resolution. Scheduler thread (Tauri tokio task) dengan configurable interval.

**Files affected:**

- `apps/desktop/src-tauri/Cargo.toml` (add `google-sheets4`, `serde_json`, mungkin `oauth2`)
- New: `apps/desktop/src-tauri/src/commands/sync.rs` (semua sync logic)
- New: `apps/desktop/src-tauri/src/sync/` (module folder: `auth.rs`, `push.rs`, `pull.rs`, `mapper.rs`)
- Schema: `sync_state` table
- `apps/desktop/src/features/settings/SinkronisasiPage.tsx` (extend UI: SA JSON upload, manual push/pull buttons, sync status badge with last-push/pull times, conflict log)
- Tests: mock Sheets API, push/pull round-trip, conflict resolution

**Acceptance:**

- Admin paste Service Account JSON + spreadsheet ID → tombol "Push Now" → semua tables uploaded ke Sheets dalam <30 detik.
- Klik "Pull Now" → row baru di Sheets di-applied ke local db.
- Auto-sync interval (default 5 menit) — bisa disable atau ubah di Pengaturan.
- Conflict (sama row updated di 2 device) → last-updated wins, log entry di `sync_log` table.
- Sheets "deleted" column (`_deleted: TRUE`) dihormati di-pull (apply soft delete).

**Risk:**

- Sheets API quota: free 60 read req/min/user, 60 write/min/user. Untuk skala sekolah <10 device, fine. Tapi batch operations harus efficient.
- Schema evolution: kalau v1.0.9 tambah kolom, sheet header tidak match. Solution: header schema_version cell + auto-migrate sheet kalau version mismatch.
- Privacy: sheet harus restricted (private to admin's Google account + service account email). Document warning di UI.

---

## PR H — OPAC public-mode

### FEAT-27 — OPAC public-mode: kiosk fullscreen + dual-UI + scan KTA optional + admin-pwd unlock

**Severity:** HIGH (large feature — public-facing terminal for students)

**Spec:**

**Mode toggle:**
- Pengaturan → "Mode Akses" radio: Admin / Public OPAC.
- Boot ke saved mode otomatis. Setting key `desktop.app_mode` = `admin` | `public`.

**Admin → Public:**
- Pengaturan → "Beralih ke Public OPAC" → confirm dialog → app reload ke OPAC UI fullscreen.

**Public → Admin (LOCKED):**
- OPAC UI tampilkan tombol kecil "Mode Admin" di pojok bawah-kanan (icon: lock).
- Klik → modal password admin → input password (sama seperti login admin sekarang) → success → keluar fullscreen + reload ke admin UI.
- Failed password 3× berturut → lock 60 detik (anti-bruteforce).

**Kiosk fullscreen lock (mandatory dalam OPAC mode):**
- Tauri window: `fullscreen=true`, `decorations=false`, `alwaysOnTop=true`, `resizable=false`.
- Disable keys: F11, Esc, Alt+F4, Alt+Tab — di-intercept di Tauri window event handlers (best-effort; tidak bisa block Ctrl+Alt+Del / Task Manager — document this limitation).
- Auto-restart kiosk: kalau crash atau closed paksa via Task Manager → app reopen otomatis ke OPAC mode (saved state).
- Auto-idle: kalau tidak ada interaksi (mouse/keyboard) selama 2 menit → reset OPAC home (logout dari KTA scan kalau ada session).

**OPAC UI:**
- **Home**: search bar besar di tengah + filter chips (kategori, ketersediaan, tahun) + "Scan KTA Saya" button (opsional, untuk personalisasi).
- **Search results**: grid card book covers + title + author + status badge (Tersedia / Dipinjam-kembali-tgl-X / Direservasi).
- **Detail buku**: full metadata + cover besar + lokasi rak (dari `eksemplar.kode_eksemplar`) + tombol "Reservasi" (kalau dipinjam) + tombol "Tambah ke Wishlist" + tombol "Cari buku serupa".
- **Scan KTA flow**: scan → personalisasi UI (header tampilkan nama + foto anggota). Tampilkan history pinjam personal + reservasi aktif + wishlist. Idle 2 menit → auto-logout.
- **Wishlist submit (anggota)**: input judul + alasan → push ke `wishlist_buku` (FEAT-22) → terlihat di admin queue.

**Files affected:**

- `apps/desktop/src-tauri/src/commands/app_mode.rs` (new: `app_mode_get`, `app_mode_set`, `kiosk_unlock` (verify password))
- `apps/desktop/src-tauri/src/lib.rs` (boot logic: read app_mode setting, set window properties accordingly)
- New feature folder: `apps/desktop/src/features/opac/`:
  - `OpacApp.tsx` (root, replaces normal admin App when mode=public)
  - `OpacHomePage.tsx`
  - `OpacSearchPage.tsx`
  - `OpacBookDetailPage.tsx`
  - `OpacKtaScanFlow.tsx`
  - `OpacWishlistDialog.tsx`
  - `OpacAdminUnlockButton.tsx`
- `apps/desktop/src/main.tsx` (route based on `app_mode`)
- New: `apps/desktop/src/features/settings/AksesModePage.tsx` (mode toggle UI di Pengaturan)
- Setup wizard for first-time public mode: pilih spreadsheet ID + Service Account (calls FEAT-26 sync UI flow).
- Tests

**Acceptance:**

- Toggle ke Public mode di Pengaturan → app reload, UI publik fullscreen.
- Tidak bisa keluar fullscreen via F11/Esc/Alt+F4/Alt+Tab.
- Klik "Mode Admin" → password prompt → success → keluar ke admin UI normal.
- Search buku → results displayed, klik card → detail.
- Scan KTA → header personalisasi, history visible.
- Idle 2 menit → reset ke home + logout KTA session.
- Auto-sync FEAT-26 jalan di background — peminjaman baru di admin tampak di OPAC dalam 1-5 menit lag.

**Risk:**

- Window event interception cross-platform — Tauri 2 punya limited support untuk Windows kiosk lock. Mungkin perlu native plugin. Document limitations.
- Kalau FEAT-26 partial / not ready, OPAC ship dengan mode "same-device only" — fallback yang valid.
- SinkronisasiPage UI conflict: setting Admin Sync (manual) vs OPAC auto-sync — disambiguate di UX.
- Performance: search query di db jutaan rows perlu FTS5 index. Existing DB sudah punya FTS5 di buku table? Audit dulu.

---

## Reference

- v1.0.7 batch sebagai precedent: PRs #119–#125. Same workflow, same patterns.
- Master prompt untuk kick-off Devin baru: lihat [`CONTINUOUS_AUTOMATION.md`](./CONTINUOUS_AUTOMATION.md).
- v1.0.7 release: https://github.com/alviarts/perpustakaan-offline/releases/tag/v1.0.7
