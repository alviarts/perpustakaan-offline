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

| Versi | Fokus |
|-------|-------|
| **v0.1** (sekarang) | Scaffold lengkap, CRUD anggota/buku, transaksi peminjaman/pengembalian, dashboard, settings dasar |
| **v0.2** | Cetak KTA + Label Barcode + Invoice (PDF), import Excel, grafik kunjungan, laporan kas |
| **v0.3** | Bebas Pustaka, Naik Kelas, Kunjungan Kelas, cek data ganda, reminder jatuh tempo |
| **v0.4** | Manual export ke Google Sheets (Opsi C) |
| **v0.5** | Auto 2-way sync ke spreadsheet pribadi user (Opsi A) — opsional |
| **v1.0** | Polish UI, multi-bahasa lengkap, dokumentasi user manual |

---

## Lisensi

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan didistribusikan.

## Credits

- **SIM-Perpus original** oleh Kang Sur (Excel + VBA)
- **DDC (Dewey Decimal Classification)** — public domain
- Built with [CustomTkinter](https://customtkinter.tomschimansky.com/), [ReportLab](https://www.reportlab.com/), [python-barcode](https://github.com/WhyNotHugo/python-barcode), [matplotlib](https://matplotlib.org/), [openpyxl](https://openpyxl.readthedocs.io/), [gspread](https://gspread.readthedocs.io/)
