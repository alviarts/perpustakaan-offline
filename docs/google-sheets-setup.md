# Setup Google Sheets Sync (Opsional)

> **EN summary at the bottom.**

Aplikasi Perpustakaan Offline 100% offline by default. Fitur **Sync ke Google Sheets**
ini opsional — gunakan kalau kamu mau:

- **Backup cloud** semua data ke Drive pribadi (otomatis tersimpan di Google selamanya)
- **View di browser** — kepala sekolah bisa lihat laporan via spreadsheet di HP/laptop tanpa install apa-apa
- **Sharing** dengan guru/staff lain via Google Drive permission

Mode saat ini (v0.1): **manual export one-way** (Aplikasi → Sheets). Sync 2-arah otomatis
direncanakan di v0.5.

---

## Apa yang Kamu Butuhkan

- Akun Google (gratis) — bisa pakai akun pribadi atau akun sekolah Google Workspace
- Akses ke Google Cloud Console (gratis, tidak perlu kartu kredit)
- Waktu setup: ~10 menit (sekali saja, tidak perlu diulang)

---

## Langkah 1: Buat Google Cloud Project

1. Buka https://console.cloud.google.com/
2. Login dengan akun Google
3. Di pojok kiri atas, klik dropdown project → **New Project**
4. Isi:
   - **Project name**: `Perpustakaan Offline` (atau bebas)
   - **Organization**: biarkan default (No organization untuk akun pribadi)
5. Klik **Create** → tunggu beberapa detik

---

## Langkah 2: Aktifkan Google Sheets API + Drive API

1. Pastikan project yang baru dibuat ter-pilih (lihat dropdown atas)
2. Buka menu hamburger (≡) → **APIs & Services** → **Library**
3. Cari "Google Sheets API" → klik → klik **Enable**
4. Balik ke Library, cari "Google Drive API" → klik → klik **Enable**

---

## Langkah 3: Setup OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Pilih **User Type**:
   - **External** (untuk akun pribadi gmail/proton/dll) — recommended
   - **Internal** (kalau kamu admin Google Workspace sekolah)
3. Klik **Create**

### App Information

| Field                    | Isi                                                |
|--------------------------|----------------------------------------------------|
| App name                 | `Perpustakaan Offline`                             |
| User support email       | Email kamu                                         |
| App logo                 | Boleh kosong / upload logo sekolah                 |
| Application home page    | `https://github.com/alviarts/perpustakaan-offline` |
| Authorized domains       | (kosong, untuk desktop app)                        |
| Developer contact email  | Email kamu                                         |

Klik **Save and Continue**.

### Scopes

1. Klik **Add or Remove Scopes**
2. Centang scope berikut:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
3. Klik **Update** → **Save and Continue**

### Test Users (untuk External)

1. Klik **Add Users**
2. Tambah email Google kamu sendiri (yang akan dipakai di aplikasi)
3. Bisa tambah email lain (mis email kepala sekolah, guru) — max 100 test user
4. Klik **Save and Continue**

> ℹ️ Selama app dalam mode "Testing", hanya email yang terdaftar di Test Users yang
> bisa login. Untuk publik, perlu submit verification ke Google (gratis tapi proses
> ~1-4 minggu). Untuk pemakaian internal sekolah, mode Testing sudah cukup.

---

## Langkah 4: Buat OAuth Credentials

1. **APIs & Services** → **Credentials**
2. Klik **+ Create Credentials** → **OAuth client ID**
3. **Application type**: **Desktop app**
4. **Name**: `Perpustakaan Offline Desktop`
5. Klik **Create**
6. Dialog muncul → klik **Download JSON**
7. File `client_secret_xxxxxxxxx.json` ter-download

---

## Langkah 5: Letakkan client_secret.json di Folder Aplikasi

1. **Rename** file ke persis `client_secret.json` (tanpa angka di belakang)
2. Pindahkan ke folder data aplikasi:

| OS       | Lokasi target                                                           |
|----------|-------------------------------------------------------------------------|
| Windows  | `%APPDATA%\PerpustakaanOffline\client_secret.json`                      |
| macOS    | `~/Library/Application Support/PerpustakaanOffline/client_secret.json`  |
| Linux    | `~/.local/share/PerpustakaanOffline/client_secret.json`                 |

> **Penting**: File ini **mengandung secret OAuth** (bukan password Google kamu, tapi
> credential aplikasi). Jangan upload ke GitHub atau share publik.

---

## Langkah 6: Login Pertama Kali di Aplikasi

1. Buka Perpustakaan Offline
2. **Setting → Sync / Export**
3. Klik **Login Google**
4. Browser otomatis terbuka → login dengan akun Google yang terdaftar di Test Users
5. Halaman warning "Google hasn't verified this app" → klik **Advanced** → **Go to Perpustakaan Offline (unsafe)**
   - Ini normal selama app belum verified Google
6. Klik **Continue** untuk grant permission ke Sheets + Drive
7. Halaman menampilkan kode → copy-paste ke aplikasi (atau aplikasi otomatis ambil)
8. Selesai — token disimpan di `token.json` (di folder data app)

> Setelah login pertama, token otomatis ter-refresh tiap kali expired. Kamu tidak
> perlu login ulang kecuali ganti akun Google.

---

## Langkah 7: Push Data ke Spreadsheet

1. **Setting → Sync / Export → Push ke Google Sheets**
2. Aplikasi akan:
   - Bikin spreadsheet baru di Drive kamu (judul: `Perpustakaan Offline - YYYY-MM-DD`)
   - Upload semua tabel (anggota, buku, peminjaman, pengembalian, kunjungan, kas) ke sheets terpisah
   - Tampilkan link spreadsheet → klik untuk buka di browser
3. URL spreadsheet juga otomatis disimpan di Setting (untuk push ulang ke spreadsheet yang sama)

---

## Push Berikutnya (Update Spreadsheet)

Setelah push pertama, Setting → Sync / Export akan menampilkan:
- URL spreadsheet
- Tombol **Push Update** — overwrite isi spreadsheet dengan data terbaru
- Tombol **Buat Spreadsheet Baru** — bikin spreadsheet baru (untuk arsip / snapshot)

---

## Sharing Spreadsheet

Setelah push:
1. Buka URL spreadsheet di browser
2. Klik tombol **Share** di pojok kanan atas
3. Tambah email kepala sekolah / guru → pilih permission **Viewer** (read-only) atau **Editor**
4. Mereka bisa langsung lihat data via browser, tanpa install aplikasi

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

Pastikan kamu pilih **Desktop app** saat bikin OAuth Client di Langkah 4.
Kalau salah pilih (misal Web app), hapus credential dan ulang.

### "Access blocked: This app's request is invalid"

Pastikan:
- Email yang kamu pakai login sudah terdaftar di Test Users (Langkah 3)
- App di mode **Testing** (bukan **In production**)

### "Token expired" / login terus-menerus

Hapus `token.json` di folder data → login ulang dari aplikasi.

### "API has not been enabled"

Pastikan Sheets API + Drive API sudah enabled (Langkah 2).

### Push gagal "quota exceeded"

Free tier Google Sheets API: 300 requests / minute / project. Untuk perpustakaan
sekolah biasa, tidak akan kena limit. Kalau push data sangat besar (>10rb baris)
sekaligus, kasih jeda atau split.

---

## Pertanyaan Umum

**Q: Apa data perpustakaan kena charge Google?**  
A: Tidak. Google Sheets + Drive gratis untuk akun personal sampai **15 GB** total. 1 spreadsheet sekolah biasa < 1 MB.

**Q: Apa data aman?**  
A: Data tersimpan di Drive **akun Google kamu** — tidak dilihat siapa pun kecuali kamu share. App-nya sendiri tidak punya akses ke akun Google kamu.

**Q: Kalau ganti komputer, apa data hilang?**  
A: Data lokal aplikasi tetap di komputer lama. Tapi spreadsheet di Drive tetap accessible dari mana saja. Untuk migrasi data lokal, lihat bab "Pindah Komputer" di [manual.md](manual.md).

**Q: Kalau saya edit di spreadsheet, apa otomatis sync ke aplikasi?**  
A: Belum (v0.1 hanya 1-arah: app → Sheets). Untuk 2-arah, tunggu v0.5 (Opsi A di [roadmap](../README.md#roadmap)).

**Q: Bisa pakai akun Google Workspace sekolah?**  
A: Bisa. Saat OAuth consent screen pilih **Internal** kalau kamu admin Workspace. Atau **External** kalau bukan admin (akun Workspace tetap bisa login).

---

# 🇬🇧 English Quick Reference

## What you need
- Google account (free)
- ~10 minutes for setup

## Steps
1. Go to https://console.cloud.google.com/, create project "Perpustakaan Offline"
2. Enable **Google Sheets API** + **Google Drive API** in the API Library
3. Configure **OAuth consent screen** (External, add scopes `spreadsheets` + `drive.file`, add your email as test user)
4. Create **OAuth client ID** (type: Desktop app), download JSON
5. Rename JSON to `client_secret.json`, place in app data folder:
   - Windows: `%APPDATA%\PerpustakaanOffline\`
   - macOS: `~/Library/Application Support/PerpustakaanOffline/`
   - Linux: `~/.local/share/PerpustakaanOffline/`
6. In app: **Setting → Sync / Export → Login Google** (browser opens, grant access)
7. **Push to Google Sheets** — creates a new spreadsheet in your Drive with all data

## Notes
- Free tier is more than enough for school libraries
- Data stays in your own Drive — neither the app nor the developer can access it
- One-way only in v0.1 (app → Sheets). Two-way auto-sync planned for v0.5.

## Need help?
[GitHub Issues](https://github.com/alviarts/perpustakaan-offline/issues)
