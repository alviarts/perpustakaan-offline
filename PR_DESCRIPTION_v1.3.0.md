# 📚 v1.3.0: Import Buku via ISBN dengan Webcam Scanner

## 🎯 Overview

Fitur baru untuk **import buku otomatis via ISBN** dengan webcam scanner atau input manual. Mendukung lookup metadata dari berbagai sumber (Google Books, Open Library, Gramedia, Tokopedia, Shopee) dengan cascade fallback.

## ✨ Features

### 1. ISBN Scanner Modal
- ✅ **Webcam Scanner**: Scan barcode ISBN menggunakan webcam (`@zxing/library`)
- ✅ **Manual Input**: Fallback jika kamera tidak tersedia
- ✅ **ISBN Validation**: Support ISBN-10 & ISBN-13 dengan auto-convert
- ✅ **Metadata Preview**: Tampilkan judul, pengarang, penerbit, tahun, deskripsi, kategori, cover
- ✅ **Auto-fill Form**: Klik "Gunakan Data Ini" → form buku ter-isi otomatis

### 2. Multi-Source Lookup (Paralel, ~15 sumber keyless)
Semua sumber di-query **bersamaan**, lalu kandidat digabung dengan skor
kualitas (katalog otoritatif menang; field kosong diisi dari kandidat lain).

**Katalog:** Perpusnas (registry ISBN Indonesia), Google Books (+HTML
fallback), Open Library, Onesearch.id, Crossref, archive.org, LIBRIS,
K10plus, NDL Japan, Inventaire.io.

**Toko buku (pelengkap + harga referensi):** Periplus, Belbuk,
Deepublish Store, AbeBooks.

Dibuang: Gramedia/Shopee/isbnsearch (terbukti SPA di balik Cloudflare — tidak
terbaca lewat HTTP biasa). Pendekatan diadaptasi dari riset `scrape-demo`.

### 3. ISBN Utilities
- ✅ Validasi ISBN-10 & ISBN-13 dengan checksum
- ✅ Normalisasi (hapus hyphen, spasi, uppercase)
- ✅ Konversi ISBN-10 ↔ ISBN-13
- ✅ Auto-detect ISBN type

### 4. Cover Image Downloader
- ✅ Download cover dari URL
- ✅ Auto-convert ke JPEG (compressed)
- ✅ Simpan di `AppData/uploads/buku/` (path **relatif**, konsisten dengan upload manual)
- ✅ Skip jika sudah ada
- ✅ Preview di modal & OPAC dirender via `readDataUrl` (data URL) — andal di Windows

## 📸 Screenshots

### ISBN Scanner Modal
![ISBN Scanner Modal](docs/screenshots/isbn-scanner-modal.png)

### Webcam Scanner
![Webcam Scanner](docs/screenshots/isbn-webcam-scanner.png)

### Metadata Preview
![Metadata Preview](docs/screenshots/isbn-metadata-preview.png)

### Auto-fill Form
![Auto-fill Form](docs/screenshots/isbn-autofill-form.png)

## 🧪 Testing

### Test ISBNs:

**Indonesia** (→ Perpusnas):
- `9786233463034` - Filosofi Teras (Henry Manampiring)
- `9786022916628` - Laskar Pelangi original story (Andrea Hirata)

**Internasional** (→ Open Library / Google Books):
- `9780306406157` - Error-correction coding for digital communications
- `0306406152` - ISBN-10 format (auto-convert ke ISBN-13)

### Manual Testing Steps:
1. Build app: `pnpm tauri:dev`
2. Buka halaman Buku
3. Klik "Impor via ISBN"
4. Test dengan ISBN di atas
5. Verify metadata & cover preview
6. Klik "Gunakan Data Ini"
7. Verify form ter-isi otomatis

## 📦 Changes

### Backend (Rust)
- **New modules**:
  - `utils/isbn.rs` - ISBN validation & conversion
  - `services/isbn_lookup.rs` - Multi-source lookup service
  - `services/cover_downloader.rs` - Cover image downloader
  - `commands/isbn.rs` - Tauri commands

- **New dependencies**:
  - `rqrr@0.8` - Barcode decoder
  - `scraper@0.20` - HTML scraping
  - `regex@1.11` - ISBN validation

### Frontend (React + TypeScript)
- **New components**:
  - `IsbnScannerModal.tsx` - Modal dengan webcam scanner

- **Updated components**:
  - `BukuList.tsx` - Integrate ISBN scanner modal
  - `routes/_authed/buku/new.tsx` - Support pre-fill dari ISBN

- **New dependencies**:
  - `@zxing/library` - Barcode scanner
  - `@zxing/browser` - Browser integration

### Documentation
- `docs/ISBN_SCANNER.md` - Comprehensive guide

## ⚠️ Known Limitations

1. **Scraping Reliability**:
   - Gramedia/Tokopedia/Shopee pakai JavaScript rendering
   - Scraping HTML statis tidak selalu dapat data
   - Anti-bot protection bisa block request
   - **Solusi**: Google Books & Open Library sudah cukup reliable

2. **Rate Limiting**:
   - Google Books tanpa API key: ~100 req/day
   - Untuk perpustakaan besar, disarankan pakai API key (gratis 1000 req/day)

3. **Buku Lokal Indonesia**:
   - Tidak semua buku Indonesia ada di database internasional
   - Input manual tetap diperlukan untuk buku yang tidak ditemukan

## 🚀 Deployment

### Google Books API Key (Optional)
Untuk rate limit lebih tinggi:

1. Buka https://console.cloud.google.com/
2. Create project baru
3. Enable "Books API"
4. Create credentials (API Key)
5. Set environment variable:
   ```bash
   # Windows
   set GOOGLE_BOOKS_API_KEY=your_api_key_here
   
   # Linux/Mac
   export GOOGLE_BOOKS_API_KEY=your_api_key_here
   ```

## 📝 Commits

- `98b99ec` - feat(isbn): add ISBN scanner with webcam + auto-import book metadata
- `4f0f1d0` - feat(isbn): improve ISBN lookup with multiple sources + API key support
- `4015e3f` - docs: add CHANGELOG entry for v1.3.0

## 🔗 Related Issues

Closes #XXX (jika ada issue terkait)

## ✅ Checklist

- [x] Backend implementation (Rust)
- [x] Frontend implementation (React)
- [x] ISBN validation & conversion
- [x] Multi-source lookup (5 sources)
- [x] Cover image downloader
- [x] Webcam scanner integration
- [x] Manual input fallback
- [x] Auto-fill form integration
- [x] Documentation
- [x] CHANGELOG entry
- [ ] Manual testing with real ISBNs
- [ ] Screenshots for PR
- [ ] Code review
- [ ] Merge to main

## 📚 Documentation

Full documentation: [docs/ISBN_SCANNER.md](docs/ISBN_SCANNER.md)

---

**Ready for review!** 🎉
