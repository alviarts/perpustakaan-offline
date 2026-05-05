# v1.0.7 Bug Batch — Progress Tracker

Single source of truth for which item is next. Companion to [`BUGS.md`](./BUGS.md) (full detail) and [`WORKFLOW.md`](./WORKFLOW.md) (Devin-session protocol).

## How to read this

- A future Devin session picks the **first row with `status: OPEN`** in the order below.
- After opening a PR, update the row to `status: IN_PR` and add the `pr` URL.
- After the user merges, update to `status: DONE` + `completed_at`.
- Update the row order ONLY if the user redirects priorities.

## Status table

| id      | pr_group | title                                                                                              | severity | status | pr  | completed_at | depends_on |
| ------- | -------- | -------------------------------------------------------------------------------------------------- | -------- | ------ | --- | ------------ | ---------- |
| BUG-01  | A        | Sirkulasi (Webcam): scan QR KTA `member:1` → toast "Kode tidak dikenali"                           | HIGH     | IN_PR  | #120 | —            | —          |
| BUG-17  | A        | Sirkulasi (Kembalikan): scan eksemplar barcode → "tidak ada peminjaman aktif" walau ada loan aktif | HIGH     | IN_PR  | #120 | —            | —          |
| BUG-18  | A        | Barcode/QR scanner susah baca walau barcode terlihat jelas (tuning camera + decoder)               | MEDIUM   | IN_PR  | #120 | —            | —          |
| FEAT-07 | A        | Rename tombol Sirkulasi: Pinjam → "Scan Anggota Pinjam", Kembalikan → "Scan Kembalikan Pinjaman"   | LOW      | IN_PR  | #120 | —            | —          |
| BUG-09  | B        | Aturan Peminjaman "Maksimum buku" = 3 tapi sistem block di 2; audit semua setting peminjaman       | HIGH     | IN_PR  | #121 | —            | —          |
| BUG-10  | B        | Toast error peminjaman menampilkan raw JSON `{"code":"validation",...}`                            | MEDIUM   | IN_PR  | #121 | —            | —          |
| FEAT-08 | B        | Pengembalian: quick-input buttons (1×/2×/3× denda per hari) di field Bayar Denda                   | MEDIUM   | IN_PR  | #121 | —            | BUG-09     |
| BUG-02  | C        | Template KTA: QR code gepeng (aspect ratio rusak) di semua template                                | HIGH     | IN_PR  | #122 | —            | —          |
| BUG-06  | C        | KTA preview: foto anggota tampil sebagai broken-image (verify saat eksekusi)                       | MEDIUM   | IN_PR  | #122 | —            | —          |
| FEAT-03 | C        | KTA depan: tambah field biodata lengkap + TTD kepala sekolah                                       | MEDIUM   | IN_PR  | #122 | —            | —          |
| FEAT-04 | C        | KTA back-side editable per-template + Tata Tertib default + cetak halaman 2                        | MEDIUM   | IN_PR  | #122 | —            | FEAT-03    |
| BUG-05  | D        | Pengaturan: action bar (Jadikan Default / Hapus / Simpan) mepet bawah window                       | MEDIUM   | IN_PR  | #123 | —            | —          |
| BUG-12  | D        | Layout halaman Cetak KTA + Cetak Label & Barcode mepet ke border kiri/kanan                        | MEDIUM   | IN_PR  | #123 | —            | —          |
| BUG-14  | D        | Topbar global search: placeholder wrap & nabrak garis container                                    | LOW      | IN_PR  | #123 | —            | —          |
| BUG-16  | D        | Sidebar tab Pengaturan hilang saat scroll konten tab — harus sticky/fixed                          | MEDIUM   | IN_PR  | #123 | —            | —          |
| FEAT-13 | D        | Cetak Label & Barcode Buku: tombol "Buka Folder Hasil" + link buka folder di toast PDF             | LOW      | IN_PR  | #123 | —            | —          |
| FEAT-15 | D        | Manual: FAB pojok kanan bawah scroll cepat ke atas / Daftar Isi                                    | LOW      | IN_PR  | #123 | —            | —          |
| FEAT-11 | E        | Dashboard quote-of-the-day rotasi tiap 5 menit dengan animasi                                      | LOW      | OPEN   | —   | —            | —          |

## Release plan

When all rows above are DONE:

| id      | title                                               | status | pr  | completed_at |
| ------- | --------------------------------------------------- | ------ | --- | ------------ |
| RELEASE | chore(release): bump versions to v1.0.7 + CHANGELOG | OPEN   | —   | —            |
