# Quickstart 1-Pager — Perpustakaan Offline v0.3.0

> **Untuk pustakawan**: panduan singkat install + alur harian. Tidak butuh tahu komputer secara teknis.
> Versi PDF: [`quickstart.pdf`](./quickstart.pdf).

---

## 1. Install (sekali saja)

1. Download **`PerpustakaanOffline-Setup-v0.3.0.exe`** dari halaman rilis:
   <https://github.com/alviarts/perpustakaan-offline/releases>
2. Klik 2x file `.exe` → klik **Yes** di dialog Windows → **Next** → **Install**
3. Setelah selesai, ada shortcut **"Perpustakaan Offline"** di Desktop. Klik 2x untuk buka.

---

## 2. Login Pertama Kali

| Field | Isi |
|-------|-----|
| Username | `admin` |
| Password | `admin123` |

> **Wajib ganti password setelah login pertama**: Settings → Manajemen Akun → klik admin → "Ubah Password".

---

## 3. Alur Harian — Peminjaman

1. Klik menu **Peminjaman** di kiri
2. Ketik / scan **kode anggota** (mis `A0001`) → Enter
3. Ketik / scan **kode buku** (mis `B0010`) → klik **Tambah Item** (boleh > 1 buku)
4. Atur **tanggal jatuh tempo** (default: 7 hari dari sekarang)
5. Klik **Simpan**
6. Dialog muncul: **"Cetak nota peminjaman?"**
   - **Ya, Cetak** → PDF nota tersimpan di `exports/` dan otomatis terbuka untuk dicetak
   - **Tidak** → transaksi tetap tersimpan, hanya skip nota

---

## 4. Alur Harian — Pengembalian

1. Klik menu **Pengembalian** di kiri
2. Ketik **kode peminjaman** atau **kode anggota** → Enter → list buku peminjaman muncul
3. Centang buku yang dikembalikan → klik **Simpan Pengembalian**
4. Kalau telat: **denda otomatis dihitung** (per hari, sesuai pengaturan di Settings → Transaksi)
5. Dialog: **"Cetak nota pengembalian?"** → pilih sesuai kebutuhan

---

## 5. Cetak

Menu **Setting → Cetak**: **KTA** (kartu siswa + barcode), **Label Barcode** buku (Code 128), **Surat Bebas Pustaka**. Plus **Nota peminjaman/pengembalian** (auto setelah simpan, lihat #3 & #4). Output PDF → folder `exports/`.

## 6. Backup Rutin (PENTING)

**Setting → Manajemen Akun → Backup Database** → file `.zip` di folder `backups/` → **copy ke flashdisk / Google Drive** tiap akhir minggu. Restore: **Restore dari Backup** → pilih `.zip`.

## 7. Lokasi Data

| OS | Folder |
|----|--------|
| Windows | `%APPDATA%\PerpustakaanOffline\` |
| macOS | `~/Library/Application Support/PerpustakaanOffline/` |
| Linux | `~/.local/share/PerpustakaanOffline/` |

Isi: `perpustakaan.db` (database SQLite), `backups/`, `exports/`, `photos/`, `covers/`.

## 8. Bantuan

Manual lengkap: <https://github.com/alviarts/perpustakaan-offline/blob/main/docs/manual.md> · Demo video: `docs/demo/perpustakaan-offline-v0.3.0-demo.mp4` (~4 menit) · Setup sync Google Sheets (opsional): [`docs/google-sheets-setup.md`](./google-sheets-setup.md) · Lapor bug: <https://github.com/alviarts/perpustakaan-offline/issues>

*Quickstart v0.3.0 — alviarts/perpustakaan-offline*
