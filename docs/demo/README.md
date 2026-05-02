# Demo Screencast — Perpustakaan Offline v0.3.0

Demo singkat (~4 menit) memperlihatkan alur lengkap aplikasi:

1. **Dashboard** — KPI ringkasan + reminder jatuh tempo otomatis (fitur v0.3.0)
2. **Master Anggota** — daftar siswa + tambah anggota baru
3. **Master Buku** — katalog buku + tambah buku baru
4. **Peminjaman** — alur transaksi + dialog konfirmasi cetak nota (fitur v0.3.0)
5. **Pengembalian** — denda otomatis + cetak nota
6. **Naik Kelas batch** (fitur v0.3.0) — mapping kelas lama → kelas baru di awal tahun ajaran
7. **Settings → Tools → Cek Data Ganda** (fitur v0.3.0) — deteksi anggota & buku duplikat
8. **Settings → Audit Log** (fitur v0.3.0) — riwayat aktivitas dengan search

## File

- [`perpustakaan-offline-v0.3.0-demo.mp4`](./perpustakaan-offline-v0.3.0-demo.mp4) — video MP4, 1280×800, ~4 menit, ~1 MB

## Reproduce

Demo direkam otomatis pakai **Xvfb + ffmpeg + customtkinter** dari script
`scripts/record_demo_screencast.py`. Cara jalankan ulang:

```bash
# 1. Pastikan Xvfb + ffmpeg + ImageMagick + fluxbox terinstall
sudo apt-get install -y xvfb ffmpeg imagemagick fluxbox

# 2. Start Xvfb di display :77
Xvfb :77 -screen 0 1280x800x24 &
DISPLAY=:77 fluxbox &

# 3. Jalankan script
DISPLAY=:77 XDG_DATA_HOME=/tmp/perpus-demo \
    .venv/bin/python scripts/record_demo_screencast.py

# 4. Output di docs/demo/perpustakaan-offline-v0.3.0-demo.mp4
```

Script:
- Initialize fresh demo database (`--demo` mode)
- Seed tambahan duplikat anggota/buku dan audit log entries
- Login admin programmatically
- Drive UI lewat method calls (tanpa simulasi click) sambil capture caption banner di overlay
- Stop ffmpeg dengan SIGINT supaya MP4 ter-finalize dengan benar

## Catatan

- Format **MP4 H.264 + faststart** supaya streamable di GitHub markdown preview
- Bitrate dijaga rendah (CRF 28) supaya file kecil — UI screen mostly statis,
  tidak perlu kualitas tinggi
- Display 1280×800 = match Xvfb config standard repo ini
