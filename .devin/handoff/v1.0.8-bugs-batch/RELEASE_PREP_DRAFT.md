# v1.0.8 Release Prep — CHANGELOG Draft

This file contains a **draft `[1.0.8]` section** ready to be merged into
`CHANGELOG.md` during the v1.0.8 release PR (PR I).

**Status:** WORKING DRAFT. Do not commit to `CHANGELOG.md` yet — the release
PR per [`WORKFLOW.md`](./WORKFLOW.md) lines 191–222 owns that edit, after every
v1.0.8 item PR is merged.

The structure mirrors the `[1.0.7]` section verbatim: bilingual (id-leading)
summary, bullet items reference both PR (`#NNN`) and batch ID (`(BUG-NN, PR X)`).

---

## [1.0.8] - YYYY-MM-DD

### Added

- **KTA: 10 desain template baru (total ~20)** — Template Editor sekarang
  ship dengan 20 preset desain yang siap dipakai out-of-the-box (10 baru
  ditambahkan dari 10 sebelumnya). Operator bisa pilih cepat lewat dropdown
  preset di Pengaturan KTA, lalu kustomisasi field bebas. (#127, FEAT-16, PR A)

- **Peminjaman: perpanjangan otomatis 1-klik** — di halaman Detail
  Peminjaman (per anggota) sekarang ada tombol "Perpanjang" yang extend
  tanggal jatuh tempo + audit trail di `peminjaman_audit`. Maksimum
  jumlah perpanjangan diatur di Pengaturan → Aturan Peminjaman
  (`max_perpanjangan`, default 1×). (#128, FEAT-17, PR B)

- **Buku: reservasi/booking saat dipinjam** — anggota / operator bisa
  reserve buku yang sedang dipinjam orang lain, masuk ke FIFO queue di
  `reservasi_buku`. Saat buku dikembalikan, sistem auto-promote
  reservasi terdepan jadi "siap diambil" + notifikasi UI di operator.
  (#128, FEAT-18, PR B)

- **Anggota: bulk import dari Excel/CSV** — wizard upload `.xlsx` / `.csv`
  (template downloadable) → preview rows → validasi NIS unik + format
  field → commit. Backend pakai `calamine` untuk parse Excel. Mode
  overwrite (replace by NIS) tersedia untuk re-import periodik.
  (#129, FEAT-19, PR C)

- **Buku: bulk import via ISBN** — paste daftar ISBN, fetch metadata
  via Open Library + Google Books API (fallback chain), preview, commit.
  Cover URL otomatis di-resolve. Field yang tidak available dari API
  bisa di-edit di review step sebelum commit. (#129, FEAT-20, PR C)

- **Anggota: surat keterangan bebas pustaka (SBP)** — auto-generate PDF
  saat anggota tidak punya tunggakan + tidak punya peminjaman aktif.
  Tombol "Cetak SBP" muncul di profil anggota kalau eligible. Template
  customizable di Pengaturan → SBP (kop sekolah, nama kepala perpustakaan,
  tanggal terbit, dll). (#130, FEAT-21, PR D)

- **Wishlist anggota: request pengadaan buku** — anggota submit form
  "Usulkan Buku Baru" (judul, pengarang, alasan opsional). Admin queue
  di Pengaturan → Wishlist tampilkan list usulan + voting count + status
  (pending / approved / rejected / acquired). Foundation untuk procurement
  workflow di v1.0.9+. (#130, FEAT-22, PR D)

- **Stocktake/Opname mode** — workflow inventarisasi: scan barcode buku
  satu per satu (pakai webcam scanner), buku ter-mark "found" di sesi
  opname aktif. Setelah selesai, report tampilkan list buku yang TIDAK
  ter-scan = potential missing/lost. Sesi opname disimpan di tabel
  `opname_session` + `opname_scan` untuk audit historis. (#131, FEAT-23, PR E)

- **Backup enhancement: cloud target via rclone + AES-256 encryption** —
  selain backup lokal, sekarang bisa configure remote rclone (Drive,
  Dropbox, OneDrive, dll). Backup file di-encrypt AES-256 dengan password
  per-instance sebelum upload. History list tampilkan timestamp +
  size + remote path + status (success / failed) untuk audit. (#132, FEAT-24, PR E)

- **Dashboard: chart trend mingguan/bulanan + heatmap + insights cards** —
  3 chart baru di home dashboard: line trend pinjaman 7-hari & 30-hari,
  heatmap waktu pinjam (hari × jam), dan 4 insights cards (top peminjam,
  top buku, peak hour, retention rate). Semua data di-aggregate dari
  `peminjaman` + `transaksi` di-frontend untuk akses offline. (#134, FEAT-25, PR F)

- **Google Sheets bidirectional sync MVP** — anggota table sekarang bisa
  push/pull delta ke Google Sheets sebagai backbone multi-device sync.
  Scheduler cron 5-menit + conflict-resolve (last-write-wins per row,
  audit log di `sheets_sync_audit`). Phase 1 cover anggota; phase 2
  (buku, peminjaman) di v1.0.9. (#133, FEAT-26, PR G)

- **OPAC public-mode + kiosk fullscreen lock** — `desktop.app_mode`
  setting (`admin` | `public`) yang ngubah whole UI saat boot. Public
  mode: fullscreen + decorations off + alwaysOnTop, search bar + grid
  buku publik, scan KTA opsional untuk personalisasi (history pinjam,
  wishlist, reservasi). Tombol "Mode Admin" (lock icon) di bottom-right
  → password verify (3-strike 60s lockout) → reload ke admin. Idle 2
  menit auto-reset ke OPAC home. **Catatan:** ship dengan fallback
  same-device-only (multi-device sync via FEAT-26 di-defer ke v1.0.9
  kalau diperlukan). (#136, FEAT-27, PR H)

- **Sirkulasi scanner: overlay aiming + ROI decode + preprocessing v2** —
  redesign full webcam scanner: overlay aiming reticle, decode hanya
  region of interest (33% center), 3-pass image preprocessing (grayscale
  → contrast → threshold), tambah DataMatrix ke supported formats,
  manual "Scan Sekarang" button untuk fallback poor lighting, optional
  torch button (kalau device support). 33 unit test baru (272 → 305
  vitest total saat itu). (#135, FEAT-28, PR J)

### Fixed

- **KTA PDF export: foto anggota tidak gepeng (preserve aspect ratio)** —
  rendering foto anggota di PDF KTA sekarang pakai 2-layer smart-fit:
  (a) clip mask preserve aspect ratio asal (tidak stretch ke ratio slot),
  (b) zoom-to-cover supaya foto fill slot tanpa border kosong. Sebelumnya
  foto landscape di slot portrait (atau sebaliknya) gepeng tidak proporsional.
  (#127, BUG-19, PR A)

### Notes

- v1.0.8 fokus pada **fitur bulk-ops + integrations + OPAC**: bulk import
  anggota & buku (FEAT-19, FEAT-20), surat keterangan bebas pustaka
  (FEAT-21), wishlist anggota (FEAT-22), stocktake (FEAT-23), backup cloud
  (FEAT-24), dashboard analytics (FEAT-25), Sheets sync MVP (FEAT-26),
  OPAC public-mode (FEAT-27), dan scanner reliability v2 (FEAT-28).
- 1 bug fix critical: BUG-19 KTA aspect-ratio.
- 13 PR groups (A–H, J), 1 release PR (I).
- Total ~20 KTA presets sekarang ship by default (10 baru + 10 lama).
- Vitest count terus bertumbuh: v1.0.7 ship dengan 272, v1.0.8 target ≥292+
  (sirkulasi v2 + OPAC unit test).
- OPAC ship dengan **same-device-only fallback** per BUGS.md FEAT-27 line 751
  — multi-device sync via FEAT-26 sudah ready tapi OPAC tidak hard-depend
  on it untuk single-device deployment.

---

## TODO before merging into CHANGELOG.md

- [ ] Update YYYY-MM-DD ke tanggal release actual.
- [ ] Verify semua 9 PR (#127, #128, #129, #130, #131, #132, #133, #134, #135, #136)
      sudah merged ke main sebelum copy section ini ke `CHANGELOG.md`.
- [ ] Cross-check setiap bullet point dengan PR description final
      (PR body bisa berubah selama review).
- [ ] Tambah section `### Removed` kalau ada deprecation (currently kosong).
- [ ] Run `pnpm i18n:lint` setelah CHANGELOG update untuk pastikan tidak ada
      regression i18n parity (CHANGELOG bukan i18n file tapi gate harus tetap green).

## Version-bump checklist (PR I)

Per WORKFLOW.md "Release PR" section:

1. `package.json` (root): `"version": "1.0.7"` → `"version": "1.0.8"`
2. `apps/desktop/package.json`: same
3. `apps/desktop/src-tauri/Cargo.toml`: `version = "1.0.7"` → `version = "1.0.8"`
4. `apps/desktop/src-tauri/tauri.conf.json`: `"version": "1.0.7"` → `"version": "1.0.8"`
5. Run `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` untuk
   auto-update `Cargo.lock`.
6. Copy `## [1.0.8]` section dari file ini ke CHANGELOG.md (di atas `[1.0.7]`).
7. Local gates (typecheck + lint + i18n:lint + test + build) all green.
8. Commit `chore(release): v1.0.8` + push + open PR (NOT draft).
9. Wait CI green → merge → tag `v1.0.8` → push tag → release-v2 workflow
   auto-publishes GitHub Release dengan installer assets.
