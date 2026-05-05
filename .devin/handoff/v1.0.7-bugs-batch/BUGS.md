# v1.0.7 Bug & Feature Batch — Full Detail

**Reporter:** [@alviarts](https://github.com/alviarts) (user `vielz88361`)
**Reported:** 2026-05-05 during session `90b87abd638645d0acab414e7ade5ec5`
**Status table:** [`PROGRESS.md`](./PROGRESS.md)
**Workflow / process:** [`WORKFLOW.md`](./WORKFLOW.md)

This file is the durable record of every bug/feature in the v1.0.7 batch. Each section is self-contained — a future Devin should be able to pick it up and ship it without re-asking the user.

---

## PR A — Sirkulasi & Scanner

### BUG-01 — KTA QR scan di Sirkulasi → "Kode tidak dikenali" walau payload `member:1`

**Severity:** HIGH (blocks the new webcam circulation flow shipped in v1.0.6 #19 / PR #111)

**Repro:**

1. Login as admin. Anggota → Tambah → buat anggota (mis. `Irmayanti` / `A10009` / `12B`). Pastikan ada minimal 1 anggota.
2. Anggota → pilih anggota → Cetak KTA → cetak / preview KTA. Pakai template default — QR yang dihasilkan akan encode payload `member:<id>` (lihat `apps/desktop/src/features/kta/print.ts` → `buildQrPayload`).
3. Sirkulasi (Webcam) → mode **Pinjam** → arahkan kamera ke QR yang baru dicetak.
4. Toast merah muncul: **"Kode tidak dikenali — member:1"** (lihat screenshot `bug-01-sirkulasi-scan-member.png`).

**Expected:** anggota terpilih (toast hijau "Anggota terpilih: A10009 · Irmayanti"), keranjang siap menerima eksemplar.

**Observed:** QR di-decode dengan benar (string `member:1` literal muncul di toast), tapi `anggotaApi.getByKode("member:1")` mengembalikan null sehingga code jatuh ke fallback "kode tidak dikenali".

**Suspected root cause:**

- `SirkulasiPage.handleScan` memanggil `anggotaApi.getByKode(code)` dengan raw `code` = `"member:1"`. `getByKode` membandingkan dengan `kode_anggota` (mis. `A10009`), bukan dengan `member:<id>`.
- Sebelum panggil getByKode, perlu **parse payload**: kalau `code` match `/^member:(\d+)$/` panggil `anggota_get_by_id(id)` instead. Kalau bukan, tetap pakai `getByKode(code)`.
- Cek juga apakah `buildQrPayload` di `print.ts` memang `member:<id>` (bisa jadi format pernah diubah; konfirmasi format sebelum patch).

**Files:**

- `apps/desktop/src/features/sirkulasi/SirkulasiPage.tsx` — `handleScan` (lines ~118–143)
- `apps/desktop/src/features/kta/print.ts` — `buildQrPayload` (source of truth for payload format)
- `apps/desktop/src/lib/anggota.ts` — frontend API wrapper (need a `getById` if it doesn't exist yet)
- `apps/desktop/src-tauri/src/commands/anggota.rs` — backend `anggota_get_by_id` / `anggota_get_by_kode`

**Acceptance:**

- Scan QR cetak ulang → anggota auto-terpilih
- Manual input `member:1` di kotak text scanner → anggota auto-terpilih
- Manual input `A10009` (kode_anggota plain text, alias ketik) → tetap auto-terpilih (regression: jangan rusakkan path existing)
- Unit test di `apps/desktop/tests/unit/` untuk parsing payload `member:` prefix vs plain kode

**Screenshot:** [`screenshots/bug-01-sirkulasi-scan-member.png`](./screenshots/bug-01-sirkulasi-scan-member.png)

---

### BUG-17 — Sirkulasi (Kembalikan): scan eksemplar `B123-01` → "Tidak ada peminjaman aktif" walau ada loan aktif

**Severity:** HIGH (mode Kembalikan webcam unusable)

**Repro:**

1. Buat anggota `Irmayanti` / `A10009`.
2. Buat buku `KEISLAMAN` (`B123`) dengan jumlah eksemplar ≥ 1. **Workaround fresh-install:** kalau eksemplar table empty, jalankan `INSERT INTO eksemplar(buku_id, kode_eksemplar, status) VALUES (1, 'B123-01', 'tersedia');` (lihat smoke-test SKILL).
3. Peminjaman → Pinjam Baru → pilih Irmayanti + buku B123 → Simpan & Pinjam. Loan aktif terbentuk (mis. `PJ-20260505-0002`, status `Dipinjam`).
4. Sirkulasi (Webcam) → mode **Kembalikan** → scan/ketik `B123-01`.
5. Toast merah: **"Tidak ada peminjaman aktif untuk kode ini — B123-01"** (screenshot `bug-17-sirkulasi-return-not-found.png`).
6. Sidebar Peminjaman jelas menunjukkan loan aktif `PJ-20260505-0002` (screenshot `bug-17-peminjaman-active-list.png`).

**Expected:** loan ditemukan, item masuk daftar pengembalian, tombol "Proses Pengembalian" enabled.

**Observed:** `peminjamanApi.aktifByEksemplar("B123-01")` mengembalikan null.

**Suspected root cause:** salah satu (atau kombinasi) dari:

- `peminjaman_aktif_by_eksemplar` query SQL pakai filter status case-sensitive (`status = 'Dipinjam'` vs db menyimpan `'dipinjam'` lowercase), atau filter `is_returned = 0` yang nilai default-nya salah.
- Whitespace/case mismatch: `kode_eksemplar` di db berbeda case dengan input (`B123-01` vs `b123-01`). `BUG-01` memungkinkan ada normalization issue umum di scanner pipeline.
- Join `peminjaman_items` ke `eksemplar` lewat field yang salah (mis. join by id padahal harusnya by kode_eksemplar, atau sebaliknya).

**Files:**

- `apps/desktop/src/features/sirkulasi/SirkulasiPage.tsx` — `handleScan` mode `kembalikan` (lines ~184–235)
- `apps/desktop/src/lib/peminjaman.ts` — `aktifByEksemplar` wrapper
- `apps/desktop/src-tauri/src/commands/peminjaman.rs` — `peminjaman_aktif_by_eksemplar` SQL
- `apps/desktop/src-tauri/src/db/mod.rs` — schema for `peminjaman` & `peminjaman_items` & `eksemplar`

**Acceptance:**

- Scan barcode `B123-01` saat ada loan aktif → loan ditemukan, item masuk daftar pengembalian
- Manual input `b123-01` (lowercase) → tetap ditemukan (case-insensitive match di backend, atau normalize di frontend)
- Unit/integration test untuk happy path (loan exists) + 2 negative paths (no loan, already returned)

**Screenshots:**

- [`screenshots/bug-17-sirkulasi-return-not-found.png`](./screenshots/bug-17-sirkulasi-return-not-found.png)
- [`screenshots/bug-17-peminjaman-active-list.png`](./screenshots/bug-17-peminjaman-active-list.png)

---

### BUG-18 — Barcode/QR scanner susah baca walau barcode terlihat jelas

**Severity:** MEDIUM (UX — slow scanning)

**Repro:**

1. Sirkulasi (Webcam) → aktifkan kamera.
2. Arahkan kamera ke barcode buku (Code 39 dari Cetak Label) atau QR KTA. Posisikan barcode jelas, di tengah, fokus, pencahayaan cukup.
3. Decoder butuh waktu lama (>3 detik) atau kadang gagal sama sekali sampai user goyang2 kamera.

**Expected:** decode < 1 detik untuk barcode/QR yang jelas terlihat.

**Observed:** scan responsiveness rendah.

**Suspected root cause / things to try:**

- **Resolusi camera stream**: `useBarcodeScanner.ts` sekarang request default constraint. Naikkan ke `{ width: { ideal: 1280 }, height: { ideal: 720 } }` minimum, atau 1920×1080 kalau device dukung. Resolusi 640×480 default Tauri webview terlalu rendah untuk barcode 1D dengan banyak bar.
- **Frame rate decode**: cek apakah ada throttle. Native `BarcodeDetector` (Chromium-based webview) bisa di-poll via `requestAnimationFrame` tanpa throttle, atau via `setInterval(decode, 50ms)` (20 fps).
- **Multi-format decoder**: `BarcodeDetector` defaults ke semua format. Pastikan `formats: ['code_128', 'code_39', 'qr_code', 'ean_13']` explicit di-pass — beberapa browser default ke subset yang tidak include Code 39.
- **ROI (region of interest)**: kalau pakai canvas-based decoder, crop ke center 60% frame untuk speed up.
- **Library**: kalau `BarcodeDetector` API tidak tersedia di Tauri webview (rare, tapi possible di webview2 Windows), fallback ke `@zxing/browser` atau `quagga2`.

**Files:**

- `apps/desktop/src/features/sirkulasi/useBarcodeScanner.ts` — main scanner hook

**Acceptance:**

- Barcode Code 39 yang jelas (B123-01 dari `feat-13-pdf-tersimpan-toast.png`) decoded < 1 detik
- QR member jelas decoded < 500ms
- No regression di kondisi gelap / blur — tetap show error panel yang ada (PR #118 / v1.0.6)

---

### FEAT-07 — Rename tombol Sirkulasi (Webcam): Pinjam / Kembalikan

**Severity:** LOW (kosmetik tapi jelas)

**Detail:**

- Tombol header **"Pinjam"** → **"Scan Anggota Pinjam"**
- Tombol header **"Kembalikan"** → **"Scan Kembalikan Pinjaman"**
- English equivalent (i18n parity): `"Scan Member Borrow"` / `"Scan Return Loan"`

**Files:**

- `apps/desktop/src/features/sirkulasi/SirkulasiPage.tsx` — mode toggle buttons (search for `t('sirkulasi:mode.pinjam')` / `t('sirkulasi:mode.kembalikan')`)
- `apps/desktop/src/i18n/id/sirkulasi.json` — update `mode.pinjam` & `mode.kembalikan` strings (or add new sub-keys like `mode.pinjamLong`)
- `apps/desktop/src/i18n/en/sirkulasi.json` — same parity

**Acceptance:** `pnpm i18n:lint` clean; visual parity di id + en.

**Screenshot:** [`screenshots/feat-07-sirkulasi-buttons.png`](./screenshots/feat-07-sirkulasi-buttons.png)

---

## PR B — Peminjaman & Pengembalian

### BUG-09 — "Maksimum buku per anggota" = 3 tapi block di 2 + audit menyeluruh setting peminjaman

**Severity:** HIGH (setting silently ignored)

**Repro:**

1. Pengaturan → Aturan Peminjaman → set "Maksimum buku per anggota" = **3**, "Durasi pinjam" = 7, "Denda per hari" = 500. Klik Simpan.
2. Anggota Irmayanti sudah punya 2 peminjaman aktif.
3. Peminjaman → Pinjam Baru → pilih Irmayanti + 1 buku → Simpan & Pinjam.
4. Toast merah: **"Gagal membuat peminjaman: validation: melebihi maksimal 2 buku per anggota (saat ini 2)"** (screenshot `bug-09-10-pinjam-baru-error.png`). Padahal setting bilang max 3.

**Expected:** loan ke-3 berhasil. Loan ke-4 gagal dengan "melebihi maksimal **3** buku per anggota".

**Suspected root cause:**

- Backend `commands/peminjaman.rs` punya constant hardcoded `MAX_BUKU_PER_ANGGOTA = 2` atau sejenisnya, tidak pernah baca dari tabel `settings`.
- Atau setting tersimpan di table tapi key/path-nya beda — frontend tulis ke `aturan.maksimumBukuPerAnggota`, backend baca dari `aturan.maxBuku`.

**Files:**

- `apps/desktop/src-tauri/src/commands/peminjaman.rs` — cari `maksimal` / `MAX_BUKU` / `melebihi`
- `apps/desktop/src-tauri/src/commands/settings.rs` — schema setting + getter
- `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx` — frontend bisa juga punya guard yang prevent submit; pastikan ini juga ikut setting
- `apps/desktop/src/features/settings/AturanPeminjamanCard.tsx` (atau nama serupa) — pastikan field name yang ditulis match

**Acceptance:**

- Setting max=3 → boleh pinjam sampai 3 buku per anggota; loan ke-4 ditolak dengan pesan "melebihi maksimal **3** buku..."
- Setting max=10 → boleh sampai 10
- Setting max=1 → langsung tolak loan ke-2

**AUDIT TAMBAHAN (lakukan sekalian dalam PR ini):** verifikasi setting lain juga benar-benar diterapkan:

| Setting              | Where it should be applied                                        | How to verify                                                              |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Durasi pinjam (hari) | `peminjaman_create` auto-fill jatuh tempo = tgl_pinjam + durasi   | Set 14 → form Pinjam Baru → tanggal jatuh tempo +14 hari                   |
| Denda per hari (Rp)  | `pengembalian_create` denda = max(0, hari_telat) × denda_per_hari | Buat loan jatuh tempo kemarin → kembalikan → cek denda                     |
| Hari libur           | Skip dari hitungan hari telat & dari hitungan jatuh tempo         | Set Min+Sab libur → pinjam Jumat dengan durasi 1 → JT Senin (skip Sab+Min) |
| Maksimum buku        | (BUG-09 di atas)                                                  | Lihat di atas                                                              |

**Screenshot:** [`screenshots/bug-09-10-pinjam-baru-error.png`](./screenshots/bug-09-10-pinjam-baru-error.png), [`screenshots/bug-09-aturan-peminjaman.png`](./screenshots/bug-09-aturan-peminjaman.png)

---

### BUG-10 — Toast error peminjaman menampilkan raw JSON

**Severity:** MEDIUM (UX)

**Repro:** trigger any validation error di Pinjam Baru (mis. coba pinjam buku yang sudah dipinjam, atau melebihi max).

**Expected:** toast description = pesan user-friendly saja, mis. `"melebihi maksimal 3 buku per anggota (saat ini 3)"`.

**Observed:** toast description = literal JSON: `{"code":"validation","message":"validation: melebihi maksimal 2 buku per anggota (saat ini 2)"}` (screenshot).

**Suspected root cause:**

- `formatTauriError` di `apps/desktop/src/lib/errors.ts` tidak handle case di mana Tauri reject dengan plain object `{code, message}` — tipikal regresi dari BUG-002 v1.0.1 yang dulu sudah di-fix (lihat `docs/bugs/POST_V1_BUGS.md`).
- Atau form di `PeminjamanForm.tsx` pakai fallback `String(err)` langsung bukan `formatTauriError(err)`.

**Files:**

- `apps/desktop/src/lib/errors.ts` — `formatTauriError`
- `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx` — error handler
- Re-check: alur Pengembalian, Sirkulasi, KTA juga, semua harus konsisten pakai `formatTauriError`

**Acceptance:** toast description di SEMUA error path = string user-friendly, bukan `{...}` JSON.

---

### FEAT-08 — Pengembalian: quick-input buttons untuk denda

**Severity:** MEDIUM (UX)

**Detail:**

Di halaman Pengembalian (atau dialog Bayar Denda), field "Bayar Denda" sekarang cuma input number. Tambah 3 tombol preset di bawah/sampingnya, isi otomatis dari setting "Denda per hari":

- Denda 1000 → tombol `[Rp 1.000] [Rp 2.000] [Rp 3.000]`
- Denda 1500 → tombol `[Rp 1.500] [Rp 3.000] [Rp 4.500]`

Klik tombol = isi field denda. User masih bisa override manual.

**Optional (saran):** kalau backend sudah hitung "telat berapa hari" untuk loan ini, tambah 1 tombol ekstra **"Auto: N hari × Rp X = Rp Y"** yang isi sesuai hitungan real.

**Files:**

- `apps/desktop/src/features/pengembalian/PengembalianPage.tsx` — denda input
- Setting denda per hari sudah dibaca dari `settingsApi.getAturan()` (atau wrapper yang sama dipakai di tempat lain)

**Acceptance:**

- 3 tombol muncul, label format `Rp X.XXX` (id-ID locale)
- Klik tombol = field terisi
- Update setting denda per hari → tombol re-render dengan angka baru tanpa reload

**Depends on:** BUG-09 (untuk pastikan setting bisa dibaca dengan benar)

**Screenshots:** [`screenshots/feat-08-bayar-denda-field.png`](./screenshots/feat-08-bayar-denda-field.png), [`screenshots/feat-08-aturan-peminjaman-card.png`](./screenshots/feat-08-aturan-peminjaman-card.png)

---

## PR C — KTA (Kartu Tanda Anggota)

### BUG-02 — QR code KTA gepeng (aspect ratio rusak) di semua template

**Severity:** HIGH (QR not scannable)

**Repro:**

1. Anggota → Cetak KTA → pilih template default (atau template apapun).
2. Lihat preview KTA: QR code terlihat **stretched horizontally** (bukan square). Sangat sulit dibaca webcam (terkait BUG-18).
3. Cetak/Simpan PDF — output sama: QR gepeng.

**Expected:** QR code square (aspect ratio 1:1) di preview, print, dan PDF export. Ukuran cukup besar untuk webcam (saran ≥ 25mm di KTA berukuran 85.6×53.98mm).

**Files:**

- `apps/desktop/src/features/kta/KtaPreview.tsx` — preview rendering
- `apps/desktop/src/features/kta/print.ts` — print HTML rendering
- `apps/desktop/src/features/kta/pdf.ts` — jsPDF PDF rendering
- `apps/desktop/src/features/kta/TemplateEditor.tsx` — field type `qr` (cek apakah W != H di-allow oleh editor; jika ya, force aspect-ratio lock untuk QR)

**Implementation hint:** di QR field renderer, sebelum `addImage`, pakai `min(width, height)` sebagai sisi square. Atau simpan field dengan `width === height` saja di template (lock di editor).

**Acceptance:**

- QR di preview = square, ≥ 18mm setara
- QR di PDF = square, scannable dengan webcam standard (test dengan PR A scanner improvements)
- Existing template config tidak rusak (migration: kalau template lama punya W != H untuk QR, normalize ke `min`)

**Screenshot:** [`screenshots/bug-02-kta-qr-gepeng.png`](./screenshots/bug-02-kta-qr-gepeng.png) (sebenarnya juga screenshot untuk FEAT-03/-04 — sama gambarnya)

---

### BUG-06 — Foto anggota tampil sebagai broken-image alt "Foto" di KTA preview

**Severity:** TBD (verify saat eksekusi — bisa jadi memang anggota belum upload foto)

**Repro:**

1. Anggota tanpa field `foto` (path null/empty).
2. Cetak KTA → preview menunjukkan placeholder "Foto" sebagai alt text broken image (lihat screenshot bug-02 / bug-12).

**Expected:** placeholder neutral (kotak abu-abu dengan icon user, ATAU tulisan "Foto belum di-upload"), bukan broken-image icon.

**Files:** `apps/desktop/src/features/kta/KtaPreview.tsx`, `pdf.ts`, `print.ts` — semua tempat foto di-render

**Acceptance:**

- Anggota tanpa foto → preview/print/PDF menampilkan placeholder gracefully
- Anggota dengan foto valid → tampil normal (regression test)
- Anggota dengan foto path invalid → fallback ke placeholder (handle `onerror` atau pre-validate path)

---

### FEAT-03 — KTA depan: tambah field biodata lengkap + TTD kepala sekolah

**Severity:** MEDIUM (feature)

**Detail (user said: "semuanya dulu aja masukin, nanti admin akan mengedit nya custom"):**

Tambah field-field berikut sebagai opsi di KTA Template Editor (admin bisa drag-place atau hide):

- Tempat & tanggal lahir (`tempatTanggalLahir` — gabung "Jakarta, 12 Mei 2008")
- Jenis kelamin (`jenisKelamin`)
- Alamat (`alamat`)
- Jurusan (sudah ada — pastikan exposed di field type list)
- Agama (sudah ada — pastikan exposed)
- No. telp (`noTelp`)
- Tahun masuk (`tahunMasuk`)
- Berlaku s.d. (`berlakuSd` — string year atau ISO date)
- TTD kepala sekolah (gambar) (`ttdKepsek`)
- Nama kepala sekolah (text) (`namaKepsek`)

**Source data:**

- Field anggota (TTL, JK, alamat, jurusan, agama, no telp, tahun masuk) → existing kolom di tabel `anggota`. Kalau belum ada di schema, tambah via migration.
- TTD + nama kepsek → setting global di Pengaturan → Identitas Perpustakaan: input upload PNG transparan + input nama. Auto-resolve di KTA renderer.

**Files:**

- `apps/desktop/src-tauri/src/db/migrations/<n>-anggota-extended-fields.sql` — kalau perlu kolom baru
- `apps/desktop/src/features/anggota/AnggotaForm.tsx` — input baru
- `apps/desktop/src/features/settings/IdentitasCard.tsx` — input TTD kepsek + nama kepsek
- `apps/desktop/src/features/kta/TemplateEditor.tsx` — daftar field type baru
- `apps/desktop/src/features/kta/{KtaPreview,print,pdf}.tsx/.ts` — render logic untuk field baru

**Acceptance:**

- Semua field baru muncul di Template Editor (Add Field dropdown)
- Field TTD kepsek + nama kepsek otomatis pull dari Settings → Identitas (tidak perlu di-edit per anggota)
- i18n parity (id + en) untuk semua label baru
- Backwards compatible: template lama tanpa field baru tetap render dengan benar

---

### FEAT-04 — KTA back-side editable + Tata Tertib + cetak halaman 2

**Severity:** MEDIUM (feature)

**Detail:**

KTA Template Editor sekarang punya tab/toggle **Front / Back**. Back-side editor parity dengan front-side (Add Field, X/Y/W/H, color, font, etc).

**Default back-side content** (pre-fill saat user klik "Buat Back-Side"):

```
TATA TERTIB PERPUSTAKAAN

1. Jam operasional perpustakaan adalah pukul 07.00 hingga 15.00 WIB.
2. Pengunjung dilarang membawa tas, makanan, dan minuman ke dalam ruang perpustakaan.
3. Kartu perpustakaan wajib ditunjukkan saat meminjam atau memperpanjang masa pinjaman buku.
4. Pengguna diperbolehkan meminjam maksimal 3 buku.
5. (silakan tambahkan...)
```

**Cetak / Export PDF:**

- Print: `window.print()` dengan 2 page CSS (page 1 = front, page 2 = back, page-break-after).
- PDF: jsPDF `addPage()` setelah front, render back layout, save.

**Files:**

- `apps/desktop/src/features/kta/TemplateEditor.tsx` — tabs/sections Front + Back
- `apps/desktop/src-tauri/src/commands/kta_templates.rs` — extend struct `KtaTemplate` dengan `back_layout: Option<Layout>` (migration di db)
- `apps/desktop/src/features/kta/{print,pdf}.ts` — render 2-page output

**Acceptance:**

- Editor punya tab Front + Back, parity behaviour
- Default back template berisi 4 poin tata tertib + placeholder ke-5
- Cetak menghasilkan 2 halaman (atau 1 halaman dengan duplex marker, depending on printer setup — page 2 selalu render)
- Export PDF = file 2-page
- Backwards compatible: template tanpa back layout → cetak/export tetap 1-page

**Depends on:** FEAT-03 (sebaiknya merge bareng karena editor disentuh barengan)

---

## PR D — UI/Layout polish

### BUG-05 — Action bar Pengaturan mepet bawah window

**Severity:** MEDIUM

**Repro:** Pengaturan → tab manapun (mis. Kartu Tanda Anggota) → action bar bawah ("Jadikan Default / Hapus / Simpan") menempel di edge bawah window. Susah klik karena tidak ada gap.

**Files:** `apps/desktop/src/features/settings/SettingsLayout.tsx` (atau wrapper sejenis), atau parent layout. Cek juga apakah `SettingsLayout` punya `pb-N`.

**Fix:** tambah `pb-6` (atau setara 24–32px) di scrollable content area shell Pengaturan. Pastikan action bar fixed/sticky tidak tertutup oleh padding yang sama.

**Acceptance:** action bar punya minimal 16–24px gap dari window edge di SEMUA tab Pengaturan.

**Screenshot:** [`screenshots/bug-05-pengaturan-actionbar-mepet.png`](./screenshots/bug-05-pengaturan-actionbar-mepet.png)

---

### BUG-12 — Layout Cetak KTA + Cetak Label & Barcode mepet ke border kiri/kanan

**Severity:** MEDIUM

**Repro:** Anggota → Cetak KTA, ATAU Buku → Cetak Label & Barcode. Konten utama mepet ke border kiri/kanan window.

**Files:** kemungkinan kedua page wrapper sendiri (bukan AppShell). Cek `CetakKtaPage.tsx`, `CetakLabelPage.tsx` (atau nama serupa di `features/label-buku/`).

**Fix:** tambahkan `px-6` atau `px-8` di outermost wrapper (atau `mx-auto max-w-screen-2xl px-6` kalau ingin centered + padded).

**Audit:** sambil disitu, konsistenkan padding di semua page wrapper. Lookup pattern dengan `rg "<main"` atau `rg "PageContainer"`.

**Acceptance:**

- Cetak KTA & Cetak Label punya horizontal padding yang konsisten
- Halaman lain tidak terdampak regresi

**Screenshots:** [`screenshots/bug-12-cetak-kta-mepet.png`](./screenshots/bug-12-cetak-kta-mepet.png), [`screenshots/bug-12-cetak-label-mepet.png`](./screenshots/bug-12-cetak-label-mepet.png)

---

### BUG-14 — Topbar global search placeholder wrap & nabrak garis container

**Severity:** LOW

**Repro:** Topbar → input search "Cari anggota, buku, peminjaman..." — placeholder wrap ke 2 baris dan vertically overflow container.

**Files:** `apps/desktop/src/components/Topbar.tsx` atau `AppShell.tsx`

**Fix:**

```tsx
<input
  className="overflow-hidden text-ellipsis whitespace-nowrap ... ..."
  placeholder="Cari anggota, buku, peminjaman..."
/>
```

Atau lebarkan container search (mis. dari `w-64` ke `w-80` / responsive).

**Acceptance:**

- Placeholder satu baris, ellipsis kalau perlu
- Tidak nabrak border container vertikal

**Screenshot:** [`screenshots/bug-14-topbar-search-wrap.png`](./screenshots/bug-14-topbar-search-wrap.png)

---

### BUG-16 — Sidebar tab Pengaturan hilang saat scroll konten tab

**Severity:** MEDIUM

**Repro:** Pengaturan → Manual (atau tab apapun yang kontennya panjang) → scroll konten ke bawah. Sidebar tab list (Identitas, Aturan Peminjaman, ..., Manual, Tentang) hilang dari view.

**Expected:** sidebar tetap visible saat scroll, supaya user bisa pindah tab kapan saja tanpa scroll-up dulu.

**Files:** `apps/desktop/src/features/settings/SettingsLayout.tsx` (sidebar wrapper). Set `position: sticky; top: 0; max-height: calc(100vh - <topbar>); overflow-y: auto` di sidebar nav.

**Acceptance:**

- Sidebar tetap visible saat konten tab scroll
- Sidebar sendiri scroll independen kalau itemnya overflow (sudah terlihat scroll bar di screenshot kedua)

**Screenshots:** [`screenshots/bug-16-pengaturan-sidebar-hidden.png`](./screenshots/bug-16-pengaturan-sidebar-hidden.png), [`screenshots/bug-16-pengaturan-sidebar-normal.png`](./screenshots/bug-16-pengaturan-sidebar-normal.png)

---

### FEAT-13 — Cetak Label & Barcode Buku: "Buka Folder Hasil" + link buka folder di toast PDF

**Severity:** LOW (UX)

**Detail:** Parity dengan Cetak KTA (yang sudah punya fitur ini di v1.0.4 / PR `feat(kta): export selected KTA to PDF + open output folder`).

**Files:**

- `apps/desktop/src/features/label-buku/CetakLabelPage.tsx` (atau nama serupa)
- Backend: re-use `kta_open_exports_folder` atau buat `label_open_exports_folder` baru di `apps/desktop/src-tauri/src/commands/`
- Saran: pisahkan folder output → `<app_data>/exports/labels/` (vs `<app_data>/exports/` untuk KTA), supaya tidak campur

**Acceptance:**

- Tombol "Buka Folder Hasil" di header sejajar Cetak / Simpan PDF / Kelola Template
- Toast "PDF tersimpan" punya tombol/link "Buka folder"
- Folder otomatis dibuat saat first export

**Screenshot:** [`screenshots/feat-13-pdf-tersimpan-toast.png`](./screenshots/feat-13-pdf-tersimpan-toast.png)

---

### FEAT-15 — Manual: FAB scroll-to-top

**Severity:** LOW (UX)

**Detail:**

- Floating action button di pojok kanan bawah halaman Manual
- Icon arrow-up
- Muncul setelah scroll > 200px (fade in)
- Klik = `window.scrollTo({ top: 0, behavior: 'smooth' })` atau scroll ke section "Daftar Isi"

**Files:** `apps/desktop/src/features/settings/ManualPage.tsx` (atau path serupa)

**Acceptance:**

- FAB hidden initially
- FAB muncul saat scroll > 200px
- Klik = smooth scroll ke top
- Tidak menghalangi konten saat di-render

**Screenshot:** [`screenshots/feat-15-manual-page.png`](./screenshots/feat-15-manual-page.png)

---

## PR E — Dashboard

### FEAT-11 — Dashboard quote-of-the-day rotasi tiap 5 menit dengan animasi

**Severity:** LOW (polish)

**Current:** quote deterministik per-hari (added in PR #100, commit `f658d3a`).

**Detail:**

- Quote ganti otomatis tiap 5 menit (pakai `setInterval(300000)`)
- Animasi transition: **fade-slide** (saran default). Quote lama fade out + slide-up, quote baru fade in + slide-up dari bottom.
- Optional: typing animation kalau diminta user nanti — tapi default fade-slide.

**Quote pool:**

- Baca dari list yang sudah ada di code (lokasi: cari `QUOTES` atau `quoteOfTheDay` di `apps/desktop/src/features/dashboard/`)
- Saran: tambah ke 50–100 quote bertema buku/pendidikan kalau pool sekarang < 30. Gunakan campuran id + en kalau locale berubah.

**Files:**

- `apps/desktop/src/features/dashboard/DashboardPage.tsx` atau component `QuoteCard.tsx`

**Acceptance:**

- Quote berubah tiap 5 menit
- Animasi fade-slide smooth (CSS transition 400–600ms)
- Setiap rotation pilih quote berbeda dari sebelumnya (jangan tampil quote yang sama 2× berturut)
- Saat user pindah halaman dan kembali, timer di-reset ke 5 menit (tidak instant ganti, supaya tidak flicker)

**Screenshot:** [`screenshots/feat-11-dashboard-quote.png`](./screenshots/feat-11-dashboard-quote.png)

---

## After all PRs — Release

When PROGRESS.md menunjukkan semua row DONE, bikin **PR F: chore(release): v1.0.7**:

- Bump version di:
  - `package.json`
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/Cargo.toml`
  - `apps/desktop/src-tauri/tauri.conf.json`
- Update `CHANGELOG.md` dengan summary semua bug + feature
- Tag `v1.0.7` setelah merge (user yang tag, atau via release workflow kalau ada)
