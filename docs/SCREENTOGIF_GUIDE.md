# 📹 Panduan Recording GIF untuk ISBN Scanner

Panduan ini akan membantu kamu membuat animated GIF tutorial untuk fitur ISBN Scanner menggunakan **ScreenToGif**.

---

## 🎯 Tujuan

Membuat GIF demo yang menunjukkan:
1. Cara membuka ISBN Scanner
2. Scan barcode atau input manual
3. Preview metadata buku
4. Auto-fill form buku

**Target**: GIF ~2-5 MB, durasi 10-20 detik, smooth & jelas.

---

## 📥 Download & Install ScreenToGif

### Download
- **Website**: https://www.screentogif.com/
- **Direct Download**: https://github.com/NickeManarin/ScreenToGif/releases/latest
- **File**: `ScreenToGif.2.x.x.Portable.zip` (portable, no install needed)

### Extract & Run
1. Extract ZIP ke folder (misal: `C:\Tools\ScreenToGif`)
2. Jalankan `ScreenToGif.exe`
3. Pilih **"Recorder"** dari menu utama

---

## 🎬 Recording Steps

### 1. Persiapan
- **Buka aplikasi Perpustakaan** (`pnpm tauri:dev`)
- **Navigate ke halaman Buku** (pastikan sudah login)
- **Resize window** ke ukuran yang pas (jangan terlalu besar, ~1280x720 ideal)
- **Tutup aplikasi lain** yang tidak perlu (minimize distraction)

### 2. Setup ScreenToGif Recorder
1. Klik **"Recorder"** di ScreenToGif
2. **Posisikan frame** di sekitar area yang ingin direkam:
   - Fokus ke area modal ISBN Scanner
   - Atau full window aplikasi (jika ingin show context)
3. **Set FPS**: 15-20 FPS (balance antara smooth & file size)
   - Klik icon ⚙️ (Settings) → **Recorder** → **Frame Rate**: `15`
4. **Ready to record!**

### 3. Recording Flow

#### **Demo 1: Scan Barcode** (15-20 detik)
**Script**:
1. ⏺️ **Start recording** (F7 atau klik tombol merah)
2. Klik tombol **"Impor via ISBN"**
3. Pilih **"Scan Barcode"**
4. Tunjukkan barcode ke webcam (atau gunakan test image)
5. Tunggu sampai barcode terdeteksi (~2 detik)
6. **Preview metadata** muncul (pause 2-3 detik, biar user bisa lihat)
7. Klik **"Gunakan Data Ini"**
8. Form buku ter-isi otomatis (pause 2 detik)
9. ⏹️ **Stop recording** (F8 atau klik tombol stop)

#### **Demo 2: Input Manual** (10-15 detik)
**Script**:
1. ⏺️ **Start recording**
2. Klik tombol **"Impor via ISBN"**
3. Pilih **"Input Manual"**
4. Ketik ISBN: `9780306406157` (atau ISBN lain)
5. Klik **"Cari Buku"**
6. **Preview metadata** muncul (pause 2-3 detik)
7. Klik **"Gunakan Data Ini"**
8. Form buku ter-isi otomatis (pause 2 detik)
9. ⏹️ **Stop recording**

### 4. Editing di ScreenToGif

Setelah recording selesai, ScreenToGif akan otomatis buka **Editor**.

#### **A. Trim Awal & Akhir**
- Hapus frame yang tidak perlu di awal/akhir
- **Select frames** → klik frame pertama/terakhir yang mau dihapus
- Tekan **Delete** atau klik icon 🗑️

#### **B. Resize (Optional)**
- Menu: **Image** → **Resize**
- **Width**: 800-1000px (maintain aspect ratio)
- **Apply**

#### **C. Add Text Overlay (Optional)**
**Untuk highlight action penting**:
1. Select frame yang mau dikasih text
2. Menu: **Image** → **Caption** atau **Watermark**
3. Ketik text: "Klik Impor via ISBN", "Scan Barcode", dll
4. Atur posisi & style
5. **Apply**

#### **D. Adjust Speed (Optional)**
**Untuk slow-motion di bagian penting**:
1. Select frame yang mau di-slow
2. Menu: **Edit** → **Change Speed**
3. Set **Delay**: 100-200ms (default 66ms untuk 15 FPS)
4. **Apply**

#### **E. Loop Settings**
- Menu: **Playback** → **Loop**
- Set **Forever** (GIF akan loop terus)

### 5. Export GIF

#### **Optimize untuk File Size**
1. Menu: **File** → **Save As** → **Gif**
2. **Encoder**: Pilih **System.Drawing** (fast) atau **FFmpeg** (better quality)
3. **Settings**:
   - **Quality**: 80-90 (balance quality & size)
   - **Color Quantization**: **Octree** (best for screenshots)
   - **Detect Unchanged Pixels**: ✅ (reduce file size)
4. **Save** ke folder: `docs/assets/` atau `docs/images/`
5. **Filename**: `isbn-scanner-demo.gif` atau `isbn-manual-input.gif`

#### **Target File Size**
- **Ideal**: 2-3 MB
- **Max**: 5 MB (GitHub README limit: 10 MB, tapi lebih kecil lebih baik)

**Tips Reduce File Size**:
- Lower FPS (10-15 FPS)
- Resize to smaller width (800px)
- Shorter duration (10-15 detik)
- Remove unnecessary frames

---

## 📝 Storyboard & Script

### **GIF 1: ISBN Scanner - Scan Barcode**
**Duration**: ~15 detik  
**File**: `isbn-scanner-barcode.gif`

| Frame | Action | Duration | Notes |
|-------|--------|----------|-------|
| 1-10 | Hover & klik "Impor via ISBN" | 1s | Show button location |
| 11-20 | Modal muncul, pilih "Scan Barcode" | 1s | Highlight mode selection |
| 21-40 | Webcam preview, scan barcode | 2s | Show barcode detection |
| 41-60 | Metadata preview muncul | 2s | Pause untuk baca metadata |
| 61-80 | Scroll preview (judul, pengarang, cover) | 2s | Show all metadata fields |
| 81-100 | Klik "Gunakan Data Ini" | 2s | Highlight button |
| 101-120 | Form ter-isi otomatis | 2s | Show auto-fill result |
| 121-150 | Pause di form (show result) | 3s | Final state |

**Total**: ~150 frames @ 15 FPS = 10 detik

---

### **GIF 2: ISBN Scanner - Input Manual**
**Duration**: ~12 detik  
**File**: `isbn-scanner-manual.gif`

| Frame | Action | Duration | Notes |
|-------|--------|----------|-------|
| 1-10 | Klik "Impor via ISBN" | 1s | Quick open |
| 11-20 | Pilih "Input Manual" | 1s | Mode selection |
| 21-50 | Ketik ISBN: 9780306406157 | 3s | Show typing animation |
| 51-70 | Klik "Cari Buku" | 2s | Trigger lookup |
| 71-100 | Metadata preview muncul | 3s | Show result |
| 101-120 | Klik "Gunakan Data Ini" | 2s | Confirm action |

**Total**: ~120 frames @ 15 FPS = 8 detik

---

## 🎨 Best Practices

### Recording
- ✅ **Clean UI**: Tutup notifikasi, popup, atau distraction lain
- ✅ **Smooth mouse movement**: Jangan terlalu cepat, biar user bisa follow
- ✅ **Pause di key moments**: Beri waktu user untuk lihat hasil (2-3 detik)
- ✅ **Consistent speed**: Jangan terlalu lambat atau terlalu cepat

### Editing
- ✅ **Trim unnecessary frames**: Hapus loading screen, delay, atau error
- ✅ **Add text overlay** (optional): Highlight action penting
- ✅ **Loop seamlessly**: Pastikan frame terakhir connect ke frame pertama

### Export
- ✅ **Optimize file size**: Target 2-5 MB
- ✅ **Test playback**: Buka GIF di browser, pastikan smooth
- ✅ **Compress** (optional): Gunakan https://ezgif.com/optimize untuk compress lebih lanjut

---

## 📂 File Organization

```
docs/
├── ISBN_SCANNER.md              # User guide (text)
├── SCREENTOGIF_GUIDE.md         # This file (recording guide)
└── assets/
    ├── isbn-scanner-barcode.gif # Demo scan barcode
    ├── isbn-scanner-manual.gif  # Demo input manual
    └── isbn-scanner-preview.png # Screenshot preview metadata
```

---

## 🔗 Embed GIF di Markdown

Setelah GIF selesai, embed di `docs/ISBN_SCANNER.md`:

```markdown
## 🎥 Video Tutorial

### Scan Barcode
![ISBN Scanner - Scan Barcode](./assets/isbn-scanner-barcode.gif)

### Input Manual
![ISBN Scanner - Input Manual](./assets/isbn-scanner-manual.gif)
```

---

## 🛠️ Alternative Tools

Jika ScreenToGif tidak cocok, coba tools lain:

### **LICEcap** (Cross-platform)
- **Download**: https://www.cockos.com/licecap/
- **Pros**: Simple, lightweight, cross-platform
- **Cons**: Limited editing features

### **Peek** (Linux only)
- **Download**: https://github.com/phw/peek
- **Pros**: Native Linux, simple UI
- **Cons**: Windows/Mac tidak support

### **Kap** (macOS only)
- **Download**: https://getkap.co/
- **Pros**: Modern UI, plugin support
- **Cons**: macOS only

### **OBS Studio** (Advanced)
- **Download**: https://obsproject.com/
- **Pros**: Professional recording, streaming support
- **Cons**: Overkill untuk GIF sederhana, perlu convert MP4 → GIF

---

## 🎓 Tips & Tricks

### 1. **Use Test Data**
Siapkan test ISBN yang reliable:
- `9780306406157` - English book (always works)
- `9786020633176` - Laskar Pelangi (Indonesian)

### 2. **Mock Webcam** (Optional)
Jika tidak punya barcode fisik, gunakan:
- **OBS Virtual Camera**: Show barcode image sebagai webcam input
- **ManyCam**: Virtual webcam dengan image overlay

### 3. **Keyboard Shortcuts**
ScreenToGif shortcuts:
- **F7**: Start/Pause recording
- **F8**: Stop recording
- **F5**: Discard recording
- **Ctrl+Z**: Undo edit
- **Ctrl+S**: Save GIF

### 4. **Compress GIF**
Jika file size terlalu besar:
1. Upload ke https://ezgif.com/optimize
2. Set **Compression level**: 35-50
3. **Lossy GIF**: Enable (reduce colors)
4. Download compressed GIF

### 5. **Convert to WebM** (Optional)
WebM lebih kecil dari GIF (50-70% smaller):
```bash
# Using FFmpeg
ffmpeg -i isbn-scanner-demo.gif -c:v libvpx-vp9 -b:v 0 -crf 30 isbn-scanner-demo.webm
```

Embed di HTML:
```html
<video autoplay loop muted playsinline>
  <source src="./assets/isbn-scanner-demo.webm" type="video/webm">
  <img src="./assets/isbn-scanner-demo.gif" alt="Fallback GIF">
</video>
```

---

## ✅ Checklist

Sebelum publish GIF, pastikan:

- [ ] **Duration**: 10-20 detik (tidak terlalu panjang)
- [ ] **File size**: < 5 MB (ideally 2-3 MB)
- [ ] **Resolution**: 800-1200px width (readable tapi tidak terlalu besar)
- [ ] **FPS**: 10-15 FPS (smooth tapi efficient)
- [ ] **Loop**: Seamless loop (frame terakhir connect ke awal)
- [ ] **Content**: Clear, fokus ke fitur utama
- [ ] **No sensitive data**: Tidak ada data pribadi, password, atau token
- [ ] **Tested**: Playback smooth di browser (Chrome, Firefox, Edge)

---

## 🚀 Next Steps

Setelah GIF selesai:

1. **Save GIF** ke `docs/assets/`
2. **Update `docs/ISBN_SCANNER.md`** dengan embed GIF
3. **Commit & push** ke repo
4. **Test di GitHub**: Buka README/docs di GitHub, pastikan GIF load dengan baik
5. **Share**: Post di social media, blog, atau documentation site

---

## 📞 Troubleshooting

### **GIF terlalu besar (> 10 MB)**
- Lower FPS (10 FPS)
- Resize to 800px width
- Shorter duration (10 detik)
- Use ezgif.com optimizer

### **GIF tidak smooth**
- Increase FPS (20 FPS)
- Remove duplicate frames
- Use FFmpeg encoder (better quality)

### **GIF tidak loop**
- Check **Playback** → **Loop** → **Forever**
- Re-export dengan loop enabled

### **Barcode tidak terdeteksi saat recording**
- Gunakan test image barcode (print atau display di layar lain)
- Increase brightness/contrast
- Use mock webcam (OBS Virtual Camera)

---

**Happy Recording! 🎬**

Jika ada pertanyaan atau butuh bantuan, silakan buka issue di GitHub atau contact maintainer.
