# Visual References for Migration v2

Screenshots and visual references collected during the planning phase of the v0.6.2 → v1.0.0 migration. Each image is named `revision-NN-<description>.png` and corresponds to a revision in `REVISION_BACKLOG.md` (created by Devin session 1).

## Index

| File | Revision | Type | Description |
|---|---|---|---|
| `revision-01-installer-exe-icon-current.png` | #1 | Bug / Current | Generic Inno Setup .exe icon yang harus diganti dengan logo Nusantara |
| `revision-01-logo-nusantara-target.png` | #1 | Asset / Target | Logo "Perpustakaan Nusantara" navy/gold (1254×1254) yang harus dipakai untuk .ico, .exe icon, Start Menu, taskbar |
| `revision-01-windows-search-icon.png` | #1 | Bug / Current | Icon di Windows Search masih default — harus auto-update setelah `build.spec` icon diganti |
| `revision-02-select-setup-language-dialog.png` | #2 | Bug / Current | Dialog "Select Setup Language" yang harus dihapus dari installer wizard |
| `revision-03-license-agreement-current.png` | #3 | Bug / Current | License Agreement masih MIT default — harus diganti license custom dengan kredit "alvi arts / vwrks" |
| `revision-03-setup-wizard-cd-box-graphic.png` | #3 | Bug / Current | Setup Wizard graphic (CD + box icon) default Inno Setup — harus diganti dengan logo Nusantara |
| `revision-05-login-modern-mockup-reference.png` | #5 | Reference / Target | Mockup referensi login screen modern minimal (Create Account / Login Account dengan illustration) |
| `revision-05-login-current.png` | #5 | Bug / Current | Login screen saat ini (gelap, sederhana) yang harus diganti |
| `revision-07-sidebar-current.png` | #7 | Bug / Current | Sidebar saat ini fixed width — harus bisa expand/collapse |
| `revision-08-theme-switcher-bug.png` | #8 | Bug / Current | Bug visual: text "Sistem" muncul di belakang segmented button — harus diganti pattern dropdown popover |
| `revision-09-dashboard-current-1.png` | #9 | Bug / Current | Dashboard saat ini (kaku, gaya Windows XP) — screenshot 1 |
| `revision-09-dashboard-current-2.png` | #9 | Bug / Current | Dashboard saat ini — screenshot 2 |
| `revision-09-dashboard-wireframe-reference.png` | #9 | Reference / Target | Wireframe modern referensi untuk redesign dashboard (3 hero card + chart) |
| `revision-10-login-ingat-saya-target-location.png` | #10 | Reference / Target | Lokasi target untuk checkbox "Ingat Saya" di login screen |
| `revision-11-identitas-perpustakaan-filled.png` | #11 | Bug / Current | Form Identitas Perpustakaan sudah diisi user — data harus sync ke seluruh app |
| `revision-12-tanggal-lahir-form.png` | #12 | Bug / Current | Field Tanggal Lahir saat ini hanya text input — harus pakai date picker calendar popup |
| `revision-13-windowed-glitch.png` | #13 | Bug / Current | Glitch saat windowed mode — layout pecah |
| `revision-13-fullscreen-ok.png` | #13 | Bug / Current | Saat fullscreen layout normal — banding dengan windowed |
| `revision-14-kta-pramuka-template.png` | #14 | Reference / Target | Template KTA Pramuka contoh dari user — untuk template editor & auto-fill |
| `revision-14-kta-error-popup.png` | #14 | Bug / Current | Error popup "Gagal cetak KTA: cannot open resource" — bug PIL font path |
| `revision-15-live-search-anggota-1.png` | #15 | Bug / Current | Search Data Anggota masih perlu klik tombol "Cari"/"Muat Ulang" — harus instant live filter |
| `revision-15-live-search-anggota-2.png` | #15 | Bug / Current | Search Data Anggota — screenshot lanjutan |
| `revision-16-data-buku-1.png` | #16 | Bug / Current | View Data Buku layout aneh banyak gap kosong — screenshot 1 |
| `revision-16-data-buku-2.png` | #16 | Bug / Current | View Data Buku — screenshot 2 |
| `revision-16-data-buku-3.png` | #16 | Bug / Current | View Data Buku — screenshot 3 |
| `revision-17-form-ddc-kategori.png` | #17 | Bug / Current | Form Data Buku field Kode DDC + Kategori masih text input — harus dropdown master data |
| `revision-19-dropdown-keperluan-style.png` | #19 | Bug / Current | Dropdown Keperluan (Catat Kunjungan): list popup lebih sempit dari trigger button — harus full width match |
| `revision-20-catat-kunjungan-anggota-field.png` | #20 | Bug / Current | Field Anggota di Catat Kunjungan — harus autocomplete suggestion ke DB anggota |
| `revision-21-peminjaman-empty.png` | #21 | Bug / Current | View Peminjaman terlalu sederhana, banyak ruang kosong — perlu redesign komplit |
| `revision-22-pengembalian-windowed.png` | #22 | Bug / Current | Pengembalian view saat windowed — tombol Pengembalian/Buku Hilang hidden |
| `revision-22-pengembalian-button-cut.png` | #22 | Bug / Current | Detail tombol Pengembalian/Buku Hilang yang ke-cut |
| `revision-22-sidebar-keluar-cut.png` | #22 | Bug / Current | Sidebar tombol "Keluar" yang ke-cut saat windowed pendek |
| `revision-23-laporan-layout.png` | #23 | Bug / Current | View Laporan layout aneh — banyak ruang kosong, tab horizontal awkward |
| `revision-24-settings-kartu-anggota.png` | #24 | Bug / Current | Settings tab "Kartu Anggota" — banyak ruang kosong, perlu fitur lebih lengkap (mirip Google Settings) |
| `revision-25-settings-transaksi-tab.png` | #25 | Bug / Current | Settings tab "Transaksi" — naming tidak akurat (isinya Denda/Lama Pinjam, bukan transaksi). Audit semua wording |
| `revision-26-backup-terjadwal-table.png` | #26 | Bug / Current | Tab "Backup Terjadwal" — table tidak bisa di-scroll pakai mouse wheel |

## Catatan untuk Devin Sessions 1-12

- Image-image ini adalah **artefak fase planning** dan **TIDAK termasuk** dalam asset bundle aplikasi v2.
- Gunakan sebagai **referensi visual** saat mengerjakan revisi — pelajari masalah yang user laporkan dari screenshot.
- Asset gambar untuk aplikasi v2 (illustrations, logo final, dll.) akan disimpan di lokasi terpisah (e.g. `apps/web/src/assets/` atau `apps/desktop/icons/` — tergantung struktur Tauri/Electron yang Devin 1 putuskan).
- Beberapa revisi tidak punya screenshot (karena hanya deskripsi text dari user): **#4 (manual book HTML)**, **#6 (asset quality high-res)**, **#18 (kunjungan animasi white bg)** — referensi tertulis di `REVISION_BACKLOG.md`.

## Tidak ada di sini (text-only revisions)

Revisi berikut hanya berupa deskripsi text dari user, tidak ada screenshot:
- **#4** Manual book HTML gantikan README.md di installer wizard
- **#6** Asset illustration high-res dari unDraw/Storyset/DrawKit (no procedural)
- **#18** Kunjungan view: animasi background putih kaku → harus transparent + blend tema
