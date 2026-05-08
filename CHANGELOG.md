# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release section is delimited by a heading of the form `## [VERSION] - DATE`.
The `release-v2` job in `.github/workflows/ci-v2.yml` runs
`scripts/extract-changelog.mjs <tag>` on tag push and uses the matching section
as the GitHub Release body. If a tag has no matching section, the workflow falls
back to GitHub's auto-generated release notes.

## [Unreleased]

## [1.2.0] - 2026-05-08

Rilis besar: **Aplikasi Android untuk siswa** + integrasi QR code untuk
menghubungkan HP ke perpustakaan tanpa konfigurasi manual.

### Added

- **Aplikasi Android "Perpustakaan Nusantara"** (`apps/mobile/`)
  - Katalog buku: cari, filter kategori, lihat detail + ketersediaan eksemplar
  - Scan KTA: kamera HP scan barcode/QR pada kartu anggota → identifikasi otomatis
  - Profil anggota: pinjaman aktif, sisa hari jatuh tempo, denda belum bayar, riwayat
  - Reservasi buku: pesan buku yang sedang dipinjam orang lain (write ke Google Sheets)
  - Wishlist: request pengadaan buku baru ke admin (write ke Google Sheets)
  - Kunjungan otomatis: auto-log kunjungan saat scan KTA
  - Notifikasi lokal: pengingat H-2 dan H-1 jatuh tempo peminjaman (WorkManager)
  - Setup zero-config: scan QR dari dinding perpustakaan → langsung terhubung
  - Offline cache: Room database menyimpan data terakhir, app tetap bisa browse offline
  - Material 3 theming dengan dynamic color support
  - Tech stack: Kotlin, Jetpack Compose, Hilt DI, CameraX + ML Kit, Room, DataStore

- **Desktop: Hubungkan HP Siswa** (Pengaturan → Sinkronisasi)
  - Generate QR code berisi konfigurasi perpustakaan (spreadsheet ID + Service Account)
  - Simpan QR ke folder exports/ sebagai PNG
  - Buka folder exports/ di File Explorer
  - Cetak poster QR (layout A4 rapi dengan instruksi 3 langkah untuk siswa)
  - Tauri command: `sync_generate_mobile_qr`, `sync_export_mobile_qr`

- **CI/CD: GitHub Actions workflow untuk Android** (`.github/workflows/android-build.yml`)
  - Auto-build debug APK pada push ke main
  - Auto-build + sign release APK pada tag push (`v*`)
  - APK otomatis di-attach ke GitHub Release bersama installer Windows

### Infrastructure

- Android project scaffold di `apps/mobile/` (Gradle 8.11, AGP 8.7, Kotlin 2.1, Compose BOM 2024.12)
- Monorepo tetap kompatibel: `apps/mobile` berdiri sendiri, tidak mengganggu `apps/desktop`

## [1.1.0] - 2026-05-06

Rilis fitur besar: 14 item baru — quality-of-life sirkulasi, OPAC interaktif
penuh, dashboard sehat, dan **Mode Demo (Sandbox)** untuk pelatihan tanpa
risiko ke data produksi. Semua perubahan offline-first, no network calls.

### Added

- **Inline Bayar Denda di PeminjamanDetail (#146)** — preset row 1×/2×/3×
  `dendaPerHari` + tiga preset tetap (Rp 5.000 / 10.000 / 15.000) langsung di
  atas input bayar, sama persis dengan `PengembalianPage`. Logika dedup
  diekstrak ke helper `dendaPresets.ts` agar tidak ada copy-paste.
- **Dashboard KPI cards clickable (#147)** — Total Anggota / Total Buku /
  Buku Dipinjam navigasi langsung ke `/anggota`, `/buku`,
  `/peminjaman?status=aktif`. Insight "Buku Terlaris bulan ini" + "Peminjam
  Teraktif" navigasi ke halaman detail entitas. Card statis (rata-rata)
  tetap non-clickable.
- **Quote rotasi 2 menit + manual next (#148)** — `QUOTE_ROTATE_MS` turun
  dari 5 menit → 2 menit, ditambah tombol `ChevronRight` untuk advance manual
  tanpa menunggu timer. Animasi slide-up tetap.
- **+30 quotes perpustakaan (#149)** — `quotes.json` ditambah 30 entri
  spesifik tentang buku / literasi / perpustakaan dari penulis Indonesia
  (Pram, Kartini, Hamka, Habibie) dan internasional (Borges, Sagan,
  Calvino).
- **Sirkulasi: search dropdown anggota + buku (#150)** — komponen
  `ScanSearchInput` (combobox) menggantikan input scan polos di
  `SirkulasiPage`. Ketik 3+ karakter (alpha) → dropdown muncul dengan
  section Anggota + section Buku (buku hanya muncul mode pinjam +
  anggota terpilih). USB hand-scanner burst tetap diteruskan langsung
  ke handler scan tanpa membuka dropdown.
- **OPAC post-scan profile (#151)** — setelah scan KTA muncul panel
  full-screen `OpacMemberProfile` berisi avatar + identitas, peminjaman
  aktif (badge `aktif`/`terlambat`), denda outstanding, riwayat 10
  pinjaman terakhir, dan section reservasi. Setiap scan otomatis
  menulis row `kunjungan` (deduplikasi 5 menit).
- **OPAC scan-locked dialog (#152)** — saat `member` masih ter-set,
  klik "Scan KTA Saya" mendapat dialog konfirmasi (`Anggota lain masih
  login: <nama>` + tombol `Logout & Scan` / `Batal`) sebelum membuka
  scan flow.
- **Command palette (Ctrl/Cmd+K) lengkap (#153)** — `GlobalSearchDialog`
  diperluas dari pure data-search jadi command palette penuh: 8+ aksi
  cepat (Backup Sekarang, Cetak Laporan Bulanan, Tambah Anggota,
  Tambah Buku, Toggle Tema, Toggle Mode Demo, Buka OPAC, Logout) +
  6+ rute (Dashboard, Anggota, Buku, Peminjaman, Pengembalian,
  Pengaturan, dst). Empty query tetap menampilkan `Aksi Cepat` +
  `Halaman` tanpa membutuhkan ketikan.
- **Skeleton screens (#154)** — komponen `TableSkeleton` (untuk
  AnggotaListPage, BukuListPage, PeminjamanListPage,
  PengembalianPage results panel) + `CardSkeleton` (untuk OPAC home
  & search grid) menggantikan spinner. Hormati
  `prefers-reduced-motion`, `aria-busy="true"` untuk screen reader.
- **Laporan Eksekutif PDF (#155)** — tombol "Cetak Laporan Eksekutif"
  di halaman Laporan menghasilkan PDF 3-halaman: cover + KPI summary,
  charts (peminjaman per minggu, top 5 buku, top 5 anggota), action
  items otomatis (denda > 50k, reservasi tertumpuk). Date-range picker
  default = bulan berjalan. Operasi sepenuhnya offline (font + chart
  bundled).
- **Dashboard System Health card (#156)** — card baru di bawah KPI grid
  menampilkan ukuran DB (KB/MB), backup terakhir (relatif),
  backup berikutnya, jumlah reservasi tertunda (badge hijau saat 0,
  oranye saat > 0), versi aplikasi + pill "Update tersedia". Click
  baris navigasi: backup → Settings → Backup, reservasi → /reservasi.
- **Mode Demo / Sandbox (#157)** — toggle di Pengaturan → Mode Demo
  yang menukar app ke `perpustakaan-v2-demo.db` (auto-copy dari prod
  pada enable). Banner kuning persisten saat aktif. Semua tulis di
  mode demo terisolasi dari prod DB. Saat dinonaktifkan, demo DB
  diarsipkan ke `demo-archive/<ts>.db`. Backup scheduler skip otomatis
  saat sandbox aktif. Berguna untuk pelatihan petugas baru / demo
  sekolah lain tanpa risiko menyentuh data asli.
- **OPAC Buku Pilihan (carousel curated) (#158)** — admin pin sampai 5
  buku featured dari halaman baru `/buku/buku-pilihan` (akses via
  tombol "Atur Pilihan OPAC" di Buku list). OPAC home menampilkan
  carousel auto-rotate 5s di atas grid katalog, pause-on-hover,
  arrow + dot navigation, keyboard accessible (←/→ + Enter), respect
  `prefers-reduced-motion`. Carousel tidak tampil sama sekali saat 0
  pin aktif (tidak ada placeholder kosong). Cap 5 pin di-enforce di
  client + server.

### Fixed

- **Detail Pengembalian: 6 tombol denda dengan nilai duplikat (#145)** —
  saat `dendaPerHari = 5000`, preset multiplier (`5_000 / 10_000 / 15_000`)
  dan preset tetap (`5_000 / 10_000 / 15_000`) bertumpuk → 6 tombol dengan
  3 nilai duplikat. Sekarang dedup via `useMemo` set; saat collide hanya
  3 tombol unique yang render. Dengan `dendaPerHari = 2000`, ke-6 tombol
  unik (`2.000 / 4.000 / 6.000 / 5.000 / 10.000 / 15.000`).

### Schema changes

- Table baru `buku_pilihan` (FK ke `buku.id` ON DELETE CASCADE) untuk
  E1-OPACBukuPilihan. Migration additif, idempotent.
- Flag file `<app_data>/sandbox.flag` untuk persistensi state Mode
  Demo lintas restart. Tidak menyentuh schema produksi.

### Dependencies

- Tidak ada upgrade dependency mayor di v1.1.0 — semua fitur
  diimplementasi pakai dependency yang sudah ada (lucide-react,
  pdf-lib, recharts, dst).

## [1.0.12] - 2026-05-06

### Fixed

- **Barcode buku Code-128 tidak terbaca walau sudah jelas (#142 follow-up)** —
  setelah investigasi mendalam ditemukan **bug fundamental** di
  `imageDataToBitmap`: buffer RGBA (4 byte per pixel) di-pass langsung
  ke `RGBLuminanceSource` yang menafsirkannya sebagai 1 byte per pixel
  luminance. Akibatnya zxing membaca bitmap yang scrambled / shifted
  per baris dan miss hampir semua barcode Code-128 + sebagian besar
  QR non-trivial. v1.0.12 menambahkan tahap konversi RGBA → grayscale
  Rec.601 (sama seperti `HTMLCanvasElementLuminanceSource` di
  `@zxing/browser`) sebelum membangun `BinaryBitmap`. Ini menjelaskan
  kenapa scanner sering gagal di v1.0.10 / v1.0.11 walaupun barcode
  terlihat jelas — bug-nya bukan di kamera, tapi di decoder pipeline.
  Catatan: live continuous decode di production sebagian masih jalan
  karena `BrowserMultiFormatReader.decodeFromCanvas` punya path
  konversi sendiri; manual "Scan Sekarang" + ROI crop yang paling
  parah terdampak.

### Added

- **Preprocess variant `blur` (3×3 box blur)** — meredam moiré
  pattern (raster layar HP × raster webcam) yang bikin Code-128
  barcode buku miss di phone screen. Box blur radius 1 cukup
  smooth raster jadi mid-grey datar tanpa menghancurkan bar
  pattern. Variant ini di-include di **MANUAL_RETRY_VARIANTS dan
  CONTINUOUS_VARIANTS** supaya catch otomatis di live decode tanpa
  perlu klik tombol manual.
- **Preprocess variant `unsharp` (unsharp mask)** — `out = src +
  amount × (src − blurred)`, default amount 1.0. Recover edge
  contrast pada frame yang sedikit out-of-focus (autofocus webcam
  meleset). Digunakan setelah `blur` di retry chain.
- **Preprocess variant `upsample` (2× nearest-neighbor)** — rescue
  barcode kecil / jauh dari kamera (~3-4 px per modul). Nearest
  neighbor dipilih daripada bilinear karena harus mempertahankan
  edge tajam yang dibutuhkan zxing.
- **Rotation retry pipeline (`decodeAnyWithRotations`)** — manual
  "Scan Sekarang" sekarang otomatis retry 0° → 180° → 90° → 270°
  jika full variant chain gagal. Menangani buku yang dipegang
  miring / terbalik tanpa user perlu memutar buku. Continuous decode
  tidak ikut rotasi (akan desync overlay tracking).
- **USB hand-scanner auto-detection (`useHandScannerDetector`)** —
  hook React yang spy global `keydown` events. Burst keystrokes
  dengan inter-key delay ≤ 35 ms diakhiri Enter dikenali sebagai
  output USB barcode/QR scanner (Symbol DS2208, Honeywell, generic
  ESky, dll). Saat terdeteksi:
  - Badge **"Hand-scanner USB terdeteksi"** muncul di header
    halaman Sirkulasi / Stocktake / OPAC sebagai konfirmasi visual.
  - Jika fokus saat ini bukan di text input (mis. user klik ke
    video preview), payload otomatis di-route ke handler scan
    halaman terkait — keystrokes tidak hilang ke `body`.
  - Badge auto-clear 30 detik setelah burst terakhir.
- **Test coverage Code-128 buku** — file baru
  `scannerCode128Scenarios.test.ts` (16 skenario end-to-end) yang
  render real Code-128 via `bwip-js` lalu decode kembali untuk
  memvalidasi:
  - Baseline cetakan jelas (zxing first-pass).
  - Phone-screen + moiré pattern (rescued by `blur`).
  - Phone-screen + dim (moiré + 40% brightness).
  - Sideways 90° / upside-down 180° / sideways 270° (rotation retry).
  - Out-of-focus (rescued by `unsharp`).
  - Low-contrast 90/200 inks.
  - Underexposed 35% (rescued by `brighten`).
  - Overexposed glare (rescued by `darken`).
  - Pitch-black frame robustness (no throw, no false positive).

## [1.0.11] - 2026-05-06

### Added

- **Live tracking overlay untuk scanner Sirkulasi / OPAC / Stocktake** —
  begitu decoder mendeteksi barcode atau QR di frame, sebuah polygon
  hijau langsung "menempel" di posisi simbol di preview kamera (mirip
  scanner QR di kamera HP). Polygon flash kuning singkat ketika
  decode sukses, dan fade-out otomatis ~600 ms setelah deteksi
  hilang. Memberi feedback visual yang jelas ke operator bahwa
  scanner benar-benar melihat kode — bukan hanya "diam saja".
- **jsQR sebagai decoder paralel khusus QR** — library spesialis QR
  (~30 KB) yang jauh lebih tahan moiré pattern (raster layar HP ×
  raster webcam), QR low-res, dan QR di tepi viewport daripada
  binarizer ZXing. Dipanggil sebagai fallback setelah ZXing gagal,
  jadi tidak menambah latensi pada kasus-kasus mudah. Mode
  `attemptBoth` menangani QR dark-mode (kotak putih di latar hitam)
  tanpa preprocess tambahan.
- **Preprocess variant baru**: `inverted`, `brighten` (gamma 0.5),
  `darken` (gamma 1.6), dan `adaptiveThreshold` (block-mean lokal).
  Tombol "Scan Sekarang" sekarang siklus lengkap 7 varian per klik
  daripada 3, sehingga jauh lebih banyak kasus pencahayaan tertangkap
  (gelap, terlalu terang, kontras rendah, lampu kelas yang tidak
  rata).
- **`analyzeImageStats(image)` helper** — rangkuman luminansi (mean,
  min, max). Dipakai `useBarcodeScanner` untuk skip frame
  pitch-black (mean < 8) sebelum membayar biaya zxing/jsQR, dan
  membuka jalan untuk pemilihan varian adaptif berbasis statistik.

### Fixed

- **QR di layar HP tidak terbaca walaupun sudah jelas (#141 follow-up)** —
  kombinasi 3 hal: ROI 70% × 30% terlalu sempit untuk QR persegi,
  ZXing tidak mencoba bitmap yang dibalik (dark-mode QR), dan tidak
  ada decoder QR-specialist. v1.0.11 memperbesar ROI ke 70% × 55%,
  menambahkan varian `inverted` di pipeline, dan jsQR fallback —
  catch-rate naik signifikan untuk QR di layar HP / phone screen.
- **"Scan Sekarang" miss kalau barcode di tepi ROI** — kalau decode
  ROI gagal, sekarang otomatis retry decode seluruh frame sebagai
  fallback (koordinat lokasi di-clamp ke kotak ROI supaya overlay
  tetap menampilkan lokasi yang benar).
- **Continuous decode sering miss QR dark-mode** — loop kontinyu
  sekarang siklus 4 varian (`normal → contrast → inverted →
  grayscale`) bukan 3, dengan tick rate dinaikkan dari 100 ms ke 80 ms
  (12.5 fps). Total siklus ~320 ms — masih di bawah cooldown
  decode, tapi tiap varian dapat ronde baru lebih cepat.
- **Decoder crash di frame pitch-black** — luminance summary di
  awal tiap tick mengeluarkan frame dengan max < 8 sebelum sampai
  ke ZXing/jsQR. Mengurangi error log noise di console saat kamera
  baru terbuka / ditutup penutup lensa.

### Changed

- `MANUAL_RETRY_VARIANTS` diperluas dari 3 ke 7 varian. Tombol
  "Scan Sekarang" sekarang lebih lambat sedikit pada kasus terburuk
  (~7 × 50 ms = 350 ms) tapi catch-rate jauh lebih tinggi pada
  kondisi pencahayaan klasroom yang sulit.
- `DecodedResult` sekarang membawa `location` (polygon 2-4 titik
  di koordinat ROI) dan `source` (`zxing` atau `jsqr`). Dipakai
  oleh overlay tracking; data flow lain tidak bergantung padanya
  jadi backward-compatible.
- Hint `ALSO_INVERTED` ZXing tidak ditambahkan karena
  `@zxing/library` 0.21 tidak mengekspor enum tersebut. Fungsi yang
  sama dipenuhi oleh varian `inverted` di retry chain dan jsQR
  `attemptBoth`.

### Tests

- 36 unit test baru di `scannerPreprocess.test.ts` mencakup setiap
  varian baru + helper `analyzeImageStats` + adaptive threshold
  edge cases.
- 13 skenario end-to-end di `scannerScenarios.test.ts` — render QR
  sintetis dengan `qrcode` lalu uji decode pada kondisi:
  bright/baseline, gelap (25%/10% brightness), gelap total
  (pitch-black), kontras rendah, dark-mode (inverted), glare
  overexposed, dan low-res (3 px / module). Semua 478 test pass.

## [1.0.10] - 2026-05-06

### Fixed

- **Stocktake: tombol kamera barcode scan tersembunyi** — input scan
  Stocktake sebelumnya hanya menerima ketikan / hand-scanner USB
  meskipun placeholder bilang "Pindai barcode atau ketik kode…".
  Sekarang ada tombol **Buka Kamera** di sebelah label scan yang
  membuka webcam preview dengan ROI overlay (mirip halaman Sirkulasi).
  Decode kontinyu (cooldown 1.5 detik) langsung mendaftarkan eksemplar
  ke sesi opname yang berjalan. Hand-scanner USB / ketik manual tetap
  bisa dipakai paralel; placeholder copy juga diperjelas. (#141)
- **Webcam barcode scan susah baca Code-128 yang jelas** (BUG-22) —
  decoder kontinyu sebelumnya membaca seluruh frame (dengan latar +
  judul buku ikut diproses) tanpa preprocessing, sehingga sering
  miss meski barcode sudah pas di kotak ROI. Sekarang loop kontinyu
  meng-crop frame ke ROI lebih dulu (sama seperti tombol "Scan
  Sekarang"), dan rotasi varian preprocess `normal → contrast →
  grayscale` per tick (~10 fps). Kamera juga diminta `focusMode:
  continuous`, `whiteBalanceMode: continuous`, `exposureMode:
  continuous` lewat `applyConstraints` supaya tidak kunci fokus di
  frame kosong sebelum bukunya diangkat. Resolusi default naik dari
  720p → 1080p (fallback 720p). (#141)

### Changed

- Camera + scanner di Stocktake otomatis dilepas saat halaman sesi
  ditutup, supaya webcam tidak "di-pegang" untuk halaman lain. (#141)
- `useBarcodeScanner` continuous-decode loop sekarang pakai canvas +
  `decodeWithRetry` daripada `BrowserMultiFormatReader.decodeFromConstraints`.
  Manfaat: ROI crop, preprocessing, dan kontrol cooldown sama persis
  dengan path "Scan Sekarang" — satu code path untuk dua mode. (#141)

## [1.0.9] - 2026-05-06

Collected fixes + sheets sync expansion. Released as a single rolled-up
follow-up to 1.0.8 covering bug reports against the OPAC, KTA editor,
list-page layouts, and FEAT-26 sheets sync scope.

### Added

- **Sheets sync expansion (FEAT-26)** — `Pengaturan → Sinkronisasi Google
  Sheets` now covers `buku`, `eksemplar`, dan `peminjaman` di samping
  `anggota`. Pull menjalankan urutan topologis (anggota → buku →
  eksemplar → peminjaman) sehingga foreign-key target selalu ada
  sebelum baris turunan tiba. Mapper terpisah per tabel dengan
  last-write-wins on `updated_at`. (#140)
- **OPAC: katalog penuh + statistik per kartu** — landing page OPAC
  sekarang menampilkan seluruh koleksi (paginated, 24 per halaman, urut
  judul) di samping pencarian. Tiap kartu menambah badge stok
  `Tersedia/Total` dan fallback grafis untuk cover yang gagal dimuat.
  (#140)
- **Pengembalian: tombol denda preset cepat** — di bawah input "Bayar
  Denda" sekarang ada 3 tombol pilih cepat Rp 5.000 / Rp 10.000 /
  Rp 15.000 untuk skenario denda umum. (#140)
- **KTA: layer reorder per field** — daftar field di editor template
  KTA sekarang punya tombol panah atas/bawah untuk mengatur urutan
  rendering (z-order). Persisted di layout JSON sebagai array order.
  (#140)
- **KTA: import background JPG/PNG** — tombol "Upload Background" di
  editor template menerima file `.jpg`/`.png`/`.webp` ≤ 2 MB.
  Background di-render sebagai layer paling bawah; field foto/QR/teks
  tetap di atasnya. Sisi Depan dan Belakang punya background mandiri.
  Backend PDF (`jsPDF.addImage`) dan print HTML mendukung sumber yang
  sama. (#140)

### Fixed

- **buku_import: eksemplar tidak ter-seed otomatis** — saat impor CSV
  buku via `Pengaturan → Impor Massal`, baris eksemplar sebanyak
  `jumlah_eksemplar` sekarang otomatis dibuat. Migration backfill juga
  menambal eksemplar untuk buku lama yang sebelumnya tertinggal. (#140)
- **stocktake `u.full_name`** — query stocktake yang merujuk kolom
  `users.full_name` (nama kolom lama dari migrasi 1.0.7) di-perbaiki ke
  `users.nama_lengkap`. (#139)
- **OPAC: cover gambar rusak menampilkan ikon broken** — sekarang fallback
  ke placeholder buku + label "Tidak ada cover". (#140)
- **KTA preview vs cetak: radius "Dekorasi (Kotak)" tidak konsisten** —
  preview dulu menggambar `border-radius` dengan satuan CSS `mm`
  (absolut), sementara PDF menggambar mm fisik. Sekarang preview pakai
  `cqi` (% inline-size) sehingga proporsinya sama di semua skala. (#140)

### Changed

- **Layout list responsif penuh-lebar** — halaman Anggota, Buku, dan
  Wishlist tidak lagi dibatasi `max-w-7xl`/`max-w-6xl`; konten meluas
  mengisi viewport seperti Dashboard, baik di window 1024px maupun
  fullscreen 1920px+. (#140)
- **Sinkronisasi page: hilangkan notice "menyusul di rilis selanjutnya"**
  karena scope sudah lengkap untuk 4 tabel master. (#140)

## [1.0.8] - 2026-05-06

### Added

- **KTA: 10 desain template baru (total ~20)** — preset library sekarang
  kaver gaya formal, modern, vibrant, dan bertema sekolah. Editor live
  preview otomatis menyesuaikan field per template. (FEAT-16, #127)
- **Peminjaman: perpanjangan otomatis 1-klik** — tombol "Perpanjang" di
  detail peminjaman tambah jatuh tempo via aturan global, log audit
  per-perpanjangan, dan hormati batas maksimum yang dikonfigurasi di
  Aturan Peminjaman. (FEAT-17, #128)
- **Buku: reservasi/booking saat dipinjam** — anggota bisa antri waiting
  list buku yang sedang dipinjam. Saat eksemplar kembali, slot
  reservasi tertua dipromosikan otomatis dan operator dapat notifikasi
  di dashboard. (FEAT-18, #128)
- **Anggota: bulk import dari Excel/CSV** — wizard upload + auto-detect
  header + preview + validasi NIS unik. Mode "Perbarui anggota yang
  sudah ada" baru memungkinkan re-import overwrite tanpa menghapus
  field yang dibiarkan kosong di spreadsheet (COALESCE-protected
  UPDATE). Hasil panel sekarang punya 4 metrik: Ditambahkan,
  Diperbarui, Dilewati, Error. (FEAT-19, #129)
- **Buku: bulk import via ISBN** — paste daftar ISBN, aplikasi resolve
  metadata via Open Library lalu Google Books (~1 req/sec throttle),
  preview hasil per-baris dengan kode buku auto-suggest yang bisa
  dioverride sebelum disimpan ke katalog. (FEAT-20, #129)
- **Anggota: cetak Surat Bebas Pustaka (SBP)** — auto-generate PDF saat
  anggota eligible (tidak ada peminjaman aktif, tidak ada denda
  outstanding). Template editable di pengaturan. (FEAT-21, #130)
- **Wishlist anggota: request pengadaan buku** — anggota submit wishlist
  via OPAC; admin punya queue review dengan upvote count, transition
  state machine (pending → disetujui → acquired), dan link otomatis ke
  buku saat sudah masuk katalog. (FEAT-22, #130)
- **Stocktake/Opname mode** — sesi opname terisolasi: scan barcode
  eksemplar batch (camera atau hand-scanner), real-time tally
  found/missing, export laporan PDF + CSV, audit log per sesi.
  (FEAT-23, #131)
- **Backup: cloud target (rclone) + AES-256 encrypted + history audit** —
  schedule backup ke remote rclone (Google Drive, S3, dll) dengan
  enkripsi AES-256-GCM. History panel surface 50 backup terakhir +
  size + status, decrypt langsung dari UI dengan password. (FEAT-24,
  #132)
- **Dashboard: trend chart + heatmap + insights cards** — grafik
  peminjaman 30/90/365 hari, heatmap kalender aktivitas, dan kartu
  insight (top kategori, top anggota, buku populer minggu ini).
  (FEAT-25, #134)
- **Sinkronisasi: Google Sheets bidirectional sync MVP (anggota)** —
  hubungkan service-account JSON, pilih spreadsheet target, lalu push
  / pull anggota dua-arah dengan konflik resolution last-write-wins +
  audit log per-sinkronisasi. Foundation untuk sync entitas lain di
  rilis berikutnya. (FEAT-26, #133)
- **OPAC: public mode + kiosk lock** — toggle Pengaturan baru
  mengaktifkan halaman OPAC tanpa login (search-only) dan kunci kiosk
  full-screen yang reset idle setelah 60 detik. Admin bisa unlock dari
  shortcut keyboard + password. (FEAT-27, #136)
- **Sirkulasi: scanner overlay + ROI decode + multi-format + manual scan** —
  overlay frame guide di webcam, decode hanya region of interest
  (lebih cepat + akurat), dukungan EAN-13/Code128/QR sekaligus, dan
  fallback input manual saat kamera tidak tersedia. (FEAT-28, #135)

### Fixed

- **KTA PDF export: foto anggota gepeng (stretch ke aspect ratio slot)** —
  rendering smart-fit 2-layer baru: outer container = slot ratio, inner
  image = `object-fit: cover` dengan center crop sehingga foto KTA
  selalu tampil proporsional sambil tetap mengisi slot template.
  (BUG-19, #127)

## [1.0.7] - 2026-05-05

### Added

- **Sirkulasi: rename tombol jadi lebih jelas** — di header halaman
  Sirkulasi (Webcam), "Pinjam" sekarang jadi "Scan Anggota Pinjam" dan
  "Kembalikan" jadi "Scan Kembalikan Pinjaman" (id + en) supaya
  operator baru langsung paham urutan flow scan-anggota → scan-buku.
  (#120)
- **Sirkulasi (peminjaman): backend hormati eksemplar yang di-scan** —
  command `peminjaman_create` sekarang accept optional `eksemplar_ids`
  override (paired with `buku_ids`) sehingga eksemplar yang persis
  di-scan operator yang dibooking, bukan eksemplar lowest-id pilihan
  FIFO. Internal split: tauri wrapper tipis + `peminjaman_create_inner`
  yang di-cover 4 unit test baru (specific copy booked, FIFO fallback,
  wrong-buku rejection, length-mismatch rejection). (#120)
- **Aturan Peminjaman: backend skip hari libur saat hitung denda** —
  `billable_late_days()` baru baca `transaksi.hari_libur` (default
  `[0]` = Minggu) dan skip weekday-weekday tersebut dari perhitungan
  hari telat. Sebelumnya backend murni kalender, mengabaikan setting
  yang sudah disediakan UI Aturan Peminjaman. Enam unit test cover
  edge cases (early return, Sunday-only, no holidays, full weekend
  skip, CSV parsing). (#121)
- **Pengembalian: quick-input denda 1×/2×/3×** — di field "Bayar
  Denda", tiga tombol shortcut otomatis kalkulasi nominal dari aturan
  peminjaman (denda per hari × hari telat × multiplier). Operator
  tidak perlu hitung manual lagi. (#121)
- **KTA: biodata lengkap + nama & TTD kepala sekolah** — Template
  Editor sekarang punya 18 jenis field (dari 10): `tempatTanggalLahir`
  (gabungan + format Indonesia), `jenisKelamin` (auto-map L/P →
  Laki-laki/Perempuan), `alamat`, `noTelp`, `tahunMasuk` (derived dari
  `tanggal_daftar`), `berlakuSd` (override eksplisit), `namaKepsek`
  (dari `Settings → Identitas → Kepala Sekolah`, terpisah dari Kepala
  Perpustakaan), `ttdKepsek` (slot gambar untuk file TTD). Template
  lama tetap kompatibel — field baru optional. (#122)
- **KTA: editor halaman belakang per-template + Tata Tertib default** —
  setiap template KTA bisa punya layout `back` terpisah. Template baru
  pre-filled dengan Tata Tertib default. Saat cetak/PDF, halaman 2
  ditambah otomatis kalau template punya `back` layout. Template
  single-page lama tetap kompatibel. (#122)
- **Cetak Label & Barcode Buku: tombol "Buka Folder Hasil" + last-export
  ribbon** — parity dengan Cetak KTA. Backend command baru
  (`label_buku_export_pdf` + `label_buku_open_exports_folder`) menulis
  ke `<APPDATA>/exports/labels/` (terpisah dari folder exports KTA).
  Setelah generate PDF, ribbon emerald di header tampilkan filename +
  link "Buka Folder Hasil". 5 unit test cover validasi header `%PDF-`,
  oversize, empty, filename pattern. (#123)
- **Manual: floating action button scroll-to-top** — FAB di pojok
  kanan bawah halaman Manual yang muncul setelah scroll > 200px,
  klik = `scrollTo({ top: 0, behavior: 'smooth' })`. Tidak menghalangi
  konten saat hidden. (#123)
- **Dashboard: quote-of-the-day rotasi tiap 5 menit dengan animasi** —
  quote sekarang berganti otomatis tiap 5 menit dengan animasi
  fade-slide (300 ms leave: fade out + slide up; 300 ms enter: fade in
  + slide up dari +8 px ke 0). Quote awal tetap deterministik per-hari
  (anti-flicker saat user pindah halaman dan kembali — timer reset ke
  fresh 5 menit). Helper baru `pickNextQuoteIndex(currentIndex, rng?)`
  jamin tidak pernah quote yang sama 2× berturut-turut. Respect
  `prefers-reduced-motion`. (#124)

### Fixed

- **Sirkulasi (Webcam): scan QR KTA `member:1` → "Kode tidak dikenali"** —
  `handleScan` sekarang parse QR payload via `parseQrPayload` dulu dan
  lookup member by ID kalau payload-nya format `member:<id>` (yang
  dicetak di KTA). Sebelumnya `getByKode` dijalankan di raw QR text
  dan tidak pernah match `kode_anggota`. Legacy/manual codes tetap
  bisa lewat fallback. (#120)
- **Sirkulasi (Kembalikan): scan eksemplar barcode → "Tidak ada
  peminjaman aktif" walau ada loan aktif** — root cause:
  `peminjaman_create` silently pilih lowest-id eksemplar via FIFO
  instead of copy yang di-scan operator, jadi return scan cari
  `kode_eksemplar` yang tidak pernah tercatat on-loan. Sirkulasi page
  sekarang pass `eksemplarIds` yang persis di-scan ke backend (lihat
  Added: backend override). (#120)
- **Barcode/QR scanner susah baca walau barcode terlihat jelas** —
  switch zxing dari `decodeFromVideoDevice` ke `decodeFromConstraints`
  dengan resolusi `1280×720` ideal + `facingMode=environment`. Default
  fallback sebelumnya ~640×480, terlalu rendah untuk decode Code-128
  di label buku ukuran biasa pada jarak arm's-length. (#120)
- **Aturan Peminjaman "Maksimum buku" = 3 tapi sistem block di 2** —
  konstanta `DEFAULT_MAKS_PINJAM` di backend dulu `2` sementara
  frontend default `3`. Pada fresh install (user belum pernah klik
  Simpan), UI tampilkan 3 tapi backend tolak peminjaman ketiga.
  Konstanta di-align ke `3` + regression test yang assert kedua sisi
  konsisten. (#121)
- **Toast error peminjaman menampilkan raw JSON** — `AppError::Serialize`
  dulu pakai `self.to_string()` yang inject prefix `validation: ` /
  `not found: ` ke field `message`, sehingga user lihat
  `{"code":"validation","message":"validation: melebihi maksimal …"}`.
  Sekarang serialize output `String` mentah; `formatTauriError` di
  frontend mengenali shape `{ code, message }` dan strip prefix lama
  secara idempoten (backward-compatible dengan shape `{ Validation:
  "…" }`). 4 vitest case baru. (#121)
- **KTA: QR code gepeng (aspect ratio rusak) di semua template** —
  Preview pasang `aspect-ratio: 1/1` di `<img>` QR. Print pakai wrapper
  flex pusat + `object-fit:contain`. PDF pakai `Math.min(width,
  height)` sebagai sisi square sebelum `addImage`, di-center
  horizontal/vertikal di slot field. Hasilnya scannable di scanner
  Android/iOS. (#122)
- **KTA: foto anggota tampil sebagai broken-image** — komponen
  `FotoSlot` baru pakai state `errored` untuk fallback ke
  `PlaceholderBox label="FOTO"` saat `<img onError>` triggered.
  Print/PDF pakai helper `imgWithFallback()` yang tulis SVG inline
  `data:image/svg+xml;utf8,…` saat `src` null/empty atau
  `readDataUrl()` gagal. PDF fallback ke rect placeholder slate-200
  saat `addImage` melempar. TTD kepsek pakai pola yang sama. (#122)
- **Pengaturan: action bar (Default / Hapus / Simpan) mepet bawah
  window** — `SettingsLayout` outer container `p-6` → `px-6 pt-6
  pb-10`. Action bar di bottom card sekarang punya gap minimal ~40 px
  dari window edge di semua tab Pengaturan. (#123)
- **Layout Cetak KTA + Cetak Label & Barcode mepet ke border
  kiri/kanan** — outermost wrapper di `CetakKtaPage` dan
  `CetakLabelPage` sekarang pakai `flex flex-col gap-6 p-6` (konsisten
  dengan `DashboardPage`, `PeminjamanList`, `LaporanLayout`, dst).
  Konten tidak lagi mepet ke viewport edge. (#123)
- **Topbar global search: placeholder wrap & nabrak garis container** —
  search button placeholder span pakai `min-w-0 flex-1 truncate
  text-left`; container pakai `min-w-0 overflow-hidden whitespace-nowrap
  lg:w-72 xl:w-80`; `kbd` shortcut pakai `shrink-0`. Placeholder
  sekarang single-line + ellipsis, tidak pernah wrap. (#123)
- **Sidebar tab Pengaturan hilang saat scroll konten tab** —
  `SettingsLayout` aside pakai `lg:sticky lg:top-6
  lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto`.
  Sidebar tetap visible saat konten tab discroll; sidebar sendiri
  scroll independen kalau item-nya overflow. (#123)

### Notes

- **Sinkronisasi Google Sheets**: masih placeholder di v1.0.7. Backend
  belum mengirim data ke Sheets API — masih dijadwalkan untuk versi
  berikutnya. Form di `Pengaturan → Sinkronisasi` tetap menyimpan
  ID Spreadsheet & API Key secara lokal supaya nilai user dipakai
  otomatis begitu sinkronisasi penuh dirilis.
- **Windows installer**: tetap unsigned di v1.0.7. SmartScreen warning
  expected pada install pertama (workaround user-side: klik
  "More info" → "Run anyway"). Solusi permanen (code-signing
  certificate) masih dijadwalkan ke versi berikutnya.

## [1.0.6] - 2026-05-05

### Added

- **Notifikasi peminjaman telat (bell + dashboard)** — header sekarang
  punya bell icon dengan badge angka jumlah peminjaman yang sudah lewat
  jatuh tempo, plus panel "Peminjaman Telat" di Dashboard yang
  menampilkan list anggota + buku + tanggal jatuh tempo + jumlah hari
  telat. Backend baru: `peminjaman_overdue_list` Tauri command. Refresh
  otomatis tiap kali tab Dashboard / Peminjaman dibuka. (#107)
- **Riwayat peminjaman per anggota** — di halaman detail anggota,
  tab baru "Riwayat Peminjaman" menampilkan timeline lengkap (statistik
  total + aktif + selesai + telat, top 5 buku yang dipinjam, dan tabel
  semua transaksi diurutkan dari terbaru). Backend: `anggota_loan_history`
  Tauri command dengan agregasi SQL. (#108)
- **Label barcode buku + 10 template preset** — fitur baru "Cetak Label"
  di halaman Buku untuk batch-print barcode label dengan format Code-128.
  10 preset tersedia (mis. Avery 5160, custom 70×30mm, dll). Editor
  template support custom dimensi, font, posisi field, dan filled-rect
  decoration. CRUD template via `label_buku.rs` Tauri commands + tabel
  baru `label_buku_templates`. (#109)
- **Import wizard Excel/CSV (anggota & buku)** — dialog wizard 4-step
  (upload file → preview parse → mapping field → confirm import) untuk
  bulk-create data anggota atau buku dari spreadsheet. Validasi field
  inline (range tahun, format jenis kelamin, dll), error report CSV
  download, dan template Excel pre-formatted. Library bersama:
  `apps/desktop/src/lib/importWizard.ts`. (#110)
- **Mode sirkulasi webcam (Ctrl+L)** — halaman baru `/sirkulasi`
  dengan dua mode (Pinjam / Kembalikan) yang membaca barcode buku
  via webcam laptop pakai `@zxing/browser`. Format barcode supported:
  Code-128, Code-39, EAN-13, EAN-8, QR. Backend: `eksemplar_resolve` +
  `peminjaman_aktif_by_eksemplar`. Shortcut global Ctrl/Cmd+L untuk
  jump ke halaman dari mana saja. (#111)
- **Tutorial inline cara dapat ID Spreadsheet & API Key** — di
  `Pengaturan → Sinkronisasi`, di bawah form, panel selalu-tampil yang
  berisi 3 sub-section bernumber: (1) ID Spreadsheet — copy dari URL
  Google Sheets, (2) API Key — Google Cloud Console → enable Sheets
  API → Credentials → Create API key, (3) Sharing settings — set
  spreadsheet ke "Anyone with the link". 2 tombol shortcut langsung ke
  Cloud Console & halaman Sheets API. Dev-note transparan: backend
  sinkronisasi masih placeholder di v1.0.6 — field tersimpan lokal
  tapi belum ada call ke Sheets API. Backend full sinkron dijadwalkan
  untuk v1.0.7+. Manual book di-update dengan instruksi identik.
  (#116)

### Fixed

- **Cetak KTA: preview tidak kepotong di kolom kanan 320px** —
  panel preview di `Cetak KTA` sebelumnya mencoba render kartu pada
  scale yang membuat header "KARTU TANDA ANGGOTA" terpotong jadi
  "KARTU ANG..." dan body kartu meluap keluar viewport. Layout flex
  + `fitToWidth` pada `KtaPreview` sekarang menjamin kartu pas di
  kolom dengan aspect-ratio mm akurat. (#112)
- **Ikon kalender input date tidak terlihat di mode gelap** — native
  `<input type="date">` calendar picker indicator dan picker popup
  default warnanya gelap, jadi invisible di dark mode. Fix: `.dark
  { color-scheme: dark }` di `globals.css` opt-in ke dark scheme
  untuk semua native form widgets — calendar icon, autofill dropdown,
  scrollbars semua ikut tema gelap. (#113)
- **Daftar Isi Manual diklik tidak scroll ke section tujuan** —
  link TOC sebelumnya hanya memperbarui hash URL tanpa benar-benar
  scroll ke heading karena heading-heading di markdown tidak punya
  ID anchor. Sekarang ManualPage menambahkan `id` slugified ke setiap
  heading rendered ReactMarkdown, dan klik TOC pakai
  `scrollIntoView({ behavior: 'smooth', block: 'start' })`. (#114)
- **Hasil cetak KTA: foto broken + proporsi teks tidak konsisten** —
  dua bug dalam satu PR. (1) Popup window cetak menerima relative
  path foto anggota seperti `uploads/foto.png` yang tidak bisa
  resolve di luar konteks Tauri webview, jadi tampil sebagai
  broken-image icon. Fix: load foto via `assetsApi.readDataUrl()` jadi
  base64 inline sebelum render HTML. (2) `fontSize` template KTA
  disimpan dalam piksel mati, padahal kartu di-render di 3 ukuran
  berbeda (template editor scale=2.4, preview fitToWidth ~280px,
  cetak scale=1 ~756px) — text terlihat proporsi berbeda di tiap
  view. Fix: konversi semua `font-size` ke unit `cqi` (1cqi = 1%
  lebar card) + tambah `container-type: inline-size` di card
  wrapper. Editor + preview + cetak sekarang tampil identik
  proporsinya. (#115)

### Notes

- **Tab Sinkronisasi**: ditandai sebagai *placeholder + tutorial
  setup* di v1.0.6. Form menyimpan ID Spreadsheet & API Key secara
  lokal, tapi backend belum mengirim data ke Google Sheets — itu
  dijadwalkan ke v1.0.7+. Dev-note transparan dipasang di panel
  tutorial supaya user tahu nilai yang mereka simpan akan otomatis
  dipakai begitu sinkronisasi penuh dirilis. Setup tidak sia-sia.
- **Windows SmartScreen**: installer v1.0.6 tetap unsigned (tidak ada
  Authenticode certificate), jadi user akan melihat warning "Windows
  protected your PC" saat install pertama. Workaround user-side: klik
  "More info" → "Run anyway". Setelah upload release, installer
  v1.0.6 akan di-submit ke Microsoft SmartScreen (https://www.microsoft.com/en-us/wdsi/filesubmission)
  untuk reputation building. Solusi permanen: code-signing
  certificate (EV ~USD 300–600/tahun, OV ~USD 100–250/tahun, Azure
  Trusted Signing ~USD 10/bulan) — dijadwalkan ke versi berikutnya.

## [1.0.5] - 2026-05-04

### Added

- **KTA template library: 10 preset designs + gallery picker** —
  `Settings → Template KTA` now exposes a "Galeri Template" button that
  opens a modal showing 10 ready-to-use card designs at CR-80
  (85.6 × 53.98 mm) — Klasik Polos, Strip Atas Teal, Sidebar Rail Navy,
  Minimalis Modern, Sash Diagonal Rose, Portrait Tengah Emerald,
  Tradisional Amber, Pelajar Modern Indigo, Emas Eksklusif Gold, and
  QR Forward Cyan. Each thumbnail renders the design at scale=0.55 via
  the live `KtaPreview` so what you see is what prints. Picking a
  preset loads its layout into the editor — operators can tweak
  colours / fields / positions before saving. Schema gains a `'rect'`
  `KtaFieldKind` for filled rectangle decorations (with optional
  `fill` hex + `radius` mm); existing user templates are unchanged
  because they have no `rect` fields. (#105)

## [1.0.4] - 2026-05-04

### Added

- **KTA export PDF + open output folder** — "Cetak KTA" page now ships a
  "Simpan PDF" button that writes the selected member cards to a vector
  PDF under `<APPDATA>/exports/kta-YYYYMMDD-HHMMSS.pdf` via `jsPDF`. A
  toast surfaces the filename, an emerald ribbon under the header pins
  it for the session, and a "Buka Folder Hasil" button opens the
  containing directory in the OS file manager. Vector text + JPEG
  raster portraits keep file sizes small. (#96)
- **Auto-compress uploaded photos** — every image uploaded via
  `assets_save` is decoded with the `image` crate, downscaled with
  Lanczos3 if its long edge exceeds the per-category cap, and re-encoded
  as quality-85 JPEG (or original PNG if it has alpha). Caps: 800 px
  for member portraits, 1200 px for book covers, 512 px for the school
  logo. Typical phone snaps drop from 4 MiB to <200 KiB. SVG and GIF
  bypass compression. (#97)
- **Editable Laporan Kas + manual entries + audit log** — the cashbook
  now supports inline edit, delete, and ad-hoc manual entries (income
  or expense) via three new Tauri commands (`kas_create`, `kas_update`,
  `kas_delete`) wrapped in transactions. Every mutation writes a
  before/after JSON detail to `audit_log` so admins can see who
  changed what. (#99)
- **Dashboard: live OS clock + deterministic quote-of-the-day** —
  header now shows a `LiveClock` ticking every second in `id-ID` with
  a full-locale date below it. The dashboard card surfaces a daily
  quote selected via `(year * 367 + dayOfYear) % QUOTES.length` so
  every operator on the same calendar day sees the same quote, and
  the quote rotates deterministically across years. 121 hand-curated
  Indonesian + English entries about reading and learning. (#100)
- **User profile dialog** — header dropdown's "Profil" item now opens
  a dialog where the signed-in operator can edit display name, foto,
  date / place of birth, contact info, address, gender, and religion.
  Backed by a new `user_profiles` table (FK to `users.id` with
  cascade delete) and `user_profile_get` / `user_profile_update`
  Tauri commands. Header avatar + greeting update live via the
  `users:profile-changed` event; saves emit an `audit_log` row with
  the full before/after JSON. Username, role, and password remain
  managed by `Settings → Akun`. (#103)

### Changed

- **Hak Akses permission matrix readability** — settings page now
  shows a two-row role header (role label + count of granted
  permissions), a sticky "Area" column, zebra rows, and vertical
  dividers between roles so wide matrices stay scannable. (#98)
- **Modern custom title bar** — replaced the OS-native window
  decorations with a 36 px React title bar that hosts the app icon,
  product name, drag region, and minimize / maximize / close buttons.
  Drag region supports double-click-to-maximize and the maximize icon
  syncs with `window.onResized`. Browser-mode dev still works because
  the Tauri window API is lazy-loaded and falls back gracefully when
  unavailable. (#101)
- **Brand rename Perpustakaan Offline → Perpustakaan Nusantara** —
  every operator-visible reference (window title, productName,
  Windows installer + Start Menu entry + Add/Remove Programs name,
  manual H1, README, system tray tooltip, login brand label) now
  reads "Perpustakaan Nusantara". The bundle identifier
  (`id.alviarts.perpustakaan`), Cargo package name, and GitHub repo
  slug are intentionally unchanged so existing v1.0.x users keep
  their SQLite database under `<APPDATA>/<bundle-id>/` with no
  manual migration. Windows users will see two entries in
  Apps & features after upgrading until they uninstall the old
  one — that's the documented migration cost. (#102)

## [1.0.3] - 2026-05-04

### Fixed

- **FilePickerInput preview broken on Windows** — Logo Perpustakaan,
  Foto Anggota, and Cover Buku previews rendered the broken-image
  glyph after a successful upload because Tauri 2's asset-protocol
  scope matcher failed to match canonicalised `\\?\C:\…` paths against
  the `$APPDATA/uploads/**` pattern. Replaced the `convertFileSrc`
  round-trip with a new `assets_read_data_url` Tauri command that
  reads the bytes through the IPC bridge and returns a
  `data:<mime>;base64,<payload>` URL the WebView always renders.
  Works identically on Linux, macOS, and Windows. (#94)
- **Date input contrast in dark mode** — native calendar / time inputs
  now inherit the theme via `color-scheme`, so the icon and value
  remain readable on dark backgrounds. Filter-invert fallback applied
  to browsers that ignore `color-scheme`. (#91)
- **Form layout cramped on wide windows** — Anggota / Buku create &
  edit routes now expand to `max-w-3xl xl:max-w-5xl 2xl:max-w-7xl`
  instead of clipping at the smaller container width. (#92)

### Changed

- **Per-aspect-ratio Windows installer artwork** — re-exported the
  four BMPs (`nsis-sidebar.bmp` 164×314, `nsis-header.bmp` 150×57,
  `wix-banner.bmp` 493×58, `wix-dialog.bmp` 493×312) from per-target
  SVG sources rendered at the exact target resolution. The previous
  v1.0.2 installer stretched a single source across all four aspect
  ratios, producing distorted art. Sources, regen script, and an
  install-artwork README live in `apps/desktop/src-tauri/installer/`.
  (#93)
- **Tooltips on icon-only buttons** — global tooltip wrapper sweep
  over 7 components so every icon-only button surfaces its label on
  hover, improving keyboard / screen-reader navigation. (#90)
- **Responsive Peminjaman date pickers** — flex-wrap "Hari Ini"
  shortcut so it drops below the date inputs on narrow widths, and
  promote Peminjaman date pickers to `xl:grid-cols-2` on wide
  windows. (#91)

## [1.0.2] - 2026-05-04

### Added

- **File picker uploader** for anggota photo, buku cover, and identitas logo
  via a reusable `FilePickerInput` component. Backed by Tauri commands
  (`assets_save` / `assets_resolve` / `assets_delete`) with path-traversal
  defenses, an allow-list of categories (anggota / buku / identitas) and
  extensions (png / jpg / jpeg / webp / gif / svg / bmp), and race-protection
  against fast successive picks. Legacy v1 absolute paths in the DB still
  pass through without migration. (#69)
- **Anggota Excel export** — "Ekspor Excel" button on the member list
  respects the active filters (search / kelas / jurusan / aktif / sort) and
  writes via a generic `export_write_bytes` Tauri command (validates
  non-empty, ≤ 64 MiB, absolute path, parent exists). Pagination uses
  500 items per batch with a 100 000-row hard cap. Reuses the existing
  `xlsx` (SheetJS) dependency. (#70)
- **Ctrl+K global search palette** — cmdk-style command palette
  (Ctrl+K / Cmd+K) searches anggota, buku, and peminjaman in a single
  dialog with three result groups, race-protection, `Promise.allSettled`
  fan-out, 200 ms debounce, and a sub-2-character short-circuit. Toggling
  Ctrl+K opens and closes the palette. (#72)
- **Forgot password** flow via security question — two-step lookup
  (username → security question → reset). `auth_get_security_question`
  always returns `Ok(None)` for ineligible branches (missing user /
  inactive / no question / blank) to defend against username enumeration.
  Security answers are bcrypt-hashed (cost 12) after trim + whitespace
  collapse + lowercase normalization. Wrong answers are mapped to
  `InvalidCredentials` to reuse the existing error path. New Settings tab
  lets users set or edit their security question. DB migration adds
  nullable `security_question` and `security_answer_hash` columns. (#74)
- **Backup cron scheduler** runs in a background thread that ticks every
  60 s, reads the schedule from the `settings` table, and supports cron
  5-field syntax (`*`, single, `M-N`, `A,B,C`, `*/N`). Auto-backups go to
  `<app_data>/backups/`; manual backups still go to a user-picked folder.
  Hardened with a 30 s startup grace window, an `AtomicBool` busy flag,
  minute-slot dedupe, silent no-op on cron typos, and lazy directory
  creation. Reuses the existing `backup_create_at` command. (#75)
- **Manual book as Settings tab** — replaces the flaky child-window
  WebView2 build of the manual with a `Settings → Buku Manual` tab that
  renders `docs/manual.md` inline via `react-markdown` + `remark-gfm`,
  with a generated table of contents. The Settings layout now has 13
  tabs (was 12), and the header "Buku Manual" button links to
  `/settings/manual`. (#76)
- **Richer kunjungan illustrations** — theme-aware vector art for the
  kunjungan empty state and supporting screens. (#71)
- **CHANGELOG-driven auto-release** — tag pushing `vX.Y.Z` now extracts
  the matching `## [X.Y.Z]` section from `CHANGELOG.md` via
  `scripts/extract-changelog.mjs` and uses it as the GitHub Release body,
  falling back to GitHub's auto-generated notes when no section matches.
  Pre-release tags (`-alpha` / `-beta` / `-rc`) are auto-marked as
  prereleases. README gains a "Release process" section documenting the
  flow end-to-end. (#73)
- **README v2 refresh** — README.md now documents the actual v2
  Tauri / React / pnpm 9 stack, monorepo layout, per-OS Tauri prereqs,
  build commands, data paths, and the 8 quality-gate command lineup.
  Drops the dead `pengembalian.placeholder` i18n key. (#78)
- **Manual.md v2 refresh** — `docs/manual.md` now documents v2 install
  flows (MSI + NSIS on Windows, `.deb` on Linux, `.dmg` on macOS),
  Tauri data paths, the actual Settings tab list (Identitas / KTA /
  Akun / Hak Akses / Aturan Peminjaman / Master Data / Tampilan /
  Bahasa / Backup / Sinkronisasi / Audit Log / Tentang), the in-app
  "Lupa Password?" flow, and v2 troubleshooting. (#81)
- **POST_V1_BUGS.md & PROGRESS.md status refresh** — status fields
  flipped to DONE for fixed bugs, BUG-010 / BUG-011 added,
  `INSTRUCTION_TEMPLATE.md` synced, and PROGRESS.md gains a
  post-v1.0.1 status section plus a post-migration cleanup section
  in the migration record. (#67, #82, #83)
- **Smoke-test-v2 SKILL.md** — agent-facing skill notes for smoke
  testing the v2 Tauri app. (#52)

### Changed

- **Header search** — replaces the placeholder input that navigated to
  `/anggota?q=...` on Enter with a `<button>` that opens the new
  `GlobalSearchDialog` (Ctrl+K). (#72)
- **Rust formatting** — `commands/buku.rs` and `db/mod.rs` re-formatted
  with rustfmt; cosmetic only. (#77)
- **Cargo.toml** — deduplicated the `[dev-dependencies]` block on `main`
  after PR #69 and PR #70 each appended `tempfile = "3"` and squash-merge
  produced a duplicate key that broke `cargo check` / `clippy` / `test`. (#87)
- **Migration archive** — `docs/migration-v2/` moved to
  `docs/archive/migration-v2/` to mark the migration as completed. (#85)
- **`release-v2` CI job** — extracts the release body from `CHANGELOG.md`
  before calling `softprops/action-gh-release@v2`, falling back to
  auto-generated notes when no section matches the tag. (#73)

### Fixed

- **BUG-008** — Dashboard "Total Buku" KPI now shows the actual book
  titles plus the eksemplar sub-line instead of the previous mislabeled
  count. (#68)
- **Manual book WebView2 child-window flakiness** — replaced the
  child-window approach with the inline Settings tab so the manual
  always renders, regardless of WebView2 version. (#76)

### Removed

- **v1 Python codebase** deleted entirely (253 files, ~24 500 lines):
  `src/perpustakaan/` Python source, `tests/` pytest suite, `pyproject.toml`,
  `requirements.txt`, `build.spec`, `build.bat`, `installer/` Inno Setup,
  `assets/` v1 illustration PNGs, six Python utility scripts,
  `scripts/migrate-v1-to-v2.mjs` and its test, the disabled v1 CI workflow,
  and v1 docs (`quickstart.md` / `quickstart.pdf`, screenshots, smoke-test
  report, demo screencast, google-sheets-setup). v1 history remains
  accessible via `git log --all`. The Google Sheets sync feature is gone
  permanently — v2 ships the backup scheduler instead. (#80)
- **`apps/manual/` package** removed (`build.mjs`, `package.json`,
  `commands/manual.rs`, `lib/manual.ts`, etc.) — superseded by the
  Settings → Manual tab. (#76)
- **Dead i18n key** `pengembalian.placeholder` removed from `id` and `en`
  locale files. (#78)

## [1.0.1] - 2026-05-04

### Fixed

- **BUG-001**: `buku_create` now inserts the initial eksemplar row so freshly
  created books are immediately borrowable.
- **BUG-002**: introduced `formatTauriError` helper and swept all call sites
  so users see actionable messages instead of `[object Object]`.
- **BUG-003**: Anggota dropdowns (Kelas / Jurusan / Agama) now read from the
  master tables and merge distinct values from existing rows.
- **BUG-004**: fresh installs seed all 10 DDC main classes so the buku form
  dropdown is populated on first launch.
- **BUG-005**: a default KTA template row is seeded on first launch so "Cetak
  KTA" is usable without manually creating a template first.
- **BUG-006**: header breadcrumb now tracks sub-routes (e.g.
  `Laporan / Backup`) instead of only the top-level segment.
- **BUG-007**: Backup tab + `backup_create` now point at `perpustakaan-v2.db`
  (the runtime DB) instead of the legacy v1 filename.
- **BUG-010 / BUG-009**: Buku Manual window redesigned and CSS/JS externalized
  to comply with Tauri 2 CSP. Inline assets bundled into the HTML so the
  manual window also renders correctly on Windows.
- **BUG-011**: system tray + close-behavior setting + clean process exit so
  closing the X button no longer leaves zombie WebView2 processes.

## [1.0.0] - 2026-05-03

### Added

- Initial v2 stable release, completing the 12-session migration from
  Python + customtkinter (v1) to **Tauri 2 + React 18 + TypeScript +
  Tailwind 3 + shadcn/ui + Zustand + Vite + pnpm + Vitest + Playwright**.
- Full feature parity with v1 plus modernized UI: login, dashboard, anggota
  CRUD with autocomplete, buku CRUD with master data, peminjaman/pengembalian
  with date pickers, kunjungan tracking, laporan (grafik / top peminjam /
  top buku / kas / backup), KTA template editor with QR + auto-fill, and
  Settings (12 categories) including audit log viewer and bilingual ID/EN.
- Tauri MSI + NSIS Windows installer with logo, license, and asset bundle.
- CI v2 pipeline: lint + typecheck + Vitest, Rust check + clippy, Windows
  installer build, and GitHub Release publish on tag push.
