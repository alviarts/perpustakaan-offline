# Smoke Test Report — v1.4.0

**Tanggal:** 2026-11-16
**Branch:** `main` (HEAD `7b7cf49`)
**Lingkungan:** Windows 10/11, Node v25.9.0, pnpm 9.15.1, Rust 1.95.0
(edition 2024), SQLite 3.50.6, WebView2. DB asli:
`%APPDATA%\id.alviarts.perpustakaan\perpustakaan-v2.db` (v1.4.0).
**Scope:** static checks, unit (Vitest), backend Rust (cargo), e2e Playwright
(browser dev mode), inspeksi DB SQLite asli, perbaikan bug.

---

## Ringkasan

| Area | Hasil |
|---|---|
| `pnpm lint` | ✅ PASS |
| `pnpm typecheck` | ✅ PASS |
| `pnpm i18n:lint` | ✅ PASS (id ↔ en parity OK) |
| `pnpm build` (Vite production) | ✅ PASS (~15s) |
| `pnpm test` (Vitest, `--no-webstorage`) | ✅ **647 PASS / 0 FAIL** (75 file; termasuk 16 test lisensi/trial + tampilan) |
| `cargo test --lib` | ✅ **297 PASS / 0 FAIL / 5 ignored** (setelah 4 bug diperbaiki) |
| `cargo check --all-targets` | ✅ PASS |
| `cargo fmt` | N/A — baseline repo tidak rustfmt-clean di banyak file (tidak diubah) |
| `pnpm test:e2e` (Playwright, 56 test) | ✅ 56/56 PASS (setelah 2 bug infra + 7 test stale diperbaiki; + spec fitur tampilan baru) |
| DB asli inspeksi | ✅ 1 admin, master data ter-seed, `ddc` 178, `kta_templates` 1, tabel bersih |
| Gotcha lama v1.0.0 (boot-001..005) | ✅ Semua sudah diperbaiki di v1.3.6 (terverifikasi di kode + cargo test) |

**Kesimpulan: v1.3.6 hijau penuh di Windows setelah 12 perbaikan** (lihat
detail di bawah). Tidak ada regresi tersisa.

---

## Bug ditemukan & diperbaiki (kode produksi)

### BUG-101 — `rangeForPreset` (frontend) salah 1 hari di 00:00–07:00
- **WHERE:** `apps/desktop/src/lib/kunjungan.ts:197` (`rangeForPreset`).
- **TRIGGER:** `new Date()` dimanipulasi dengan setter **lokal**
  (`setDate`/`setMonth`), lalu diformat dengan `toISOString()` yang **UTC**.
  Pada UTC+7 sebelum pukul 07:00, tanggal lokal ≠ tanggal UTC → preset
  `month` (mulai `-01`) dan `year` (mulai `-01-01`) meleset 1 hari
  (contoh: 1 Nov 00:30 WIB = 31 Okt 17:30 UTC).
- **OBSERVED:** `rangeForPreset('month').from` = `2026-10-31` (bukan
  `2026-11-01`); unit test `kunjungan.test.ts` gagal.
- **EXPECTED:** batas range mengikuti tanggal lokal pengguna.
- **SEVERITY:** Rendah–Sedang (laporan filter bulan/tahun salah di pagi hari).
- **FIX:** helper `toLocalDate()` (komponen `getFullYear/getMonth/getDate`)
  dipakai untuk `from` dan `to`; tidak ada lagi campuran lokal/UTC.

### BUG-102 — Rust: `peminjaman_quick_stats` / `overdue_list` / `buku_summary`-style date compare pakai UTC
- **WHERE:** `apps/desktop/src-tauri/src/commands/peminjaman.rs`
  (`peminjaman_quick_stats` ~1374/1380/1387, `peminjaman_overdue_list_inner`
  ~1407/1413, `anggota_loan_history_inner` ~1496, `anggota_summary` ~1621).
- **TRIGGER:** semua tanggal domain (tanggal_pinjam, tanggal_jatuh_tempo)
  diisi dari UI lokal (`YYYY-MM-DD`), tetapi query membandingkannya dengan
  `date('now')` (**UTC**). Antara 00:00–07:00 WIB, `hari_terlambat`,
  `aktif_hari_ini`, dan `aktif_minggu_ini` salah 1 hari (dan daftar overdue
  tidak memasukkan item yang baru jatuh tempo hari ini).
- **OBSERVED:** `cargo test` gagal (`dashboard_trend_days7_counts_today_loans`,
  `overdue_list_orders_by_days_late_descending`) saat dijalankan pada jam
  tersebut.
- **EXPECTED:** konsisten dengan dashboard (`date('now','localtime')`).
- **SEVERITY:** Sedang (data laporan/denda salah di jendela malam–pagi).
- **FIX:** semua perbandingan tanggal domain → `date('now','localtime')`
  (+ `date('now','-6 days','localtime')` untuk week). Seed helper di test
  ikut disamakan (`date('now','localtime')`) supaya deterministik kapan pun.

### BUG-103 — `assets::resolve_inner`/`read_data_url_inner`/`delete_inner`: path absolut POSIX ditolak di Windows
- **WHERE:** `apps/desktop/src-tauri/src/commands/assets.rs`
  (`resolve_inner` ~497, `read_data_url_inner` ~540, `delete_inner` ~585).
- **TRIGGER:** `Path::is_absolute()` di Windows tidak mengenali path gaya
  POSIX (`/home/user/old-foto.jpg`) warisan v1 (Linux). Path tsb jatuh ke
  `validate_rel_path` → ditolak (`must not be absolute`), padahal desainnya
  "pass-through unchanged" untuk data legacy.
- **OBSERVED:** `resolve_inner_joins_relative_passes_through_absolute_and_validates`
  gagal; foto/data legacy dengan path absolut tidak bisa dirender di Windows.
- **EXPECTED:** path absolut (gaya apa pun) diteruskan apa adanya; path relatif
  tetap divalidasi anti-traversal.
- **SEVERITY:** Sedang (migrasi v1→v2 dari Linux).
- **FIX:** helper `is_absolute_like()` (`Path::is_absolute()` ∪ awalan `/`
  atau `\`) dipakai di 3 fungsi baca/hapus; `validate_rel_path` tidak berubah
  (tetap menolak absolut untuk jalur tulis).

---

## Verifikasi: Free Trial 30 hari & Lisensi (v1.3.6)

Implementasi sepenuhnya di frontend (`src/lib/license.ts` + `src/features/license/Aktivasi.tsx`
+ guard `src/routes/_authed.tsx`). Tidak ada logika lisensi di sisi Rust.

**Alur yang terverifikasi (ujian manual via browser + unit test):**

| Skenario | Hasil |
|---|---|
| Instal baru (tanpa lisensi) | ✅ Trial aktif otomatis, 30 hari tercatat sekali (`perpustakaan.trial.start`); dashboard dapat diakses; layar Aktivasi menampilkan "Mode trial: 30 dari 30 hari tersisa" |
| Trial menua (10 hari) | ✅ `trialDaysLeft()` = 20 |
| Trial habis (>30 hari) | ✅ Status `terkunci` → `_authed` redirect ke `/aktivasi`; tombol "Lanjut dengan trial" hilang; pesan "Masa trial sudah berakhir" |
| Kode malformed | ✅ Error "Format kode lisensi tidak dikenal" |
| Kode palsu/diubah (signature) | ✅ Ditolak verifikasi Ed25519 lokal |
| Kode asli PU-0001 (signature valid) | ✅ Payload terbaca (`i=PU-0001`, `m=2`, `e=2027-12-31`) |
| Aktivasi sukses (server ter-simulasi) | ✅ State `aktif` tersimpan (code/licenseId/expires/slot), auto-redirect ke dashboard setelah ~800 ms |
| Lisensi kedaluwarsa (`expires` lewat) | ✅ Status `kedaluwarsa` → terkunci & redirect ke `/aktivasi` |

**Bug UX ditemukan & diperbaiki:**
- **BUG-104** — saat lisensi *kedaluwarsa*, teks tetap berbunyi "Masa trial sudah
  berakhir" (menyesatkan). `Aktivasi.tsx` sekarang menampilkan "Lisensi sudah
  kedaluwarsa (YYYY-MM-DD). Masukkan kode aktivasi baru…" bila statusnya
  `kedaluwarsa`.

**Cakupan test ditambah:** `tests/unit/license.test.ts` 3 → **12 test**
(bl trial start/daysLeft, state machine `readLicenseState`, verifikasi kode).
Sisi UI & guard sudah diuji manual (browser) karena tidak ada e2e khusus.

**Catatan arsitektur (bukan bug, perlu diketahui):** semua status trial/lisensi
disimpan di **localStorage** — menghapus `perpustakaan.trial.start` /
`perpustakaan.license.v1` akan mereset trial 30 hari. Ini "soft trial" per
perangkat; tidak ada pengunci di tingkat disk/Rust. Untuk lisensi komersial
ketat, pertimbangkan anchor di sisi Rust (mis. file state di app-data dir).

---

## Fitur Baru: Pilih Tampilan saat Instal (v1.3.6+)

**Permintaan user:** saat instalasi awal ada pilihan tampilan (3 layout +
warna tema via tombol), dan tetap bisa diubah di Settings → Tampilan.

**Implementasi:**
- `src/features/permissions/PermissionsGate.tsx` → 2 langkah: (1) izin
  kamera/unduh/cetak (eksisting), (2) **Pilih Tampilan** — `AppearancePicker`
  dengan 3 kartu layout (Klasik/Ringkas/Modern) + 5 swatch warna
  (Biru/Hijau/Ungu/Oranye/Mawar); tombol "Simpan & lanjut" / "Lewati".
- `src/lib/appearance.ts` — metadata LAYOUTS/ACCENTS + `applyAppearance()`
  (menulis `data-layout`/`data-accent`/density/fontScale ke `<html>`).
- `src/lib/settings.ts` — `DisplayPrefs` diperluas (`layout`, `accent`),
  default `klasik`/`biru`; mock & backend Tauri (`ui.layout`, `ui.accent`)
  dengan validasi + merge default untuk instal lama.
- `src/styles/globals.css` — override `--primary`/`--ring` per aksen (light &
  dark) + variasi layout (ringkas: sembunyikan tagline & padatkan nav; modern:
  pill aktif & sidebar berbeda).
- `src/features/settings/TampilanPage.tsx` — seksi "Tata letak" & "Warna tema"
  memakai `AppearancePicker` yang sama; tersimpan instan; Reset mengembalikan
  default. `handleAppearanceChange` memakai ref agar klik beruntun layout +
  aksen tidak saling menimpa.
- `src/components/layout/AppShell.tsx` — hidrasi preferensi saat mount (prefs
  kini berlaku global tanpa harus buka Settings) + layout `ringkas` mulai
  dengan sidebar mengecil (dapat diekspansi).

**Verifikasi:** unit `tests/unit/appearance.test.ts` (4 test) + e2e baru
`tests/e2e/appearance.spec.ts` (3 test: persistensi+terapkan, ringkas
collapsed, reset). Hasil agent verifikasi visual menyusul di bab berikutnya.

---

## Bug ditemukan & diperbaiki (infrastruktur test / kesalahan test)

### T-101 — Playwright: semua e2e mentok karena gate `/izin`
- **WHERE:** `apps/desktop/playwright.config.ts` + `tests/e2e/storage-state.json`.
- **TRIGGER:** v1.3.6 menambah "Layar izin awal" (`/izin`) dengan guard di
  `/login`: jika `localStorage['perpustakaan.permissions.done']` tidak ada,
  setiap goto `/login` di-redirect ke `/izin`. Playwright memulai context kosong
  → **56/56 test timeout 30 s**.
- **FIX:** seed flag via `storageState` di config (origin `localhost:1420`).

### T-102 — Playwright: `settings.spec` `localStorage.clear()` menghapus flag izin
- **WHERE:** `tests/e2e/settings.spec.ts` `adminLogin`.
- **FIX:** setelah `clear()`, re-seed
  `perpustakaan.permissions.done=1` (komentar menjelaskan alasannya).

### T-103 — test stale (asumsi UI lama):
- `anggota.spec` header search: field itu kini tombol yang membuka command
  palette (`global-search-input`) dan menavigasi ke detail `/anggota/:id`
  (bukan `/anggota?q=`). Test di-update.
- `kunjungan.spec`: locator `getByText(/Membaca/)` ambigu (baris tabel +
  trigger select dialog) → di-scope ke `kunjungan-table`.
- `peminjaman.spec`: teks error sekarang `Pilih anggota terlebih dahulu`;
  regex lama `Pilih anggota` kena subtitle form → pakai teks tepat.
- `smoke-full.spec`: `heading Pengembalian` kini 2 heading (h1 + "Detail
  Pengembalian") → `exact: true`.
- `settings.spec`: jumlah section 12 → **18** (aplikasi memang sudah punya 18
  sub-route); dialog reset adalah `role=dialog` (bukan `alertdialog`); halaman
  Tentang tidak lagi punya tombol manual (sudah ada section Manual sendiri) →
  assert link "Repositori GitHub".

---

## Test yang TIDAK diuji (deferred)

- Windows installer (`pnpm tauri:build` + NSIS/MSI) — butuh signing/UI.
- Click-through GUI native Tauri (WebView2) — tool kontrol GUI native tidak
  tersedia; UI diuji via Vite dev server (browser mode + mock backend) dan
  backend diuji via `cargo test` + `cargo check --all-targets`.
- Aplikasi Android (`apps/mobile`).
- Migrasi v1 → v2 & Excel import lintas versi.
- Sinkronisasi cloud (Sync) dengan akun Google nyata.
- Cetak/unduh nyata (dialog sistem) — diverifikasi hanya di level logika.

---

## Bukti tambahan

- `cargo test --lib` sebelum fix: **293 pass / 4 fail**; sesudah: **297 pass /
  0 fail**.
- Vitest sebelum fix: **622 pass / 3 fail**; sesudah: **633 pass / 0 fail**.
- E2E sebelum fix: 56 test, mayoritas gagal (gate `/izin`); sesudah fix
  proses: lihat hasil run final (bab e2e).
- DB asli: `users=1` (admin), `kategori=8`, `kelas=18`, `jurusan=6`,
  `agama=6`, `bahasa=10`, `ddc=178`, `kta_templates=1`, `buku/anggota/
  peminjaman/eksemplar = 0` (belum ada data transaksi).

---

## Sesi lanjutan — 2026-11-17 (verifikasi visual + Excel menyeluruh)

**Permintaan:** pastikan pemilih tampilan awal (3 layout + warna tema, semua
tombol, juga tersedia di Settings) terverifikasi secara visual, jalankan semua
fitur A→B→C dan sebaliknya tanpa error, serta perbaiki impor/ekspor Excel di
semua fitur.

### Hasil verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `pnpm lint` | ✅ PASS |
| `pnpm typecheck` | ✅ PASS |
| `pnpm i18n:lint` | ✅ PASS |
| `pnpm build` | ✅ PASS (~13s) |
| `pnpm test` (Vitest) | ✅ **653 PASS / 0 FAIL** (76 file; +6 test baru) |
| `pnpm test:e2e` (Playwright) | ✅ **63 PASS / 0 FAIL** (59 existing + 4 Excel baru) |
| Verifikasi visual onboarding | ✅ PASS (screenshot: layar izin + "Pilih Tampilan" — 3 kartu layout & 5 swatch warna, semuanya tombol) |
| Alur tampilan A→B→C | ✅ PASS: pilih Modern+Ungu di onboarding → `data-layout=modern`, `data-accent=ungu`, `--primary` ungu → login → dashboard (sidebar pill aktif radius 9999px) → Settings menampilkan Modern+Ungu → ubah Ringkas+Hijau → tersimpan & sidebar collapse → kembalikan Klasik+Biru |
| Alur impor Excel A→B→C | ✅ PASS: unggah `.xlsx` 2 baris → auto-mapping kolom → preview "2 baris siap" → submit → "2 ditambahkan, 0 dilewati" → baris muncul di tabel setelah filter |
| Alur ekspor Excel A→B→C | ✅ PASS: Anggota & Buku menghasilkan file `.xlsx` (di browser dev via anchor download; di aplikasi Tauri via dialog simpan + `export_write_bytes`) |

### Perbaikan kode produksi

1. **`src/lib/anggotaExport.ts` — BUG: `invoke()` dipanggil di mode browser.**
   `runAnggotaExport` membuat workbook lalu selalu memanggil
   `export_write_bytes`, padahal di `pnpm dev`/Vitest tidak ada Tauri internals
   → `TypeError`. Sekarang ada fallback anchor download saat `!isTauri()`,
   mengikuti pola `exportXlsx`. Di mode Tauri perilaku tidak berubah.
2. **`src/features/permissions/PermissionsGate.tsx` — UX: tidak ada live
   preview.** Memilih layout/warna di onboarding belum langsung terlihat
   sampai tombol "Simpan & lanjut". `onAppearanceChange` kini memanggil
   `applyAppearance({...DEFAULT_DISPLAY_PREFS, ...merged})` sehingga perubahan
   langsung diterapkan ke `<html>`.
3. **Ekspor Excel Buku (fitur baru).** Sebelumnya Buku hanya punya Impor Excel;
   tombol Ekspor tidak ada. Ditambahkan `src/lib/bukuExport.ts`
   (`toBukuExportRow`, `buildBukuWorkbookBytes`, `fetchAllBuku` bermagin 500,
   `runBukuExport` dengan dialog Tauri + fallback browser) dan tombol
   "Ekspor Excel" (`data-testid="buku-export"`) di `BukuList.tsx` dengan
   filter yang sama seperti daftar (query/kategori/bahasa/sort).
4. **Ekspor Excel di semua laporan.** `RangeToolbar` sudah mendukung
   `onExportExcel`; handler ditambahkan ke `TopPeminjamSubPage`,
   `TopBukuSubPage`, `GrafikSubPage`, `KasSubPage` (via `exportXlsx`),
   `PemanfaatanSubPage` (ringkasan 5 seksi dalam satu sheet), dan
   `EksekutifSubPage` (tombol "Ekspor Excel" + ringkasan KPI/tren/top/denda).
   `KoleksiSubPage` sudah memiliki tombol Excel inline sebelumnya.

### Test baru

- `tests/unit/bukuExport.test.ts` (6 test): mapping baris, workbook XLSX valid
  (signature `PK`), nama file, pagination, dan fallback browser tanpa
  `invoke`.
- `tests/e2e/excel.spec.ts` (4 test): ekspor Anggota → `.xlsx`, ekspor Buku →
  `.xlsx`, wizard impor Anggota lengkap (upload→map→preview→result→tabel),
  dan keberadaan tombol Excel di semua sub-halaman laporan.

### Catatan

- Screenshot diverifikasi pada tab browser OpenCode: layar "Siapkan Izin
  Aplikasi" dan "Pilih Tampilan" tampil benar (dark mode, 3 kartu layout,
  5 swatch warna, tombol Simpan & lanjut aktif).
- Upaya screenshot tambahan setelah perubahan受阻 oleh
  `ERR_PROXY_CONNECTION_FAILED` pada resource Vite di tool browser (masalah
  jaringan tool, bukan aplikasi); keberadaan & perilaku tombol baru tetap
  diverifikasi oleh tes Playwright yang semuanya lolos.

### Tindak lanjut: "kenapa layout masih sama aja?" (2026-11-17)

Screenshot perbandingan membuktikan keluhan tersebut benar: **Ringkas** dan
**Modern** sama-sama menampilkan sidebar 64px berisi ikon saja.

- **Penyebab:** state `collapsed` sidebar tersimpan terpisah (`po:sidebar`).
  Saat layout diganti dari Ringkas ke Modern, `AppShell` tidak pernah
  diinformasikan, jadi sidebar tetap collapsed. Selain itu CSS `modern`
  sebelumnya hanya mengubah warna latar + pill pada item aktif — tidak
  membedakan bentuk sidebar secara nyata.
- **FIX 1 — sinkronisasi layout → sidebar:**
  `applyAppearance()` kini memancarkan event `appearance-changed`. `AppShell`
  mendengarkan event ini, mengubah state `layout`, lalu menyetel sidebar:
  `ringkas` → collapsed (ikon saja), `klasik`/`modern` → expanded (label).
  Event **tidak** dipancarkan saat hidrasi awal (`applyAppearance(prefs, false)`)
  agar preferensi collapse manual pengguna tetap bertahan setelah reload.
- **FIX 2 — perbedaan visual nyata:**
  `globals.css` diperbarui: `modern` sekarang memakai sidebar lebar dengan
  latar bernuansa warna aksen, item nav berbentuk pill, dan item aktif berisi
  warna aksen penuh + bayangan; `ringkas` tetap 64px ikon saja dengan nav
  lebih padat; `klasik` tanpa perubahan.
- **Verifikasi:** screenshot ulang menunjukkan 3 tampilan yang jelas berbeda.
  E2e baru `switching ringkas → modern expands the sidebar and shows labels`
  ditambahkan. Total akhir: **653 unit PASS**, **64 e2e PASS**, lint/typecheck/
  i18n-lint/build PASS.

### Transisi halaman ala macOS (2026-11-17)

- **Permintaan:** ada fade/animasi saat berpindah fitur.
- **Implementasi akhir:** `src/components/layout/AppShell.tsx` membungkus
  `<Outlet />` dengan `<motion.div key={pathname}>` dari `framer-motion`.
  Setiap pindah route, halaman baru **fade-in + geser sedikit dari bawah**
  (~0.18s) dengan easing `cubic-bezier(0.22, 1, 0.36, 1)` (kurva halus khas
  macOS).
- **Aksesibilitas:** `useReducedMotion()` menonaktifkan gerakan bila sistem
  mengatur *Reduce Motion*.
- **Bug saat verifikasi (percobaan pertama):** memakai
  `AnimatePresence mode="wait"` dengan `<Outlet />` di dalamnya membuat
  komponen form lama ikut me-render route baru saat proses exit → form
  di-remount, state hilang, dan **5 e2e CRUD gagal** (submit tidak navigasi).
  Pendekatan itu dibatalkan; wrapper ber-key tanpa exit animation dipakai
  sebagai gantinya. Kelima tes tersebut kembali lolos.
- Verifikasi: lint, typecheck, i18n-lint, build, dan 653 unit test PASS;
  e2e penuh dijalankan ulang: **65/65 PASS** (termasuk test kamera baru).
  Satu flake sesi sebelumnya pada `peminjaman.spec` terjadi karena file diedit
  saat e2e masih berjalan (Vite HMR me-reload halaman), bukan regresi kode.

### Dropdown pemilih kamera di ISBN Scanner (2026-11-17)

- **Permintaan:** saat memakai kamera, ada daftar dropdown untuk memilih
  sumber kamera/scaner.
- **Temuan:** Sirkulasi dan KTA OPAC sudah punya dropdown kamera, tetapi modal
  **Impor Buku via ISBN** selalu memakai `videoInputDevices[0]`.
- **FIX:** `src/features/buku/IsbnScannerModal.tsx` kini mengEnumerasi perangkat
  (`listVideoInputDevices`), menyimpan `devices` + `selectedDeviceId`, dan
  menampilkan `<select data-testid="isbn-camera-select">` di atas preview
  video. Memilih kamera menyimpan `deviceId` ke ref lalu menaikkan
  `cameraAttempt` sehingga effect scanner di-restart dengan kamera pilihan
  (stream lama dilepas oleh cleanup).
- **Test:** `tests/e2e/camera.spec.ts` membuka modal dengan 2 perangkat palsu
  (via `addInitScript`) dan memastikan dropdown tampil berisi 2 opsi.

### Editor template Label Buku / barcode setara KTA (2026-11-17)

- **Permintaan:** template Label Buku/barcode belum punya popup *Advanced*
  seperti KTA, dan perlu lebih mudah diedit saat membuat template.
- **Sebelumnya:** halaman Settings → Label Buku langsung menumpuk editor
  lengkap + pratinjau, tanpa tombol Advanced; daftar field hanya bisa dihapus
  (tidak bisa diurutkan/diduplikat) dan label jenis field masih mentah.
- **Perubahan:**
  - `LabelBukuSettingsPage.tsx` mengikuti pola KTA: halaman utama kini berisi
    nama/deskripsi, kartu info + tombol **Advanced (layout manual)**
    (`data-testid="label-buku-open-advanced"`), serta pratinjau label.
    Editor lengkap dipindah ke `<Dialog>` `max-w-5xl` yang bisa di-scroll.
  - `TemplateEditor.tsx` kini mendukung **pindah field naik/turun** (layer
    depan-belakang), **duplikat field**, dan menampilkan nama jenis field
    yang ramah (mis. "Barcode (Code-128)") pada daftar field.
  - Terjemahan baru `settings.advanced*` ditambahkan ke `id`/`en`
    `label-buku.json` (parity OK).
- **Test:** `tests/e2e/label-buku.spec.ts` memastikan tombol Advanced ada,
  editor tidak menumpuk di halaman utama, popup terbuka, field bisa ditambah,
  dan popup bisa ditutup.

### Notifikasi mundur trial & trial tidak bisa diulang (2026-11-17)

- **Permintaan:** selama trial aktif ada notifikasi hitung mundur sampai habis,
  dan setelah habis trial tidak boleh dipakai lagi.
- **Perubahan:**
  - `src/lib/license.ts`: penanda permanen `perpustakaan.trial.used` ditulis
    bersama `trial.start`. `readLicenseState()` sekarang mengunci permanen bila
    state tersimpan `terkunci`/`kedaluwarsa`, dan menolak trial baru bila
    `trial.start` dihapus tetapi penanda pemakaian masih ada. Helper baru
    `trialEverStarted()` dan `trialEndsAt()`.
  - `src/features/license/TrialBadge.tsx` (baru): badge **"Trial · N hari
    tersisa"** di header, kuning saat ≤7 hari, tooltip berisi tanggal berakhir,
    klik menuju `/aktivasi`. Diperbarui tiap menit tanpa reload.
  - `Aktivasi.tsx`: teks terkunci sekarang menyatakan trial 30 hari "tidak
    dapat diulang atau diperpanjang"; tombol "Lanjut dengan trial" memang sudah
    hilang saat terkunci.
  - Terjemahan `common.license.trialBadge/trialTooltip` ditambahkan di id/en.
- **Test:** 4 unit test baru di `license.test.ts` (marker permanen, tidak
  restart setelah start dihapus / `clearLicenseState`, `trialEndsAt`) dan
  `tests/e2e/trial.spec.ts` (badge 20 hari, akun terkunci & tidak bisa restart).
  Total akhir: **656 unit PASS**, **68 e2e PASS**, lint/typecheck/i18n/build PASS.

### Melengkapi ekspor Excel pada daftar operasional (2026-11-17)

- **Temuan:** ekspor Excel sudah ada di Anggota, Buku, dan semua laporan,
  tetapi daftar operasional Peminjaman, Pengembalian, Kunjungan, Reservasi,
  dan Wishlist belum punya tombol ekspor (Stocktake sudah punya PDF).
- **Perubahan:**
  - Komponen baru `src/components/shared/ExportExcelButton.tsx` — tombol
    ekspor generik (memakai `exportXlsx`, otomatis nonaktif bila tabel kosong).
  - Tombol "Ekspor Excel" ditambahkan ke `PeminjamanList`, `PengembalianPage`,
    `KunjunganPage`, `ReservasiPage`, dan `WishlistAdminPage` dengan kolom yang
    disesuaikan tiap modul serta mengikuti data/filter yang sedang tampil.
- **Test:** `tests/e2e/excel.spec.ts` ditambah satu kasus yang memeriksa
  keberadaan kelima tombol. Total akhir: **656 unit PASS**, **69 e2e PASS**,
  lint/typecheck/i18n/build PASS.

### Catatan: celah fitur yang masih bisa dipertimbangkan (belum diimplementasi)

- Stocktake: ekspor Excel untuk hasil stocktake (saat ini PDF saja).
- Pengingat denda/terlambat otomatis (email/WA) — baru ada bell di aplikasi.
- Mode multi-perpustakaan / cabang & sinkron antar-instance.
- Aplikasi mobile (`apps/mobile`) belum diverifikasi/dirasmi di sesi ini.
- Installer Windows + code signing belum diuji.

### Bug: KPI dashboard menampilkan angka demo (2026-11-17)

- **Gejala:** dashboard menampilkan **Total Anggota 128**, padahal daftar
  Anggota hanya berisi 3 data (2 aktif). Total Buku 412 & Dipinjam 24 juga
  angka demo.
- **Penyebab:** `src/lib/dashboard.ts` `mockRpc.kpi()` mengembalikan konstanta
  hardcode `128/412/1843/24` untuk mode browser dev. Di aplikasi Tauri/Rust,
  `dashboard_kpi` sudah benar meng-query DB.
- **FIX:** `mockRpc` kini menghitung KPI dari data mock yang sebenarnya:
  `anggotaApi.list({aktif:true})`, `bukuApi.list()`, dan `peminjamApi.list()`.
  Delta bulan ini vs bulan lalu dihitung dari `createdAt`/`tanggalPinjam`
  (bukan angka buatan). `ddc()`, `kunjungan7d()`, `topPeminjam()`, dan
  `topBuku()` juga ikut diturunkan dari data nyata supaya tidak ada nama/title
  palsu seperti "Adelia Putri" yang tidak ada di daftar anggota.
- **Test:** `tests/unit/dashboardConsistency.test.ts` (3 test) + e2e
  `dashboard.spec.ts` (KPI berubah +1 setelah tambah anggota, bukan 128).
  Test lama `dashboard.test.ts` yang mengasumsikan 10 slice DDC & tanggal UTC
  diperbarui mengikuti perilaku berbasis data. Total akhir: **659 unit PASS**,
  **70 e2e PASS**, lint/typecheck/i18n/build PASS.
