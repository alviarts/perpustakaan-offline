# Perpustakaan Nusantara

> Aplikasi manajemen perpustakaan **offline-first** untuk sekolah / madrasah —
> berjalan di Windows, Linux, dan macOS, semua data tersimpan lokal di SQLite.

[![Latest release](https://img.shields.io/github/v/release/alviarts/perpustakaan-offline?label=release)](https://github.com/alviarts/perpustakaan-offline/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

📥 **[Download installer terbaru →](https://github.com/alviarts/perpustakaan-offline/releases/latest)** (Windows MSI / NSIS)

---

## ✨ Fitur

### 📚 Katalog Buku
- Master data buku + cover + klasifikasi DDC
- **Bulk import dari Excel/CSV** + **bulk import via ISBN** (Open Library + Google Books)
- Cetak label barcode per eksemplar (single atau batch)
- Filter, sort, dan pencarian fuzzy

### 👥 Anggota
- Master data anggota + foto + KTA per anggota
- **Bulk import Excel/CSV** dengan mode "perbarui anggota yang sudah ada"
- **Naik kelas batch** + **Surat Bebas Pustaka (SBP)** otomatis
- Cetak KTA single / batch dari **20+ template** desain (front + back editor)

### 🔄 Sirkulasi (Peminjaman & Pengembalian)
- Scanner barcode webcam dengan **overlay frame + ROI decode** + manual fallback
- **Perpanjangan otomatis** 1-klik dengan batas konfigurabel
- **Reservasi/booking** — antrian saat buku dipinjam, auto-promote saat kembali
- Quick-input denda 1×/2×/3× dari aturan peminjaman
- Riwayat per anggota + audit log per transaksi

### 📊 Dashboard & Laporan
- Real-time: total anggota, buku, peminjaman aktif, kunjungan hari ini
- **Trend chart** 30/90/365 hari + **heatmap kalender** aktivitas
- Insights cards: top kategori, top anggota, buku populer minggu ini
- Quote-of-the-day rotasi tiap 5 menit
- Laporan Top Peminjam, Top Buku, Grafik Kunjungan, Kas (auto dari denda)

### 🌐 OPAC (Public Catalog)
- Mode publik tanpa login — pengunjung browse katalog mandiri
- **Kiosk lock** full-screen dengan idle reset 60 detik
- Anggota submit **wishlist** (request pengadaan buku) langsung dari OPAC

### 📦 Stocktake / Opname
- Sesi opname terisolasi: scan barcode batch (kamera atau hand-scanner)
- Real-time tally found / missing
- Export laporan PDF + CSV per sesi

### ☁️ Backup & Sinkronisasi
- Backup manual + scheduler cron-like
- **Cloud target via rclone** (Google Drive, S3, Dropbox, dll) — **AES-256-GCM encrypted**
- History audit 50 backup terakhir, decrypt langsung dari UI
- **Sinkronisasi Google Sheets** dua-arah untuk anggota (last-write-wins)

### ⚙️ Lainnya
- **Login multi-user** dengan RBAC + lupa password offline (security question)
- **Bilingual** Indonesia / English — toggle live, parity dijaga oleh CI
- **Ctrl+K global search** (anggota + buku + peminjaman)
- 12 tab Pengaturan: identitas, akun, hak akses, aturan peminjaman, tampilan, master data, backup, sync, audit log, manual book, tentang
- System tray + close-behavior (minimize-to-tray vs close)

---

## 🚀 Quick Start

### Untuk pengguna akhir

1. Download installer dari [Releases](https://github.com/alviarts/perpustakaan-offline/releases/latest):
   - **Windows:** `PerpustakaanNusantara_<version>_x64-setup.exe` (NSIS) atau `.msi`
2. Jalankan installer.
3. Login default: `admin` / `admin123` — **wajib diubah saat login pertama**.

### Untuk developer

```bash
git clone https://github.com/alviarts/perpustakaan-offline.git
cd perpustakaan-offline
pnpm install --frozen-lockfile
pnpm tauri:dev
```

Persyaratan: **Node ≥ 20**, **pnpm ≥ 9**, **Rust stable ≥ 1.95**, plus prereqs Tauri per OS (lihat detail di bawah).

---

## 🛠️ Stack

**Backend:** Rust + Tauri 2 + rusqlite + bcrypt
**Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Router + Zustand
**i18n:** i18next (id / en, parity-checked)
**Charts:** Recharts • **Excel:** SheetJS • **Markdown:** react-markdown
**Workspace:** pnpm monorepo (`apps/desktop`, `apps/manual`, `packages/shared`)

---

## 📦 Build Production

```bash
pnpm tauri:build
```

Output di `apps/desktop/src-tauri/target/release/bundle/`:
- **Windows:** `msi/*.msi` + `nsis/*-setup.exe`
- **Linux:** `deb/*.deb` + `appimage/*.AppImage`
- **macOS:** `dmg/*.dmg`

Tauri tidak mendukung cross-build — build di OS target masing-masing atau pakai CI matrix.

---

## 🗄️ Lokasi Data

SQLite + asset files dibuat otomatis di app data dir per OS:

- **Linux:** `~/.local/share/id.alviarts.perpustakaan/`
- **Windows:** `%APPDATA%\id.alviarts.perpustakaan\`
- **macOS:** `~/Library/Application Support/id.alviarts.perpustakaan/`

Berisi: `perpustakaan-v2.db` (database utama), `uploads/{anggota,buku,identitas}/` (foto + cover + logo), `backups/perpustakaan-<timestamp>.db[.sha256]` (output backup).

---

## ✅ Quality Gates (sebelum commit)

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

CI (`.github/workflows/ci-v2.yml`) menjalankan semua gate di atas pada tiap PR. Tag `v*` push memicu build Windows installer + publish GitHub Release otomatis.

---

## 🔧 Persyaratan Development per OS

- **Linux (Ubuntu 22.04+):**
  ```bash
  sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
    librsvg2-dev patchelf libssl-dev pkg-config
  ```
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** WebView2 (sudah ada di Windows 11) + [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

## 🤝 Kontribusi

Konvensi:
- **Conventional commits** (English): `feat(scope): description`, `fix(scope): ...`, dst.
- **Branch:** `devin/<unix-ts>-<short-kebab-name>`
- **i18n parity wajib** — setiap string baru harus ada di `i18n/id/<ns>.json` **dan** `i18n/en/<ns>.json`
- **Jangan commit:** `*.db`, `target/`, `node_modules/`, binary, secret

Lihat [`docs/manual.md`](docs/manual.md) untuk panduan end-user dan [CHANGELOG.md](CHANGELOG.md) untuk riwayat rilis.

---

## 📜 Lisensi & Credits

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan didistribusikan.

- **SIM-Perpus original** oleh Kang Sur (Excel + VBA)
- **DDC (Dewey Decimal Classification)** — public domain
- Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Router](https://tanstack.com/router), [Recharts](https://recharts.org/), [SheetJS](https://sheetjs.com/)
