# Manual Pengguna — Perpustakaan Nusantara

> **English version below** — scroll ke bawah untuk versi Bahasa Inggris.

Manual ini ditujukan untuk **pustakawan / operator** sekolah atau madrasah yang akan
menggunakan aplikasi sehari-hari, bukan untuk developer. Semua fitur dijelaskan
sesuai urutan menu di sidebar.

> Tip cetak: dokumen ini bisa dibuka di GitHub web, atau di-export ke PDF dengan
> `pandoc docs/manual.md -o manual.pdf`.

---

## Daftar Isi

1. [Instalasi & Jalankan Pertama Kali](#instalasi--jalankan-pertama-kali)
2. [Login & Akun](#login--akun)
3. [Tutorial Kontekstual & Toggle Tema](#tutorial-kontekstual--toggle-tema)
4. [Dashboard](#dashboard)
5. [Master Data — Anggota](#master-data--anggota)
6. [Master Data — Buku](#master-data--buku)
7. [Transaksi — Kunjungan](#transaksi--kunjungan)
8. [Transaksi — Peminjaman](#transaksi--peminjaman)
9. [Transaksi — Pengembalian](#transaksi--pengembalian)
10. [Laporan](#laporan)
11. [Setting](#setting)
12. [Audit Log Viewer](#audit-log-viewer)
13. [Backup, Reset, & Lokasi Data](#backup-reset--lokasi-data)
14. [Cetak (KTA, Label Barcode, Bebas Pustaka, Nota)](#cetak-kta-label-barcode-bebas-pustaka-nota)
15. [Troubleshooting](#troubleshooting)

---

## Instalasi & Jalankan Pertama Kali

Aplikasi v2 dibangun dengan **Tauri 2** — native installer (bukan PyInstaller .exe).
Download artefak terbaru dari [halaman Releases](https://github.com/alviarts/perpustakaan-offline/releases) sesuai sistem operasi.

### Windows

Tersedia **dua format installer**, pilih salah satu:

| Format | File                                              | Catatan                                                  |
|--------|---------------------------------------------------|----------------------------------------------------------|
| MSI    | `PerpustakaanNusantara_<versi>_x64_en-US.msi`       | Standar Windows Installer; cocok untuk deployment massal |
| NSIS   | `PerpustakaanNusantara_<versi>_x64-setup.exe`       | Wizard interaktif; cocok untuk install di 1 PC           |

1. Download salah satu file di atas dari halaman Releases
2. Klik 2x → ikuti wizard (Next → Next → Install)
3. Aplikasi terinstall ke `C:\Program Files\PerpustakaanNusantara\` (atau lokasi lain yang dipilih)
4. Shortcut otomatis dibuat di **Start Menu**
5. Klik shortcut **"PerpustakaanNusantara"** untuk menjalankan — saat pertama kali dibuka, database SQLite + seed data otomatis dibuat
6. Untuk uninstall: Control Panel → Programs → PerpustakaanNusantara → Uninstall

### Linux (Ubuntu/Debian)

1. Download `perpustakaan-offline_<versi>_amd64.deb` dari halaman Releases
2. Install: `sudo apt install ./perpustakaan-offline_<versi>_amd64.deb`
3. Jalankan dari menu aplikasi atau via terminal: `perpustakaan-offline`

### macOS

1. Download `PerpustakaanNusantara_<versi>_x64.dmg` (Intel) atau `_aarch64.dmg` (Apple Silicon)
2. Buka `.dmg` → drag aplikasi ke folder Applications
3. Buka via Launchpad atau Spotlight ("PerpustakaanNusantara")

### Catatan Windows Defender / SmartScreen

Karena installer belum kami sign dengan code signing certificate komersial, Windows mungkin menampilkan:

> Windows protected your PC

Klik **"More info"** → **"Run anyway"**. Ini normal untuk software open-source yang belum disigning.

### macOS Gatekeeper

Kalau muncul *"PerpustakaanNusantara can't be opened because Apple cannot check it for malicious software"*, klik kanan icon aplikasi → **Open** → konfirmasi **Open** sekali lagi. Setelah itu bisa dibuka normal.

---

## Login & Akun


**Login default pertama kali:**

| Field    | Nilai      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

> ⚠️ **WAJIB ganti password setelah login pertama** — pergi ke
> **Setting → Manajemen Akun → Ganti Password**.

### Daftar Akun Baru

Klik **"Daftar Akun Baru"** di layar login untuk register operator/pustakawan tambahan.
Akun pertama otomatis menjadi **administrator**; akun berikutnya berperan **operator**
(tidak bisa hapus akun lain atau reset DB).

---

## Tutorial Kontekstual & Toggle Tema

> Tutorial **tidak linear dari awal-akhir aplikasi**.
> Tiap menu punya **panduan sendiri** yang muncul otomatis hanya
> saat kamu pertama kali membuka menu itu.

### First-Run di Dashboard

Saat aplikasi pertama kali dibuka, akan muncul **welcome tour singkat di
Dashboard saja** (3 langkah: sambutan → kartu statistik → tombol `?`).
Setelah itu tour menutup; tutorial menu lain akan muncul otomatis saat
kamu mengunjungi menu itu pertama kali.

Kontrol di tiap popup:

- **Lewati** — tutup tour menu ini, tidak akan auto-muncul lagi.
- **Sebelumnya** — kembali ke step sebelumnya.
- **Berikutnya** — lanjut ke step selanjutnya.
- **Selesai** — di langkah terakhir; menutup tour.

### Tour Per Menu

Setiap menu di sidebar kiri punya tour kontekstual yang menjelaskan
tombol-tombol pentingnya:

| Menu          | Yang dijelaskan                                                                          |
|---------------|------------------------------------------------------------------------------------------|
| **Anggota**   | tambah / simpan, **Naik Kelas** batch, **Cetak KTA**, **Surat Bebas Pustaka**, **Import Excel** |
| **Buku**      | tambah / simpan, **Cetak Label & Barcode**, **Transfer Penerbit** (dedupe), **Import Excel** |
| **Kunjungan** | pilih anggota / scan kartu, kunjungan kelas batch, simpan                                |
| **Peminjaman**| **alur 4 langkah**: pilih anggota → cari buku → tambah item → simpan + cetak nota PDF    |
| **Pengembalian** | cari anggota, daftar pinjam aktif, **Pengembalian Normal** vs **Buku Hilang**          |
| **Laporan**   | tab-tab laporan, **Ekspor Excel**, grafik kunjungan / top peminjam / kas                 |
| **Setting**   | tab Identitas → KTA → Akun → Hak Akses → Aturan Peminjaman → Master Data → Tampilan → Bahasa → Backup → Sinkronisasi → Audit Log → Tentang (auto-switch tab) |

### Tombol "?" — Memutar Ulang Tutorial Kapan Saja

Di **pojok kanan atas window**, sebelahan kiri toggle tema, ada tombol
bulat berisi tanda **`?`**. Klik tombol ini kapan saja untuk **memutar
ulang tutorial menu yang sedang kamu buka**. Tombol selalu visible di
setiap menu.

### Mengulang Semua Tutorial Sekaligus

Buka **Setting → tab "Tampilan"** lalu klik tombol
**Mulai Ulang Semua Tutorial** di bagian bawah. Ini me-reset flag
`tutorial.<menu>.completed` untuk semua menu sehingga panduan kontekstual
auto-muncul lagi saat kamu mengunjungi tiap menu.

### Animasi & Visual Polish

- **Toast notification** kini meluncur masuk dari kanan (slide-in) dan keluar lagi saat hilang.
- **Popup tutorial** muncul dengan **fade-in lembut** dan **spotlight ring**
  (lingkaran indigo) yang menyorot tombol/widget yang sedang dijelaskan.
- **Sidebar** punya **indicator bar indigo** di item aktif supaya jelas menu mana yang sedang dibuka.
- **Kartu Dashboard** (Stat Card) punya efek **hover lift** halus dengan ikon dalam lingkaran berwarna.

### Toggle Tema (Sistem / Terang / Gelap)

Di **pojok kanan atas window** ada tombol segmented dengan 3 pilihan:

- **Sistem** — ikut setting OS (auto-switch siang/malam di Windows 10/11).
- **Terang** — paksa light mode.
- **Gelap** — paksa dark mode.

Tombol ini **selalu muncul di menu manapun** (Dashboard, Anggota, Buku,
Setting, dst.) sehingga kamu bisa ganti tema kapan saja tanpa harus
buka Setting. Pilihan disimpan di tabel `settings` (`ui.theme`) dan
diingat untuk sesi-sesi berikutnya.

---

## Dashboard


Tampilan ringkasan operasional perpustakaan saat ini:

| Card                     | Penjelasan                                                          |
|--------------------------|---------------------------------------------------------------------|
| **Total Anggota**        | Jumlah anggota aktif (siswa terdaftar)                              |
| **Total Buku**           | Jumlah judul unik (1 judul bisa punya banyak eksemplar)             |
| **Total Eksemplar**      | Jumlah copy fisik buku                                              |
| **Sedang Dipinjam**      | Eksemplar yang sedang keluar / belum dikembalikan                   |
| **Telah Dikembalikan**   | Total transaksi pengembalian sepanjang waktu                        |
| **Terlambat**            | Peminjaman yang lewat tanggal jatuh tempo dan belum dikembalikan    |
| **Buku Hilang**          | Eksemplar yang ditandai hilang (sudah ada ganti rugi atau belum)    |
| **Kunjungan Hari Ini**   | Jumlah catatan kunjungan untuk tanggal hari ini                     |
| **Saldo Kas**            | Akumulasi denda + transaksi kas manual                              |

**Tabel "Reminder Jatuh Tempo / Terlambat"** di bawah menampilkan peminjaman yang:
- Akan jatuh tempo dalam 3 hari ke depan (warning)
- Sudah terlambat (merah, dengan `sisa_hari` negatif)

### Reminder Otomatis Saat Login

Saat dashboard pertama kali ter-load setelah login, aplikasi akan otomatis menampilkan **toast notification** di pojok kanan bawah jika ada peminjaman yang:
- **Sudah terlambat** (overdue)
- **Jatuh tempo dalam 3 hari ke depan**

Contoh pesan: *"Reminder: 2 buku TERLAMBAT, 3 buku jatuh tempo dalam 3 hari."*

Reminder ini hanya muncul satu kali per sesi (saat dashboard dibuka pertama kali). Kalau ingin lihat ulang, klik tombol **Muat Ulang** di header dashboard.

Kolom tabel reminder:

| Kolom              | Penjelasan                                                  |
|--------------------|-------------------------------------------------------------|
| No. Pinjam         | Nomor unik transaksi peminjaman                             |
| Kode Anggota       | Mis `A0001`                                                 |
| Nama               | Nama lengkap peminjam                                       |
| Kode Buku          | Mis `B0003`                                                 |
| Judul              | Judul buku                                                  |
| Jatuh Tempo        | Tanggal seharusnya dikembalikan                             |
| Sisa Hari          | Negatif kalau sudah lewat (mis `-5` = terlambat 5 hari)     |

Klik **Muat Ulang** kalau ada perubahan di komputer lain (misal multi-user).

---

## Master Data — Anggota


### Tambah Anggota

1. Klik tombol **"Baru"** untuk reset form
2. Isi field minimal: **Nama Lengkap** + **Kelas**
3. **Kode Anggota** akan auto-generate (`A0001`, `A0002`, ...) — tidak perlu diisi manual
4. **Tanggal Lahir** format `YYYY-MM-DD` (mis `2010-08-15`)
5. **Foto (path)** — boleh kosong, atau pilih file via tombol **"Pilih Foto..."** (akan dicopy ke folder data app)
6. Klik **Tambahkan**

### Naik Kelas (Batch)


Fitur untuk **menaikkan kelas semua siswa secara batch** di awal tahun ajaran baru — tidak perlu edit satu-satu.

1. Di toolbar Master Anggota, klik tombol **Naik Kelas**
2. Dialog akan menampilkan daftar **semua kelas yang ada** (mis `VII A`, `VII B`, `VIII A`, ...)
3. Untuk setiap baris, isi **kelas baru** (mis `VII A` → `VIII A`)
4. Kelas yang **dibiarkan kosong** akan tetap (tidak diubah)
5. Untuk siswa kelas akhir (mis `IX A` di SMP, `XII IPA` di SMA), set kelas baru ke `Lulus` atau status keluar lainnya
6. Klik **Simpan** → konfirmasi → semua anggota di kelas tsb otomatis ter-update

> **Tip:** Backup database sebelum operasi batch (Laporan → Backup). Operasi naik kelas dijalankan dalam transaksi; kalau ada error di tengah, semua perubahan di-rollback otomatis.

### Edit Anggota

1. Klik baris di tabel kanan → form kiri otomatis terisi
2. Ubah field yang perlu
3. Tombol **Tambahkan** akan berubah jadi **Simpan** (otomatis)
4. Klik **Simpan**

### Hapus Anggota

1. Klik baris yang mau dihapus
2. Klik tombol merah di pojok form
3. Konfirmasi → anggota dipindah ke arsip (soft delete) — data lama tetap aman untuk laporan historis

### Import dari Excel

1. Klik **Template** untuk download contoh `.xlsx` dengan kolom yang benar
2. Isi data anggota di Excel (boleh ratusan baris)
3. Klik **Impor** → pilih file → preview → konfirmasi
4. Aplikasi akan skip baris dengan kode anggota duplikat dan kasih laporan

### Cetak KTA (Kartu Tanda Anggota)

1. Klik baris anggota
2. Klik **Cetak KTA** di toolbar
3. PDF KTA ukuran CR80 (kartu nama) terbuka — print di printer kartu PVC, atau cetak biasa lalu laminating

> Lihat [Cetak](#cetak-kta-label-barcode-bebas-pustaka) untuk detail layout & kustomisasi.

### Surat Bebas Pustaka

1. Klik baris anggota (biasanya siswa kelas 9 / 12 yang akan lulus)
2. Klik **Surat Bebas Pustaka**
3. Aplikasi cek: anggota tersebut **tidak punya peminjaman aktif**
4. Kalau lolos → PDF surat bebas pustaka (template resmi) — print
5. Kalau gagal → tampilkan list buku yang masih dipinjam → harus dikembalikan dulu

---

## Master Data — Buku


### Tambah Buku

1. Klik **Baru**
2. Isi field minimal: **Judul** + **Pengarang**
3. **Kode Buku** auto-generate (`B0001`, ...)
4. **Kode DDC** — pilih dari klasifikasi Dewey (sudah ter-seed 2.700+ entri saat install). Contoh: `510` = Matematika, `813` = Fiksi Amerika
5. **Jumlah Eksemplar** — berapa copy fisik tersedia (default 1). Sistem akan otomatis bikin entri `B0001-01`, `B0001-02`, dst di tabel `eksemplar`
6. **Harga (Rp)** — dipakai untuk hitung ganti rugi kalau hilang (default `Rp 50.000` bisa diubah di Setting → Transaksi)
7. **Cover (path)** — opsional, foto cover buku
8. Klik **Tambahkan**

### Transfer Penerbit (Dedupe)

Kalau di data ada banyak variasi nama penerbit (misal "Erlangga", "PT Erlangga", "Penerbit Erlangga") yang sebenarnya sama:

1. Klik **Transfer Penerbit**
2. Pilih nama "asli" yang dipakai → pilih nama "duplikat" yang akan dimerge
3. Konfirmasi → semua buku berpenerbit duplikat akan diubah ke yang asli

### Cetak Label & Barcode

1. Klik baris buku (atau Ctrl+klik beberapa baris untuk multi-select)
2. Klik **Cetak Label & Barcode**
3. PDF dengan grid 3×8 label per A4, masing-masing berisi judul + kode + barcode Code 39 — print di kertas label

> Untuk scan barcode: butuh barcode scanner USB biasa (~Rp 100k-300k). Scanner akan
> mengetik kode buku ke field input → cocok untuk peminjaman/pengembalian cepat.

---

## Transaksi — Kunjungan


Kunjungan = catatan siapa datang ke perpus (untuk laporan grafik kunjungan).

### Catat Kunjungan Individu

1. Scan barcode KTA siswa, atau ketik kode anggota → Enter
2. Otomatis tercatat dengan timestamp sekarang
3. Form reset → siap untuk siswa berikutnya

### Catat Kunjungan Kelas (Batch)

1. Klik **Kunjungan Kelas**
2. Pilih kelas (mis `VII A`)
3. Centang siswa yang hadir (semua tercentang default)
4. Klik **Simpan** → semua siswa tercentang masuk ke catatan kunjungan dengan timestamp sama

### Hapus Kunjungan

Klik baris di tabel → tombol **Hapus**. Jarang dipakai (biasanya kunjungan dibiarkan utuh untuk audit).

---

## Transaksi — Peminjaman


### Alur Peminjaman

1. **Cari Anggota**:
   - Scan barcode KTA, ATAU
   - Ketik kode anggota / nama → klik **Cari**
   - Data anggota muncul di panel kiri (nama, kelas, foto, jumlah peminjaman aktif)
2. **Tambah Buku**:
   - Scan barcode buku, ATAU
   - Ketik kode buku → klik **Tambah Item**
   - Buku masuk ke tabel kanan
3. Ulangi langkah 2 untuk buku ke-2, ke-3, dst (max sesuai setting `max_buku_per_anggota`, default 2)
4. **Tambah ke Kunjungan?** (checkbox) — kalau dicentang, otomatis catat kunjungan untuk anggota ini
5. Klik **Simpan**

### Validasi Otomatis

Sistem akan tolak peminjaman kalau:
- Anggota sudah punya peminjaman aktif >= max_buku_per_anggota
- Buku tidak punya eksemplar tersedia
- Anggota punya peminjaman terlambat (kecuali admin override di Setting)
- Anggota status non-aktif (sudah lulus, dll)

### Tanggal Jatuh Tempo

Otomatis = **tanggal pinjam + lama_pinjam_default** (default 7 hari, ubah di Setting → Transaksi).

---

## Transaksi — Pengembalian


### Alur Pengembalian

1. **Cari Anggota** (scan / ketik kode → Enter)
2. Tabel kanan otomatis ter-load semua peminjaman aktif anggota
3. Centang baris buku yang dikembalikan (atau scan barcode → otomatis tercentang)
4. Sistem hitung **Denda Otomatis** = `(hari_terlambat × denda_per_hari)`
   - default denda Rp 500/hari, ubah di Setting
5. Field **Bayar** — ketik jumlah yang dibayar siswa
6. Field **Catatan** — opsional (mis "buku rusak ringan", "potongan denda karena alasan X")
7. Klik **Simpan**

### Tandai Hilang

Kalau buku tidak dikembalikan dan dianggap hilang:

1. Klik baris peminjaman → klik **Tandai Hilang**
2. Sistem akan charge **harga ganti rugi** = harga buku (atau custom)
3. Kas otomatis tambah masukan
4. Eksemplar status berubah jadi `hilang`, total stok berkurang

---

## Laporan


### Tab "Backup / Reset"

| Tombol                            | Fungsi                                                                  |
|-----------------------------------|-------------------------------------------------------------------------|
| **Backup Database (.db)**         | Salin file `perpustakaan.db` ke folder `backup/` dengan timestamp       |
| **Ekspor Semua Data (.xlsx)**     | Export semua tabel ke 1 file `.xlsx`, 1 sheet per tabel (untuk arsip)   |
| **Reset Data Transaksi (aman)**   | Hapus peminjaman + kunjungan + kas, pertahankan data anggota & buku    |
| **Reset Total (HATI-HATI)**       | Hapus semua data, kembali ke kondisi seperti install pertama            |

> ⚠️ Selalu **Backup dulu** sebelum Reset.

### Tab "Grafik Kunjungan"


- Pilih **tahun** + **bulan** → grafik bar/line per hari
- Pilih hanya **tahun** → grafik per bulan (12 bar)
- Tombol **Ekspor PNG** untuk save grafik ke gambar

### Tab "Top Peminjam" / "Top Buku"


- Daftar anggota dengan jumlah peminjaman terbanyak (sortable)
- Daftar buku paling sering dipinjam
- Filter berdasarkan rentang tanggal

### Tab "Kas"

- List transaksi kas (auto dari denda + manual)
- Saldo akumulasi
- Tombol **Tambah Manual** untuk input pemasukan/pengeluaran custom (mis "beli rak buku Rp 1.500.000")

---

## Setting


### Tab "Identitas Perpustakaan"

| Field             | Penjelasan                                                       |
|-------------------|------------------------------------------------------------------|
| Nama Perpustakaan | Tampil di header KTA, surat, nota                                |
| Alamat            | Multi-line, tampil di surat resmi                                |
| Kepala Sekolah    | Untuk tanda tangan di surat bebas pustaka                        |
| NPSN              | Nomor Pokok Sekolah Nasional (opsional, tampil di surat)         |
| Tahun Ajaran      | Mis `2024/2025` — tampil di KTA                                  |
| Logo              | Path file logo (PNG/JPG) — akan tampil di kiri atas surat & KTA  |

### Tab "Kartu Anggota"

Customize teks & layout KTA: header, footer, font, ukuran. Preview real-time.

### Tab "Transaksi"

| Field                       | Default | Penjelasan                                            |
|-----------------------------|---------|-------------------------------------------------------|
| `lama_pinjam_default`       | 7       | Hari peminjaman default                               |
| `max_buku_per_anggota`      | 2       | Maksimal buku boleh dipinjam bersamaan                |
| `denda_per_hari`            | 500     | Rupiah per hari terlambat                             |
| `harga_ganti_rugi_default`  | 50000   | Default harga buku hilang (kalau buku tidak ada harga)|
| `boleh_pinjam_terlambat`    | false   | Boleh pinjam baru kalau ada terlambat?                |

### Tab "Manajemen Akun"

- List akun terdaftar
- Tombol **Daftar Baru**, **Edit**, **Reset Password**, **Hapus**
- **Ganti Password Saya** — wajib pakai ini setelah login pertama!

### Tab "Tampilan"

Atur **tema gelap/terang** dan **warna aksen UI**:

| Field   | Pilihan                                |
|---------|----------------------------------------|
| Tema    | `system` / `light` / `dark`            |
| Warna   | `blue` / `green` / `dark-blue`         |

Klik **Simpan** → UI berubah live tanpa restart.

Di bagian bawah ada tombol **Mulai Ulang Semua Tutorial** untuk reset flag
`tutorial.<menu>.completed` agar panduan kontekstual tiap menu auto-muncul lagi.

### Tab "Bahasa"

| Field   | Pilihan                                |
|---------|----------------------------------------|
| Bahasa  | `id — Indonesia` / `en — English`      |

Ubah bahasa di sini akan **switch UI live** tanpa restart — semua label, tombol,
dan toast notification ikut berganti.

### Tab "Hak Akses"

Untuk role-based access control (RBAC). Hanya akun **administrator** yang
bisa mengubah:

- **Per-akun permission grant/revoke**: tiap akun bisa diberi izin granular ke modul tertentu (Anggota CRUD, Buku CRUD, Peminjaman, Laporan, dll.)
- **Default role permissions**: konfigurasi default permission saat akun baru dibuat
- Saat user tidak punya izin ke suatu modul, menu di sidebar otomatis disembunyikan

### Tab "Master Data"

Kelola seed lookup tables yang dipakai di seluruh aplikasi:

| Lookup       | Penjelasan                                                  |
|--------------|-------------------------------------------------------------|
| Kelas        | Daftar kelas (mis. `7A`, `8B`, `XII IPA 1`)                 |
| Jurusan      | Daftar jurusan (mis. `IPA`, `IPS`, `Bahasa`)                |
| Agama        | Daftar agama (default: 6 agama resmi Indonesia)             |
| Kategori     | Kategori buku (Fiksi, Non-fiksi, Referensi, dll.)           |
| Penerbit     | Daftar penerbit (auto-grow saat input buku baru)            |
| DDC override | Override label klasifikasi DDC (Dewey Decimal Classification) |

Tambah / edit / hapus baris langsung di tabel.

### Tab "Backup"

Aplikasi bisa **otomatis membuat backup database SQLite** secara harian atau
mingguan ke folder lokal. File lama akan dihapus otomatis sesuai jumlah
retensi yang dipilih.

| Field          | Pilihan / Format                                            |
|----------------|-------------------------------------------------------------|
| Frekuensi      | `Mati` / `Harian` / `Mingguan`                              |
| Jam            | `HH:MM` 24-jam (mis. `02:00`)                               |
| Hari (mingguan)| `Senin` … `Minggu` — hanya muncul saat frekuensi mingguan   |
| Folder Tujuan  | Path folder; kosongkan untuk pakai folder backup default    |
| Retensi        | Jumlah file backup yang dipertahankan (sisanya dihapus)     |

Tombol:
- **Simpan Pengaturan** → menyimpan jadwal & folder, scheduler langsung memuat
  ulang konfigurasi tanpa restart aplikasi.
- **Backup Sekarang** → buat backup manual saat ini juga (juga di-prune sesuai
  retensi). Sukses/gagal akan tampil sebagai toast notification.
- **Buka Folder** → buka folder backup di File Explorer.

Status terbawah menampilkan **Backup terakhir** (timestamp + status sukses/
gagal) dan **Backup berikutnya** (perkiraan kapan scheduler akan jalan).
Daftar file backup tersimpan ditampilkan di tabel paling bawah lengkap dengan
ukuran & tanggal.

**Catatan operasional:**
- Scheduler berjalan di background daemon Tauri — backup hanya
  jalan saat aplikasi terbuka. Kalau jadwal terlewat (mis. PC dimatikan
  semalam), saat aplikasi dibuka lagi backup akan langsung dijalankan
  sebagai *catch-up*.
- Setiap operasi backup tercatat di **Audit Log** dengan aksi `backup_ok`
  atau `backup_failed`, lengkap dengan trigger (`scheduled` / `manual` /
  `catchup`) dan jumlah file lama yang ter-prune.

### Tab "Sinkronisasi"

> Placeholder untuk sinkronisasi data antar perangkat. Saat ini belum
> ada backend implementation — setting `lastSync` hanya di-update
> ke timestamp saat ini ketika tombol "Sinkronisasi Sekarang" diklik.
> Akan diisi di rilis mendatang.

### Tab "Audit Log"

Lihat bab terpisah: [Audit Log Viewer](#audit-log-viewer).

### Tab "Tentang"

Menampilkan **versi aplikasi**, **link repo GitHub**, dan **lisensi** —
berguna saat lapor bug supaya tahu versi yang dipakai.

---

## Audit Log Viewer


Fitur untuk **melihat riwayat aksi siapa-melakukan-apa-kapan**. Akses
lewat **Setting → tab Audit Log**.

### Yang Tercatat

| Kolom        | Penjelasan                                                       |
|--------------|------------------------------------------------------------------|
| **Waktu**    | Timestamp aksi (`YYYY-MM-DD HH:MM:SS`)                           |
| **User**     | Username operator (atau `—` kalau user sudah dihapus)            |
| **Aksi**     | `create` / `update` / `delete` / `login` / `naik_kelas` / dll   |
| **Entitas**  | Nama tabel yang di-affect (`anggota`, `buku`, `peminjaman`, ...) |
| **ID**       | ID record yang terkena aksi                                      |
| **Detail**   | JSON detail (mis nama anggota, judul buku, dst)                  |

### Search & Filter

- **Field cari**: ketik kata kunci → tekan Enter atau klik **Muat Ulang**
- Search match terhadap **Aksi**, **Entitas**, atau **Username** (case-insensitive substring)
- Contoh: ketik `delete` → tampilkan semua aksi delete; ketik `admin` → tampilkan semua aksi user `admin`
- Kosongkan field → tampilkan semua

### Use Case

- **Audit / kepala sekolah**: review aksi pustakawan harian/mingguan
- **Investigasi**: "siapa yang menghapus anggota X?" → search `delete anggota`
- **Compliance**: bukti aktivitas untuk laporan tahunan

> Audit log tidak bisa dihapus dari UI — by design untuk integritas. Untuk reset (mis akhir tahun ajaran), gunakan tools developer atau backup + reset DB.

---

## Backup, Reset, & Lokasi Data

### Lokasi Data

v2 menggunakan **Tauri app data directory** dengan bundle identifier
`id.alviarts.perpustakaan`:

| OS       | Path                                                              |
|----------|-------------------------------------------------------------------|
| Windows  | `%APPDATA%\id.alviarts.perpustakaan\`                             |
| macOS    | `~/Library/Application Support/id.alviarts.perpustakaan/`         |
| Linux    | `~/.local/share/id.alviarts.perpustakaan/`                        |

Isi folder:
```
id.alviarts.perpustakaan/
├── perpustakaan-v2.db     # database SQLite (semua data)
├── backup/                # auto-backup (.db dengan timestamp)
├── exports/               # output PDF, .xlsx, gambar
├── photos/                # foto anggota (di-copy saat upload)
└── covers/                # cover buku (di-copy saat upload)
```

> Untuk membuka folder ini cepat: tombol **Buka Folder** di **Setting → Backup**
> akan langsung membuka folder data di File Explorer / Finder / file manager.

### Backup Manual

**Cara 1 — Lewat aplikasi**: **Setting → Backup** → tombol **Backup Sekarang** (juga bisa lewat **Laporan → Backup**).

**Cara 2 — Manual file copy**: Copy seluruh folder di atas ke flashdisk / hard disk eksternal / Google Drive.

### Restore dari Backup

1. Tutup aplikasi
2. Replace `perpustakaan-v2.db` di folder data dengan file backup
3. Buka aplikasi → data sudah pulih

### Pindah ke Komputer Lain

1. Copy seluruh folder data ke komputer baru
2. Install aplikasi di komputer baru
3. Buka — data otomatis ter-load

---

## Cetak (KTA, Label Barcode, Bebas Pustaka, Nota)

### Format Output

| Cetakan          | Ukuran     | File              | Tools yang sesuai           |
|------------------|------------|-------------------|-----------------------------|
| KTA Anggota      | CR80 (kartu) | PDF               | Printer kartu PVC, atau A4 + laminating |
| Label Buku       | 70×30mm grid 3×8 | PDF (A4)      | Kertas label sticker A4 (Tom & Jerry, Avery) |
| Surat Bebas Pustaka | A4       | PDF               | Printer biasa               |
| Nota Peminjaman  | A5 / struk | PDF               | Printer biasa atau thermal struk |
| Nota Pengembalian| A5 / struk | PDF               | Printer biasa atau thermal struk |

### Cetak Nota Peminjaman / Pengembalian


Setelah simpan transaksi peminjaman atau pengembalian, aplikasi akan otomatis
menampilkan dialog konfirmasi **"Cetak nota peminjaman?"** (atau **"Cetak nota
pengembalian?"**):

1. Klik **Ya, Cetak** → PDF nota di-generate dan otomatis terbuka di PDF reader default OS
2. Klik **Tidak** → transaksi tersimpan tapi tidak ada nota (bisa di-cetak ulang manual nanti)
3. PDF nota disimpan di folder `exports/` di [folder data aplikasi](#lokasi-data)

Isi nota:
- **Header**: Nama perpustakaan + alamat (dari Setting → Identitas)
- **Nomor transaksi**: mis `PJ-202405-001`
- **Tanggal**: tanggal pinjam (atau tanggal kembali untuk nota pengembalian)
- **Anggota**: nama, kelas, kode anggota
- **Tabel item**: kode buku + judul + (jatuh tempo untuk peminjaman, atau denda untuk pengembalian)
- **Footer**: total denda (kalau pengembalian), tanda tangan operator

> **Tip:** Untuk printer thermal struk 58mm/80mm, ukuran PDF tetap A5 — printer driver akan auto-fit. Kalau output terpotong, atur margin printer atau cetak ke A4 lalu potong.

### Cetak Beberapa KTA Sekaligus

1. Di Master Anggota, Ctrl+klik beberapa baris (atau Shift+klik untuk range)
2. Klik **Cetak KTA**
3. PDF gabungan dengan semua KTA dalam 1 file → print sekaligus

### Tip: Barcode Scanner

Scanner USB biasa cukup. Mode **HID Keyboard Wedge** (default scanner USB) — scan barcode = sama seperti ngetik kode + Enter. Cocok untuk semua field input di aplikasi.

---

## Troubleshooting

### "Windows protected your PC" saat buka installer

→ Klik **More info** → **Run anyway**. Normal untuk software open-source yang belum disigning dengan code signing certificate komersial.

### Aplikasi tidak buka / layar hitam / langsung close

1. Coba jalankan dari Command Prompt (Windows) atau terminal (Linux/macOS) untuk lihat error message lengkap
2. Cek folder data app (lihat [Lokasi Data](#lokasi-data)) — kalau ada masalah I/O, pastikan ada permission tulis
3. Coba rename DB: `perpustakaan-v2.db` → `perpustakaan-v2.db.bak`, lalu buka app (akan bikin DB baru otomatis, **tapi data hilang** — backup dulu!)
4. Pastikan WebView2 (Windows) ter-install — sudah default ada di Windows 11, kalau Windows 10 lama mungkin perlu install dari [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
5. Buka [GitHub Issues](https://github.com/alviarts/perpustakaan-offline/issues) untuk lapor bug, sertakan info OS + versi app + langkah reproduksi

### Login gagal "username/password salah"

- Default akun pertama kali: `admin` / `admin123`
- Sudah ganti password tapi lupa? → buka [Login screen](#login--akun) → link **Lupa Password?** akan minta jawaban *security question* yang kamu set saat ganti password (jika fitur sudah aktif di rilis terbaru)
- Sebagai fallback terakhir: tutup app, hapus `perpustakaan-v2.db` di folder data, buka app → admin default akan re-create. **PERINGATAN:** semua data hilang — backup dulu kalau perlu.

### Barcode scanner tidak bekerja

- Pastikan scanner di mode **HID Keyboard Wedge** (lihat manual scanner)
- Test di Notepad — scan barcode harus muncul sebagai teks + Enter
- Pastikan field input di aplikasi sudah dalam keadaan focus sebelum scan

### Cetak PDF / nota tidak muncul

- Cek folder `exports/` di [folder data aplikasi](#lokasi-data)
- Pastikan tidak ada PDF reader yang nge-lock file (Adobe Reader / SumatraPDF kadang lock file output)
- Kalau printer thermal output terpotong: atur margin printer atau cetak ke A4 lalu potong

### Import Excel error

- Pastikan format file `.xlsx` (bukan `.xls` lama)
- Header kolom harus **persis sesuai Template** — download Template dari toolbar Master Anggota / Master Buku
- Tanggal harus format `YYYY-MM-DD` (text cell), bukan format Excel date
- Kalau ada baris error spesifik, dialog akan tampil daftar baris + kolom yang gagal

---

## Bantuan & Lapor Bug

- **GitHub Issues**: https://github.com/alviarts/perpustakaan-offline/issues
- **GitHub Discussions** (untuk pertanyaan umum): https://github.com/alviarts/perpustakaan-offline/discussions

Saat lapor bug, sertakan:
1. **Versi aplikasi** (cek di **Setting → Tentang**)
2. **OS + versi** (Windows 10/11, Ubuntu 22.04, macOS 14, dst.)
3. **Langkah reproduksi** (urutan klik / aksi)
4. **Screenshot** atau error message yang muncul
5. **Output developer tools** kalau ada (kanan-klik di window aplikasi → Inspect Element → Console di rilis dev build)

---


# 🇬🇧 English Version

This is a translated short version of the manual. Indonesian version above is more comprehensive.

## Quick Start

1. Download the latest installer for your OS from [Releases](https://github.com/alviarts/perpustakaan-offline/releases):
   - **Windows:** `PerpustakaanNusantara_<version>_x64-setup.exe` (NSIS) or `..._x64_en-US.msi` (MSI)
   - **Linux:** `perpustakaan-offline_<version>_amd64.deb`
   - **macOS:** `PerpustakaanNusantara_<version>_x64.dmg` or `_aarch64.dmg`
2. Install → launch → login with `admin` / `admin123` → **change password immediately** (Setting → Akun)
3. Switch UI language: **Setting → Bahasa → `en — English`**

## Main Modules

| Module           | Purpose                                                                |
|------------------|------------------------------------------------------------------------|
| **Dashboard**    | At-a-glance KPIs + auto-popup reminder for overdue / due-soon loans     |
| **Members**      | Student CRUD, ID card printing, **batch class promotion**, clearance letter, **Excel import/export** |
| **Books**        | Book CRUD, multi-copy management, DDC classification, label printing   |
| **Visits**       | Daily visit log (individual or batch by class)                         |
| **Borrow**       | Issue books, **prompt to print receipt** after save                    |
| **Return**       | Process returns, calculate overdue fines, mark lost books, **print receipt** |
| **Reports**      | Backup/Restore, charts, top borrowers, top books, finance ledger       |
| **Settings**     | 12 tabs: identity, KTA layout, accounts, RBAC, transaction rules, master data, theme, language, scheduled backup, sync (placeholder), audit log, about |

## Highlights

- **Tauri 2 desktop app** — native installer, no Python runtime required
- **Bilingual UI** — Indonesian / English live toggle
- **Bcrypt password hashing** with optional security question for offline password recovery
- **Cron-like scheduled backup** with configurable retention + audit-logged backup operations
- **Auto due-date reminder** on dashboard first load (overdue / due in 3 days toast)
- **Audit log viewer** — searchable history of create / update / delete / login actions
- **Global Ctrl+K command palette** — quick-search anggota / buku / peminjaman
- **System tray** with configurable close behavior (minimize-to-tray vs close)

## Data Location

v2 uses Tauri's app data directory with bundle identifier `id.alviarts.perpustakaan`:

- **Windows**: `%APPDATA%\id.alviarts.perpustakaan\`
- **macOS**: `~/Library/Application Support/id.alviarts.perpustakaan/`
- **Linux**: `~/.local/share/id.alviarts.perpustakaan/`

Backup the entire folder to preserve all data. Database file: `perpustakaan-v2.db`.

## Default Login

- Username: `admin`
- Password: `admin123`
- **Must change after first login!**

## Default Transaction Settings

| Setting                  | Default     |
|--------------------------|-------------|
| Loan duration            | 7 days      |
| Max books per member     | 2           |
| Fine per overdue day     | Rp 500      |
| Default replacement cost | Rp 50,000   |

Adjust in **Setting → Aturan Peminjaman**.

## Bug Reports & Help

- GitHub Issues: https://github.com/alviarts/perpustakaan-offline/issues
- Include version (**Setting → Tentang**), OS, steps to reproduce, screenshot, and any console error messages

---

*Manual ini akan diperbarui mengikuti perkembangan aplikasi. Cek
[Releases](https://github.com/alviarts/perpustakaan-offline/releases)
untuk catatan rilis terbaru.*

## Riwayat Update Manual

| Versi   | Tanggal     | Perubahan                                                                                            |
|---------|-------------|------------------------------------------------------------------------------------------------------|
| v1.x    | 2026-05     | Refresh manual untuk v2 (Tauri + React): instalasi multi-OS, lokasi data `id.alviarts.perpustakaan`, settings 12 tab, drop section Tools (tidak ada di v2), troubleshooting v2-flavored, English section diringkas |
| v0.3.0  | 2026-05     | (legacy v1) Tambah dokumentasi: Naik Kelas batch, Cetak Nota, Cek Data Ganda, Reminder Jatuh Tempo otomatis, Audit Log viewer + screenshot 14–17 |
| v0.1.1  | 2025-09     | (legacy v1) Versi awal manual (561 baris) — instalasi, login, dashboard, master data, transaksi, laporan, setting, backup, cetak, sync, troubleshooting |
