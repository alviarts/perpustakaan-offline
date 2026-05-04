# References — Screenshot revisi v2

> Folder ini menampung 36 screenshot yang berfungsi sebagai **referensi
> visual** untuk 26 revisi di `REVISION_BACKLOG.md`. Beberapa revisi punya
> >1 referensi (misal sebelum/sesudah, light/dark) → karena itu total ~36.
>
> **Diisi manual oleh user** (alvi arts). Devin tidak generate referensi
> visual; hanya merefer dari `REVISION_BACKLOG.md` dan
> `sessions/SESSION_NN.md`.

## Naming convention

`revision-NN-<short-name>[-<variant>].png`

- `NN` = nomor revisi (01–26), zero-padded.
- `<short-name>` = slug kebab-case (e.g. `login`, `sidebar`, `dashboard`).
- `<variant>` (opsional) = `before`, `after`, `light`, `dark`, `mobile`,
  `1`, `2`, dst.

## Daftar reference yang diharapkan

| Revisi | File pattern | Catatan |
|---|---|---|
| #1 Logo installer + .exe icon | `revision-01-installer-logo.png` | Mock tampilan Start Menu / Taskbar |
| #2 Hapus language picker | `revision-02-no-language-picker.png` | Sebelum/sesudah |
| #3 License + wizard graphic | `revision-03-license-and-wizard.png`, `revision-03-wizard-banner.png` | License page + wizard side-banner |
| #4 Manual HTML | `revision-04-manual-html.png`, `revision-04-manual-mobile.png` | Desktop + mobile responsif |
| #5 Login redesign | `revision-05-login.png`, `revision-05-login-dark.png` | 2 variant |
| #6 Asset quality | `revision-06-assets-undraw.png`, `revision-06-assets-storyset.png` | Contoh asset SVG/PNG |
| #7 Sidebar collapsible | `revision-07-sidebar.png`, `revision-07-sidebar-collapsed.png` | Expanded + collapsed |
| #8 Theme switcher | `revision-08-theme-switcher.png` | Popup 3 row |
| #9 Dashboard modern | `revision-09-dashboard.png`, `revision-09-dashboard-empty.png` | Filled + empty state |
| #10 Ingat saya | `revision-10-remember-me.png` | Login screen highlight checkbox |
| #11 Sync identitas | `revision-11-identity-sync.png` | Multi-component visual |
| #12 Date picker | `revision-12-date-picker.png` | Calendar popup ID locale |
| #13 Resize glitch fix | `revision-13-resize-glitch.png` | Animasi sequence resize |
| #14 KTA komplit | `revision-14-kta.png`, `revision-14-kta-editor.png` | Card + editor |
| #15 Live search | `revision-15-live-search.png` | Search bar + result highlight |
| #16 Buku layout | `revision-16-buku-layout.png` | Master/detail |
| #17 Master data | `revision-17-master-data.png` | Settings tabs 6 master |
| #18 Kunjungan | `revision-18-kunjungan.png` | Quick stats + ilustrasi transparan |
| #19 Dropdown styled | `revision-19-dropdown.png` | Popup match width |
| #20 Autocomplete | `revision-20-autocomplete.png` | 2-line item suggestion |
| #21 Peminjaman komplit | `revision-21-peminjaman.png` | 2-kolom + panel info |
| #22 Window resize | `revision-22-window-resize.png` | Min/max state |
| #23 Laporan komplit | `revision-23-laporan.png`, `revision-23-laporan-charts.png` | Sub-nav + charts |
| #24 Settings 12 kategori | `revision-24-settings.png`, `revision-24-settings-search.png` | 12 sub-page + search |
| #25 Wording audit | `revision-25-wording.png` | Sebelum/sesudah label |
| #26 Scroll polish | `revision-26-scroll.png` | Scrollbar fade |

## Fallback

Kalau referensi belum ada saat sesi dimulai, Devin pakai screenshot v1
di `docs/screenshots/` sebagai baseline visual:

| v1 screenshot | Relevansi |
|---|---|
| `01-login.png` | Baseline #5 |
| `02-dashboard.png` | Baseline #9 |
| `03-anggota.png` | Baseline #15, #19, #20 |
| `04-buku.png` | Baseline #16, #17 |
| `05-kunjungan.png` | Baseline #18 |
| `06-peminjaman.png` | Baseline #21 |
| `07-pengembalian.png` | Baseline pengembalian (sesi 6) |
| `08-laporan.png` | Baseline #23 |
| `09-setting.png` | Baseline #24 |
| `10-setting-bahasa.png` | Baseline #25 (bahasa) |
| `11-setting-sync.png` | Baseline Settings sub-page sinkronisasi |
| `12-laporan-grafik.png` | Baseline #23 (grafik) |
| `13-laporan-top-peminjam.png` | Baseline #23 (top peminjam) |
| `14-naik-kelas.png` | Baseline anggota naik kelas |
| `15-cetak-nota.png` | Baseline #21 (nota) |
| `16-tools-duplikat.png` | Baseline tools (Devin 11 settings opsional) |
| `17-audit-log.png` | Baseline audit log (Devin 11) |
