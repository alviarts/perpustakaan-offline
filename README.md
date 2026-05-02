# Perpustakaan Offline (SIM-Perpus Reborn)

> Aplikasi **Sistem Informasi Manajemen Perpustakaan** (SIM-Perpus) berbasis Python + SQLite yang berjalan **100% offline** dan dapat dikemas menjadi `.exe` Windows tunggal. Cocok untuk perpustakaan **sekolah / madrasah**.

Inspirasi: SIM-Perpus v.1.2.2 (Excel + VBA) oleh **Kang Sur**, ditulis ulang menjadi aplikasi desktop modern dengan tetap mempertahankan alur kerja yang familiar bagi pustakawan sekolah.

---

## Fitur Utama

- **Login multi-user** (admin + pustakawan) dengan hashing bcrypt
- **Dashboard** real-time: total anggota, buku, dipinjam, dikembalikan, terlambat, hilang
- **Master Data Anggota**: input/edit/hapus/import Excel, foto KTA, sort, **Naik Kelas**, **Surat Bebas Pustaka**
- **Master Data Buku**: input/edit/hapus/import Excel, cover, klasifikasi DDC, sort, **Cetak Label & Barcode** per eksemplar, transfer penerbit (dedupe)
- **Transaksi**: Kunjungan, Peminjaman, Pengembalian, Buku Hilang — semua mendukung **barcode scanner**
- **Laporan**: Backup/Reset DB, **Grafik Kunjungan** (tahunan/bulanan), **Top Peminjam**, **Top Buku**, **Kas** (otomatis dari denda + manual)
- **Setting**: identitas perpustakaan + logo, teks kartu anggota, jatuh tempo, denda, kategori, kelas
- **Bilingual**: Indonesia / English (toggle di Settings)
- **Export Google Sheets** (manual): push semua data ke spreadsheet pribadi user di Google Drive
- **Build .exe Windows** dengan satu klik (`build.bat`)

---

## Persyaratan

- Python **3.11+**
- Windows / Linux / macOS untuk pengembangan
- Windows untuk build `.exe` final (PyInstaller cross-build tidak didukung)
- (Opsional) **IDAutomation HC39M Code 39** font untuk render barcode di label cetak

---

## Quick Start (Development)

```bash
# 1. Clone
git clone https://github.com/alviarts/perpustakaan-offline.git
cd perpustakaan-offline

# 2. Buat virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Jalankan aplikasi (DB + seed data otomatis dibuat saat pertama jalan)
python -m perpustakaan

# Atau dengan demo data (5 anggota + 10 buku + 2 peminjaman aktif)
# berguna untuk training / demo tanpa input data manual
python -m perpustakaan --demo
```

Database (SQLite) akan dibuat otomatis di:

- **Windows:** `%APPDATA%\PerpustakaanOffline\perpustakaan.db`
- **macOS:** `~/Library/Application Support/PerpustakaanOffline/perpustakaan.db`
- **Linux:** `~/.local/share/PerpustakaanOffline/perpustakaan.db`

**Login default:** `admin` / `admin123` (wajib diubah saat pertama kali login).

---

## Build ke `.exe` Windows

Jalankan di Windows:

```bat
build.bat
```

Hasil ada di `dist\PerpustakaanOffline.exe` — siap distribusi (single-file, ~40-60 MB termasuk semua dependency).

Atau manual:

```bash
pyinstaller build.spec --clean --noconfirm
```

---

## Struktur Project

```
perpustakaan-offline/
├── assets/                 # DDC reference, logo placeholder, font barcode
├── scripts/                # Init DB, migrasi, utilitas
├── src/perpustakaan/
│   ├── __main__.py         # entry: python -m perpustakaan
│   ├── app.py              # bootstrap aplikasi
│   ├── config.py           # path, default, konstanta
│   ├── i18n.py             # bilingual ID/EN
│   ├── db/                 # connection, schema.sql, seed
│   ├── models/             # CRUD per domain (anggota, buku, peminjaman, ...)
│   ├── services/           # auth, barcode, pdf, excel, sheets, report
│   └── gui/                # CustomTkinter views (login, dashboard, master, transaksi, laporan, settings)
├── tests/                  # pytest
├── .vscode/                # debug config + tasks
├── build.spec              # PyInstaller config
├── build.bat               # one-click build .exe (Windows)
├── pyproject.toml
├── requirements.txt
└── README.md
```

---

## Roadmap

Roadmap dikelompokkan ke dalam **4 jalur kerja paralel** supaya gampang diambil
sebagian-sebagian (oleh kontributor manusia maupun AI agent seperti Devin).
Tiap item bisa dikerjakan tanpa menunggu jalur lain selesai.

### Jalur A — Hardening & Validasi (highest ROI, ~1 hari)

Pastikan release yang sudah keluar benar-benar tahan dipakai user awam.

- [x] End-to-end smoke test: jalankan app di Xvfb, klik semua menu, verifikasi tiap CRUD + peminjaman + dashboard, dokumentasikan bug → `tests/test_smoke_gui.py` + `docs/smoke-test/REPORT.md`
- [x] Tambah **seed demo data** (5 anggota dummy + 10 buku dummy) di `src/perpustakaan/db/seed.py` flag `--demo`, sehingga user yang baru download bisa langsung coba alur peminjaman tanpa input data dulu
- [x] **Polish error handling** — banyak `try/except` yang masih silent; ganti jadi toast notification user-friendly via `gui/widgets.show_toast(...)`
- [x] **Auto-release workflow** — tambah job di `.github/workflows/ci.yml` yang trigger `on: push: tags: ['v*']` → otomatis bikin GitHub Release + upload `.exe` + installer. Tinggal `git tag v0.x.0 && git push --tags`
- [x] CI matrix tambahin Linux build (untuk distribusi non-Windows). macOS di-skip karena tkinter issues di GitHub Actions runner

### Jalur B — Lengkapi Fitur Skeleton (~2-3 hari)

Beberapa flow di v0.1 cuma ada di backend; UI-nya belum lengkap.

- [x] **UI Naik Kelas batch** — dialog mapping kelas lama → baru di toolbar Anggota (PR #9)
- [x] **Bebas Pustaka full flow** — validasi otomatis: blokir kalau ada peminjaman aktif (PR #10)
- [x] **Cetak Nota peminjaman/pengembalian dari UI** — prompt cetak nota PDF setelah simpan/proses (PR #11)
- [x] **Cek Data Ganda** — deteksi duplikat anggota (nama+kelas) dan buku (ISBN/judul+pengarang); UI di Settings → Tools (PR #12)
- [x] **Reminder jatuh tempo otomatis** — toast popup di dashboard saat login, list H+0 s/d H+3 (PR #13)
- [x] **Audit log viewer** — tab Audit Log di Settings: siapa-melakukan-apa-kapan dengan search (PR #14)

### Jalur C — Dokumentasi & Onboarding (~0.5 hari)

- [ ] **User manual** lengkap di `docs/manual.md` (bilingual ID/EN) dengan screenshot tiap menu
- [ ] **Setup guide Google Sheets** di `docs/google-sheets-setup.md` (langkah dapatkan `client_secret.json` dari Google Cloud Console)
- [ ] **Demo screencast** 3-5 menit (alur peminjaman end-to-end) di-attach ke release page
- [ ] **Quickstart** untuk pustakawan yang gak technical (1-pager PDF)
- [ ] **Inno Setup installer** (`installer/installer.iss`) — Windows installer dengan Setup wizard, Start Menu shortcut, registered uninstaller

### Jalur D — Fitur Lanjutan (~3-5 hari, opsional)

- [ ] **Opsi A: Sync 2-arah Google Sheets** — auto-sync background, conflict resolution last-write-wins by `updated_at`. Sebagai upgrade dari Opsi C yang sudah ada
- [ ] **Multi-perpustakaan / multi-cabang** — kalau sekolah punya >1 perpus
- [ ] **Mobile companion (PWA)** — siswa lihat status peminjaman sendiri, scan QR untuk pinjam mandiri
- [ ] **Backup terjadwal** — auto-backup harian/mingguan ke folder lokal atau cloud
- [ ] **Import dari SIM-Perpus.xlsb asli** — script konversi data lama → SQLite untuk migrasi user existing
- [ ] **Code signing certificate** — sign `.exe` supaya Windows Defender / SmartScreen tidak warning

### Versi yang sudah dirilis

| Versi | Tanggal | Highlights |
|-------|---------|-----------|
| **v0.3.0** | 2026-05-02 | feat(gui): UI Naik Kelas batch · feat(gui): Bebas Pustaka validasi peminjaman aktif · feat(gui): Cetak Nota di Peminjaman & Pengembalian · feat(gui): Cek Data Ganda (Settings → Tools) · feat(gui): Reminder jatuh tempo otomatis saat login · feat(gui): Audit Log viewer (Settings → Audit Log) |
| **v0.2.0** | 2026-05-02 | feat(seed): `--demo` flag untuk seed 5 anggota + 10 buku + 2 peminjaman aktif · feat(gui): toast notification non-blocking + exception reporter dengan log ke `app.log` · test: full GUI smoke test passed di Xvfb (17 test cases) · fix: StyledTreeview crash pada duplicate iid · ci: Linux build artifact ditambahkan ke release |
| **v0.1.1** | 2026-05-02 | docs: user manual + Google Sheets setup guide + Inno Setup installer |
| **v0.1.0** | 2026-05-02 | Initial scaffold lengkap, semua menu functional, DB SQLite + seed DDC, .exe Windows tersedia di [Releases](https://github.com/alviarts/perpustakaan-offline/releases) |

---

## Untuk Kontributor / AI Agent

Kalau kamu meneruskan kerjaan dari titik ini:

1. **Baca dulu** `docs/manual.md` (kalau sudah ada) atau eksplor `src/perpustakaan/` untuk paham struktur
2. **Pilih satu item** dari roadmap di atas (preferensi: Jalur A → B → C → D), atau buat issue baru
3. **Setup environment**: `python -m venv .venv && pip install -r requirements.txt`
4. **Run tests**: `pytest tests/ -q` (harus all green sebelum & sesudah perubahan)
5. **Lint**: `ruff check src/ tests/` (harus clean)
6. **Run app lokal**: `python -m perpustakaan` (login `admin` / `admin123`)
7. **PR** ke `main` dengan deskripsi yang jelas dan checkbox testing — CI di `.github/workflows/ci.yml` otomatis verify lint + pytest + Windows build
8. **Tag baru**: setelah merge, kalau perlu rilis: `git tag vX.Y.Z && git push --tags` lalu manual upload `.exe` ke Release page (auto-release workflow di Jalur A masih TODO)

Konvensi:
- Tanggal/waktu disimpan sebagai TEXT ISO-8601, uang INTEGER rupiah
- Kode anggota auto `A0001`, kode buku auto `B0001`, kode eksemplar `B0001-01`/`-02`/...
- DB path runtime: lihat `src/perpustakaan/config.py::_user_data_root()` (handles Windows/macOS/Linux)
- **JANGAN commit** `client_secret.json`, `token.json`, `*.db`, atau file binary apa pun

---

## Lisensi

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan didistribusikan.

## Credits

- **SIM-Perpus original** oleh Kang Sur (Excel + VBA)
- **DDC (Dewey Decimal Classification)** — public domain
- Built with [CustomTkinter](https://customtkinter.tomschimansky.com/), [ReportLab](https://www.reportlab.com/), [python-barcode](https://github.com/WhyNotHugo/python-barcode), [matplotlib](https://matplotlib.org/), [openpyxl](https://openpyxl.readthedocs.io/), [gspread](https://gspread.readthedocs.io/)
