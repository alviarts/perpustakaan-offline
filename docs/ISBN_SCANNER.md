# ISBN Scanner Feature

## Overview
Import buku otomatis via ISBN dengan webcam scanner atau input manual. Mendukung lookup metadata dari berbagai sumber.

## 🎓 Interactive Tutorial

**First-time users**: Tutorial interaktif akan otomatis muncul saat pertama kali membuka halaman Buku. Tutorial ini akan memandu kamu step-by-step cara menggunakan ISBN Scanner.

**Replay tutorial**: Klik tombol **"Tutorial ISBN"** di halaman Buku untuk menonton ulang tutorial.

## 🎥 Video Tutorial

Untuk panduan visual, lihat animated GIF demo di bawah (coming soon):
- **Scan Barcode**: Demo scan barcode dengan webcam
- **Input Manual**: Demo input ISBN manual

> **Note**: Untuk membuat GIF tutorial sendiri, lihat panduan lengkap di [SCREENTOGIF_GUIDE.md](./SCREENTOGIF_GUIDE.md)

## Sumber Data (Multi-Source Paralel)

Semua sumber di-query **bersamaan** (paralel), lalu kandidat terbaik dipilih
berdasarkan skor kualitas dan field yang kosong diisi dari kandidat lain.
Semua sumber **keyless** (tanpa API key).

**Katalog otoritatif**
1. **Perpusnas** — registry ISBN Indonesia (otoritatif untuk buku lokal)
2. **Perpustakaan Jakarta (JAKLITERA)** — katalog DKI Jakarta; mencari via `keyword=<ISBN>` lalu mem-parse halaman detail (judul, pengarang, penerbit, tahun, halaman, subjek, sinopsis, **cover asli**)
3. **Perpustakaan Darul Ilmi (SLiMS)** — mencari via `search=search&isbn=<ISBN ber-hyphen>` lalu mem-parse meta Dublin Core (judul, pengarang, penerbit, halaman, subjek, bahasa, **DDC dari kolom Classification/Call Number**, cover)
4. **Google Books** — buku internasional & Indonesia
5. **Open Library** — katalog global + cover

**Bibliografis / akademik**
6. **Onesearch.id** — agregat perpustakaan Indonesia
7. **Crossref** — buku akademik ber-DOI
8. **archive.org**, **LIBRIS** (Swedia), **K10plus** (Jerman), **NDL** (Jepang), **Inventaire.io**

**Toko buku (pelengkap + harga referensi)**
9. **Periplus**, **Belbuk**, **Deepublish Store**, **AbeBooks**

> Catatan: Gramedia, Shopee, dan isbnsearch **tidak dipakai** karena semuanya
> SPA di balik Cloudflare/bot wall yang tidak bisa dibaca lewat HTTP biasa
> (sudah diuji di riset `scrape-demo`).

Sumber yang menang ditampilkan di preview ("Sumber: ..."), lengkap dengan
harga referensi bila berasal dari toko buku.

## Cara Pakai

### Desktop App:
1. Buka halaman **Buku**
2. Klik tombol **"Impor via ISBN"**
3. Pilih mode:
   - **Scan Barcode**: Arahkan webcam ke barcode ISBN di belakang buku
   - **Input Manual**: Ketik ISBN (10 atau 13 digit)
4. Tunggu loading → metadata buku muncul dengan preview cover
5. Klik **"Gunakan Data Ini"** → form buku ter-isi otomatis
6. Lengkapi data lain (kode buku, DDC, kategori, dll)
7. Simpan

### Test ISBNs:
- **Indonesia**: `9786233463034` (Filosofi Teras — Henry Manampiring) → JAKLITERA
- **Indonesia**: `9786236258255` (Masya Allah!!! … Ibunda Aisyah) → JAKLITERA
- **Indonesia**: `9786022916628` (Laskar Pelangi original story — Andrea Hirata) → Perpusnas
- **Internasional**: `9780306406157` (Error-correction coding...) → Open Library
- **ISBN-10**: `0306406152` (akan auto-convert ke ISBN-13)

## Google Books API Key (Optional)

Untuk rate limit lebih tinggi (1000 req/day), set environment variable:

```bash
# Windows
set GOOGLE_BOOKS_API_KEY=your_api_key_here

# Linux/Mac
export GOOGLE_BOOKS_API_KEY=your_api_key_here
```

Cara dapat API key:
1. Buka https://console.cloud.google.com/
2. Create project baru
3. Enable "Books API"
4. Create credentials (API Key)
5. Copy API key

Tanpa API key: ~100 requests/day (cukup untuk perpustakaan kecil)

## Metadata yang Di-import:
- ✅ ISBN
- ✅ Judul buku
- ✅ Pengarang
- ✅ Penerbit
- ✅ Tahun terbit
- ✅ Deskripsi
- ✅ Jumlah halaman
- ✅ Kategori
- ✅ Bahasa
- ✅ Cover image (auto-download ke `AppData/uploads/buku/`, disimpan sebagai path relatif)
- ✅ Harga referensi (bila tersedia dari toko buku)

## Troubleshooting

### Webcam tidak terdeteksi:
- Pastikan browser/app punya permission akses kamera
- Gunakan mode "Input Manual" sebagai fallback

### Buku tidak ditemukan:
- Coba ISBN format lain (ISBN-10 vs ISBN-13)
- Coba cari manual di Google Books: https://books.google.com/
- Beberapa buku lokal Indonesia mungkin tidak ada di database internasional

### Buku lokal Indonesia tidak ditemukan:
- Registry Perpusnas adalah sumber utama untuk buku Indonesia — pastikan ISBN-nya benar
- Coba ISBN format lain (ISBN-10 vs ISBN-13)
- Beberapa buku sangat lama/self-published mungkin tidak ada di sumber mana pun → input manual

## Technical Details

### Backend (Rust):
- `utils/isbn.rs` - ISBN validation & conversion
- `services/isbn_lookup.rs` - Mesin multi-sumber paralel (15 sumber) + merge/scoring
- `services/cover_downloader.rs` - Download & save cover images
- `commands/isbn.rs` - Tauri commands

### Frontend (React):
- `IsbnScannerModal.tsx` - Modal component dengan webcam scanner
- `@zxing/library` - Barcode scanner library

### Dependencies:
- **Rust**: `rqrr`, `scraper`, `regex`, `ureq`
- **Frontend**: `@zxing/library`, `@zxing/browser`
