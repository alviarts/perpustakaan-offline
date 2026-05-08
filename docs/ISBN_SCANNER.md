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

## Sumber Data (Cascade Fallback)
1. **Google Books API** (primary) - buku internasional & Indonesia
2. **Open Library API** (fallback) - unlimited requests
3. **Gramedia** (scraping) - buku Indonesia
4. **Tokopedia** (scraping) - buku Indonesia
5. **Shopee** (scraping) - buku Indonesia (mungkin tidak bekerja karena anti-bot)

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
- **International**: `9780306406157` (English book)
- **Indonesia**: `9786020633176` (Laskar Pelangi - Andrea Hirata)
- **Indonesia**: `9786024246945` (Bumi - Tere Liye)
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
- ✅ Cover image (auto-download ke `AppData/covers/`)

## Troubleshooting

### Webcam tidak terdeteksi:
- Pastikan browser/app punya permission akses kamera
- Gunakan mode "Input Manual" sebagai fallback

### Buku tidak ditemukan:
- Coba ISBN format lain (ISBN-10 vs ISBN-13)
- Coba cari manual di Google Books: https://books.google.com/
- Beberapa buku lokal Indonesia mungkin tidak ada di database internasional

### Gramedia/Tokopedia/Shopee tidak bekerja:
- Website ini pakai JavaScript rendering, scraping mungkin tidak selalu bekerja
- Gunakan Google Books atau Open Library sebagai alternatif
- Atau input manual data buku

## Technical Details

### Backend (Rust):
- `utils/isbn.rs` - ISBN validation & conversion
- `services/isbn_lookup.rs` - Lookup service dengan cascade fallback
- `services/cover_downloader.rs` - Download & save cover images
- `commands/isbn.rs` - Tauri commands

### Frontend (React):
- `IsbnScannerModal.tsx` - Modal component dengan webcam scanner
- `@zxing/library` - Barcode scanner library

### Dependencies:
- **Rust**: `rqrr`, `scraper`, `regex`, `ureq`
- **Frontend**: `@zxing/library`, `@zxing/browser`
