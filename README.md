# Perpustakaan Nusantara — PC + HP

> **Aplikasi manajemen perpustakaan untuk sekolah & madrasah Indonesia.**
> Desktop (Windows) + Android app untuk siswa. Sinkronisasi via Google Sheets.
> Tanpa langganan, tanpa server khusus.

[![Latest release](https://img.shields.io/github/v/release/alviarts/perpustakaan-offline?label=release)](https://github.com/alviarts/perpustakaan-offline/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI v2](https://github.com/alviarts/perpustakaan-offline/actions/workflows/ci-v2.yml/badge.svg?branch=main)](https://github.com/alviarts/perpustakaan-offline/actions/workflows/ci-v2.yml)

📥 **[Download installer PC →](https://github.com/alviarts/perpustakaan-offline/releases/latest)**
📱 **[Download APK Android →](https://github.com/alviarts/perpustakaan-offline/releases/latest)**
📖 **[Manual pengguna lengkap →](docs/manual.md)**

---

## 🎯 Untuk Siapa Aplikasi Ini?

Sekolah / madrasah / komunitas yang mengelola perpustakaan tapi:

- **Tidak punya server** atau IT staff khusus.
- **Internet sering mati** atau biaya SaaS bulanan terlalu mahal.
- Data peminjaman masih di **Excel / buku tulis** dan rawan hilang.
- Butuh **KTA cetak**, **barcode scanner**, **laporan bulanan**, dan **OPAC kios** untuk siswa.

Setelah dipasang, satu komputer tua dengan webcam pun cukup untuk menjalankan
sirkulasi harian — tinggal scan KTA siswa, scan barcode buku, selesai. Backup
otomatis ke USB / Google Drive.

---

## ✨ Fitur

<details open>
<summary><b>📚 Katalog Buku</b></summary>

- Master data buku + cover + klasifikasi DDC + kategori + bahasa.
- **Bulk import dari Excel / CSV** + **bulk import via ISBN** (Open Library + Google Books, fallback offline).
- Cetak label barcode per eksemplar (single atau batch, format Code-128).
- Filter, sort, dan **pencarian fuzzy** (Ctrl+K, palette global).
- **Buku Pilihan / Featured** — admin pin sampai 5 buku untuk carousel di OPAC.

</details>

<details open>
<summary><b>👥 Anggota</b></summary>

- Master data anggota + foto + KTA per anggota.
- **Bulk import Excel / CSV** dengan mode "perbarui anggota yang sudah ada".
- **Naik kelas batch** (akhir tahun ajaran) + **Surat Bebas Pustaka (SBP)** otomatis.
- **Cetak KTA** single atau batch dari **20+ template** desain (front + back editor visual).
- **Sinkronisasi Google Sheets** dua-arah (last-write-wins, optional).

</details>

<details open>
<summary><b>🔄 Sirkulasi (Peminjaman & Pengembalian)</b></summary>

- **Scanner barcode webcam** dengan overlay frame + ROI decode + manual fallback.
- **USB hand-scanner auto-detection** (deteksi burst keystroke, langsung diproses).
- **Search dropdown** (anggota + buku) di Sirkulasi — ketik nama / judul kalau scan gagal.
- **Perpanjangan otomatis** 1-klik dengan batas konfigurabel (default 1× per pinjaman).
- **Reservasi / antrian** saat eksemplar habis — auto-promote saat buku kembali.
- **Inline Bayar Denda** dengan preset 1×/2×/3× × `dendaPerHari` + preset tetap (5k/10k/15k).
- Riwayat per anggota + audit log per transaksi.

</details>

<details open>
<summary><b>📊 Dashboard & Laporan</b></summary>

- **Real-time KPI** (clickable): Total Anggota, Total Buku, Buku Dipinjam.
- **Trend chart** 30/90/365 hari + **heatmap kalender** aktivitas.
- **Insight cards**: Buku Terlaris, Peminjam Teraktif (clickable ke detail).
- **Quote-of-the-day** rotasi 2 menit + tombol manual next.
- **System Health card** — ukuran DB, backup terakhir, reservasi tertunda, versi.
- **Laporan Top Peminjam, Top Buku, Grafik Kunjungan, Kas** (auto dari denda).
- **Laporan Eksekutif PDF** 3-halaman (cover + KPI / charts / action items) buat rapat bulanan.

</details>

<details open>
<summary><b>🌐 OPAC (Public Catalog)</b></summary>

- **Mode publik tanpa login** — pengunjung browse katalog mandiri.
- **Featured Carousel** di OPAC home — pinned books auto-rotate 5s, pause-on-hover, keyboard accessible.
- **Post-scan profile** — setelah scan KTA muncul peminjaman aktif + denda outstanding + riwayat + reservasi.
- **Auto absen kunjungan** setiap scan (deduplikasi 5 menit).
- **Reservasi langsung dari OPAC** saat eksemplar 0 — antrian FIFO.
- **Scan-locked dialog** — kalau anggota lain masih login, konfirmasi dulu sebelum scan baru.
- **Kiosk lock** full-screen dengan idle reset 60 detik.
- **Wishlist** — anggota request pengadaan buku langsung dari OPAC.

</details>

<details open>
<summary><b>📦 Stocktake / Opname</b></summary>

- Sesi opname terisolasi: scan barcode batch (kamera atau hand-scanner).
- Real-time tally found / missing / extra.
- Export laporan PDF + CSV per sesi.

</details>

<details open>
<summary><b>☁️ Backup & Sinkronisasi</b></summary>

- Backup manual + scheduler cron-like.
- **Cloud target via rclone** (Google Drive, S3, Dropbox, dll) — **AES-256-GCM encrypted**.
- History audit 50 backup terakhir, decrypt langsung dari UI.
- **Sinkronisasi Google Sheets** dua-arah untuk anggota.

</details>

<details open>
<summary><b>🧪 Mode Demo / Sandbox</b></summary>

- Toggle di Pengaturan → Mode Demo untuk **switch ke DB demo terpisah**.
- Banner kuning aktif persisten lintas restart.
- **Semua perubahan terisolasi** — DB asli aman.
- Demo DB diarsipkan otomatis saat dinonaktifkan.
- Cocok buat: training petugas baru, demo ke sekolah lain, debugging.

</details>

<details open>
<summary><b>⚙️ Lainnya</b></summary>

- **Login multi-user** dengan **RBAC** + lupa password offline (security question).
- **Bilingual** Indonesia / English — toggle live, parity dijaga oleh CI.
- **Command palette (Ctrl/Cmd+K)** — jump ke halaman / aksi cepat (Backup Sekarang, Cetak Laporan, Toggle Tema, dst).
- **Skeleton screens** menggantikan spinner (loading lebih halus, hormati `prefers-reduced-motion`).
- 12 tab Pengaturan: identitas, akun, hak akses, aturan peminjaman, tampilan, master data, backup, sync, audit log, manual book, tentang, mode demo.
- System tray + close-behavior (minimize-to-tray vs close).

</details>

---

## 🚀 Cara Pasang (untuk Pustakawan / Pengguna Akhir)

### Windows

1. Download installer terbaru dari **[Releases](https://github.com/alviarts/perpustakaan-offline/releases/latest)**:
   - `PerpustakaanNusantara_<version>_x64-setup.exe` (NSIS, recommended) **atau**
   - `PerpustakaanNusantara_<version>_x64_en-US.msi` (MSI, untuk deployment via GPO).
2. Klik kanan installer → **Run as administrator** → ikuti wizard → selesai.
3. Buka aplikasi dari Start Menu: **Perpustakaan Nusantara**.
4. **Login pertama:**
   - Username: `admin`
   - Password: `admin123`
   - **WAJIB ganti password** saat login pertama (form akan muncul otomatis).

### Linux

Belum ada `.deb` / `.AppImage` resmi di releases — sementara build sendiri dari source (lihat [Untuk Developer](#-untuk-developer)).

### macOS

Belum ada `.dmg` resmi di releases — sementara build sendiri dari source.

---

## 🎬 Setup Pertama Kali (5 Menit Sampai Pakai)

Setelah login pertama dan ganti password admin:

1. **Pengaturan → Identitas Sekolah** — isi nama sekolah, alamat, logo. Akan muncul di KTA, surat bebas pustaka, dan PDF laporan.
2. **Pengaturan → Aturan Peminjaman** — atur lama pinjam (default 7 hari), denda per hari (default Rp 0 = tidak ada denda), maksimal pinjaman per anggota.
3. **Pengaturan → Backup** — set folder lokal (default `<app_data>/backups/`) atau target rclone (Google Drive / S3). Aktifkan scheduler harian / mingguan.
4. **Master Data → Kategori / DDC / Penerbit / Bahasa** — isi master data dasar atau biarkan default.
5. **Anggota → Tambah / Impor Excel** — input siswa. Bisa via `+ Tambah Anggota` (manual) atau `Impor Excel` (bulk dari template `.xlsx`).
6. **Buku → Tambah / Impor Excel / Impor via ISBN** — input koleksi. ISBN scanner otomatis ambil judul/penulis/cover dari Open Library + Google Books.
7. **Cetak KTA** — dari halaman Anggota, pilih anggota → `Cetak KTA` → pilih template → print.
8. **Mulai sirkulasi** — Sidebar → **Sirkulasi** → mode `Pinjam` → scan KTA siswa → scan barcode buku → selesai.

> Butuh latihan tanpa risiko? Aktifkan **Pengaturan → Mode Demo** — semua perubahan masuk DB terpisah. Saat dinonaktifkan, DB asli kembali utuh.

---

## 📍 Lokasi Data

SQLite + asset files dibuat otomatis di app data dir per OS:

| OS | Path |
|---|---|
| Linux | `~/.local/share/id.alviarts.perpustakaan/` |
| Windows | `%APPDATA%\id.alviarts.perpustakaan\` |
| macOS | `~/Library/Application Support/id.alviarts.perpustakaan/` |

Berisi:
- `perpustakaan-v2.db` — database utama (SQLite, WAL mode).
- `perpustakaan-v2-demo.db` — DB sandbox (kalau Mode Demo pernah diaktifkan).
- `uploads/{anggota,buku,identitas}/` — foto + cover + logo.
- `backups/perpustakaan-<timestamp>.db[.sha256]` — output backup.
- `demo-archive/<ts>.db` — arsip DB demo dari sesi sebelumnya.

> **Untuk migrasi ke komputer baru:** tinggal copy seluruh folder `id.alviarts.perpustakaan/` ke komputer baru di lokasi yang sama. Pasang aplikasi → buka → semua data sudah ada.

---

## ❓ FAQ

**T: Aplikasi butuh internet?**
J: Tidak. Semua fitur jalan offline. Internet hanya dibutuhkan untuk: (a) Bulk import via ISBN (opsional, ada fallback offline), (b) Backup ke cloud via rclone (opsional), (c) Sinkronisasi Google Sheets (opsional).

**T: Bagaimana kalau lupa password admin?**
J: Login screen → "Lupa kata sandi?" → jawab security question yang di-set saat first-run. Kalau security question pun lupa, lihat [docs/manual.md](docs/manual.md) section "Reset password manual via SQLite".

**T: Apakah bisa multi-user / akses dari komputer lain?**
J: Saat ini single-machine, multi-user lokal (banyak akun di satu komputer dengan RBAC). Akses lintas komputer rencananya via Sheets sync (lihat roadmap).

**T: Kalau saya rusak DB / hapus tidak sengaja?**
J: Restore dari backup terakhir via Pengaturan → Backup → History → Restore. Kalau tidak ada backup, export manual ke Excel sebelum operasi destruktif.

**T: Berapa beban lisensi?**
J: **Gratis (MIT)** — bebas dipakai sekolah negeri / swasta / komunitas / komersial. Sumber kode publik di repo ini.

---

## 🛠️ Untuk Developer

### Stack

**Backend:** Rust + Tauri 2 + rusqlite + bcrypt + chrono
**Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Router + Zustand + React Query
**i18n:** i18next (id / en, parity-checked)
**Charts:** Recharts • **Excel:** SheetJS • **PDF:** pdf-lib • **Markdown:** react-markdown
**Workspace:** pnpm monorepo (`apps/desktop`, `apps/manual`, `packages/shared`)

### Persyaratan Build

- **Node ≥ 20**, **pnpm ≥ 9.15.1**, **Rust stable ≥ 1.95**
- Plus prereqs Tauri per OS:
  - **Linux (Ubuntu 22.04+):**
    ```bash
    sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
      librsvg2-dev patchelf libssl-dev pkg-config
    ```
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Windows:** WebView2 (sudah ada di Windows 11) + [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Dev

```bash
git clone https://github.com/alviarts/perpustakaan-offline.git
cd perpustakaan-offline
pnpm install --frozen-lockfile
pnpm tauri:dev    # buka aplikasi dengan hot-reload
```

### Build Production

```bash
pnpm tauri:build
```

Output ada di `apps/desktop/src-tauri/target/release/bundle/`:
- **Windows:** `msi/*.msi` + `nsis/*-setup.exe`
- **Linux:** `deb/*.deb` + `appimage/*.AppImage`
- **macOS:** `dmg/*.dmg`

> Tauri tidak mendukung cross-build — build di OS target masing-masing atau pakai CI matrix.

### Quality Gates (sebelum commit)

```bash
# Frontend
pnpm i18n:lint                                    # id ↔ en parity
pnpm typecheck
pnpm --filter @perpustakaan/desktop lint
pnpm --filter @perpustakaan/desktop test -- --run
pnpm --filter @perpustakaan/desktop build

# Backend
cd apps/desktop/src-tauri
cargo check --all-targets
cargo clippy --all-targets -- -D warnings
cargo test --lib
```

CI (`.github/workflows/ci-v2.yml`) menjalankan semua gate di atas pada tiap PR.
Tag `v*` push memicu build Windows installer + publish GitHub Release otomatis.

### Kontribusi

- **Conventional commits** (English): `feat(scope): description`, `fix(scope): ...`, dst.
- **Branch:** `devin/<unix-ts>-<short-kebab-name>` atau `feat/<short>` / `fix/<short>`.
- **i18n parity wajib** — setiap string baru harus ada di `i18n/id/<ns>.json` **dan** `i18n/en/<ns>.json`.
- **Jangan commit:** `*.db`, `target/`, `node_modules/`, binary, secret.

Lihat [`docs/manual.md`](docs/manual.md) untuk panduan end-user dan [CHANGELOG.md](CHANGELOG.md) untuk riwayat rilis.

---

## 📜 Lisensi & Credits

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan didistribusikan untuk keperluan apapun (termasuk komersial).

- **SIM-Perpus original** — Kang Sur (Excel + VBA) — inspirasi awal aplikasi ini.
- **DDC (Dewey Decimal Classification)** — public domain.
- Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Router](https://tanstack.com/router), [Recharts](https://recharts.org/), [SheetJS](https://sheetjs.com/), [pdf-lib](https://pdf-lib.js.org/).

Bug / saran? **[Buka issue di GitHub →](https://github.com/alviarts/perpustakaan-offline/issues/new)**
