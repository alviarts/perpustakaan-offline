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

# Atau dengan demo data (5 anggota + 10 buku + 2 peminjaman aktif)
# berguna untuk training / demo tanpa input data manual
python -m perpustakaan --demo
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

Roadmap dikelompokkan ke dalam **4 jalur kerja paralel** supaya gampang diambil
sebagian-sebagian (oleh kontributor manusia maupun AI agent seperti Devin).
Tiap item bisa dikerjakan tanpa menunggu jalur lain selesai.

### Jalur A — Hardening & Validasi (highest ROI, ~1 hari)

Pastikan release yang sudah keluar benar-benar tahan dipakai user awam.

- [x] End-to-end smoke test: jalankan app di Xvfb, klik semua menu, verifikasi tiap CRUD + peminjaman + dashboard, dokumentasikan bug → `tests/test_smoke_gui.py` + `docs/smoke-test/REPORT.md`
- [x] Tambah **seed demo data** (5 anggota dummy + 10 buku dummy) di `src/perpustakaan/db/seed.py` flag `--demo`, sehingga user yang baru download bisa langsung coba alur peminjaman tanpa input data dulu
- [x] **Polish error handling** — banyak `try/except` yang masih silent; ganti jadi toast notification user-friendly via `gui/widgets.show_toast(...)`
- [x] **Auto-release workflow** — tambah job di `.github/workflows/ci.yml` yang trigger `on: push: tags: ['v*']` → otomatis bikin GitHub Release + upload `.exe` + installer. Tinggal `git tag v0.x.0 && git push --tags`
- [x] CI matrix tambahin Linux build (untuk distribusi non-Windows). macOS di-skip karena tkinter issues di GitHub Actions runner

### Jalur B — Lengkapi Fitur Skeleton (~2-3 hari)

Beberapa flow di v0.1 cuma ada di backend; UI-nya belum lengkap.

- [x] **UI Naik Kelas batch** — dialog mapping kelas lama → baru di toolbar Anggota (PR #9)
- [x] **Bebas Pustaka full flow** — validasi otomatis: blokir kalau ada peminjaman aktif (PR #10)
- [x] **Cetak Nota peminjaman/pengembalian dari UI** — prompt cetak nota PDF setelah simpan/proses (PR #11)
- [x] **Cek Data Ganda** — deteksi duplikat anggota (nama+kelas) dan buku (ISBN/judul+pengarang); UI di Settings → Tools (PR #12)
- [x] **Reminder jatuh tempo otomatis** — toast popup di dashboard saat login, list H+0 s/d H+3 (PR #13)
- [x] **Audit log viewer** — tab Audit Log di Settings: siapa-melakukan-apa-kapan dengan search (PR #14)

### Jalur C — Dokumentasi & Onboarding (~0.5 hari)

- [ ] **User manual** lengkap di `docs/manual.md` (bilingual ID/EN) dengan screenshot tiap menu
- [ ] **Setup guide Google Sheets** di `docs/google-sheets-setup.md` (langkah dapatkan `client_secret.json` dari Google Cloud Console)
- [ ] **Demo screencast** 3-5 menit (alur peminjaman end-to-end) di-attach ke release page
- [ ] **Quickstart** untuk pustakawan yang gak technical (1-pager PDF)
- [ ] **Inno Setup installer** (`installer/installer.iss`) — Windows installer dengan Setup wizard, Start Menu shortcut, registered uninstaller

### Jalur D — Fitur Lanjutan (~3-5 hari, opsional)

- [ ] **Opsi A: Sync 2-arah Google Sheets** — auto-sync background, conflict resolution last-write-wins by `updated_at`. Sebagai upgrade dari Opsi C yang sudah ada
- [ ] **Multi-perpustakaan / multi-cabang** — kalau sekolah punya >1 perpus
- [ ] **Mobile companion (PWA)** — siswa lihat status peminjaman sendiri, scan QR untuk pinjam mandiri
- [x] **Backup terjadwal** — auto-backup harian/mingguan ke folder lokal (v0.4.0)
- [ ] **Import dari SIM-Perpus.xlsb asli** — script konversi data lama → SQLite untuk migrasi user existing
- [ ] **Code signing certificate** — sign `.exe` supaya Windows Defender / SmartScreen tidak warning

### Versi yang sudah dirilis

| Versi      | Tanggal    | Highlights                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0.6.2** | 2026-05-03 | feat(ui): **PR-V4c — Phosphor Icons + 2 illustrations baru** · feat(phosphor): bundle Phosphor Fill TTF (`assets/fonts/Phosphor-Fill.ttf`, 449 KB, MIT lisensi termasuk) dengan 66 icon name → Unicode codepoint mapping di `gui/phosphor.py` (extracted dari `@phosphor-icons/web@2.1.0` style.css). Icon di-render runtime via `PIL.ImageFont.truetype()` + `ImageDraw.text()` lalu di-recolor untuk theme awareness — full anti-aliasing terjaga, no extra dependency · feat(widgets): `widgets.icon_button(phosphor=...)` + `widgets.permission_button(phosphor=...)` parameter baru — Phosphor Fill icon priority lebih tinggi dari Lucide (graceful fallback kalau Phosphor unavailable) · feat(cta): primary CTA buttons (Tambah, Update/Simpan, Hapus, Cetak, Import) di buku/anggota/peminjaman/pengembalian/laporan/settings/kunjungan view sekarang pakai Phosphor Fill — hierarki visual jelas vs Lucide monoweight subtle · feat(illustrations): 2 illustration baru di `scripts/gen_illustrations.py` — `empty-laporan` (bar chart growing trend + donut chart amber accent) + `empty-pengaturan` (gear ganda meshed + sliders amber); total 9 illustration ter-bundle · test: 20 test baru di `test_phosphor.py` (TTF magic, license bundle, codepoint Private Use Area validation, glyph render visibility/color, lru_cache hit detection); +1 update di `test_widgets_visual.py` untuk verify 9 illustrations                                                                                                                                                                                                                                                                          |
| **v0.6.1** | 2026-05-03 | feat(ui): **PR-V4b — Procedural animations** (\"Lottie-like\" tanpa dependency Lottie/cairo) · feat(scripts): `scripts/gen_animations.py` procedural generator pakai Pillow — 4 animasi siap pakai: `loader_dots` (24 frame, circular dots fade trailing), `success_check` (15 frame, lingkaran fill + checkmark drawn), `pulse_heart` (10 frame, scale 1.0→1.15→1.0 sin wave), `bounce_book` (12 frame, bouncing dengan squash & stretch + ground shadow) · feat(animation_player): widget baru `gui/animation_player.py` `AnimationPlayer(name=, size=, fps=, loop=, on_done=)` — cycle PNG frames via `after()`, frame cache by (name, size), defensive cleanup pada `<Destroy>` event · feat(empty_state): `EmptyState` widget extend dengan param `animation`, `animation_size`, `animation_fps` — priority animasi > illustration > Lucide icon · feat(toast): `show_toast(kind=\"success\")` sekarang prepend animated checkmark `success_check` di sisi kiri pesan · feat(empty_buku): empty state Buku (saat tidak filter search) tampilkan `bounce_book` animation 120×120, 20fps · feat(installer): folder `assets/animations/` otomatis ter-bundle via `build.spec` `(ASSETS, \"assets\")` — tidak perlu update Inno Setup script · test: 21 test baru di `test_animation_player.py` (frame count, size match, pixel verification untuk merah/non-empty, easing curve symmetry, registry completeness, asset bundle integrity); total 199 passed                                                                                                                                                                                                                                            |
| **v0.6.0** | 2026-05-03 | feat(ui): **PR-V4a — Microinteractions + Drop Shadow + Gradient** (foundation, no new dependency selain Pillow yang sudah dipakai) · feat(animations): 5 helper baru di `gui/animations.py` — `lerp_color` interpolasi RGB hex, `animate_color` smooth fg_color/border_color transition via easing curve, `slide_to_y` animate place(y=), `apply_dialog_appear` fade-in + slide kecil dari atas untuk modal CTkToplevel, `attach_press_feedback` tactile feedback (border_width pulse) saat tombol di-klik, `attach_hover_lift` smooth color cross-fade saat hover · feat(effects): module baru `gui/effects.py` — `make_drop_shadow` PNG drop shadow lembut via Pillow Gaussian blur, `make_linear_gradient` 2-color gradient any angle, `make_radial_gradient` soft glow spotlight; semua di-cache via `lru_cache` per parameter tuple · feat(modal): semua modal (`HelpDialog`, `ChangePasswordDialog`, `ResetPasswordDialog`, `FirstLoginSecuritySetupDialog`, `RegisterDialog`, dialog Anggota / Pengembalian / Settings / Laporan) sekarang appear dengan fade-in 180ms + slide-in 12px dari atas, ease-out cubic · feat(button): tombol header utama (Bantuan, Ganti Password, "?", Login submit) punya tactile feedback saat di-klik · feat(sidebar): active menu indicator + button bg cross-fade smooth saat switch menu — tidak instant snap · feat(login): background gradient radial subtle (indigo center spotlight) di login screen · feat(card): `StatCard` di Dashboard hover lift sekarang smooth color interpolation, bukan instant configure · test: 45 test baru untuk pure functions (33 lerp/easing/color helpers + 12 effects PIL pixel sampling), total 178 passed, lint clean |
| **v0.5.3** | 2026-05-03 | feat(help): menu **Bantuan** baru di header window — modal dialog 3 tab (FAQ + Video Tutorial + Tentang) · feat(help): **18 entri FAQ** bilingual (login default, lupa/ganti password, tambah anggota, import Excel, cetak KTA, peminjaman/pengembalian, bebas pustaka, naik kelas, cek data ganda, backup manual/terjadwal, lokasi DB, DDC, ekspor Sheets, lapor bug) · feat(help): tab **Video Tutorial** auto-discover MP4 di `docs/demo/` — tombol "Buka Video" pakai default media player OS (cross-platform: Windows `os.startfile`, macOS `open`, Linux `xdg-open`); empty-state dengan link GitHub Releases kalau bundle tidak ada · feat(help): tab **Tentang** — versi aplikasi, lisensi MIT, kredit Kang Sur (SIM-Perpus v.1.2.2), tombol link ke GitHub repo / releases / issues (lapor bug) · installer: bundle `docs/demo/*.mp4` ke installer Windows supaya video tutorial offline-ready setelah install                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **v0.5.2** | 2026-05-02 | feat(auth): tombol **Ganti Password** di header window — modal validasi password lama → password baru → konfirmasi · feat(auth): **Lupa Password?** di layar login — flow 2-step (username → tampilkan pertanyaan keamanan → jawab + set password baru), jawaban di-hash bcrypt, error message generik untuk hindari user enumeration · feat(auth): **First-login wizard wajib** untuk user lama (v0.4.0–v0.4.3) yang belum punya pertanyaan keamanan — modal tidak bisa di-skip, dropdown 5 pertanyaan default + opsi kustom, jawaban minimal 2 karakter (case + whitespace insensitive) · feat(audit): entry `password_changed`, `password_reset_via_security_question`, `security_question_set` di audit log · refactor(db): kolom `security_question` + `security_answer_hash` ditambah ke tabel `users` via idempotent ALTER (helper `_ensure_columns`) — DB existing otomatis ter-upgrade tanpa migration script                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **v0.5.1** | 2026-05-02 | feat(ui): bundle **7 procedural empty-state illustration** (PNG 1024×640) di-generate via `scripts/gen_illustrations.py` dengan Pillow — palette indigo (`#4f46e5`) + indigo-soft (`#a5b4fc`) + amber accent (`#f59e0b`) + warm cream bg (`#fef9f3`), satu master style anchor sehingga 7 illustration kelihatan satu keluarga · feat(ui): `EmptyState` widget gain param `illustration` + `illustration_size` — load dari `assets/illustrations/<name>.png`, fallback ke Lucide icon kalau file tidak ada · feat(ui): Anggota, Buku, Kunjungan empty state pakai illustration baru (dengan search-aware variant untuk Anggota & Buku) · feat(tokens): `design_tokens.py` extends dgn `ILLUSTRATION` (palette utk image-gen), `SHADOW` (specs utk PNG drop-shadow layer recipe), `MOTION` (durasi animasi standar 0/120/200/320/480 ms) · scripts: `gen_illustrations.py` idempotent procedural generator (re-run safe untuk re-style atau regen) · test: 4 test baru utk illustration loader + EmptyState illustration param + bundle integrity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **v0.5.0** | 2026-05-02 | feat(ui): visual overhaul major — design system foundation dengan `gui/design_tokens.py` (palette, spacing, radius, icon sizes) · feat(ui): bundle **56 ikon Lucide** di `assets/icons/lucide/` (MIT) + loader recolor PIL theme-aware via `gui/icons.py` · feat(ui): widget baru `EmptyState` (icon + title + description + optional action) untuk placeholder list/dashboard kosong · feat(ui): widget baru `Tooltip` (hover label borderless ala native) · feat(ui): helper `widgets.icon_button(...)` untuk CTkButton dengan ikon Lucide kiri text · feat(ui): sidebar menu + tombol header (theme toggle, help, logout) migrasi ke ikon Lucide (sun/moon/monitor, layout-dashboard, users, book-open, calendar-days, arrow-right-left, rotate-ccw, chart-bar, settings, log-out, circle-question-mark) · feat(ui): toolbar tiap view (anggota, buku, peminjaman, pengembalian, laporan, settings) migrasi ke ikon Lucide (plus, save, trash-2, x, refresh-cw, search, printer, upload, download, file-text) · feat(ui): empty state ditampilkan di Anggota / Buku / Kunjungan saat data kosong (search-aware) · feat(ui): stub `gui/illustrations.py` + folder `assets/illustrations/` siap untuk unDraw illustration berikutnya · feat(auth): tombol "Ganti Password Saya" + flow forgot password via security question (PR-C) · feat(rbac): granular permission per fitur dgn UI Edit Hak Akses (PR-B) · ci: PR sekarang trigger ke branch manapun (sebelumnya hanya `main`) supaya stacked PR bisa di-test                                                                                                                                                                                      |
| **v0.4.3** | 2026-05-02 | feat(rbac): **Manajemen hak akses granular** — schema baru `permissions` + `user_permissions`, registry 33 permission key per area (anggota / buku / kunjungan / peminjaman / pengembalian / laporan / setting / audit_log) · feat(ui): dialog **Edit Hak Akses** di Setting → Manajemen Akun dengan checkbox grouped per area + tombol preset (Default Admin / Pustakawan / Siswa / Kosongkan) · feat(rbac): tombol aksi protected otomatis ter-disable kalau user tidak punya hak (toast "Akses ditolak" sebagai defense-in-depth) · feat(rbac): default preset per role + auto-grant migration utk user existing dari v0.4.0–v0.4.2 (admin: semua, pustakawan: operasional sehari-hari, siswa: read-only) · feat(audit): entry `permission_granted` / `permission_revoked` setiap perubahan grant · refactor(db): schema selalu di-run idempotent agar upgrade dari versi lama otomatis dapat tabel baru tanpa migration script terpisah                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **v0.4.2** | 2026-05-02 | feat(ui): bundle font modern **Inter** (Regular/Medium/SemiBold/Bold OTF, ~1.1 MB) + auto-install via Inno Setup ke per-user fonts directory (no admin required) · feat(ui): heading bar konsisten di tiap menu dengan tombol bulat **`?`** **inline di samping judul** (Data Anggota / Data Buku / Kunjungan / Peminjaman / Pengembalian / Laporan / Setting / Dashboard) — replay tutorial menu itu kapan saja · refactor(ui): widget `HeadingBar` baru dengan deteksi font system otomatis (Inter → Segoe UI Variable / Cantarell / Helvetica / Arial → Tk default) · refactor: StatCard Dashboard pakai font helper (lebih konsisten + jelas)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **v0.4.1** | 2026-05-02 | feat(ui): tutorial **kontekstual per-menu** — first-run cuma intro singkat di Dashboard, lalu tiap user buka menu (Anggota, Buku, Peminjaman, Pengembalian, Kunjungan, Laporan, Setting) pertama kali, panduan khusus menu itu auto-muncul · feat(ui): tombol bulat **`?`** mengambang di pojok kanan-atas (sebelahan toggle tema) untuk **memutar ulang tutorial menu yang sedang dibuka** kapan saja · feat(ui): UI/UX modern — sidebar dengan **indicator bar** di item aktif, **hover lift** halus di kartu Dashboard, ikon dalam lingkaran berwarna · feat(ui): animasi sederhana — toast **slide-in / slide-out** dari kanan, popup tutorial **fade-in** + **spotlight ring** di sekitar widget target                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **v0.4.0** | 2026-05-02 | feat(backup): backup terjadwal harian/mingguan dengan retensi otomatis, catch-up saat startup, audit log + toast tiap selesai backup · feat(ui): tombol toggle tema **Sistem / Terang / Gelap** mengambang di pojok kanan atas — selalu visible di menu manapun · feat(ui): tutorial / guided tour interaktif yang muncul otomatis di first-run dengan tombol Lewati / Sebelumnya / Berikutnya, juga bisa diulang dari Setting → Bahasa & Tema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **v0.3.1** | 2026-05-02 | docs: manual.md update + 4 screenshot fitur v0.3.0 · docs: review Google Sheets setup guide · docs: demo screencast 4 menit (`docs/demo/`) · docs: quickstart 1-pager PDF (`docs/quickstart.pdf`) · installer: bump Inno Setup AppVersion ke v0.3.1 + bundle quickstart docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **v0.3.0** | 2026-05-02 | feat(gui): UI Naik Kelas batch · feat(gui): Bebas Pustaka validasi peminjaman aktif · feat(gui): Cetak Nota di Peminjaman & Pengembalian · feat(gui): Cek Data Ganda (Settings → Tools) · feat(gui): Reminder jatuh tempo otomatis saat login · feat(gui): Audit Log viewer (Settings → Audit Log)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **v0.2.0** | 2026-05-02 | feat(seed): `--demo` flag untuk seed 5 anggota + 10 buku + 2 peminjaman aktif · feat(gui): toast notification non-blocking + exception reporter dengan log ke `app.log` · test: full GUI smoke test passed di Xvfb (17 test cases) · fix: StyledTreeview crash pada duplicate iid · ci: Linux build artifact ditambahkan ke release                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **v0.1.1** | 2026-05-02 | docs: user manual + Google Sheets setup guide + Inno Setup installer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **v0.1.0** | 2026-05-02 | Initial scaffold lengkap, semua menu functional, DB SQLite + seed DDC, .exe Windows tersedia di [Releases](https://github.com/alviarts/perpustakaan-offline/releases)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## Untuk Kontributor / AI Agent

Kalau kamu meneruskan kerjaan dari titik ini:

1. **Baca dulu** `docs/manual.md` (kalau sudah ada) atau eksplor `src/perpustakaan/` untuk paham struktur
2. **Pilih satu item** dari roadmap di atas (preferensi: Jalur A → B → C → D), atau buat issue baru
3. **Setup environment**: `python -m venv .venv && pip install -r requirements.txt`
4. **Run tests**: `pytest tests/ -q` (harus all green sebelum & sesudah perubahan)
5. **Lint**: `ruff check src/ tests/` (harus clean)
6. **Run app lokal**: `python -m perpustakaan` (login `admin` / `admin123`)
7. **PR** ke `main` dengan deskripsi yang jelas dan checkbox testing — CI di `.github/workflows/ci.yml` otomatis verify lint + pytest + Windows build
8. **Tag baru → auto-release**: setelah merge, untuk rilis baru jalankan `git tag vX.Y.Z && git push --tags`. Workflow `release-v2` di `.github/workflows/ci-v2.yml` otomatis (a) build installer Windows MSI + NSIS, (b) baca section `## [X.Y.Z]` dari `CHANGELOG.md` untuk body release, (c) publish GitHub Release plus upload artifact `.exe`/`.msi`. Lihat section "Release process" di bawah.

Konvensi:

- Tanggal/waktu disimpan sebagai TEXT ISO-8601, uang INTEGER rupiah
- Kode anggota auto `A0001`, kode buku auto `B0001`, kode eksemplar `B0001-01`/`-02`/...
- DB path runtime: lihat `src/perpustakaan/config.py::_user_data_root()` (handles Windows/macOS/Linux)
- **JANGAN commit** `client_secret.json`, `token.json`, `*.db`, atau file binary apa pun

---

## Release process

Versi v2 (Tauri) dirilis dari tag `vX.Y.Z` melalui workflow
`.github/workflows/ci-v2.yml`. Alurnya end-to-end:

1. **Tambah section di `CHANGELOG.md`** untuk versi baru, mengikuti format
   `## [X.Y.Z] - YYYY-MM-DD` plus sub-section `### Added` / `### Changed` /
   `### Fixed` (lihat versi sebelumnya sebagai contoh).
2. **Bump versi** di `package.json`, `apps/desktop/package.json`,
   `apps/desktop/src-tauri/Cargo.toml`, dan
   `apps/desktop/src-tauri/tauri.conf.json` supaya konsisten dengan tag.
3. **Merge PR** ke `main`.
4. **Push tag** dari `main` sesudah merge:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
5. CI mendeteksi tag `v*`, kemudian:
   - `lint-typecheck-test` + `rust-check` jalan seperti biasa.
   - `build-windows-installer` build `.exe` + `.msi` di `windows-latest`.
   - `release-v2` (di `ubuntu-latest`) menjalankan
     `node scripts/extract-changelog.mjs vX.Y.Z` untuk membaca section
     `## [X.Y.Z]` dari `CHANGELOG.md`, lalu menggunakannya sebagai body
     GitHub Release via `softprops/action-gh-release@v2`. Kalau section
     tidak ada, workflow fallback ke `generate_release_notes: true` dan
     mencatat warning di summary CI.

Tag `vX.Y.Z-alpha`/`-beta`/`-rc` otomatis ditandai sebagai pre-release.

---

## Lisensi

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan didistribusikan.

## Credits

- **SIM-Perpus original** oleh Kang Sur (Excel + VBA)
- **DDC (Dewey Decimal Classification)** — public domain
- Built with [CustomTkinter](https://customtkinter.tomschimansky.com/), [ReportLab](https://www.reportlab.com/), [python-barcode](https://github.com/WhyNotHugo/python-barcode), [matplotlib](https://matplotlib.org/), [openpyxl](https://openpyxl.readthedocs.io/), [gspread](https://gspread.readthedocs.io/)
