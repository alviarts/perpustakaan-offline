# v1.0.3 Backlog — 16 reported items

Reported by **vielz45@proton.me** during a hands-on smoke test of v1.0.2
on Windows on 2026-05-04 (after the v1.0.2 GitHub Release published).

Conventions:

- **Severity** — `bug` (regression / clearly broken) vs `enhancement` /
  `feature` (new capability or UX polish).
- **Scope** — `S` (one or two files, ≤ a few hours), `M` (a feature or
  cross-cutting fix, half a day), `L` (multi-file feature with schema
  changes, > 1 day), `XL` (multi-day, major surface).
- The screenshots referenced below live under
  [`screenshots/`](screenshots/).

---

## #1 — `FilePickerInput` preview broken across all 3 categories

**Severity:** bug · **Scope:** S–M · **Surfaces affected:** Settings →
Identitas (logo perpustakaan), Anggota → form (foto anggota), Buku →
form (cover buku).

User quotes:

> "ada bug ini sudah upload logo tidak tampil preview"
> "foto anggota juga tidak bisa kalau bisa kamu buat system yang compres
>  otomatis foto tetapi tetap kelihatan"
> "cover buku juga tidak ada preview dan tidak bisa upload"

Screenshots:

- `screenshots/01-logo-identitas-broken.png`
- `screenshots/03-foto-anggota-broken.png`
- `screenshots/05-cover-buku-broken.png`

After the user picks a file, the preview thumbnail renders a broken-image
icon (Logo Perpustakaan, Cover Buku) or stays blank (Foto Anggota — the
round mask hides the broken icon). The user also reports they "cannot
upload" the cover buku at all — needs reproduction to determine whether
the upload itself fails or only the preview.

See [`bug-analysis.md`](bug-analysis.md#1-filepickerinput-preview)
for the code-level investigation.

---

## #2 — Tooltips on icon-only buttons

**Severity:** enhancement · **Scope:** S · **Surfaces affected:** every
icon-only button in the app (header search, language toggle, theme
toggle, "Ganti kata sandi" key icon, edit / delete row actions, …).

User quote:

> "saya ingin kamu ini menambahkan text pop up overlay judul ini button
>  apa nah kalo yang saya arahkan ini kan kata sandi munculkan ganti
>  kata sandi"

Screenshot: `screenshots/02-key-icon-no-tooltip.png`.

Add a hover/focus tooltip to every icon-only button using the existing
shadcn `Tooltip` primitive (already in the dependency tree).

---

## #3 — Auto-compress photos on upload

**Severity:** feature · **Scope:** M · **Surfaces affected:**
`FilePickerInput` (anggota / buku / identitas), backup export.

User quote (combined with #1):

> "kalau bisa kamu buat system yang compres otomatis foto tetapi tetap
>  kelihatan, mungkin sistem nya kaya gini, klik upload pilih file saat
>  file sudah ter upload ke software otomatis melakukan compress file
>  dan nama taro di tmp software itu atau masukan ke path backup juga
>  atau excel"

Plan: client-side resize + JPEG/WebP quality reduction via a `<canvas>`
pipeline before handing the bytes to `assets_save`. Cap at e.g.
`max(800x800)` for member photos and `max(1200x1200)` for book covers.
No new native deps required.

---

## #4 — Date input calendar icon position + theme-aware color

**Severity:** bug · **Scope:** S · **Surfaces affected:** every
`<input type="date">` (DatePicker component + `AnggotaForm` two
hand-rolled date inputs).

User quote (combined from two messages):

> "logo kalender geser ke pojok tombol kanan atau perkecil shape kotak
>  itu, dan ketika dark mode logo tidak berwarna putih"
> "tombol kalendar pokoknya saat dark mode juga gelap saya mau putih
>  ketika dark mode hitam ketika white mode"

Screenshots:

- `screenshots/04-date-input-tanggal-daftar.png`
- `screenshots/07-date-input-tanggal-pinjam.png`

Two related fixes:

- Move the native calendar picker indicator to the right edge of the
  input (or shrink it). The current DatePicker draws a Lucide
  `Calendar` icon on the **left** and the browser still renders its own
  picker indicator on the **right**, so there are effectively two
  calendar marks per input.
- Make the `::-webkit-calendar-picker-indicator` honour the active
  theme: white in dark mode, black in light mode.

---

## #5 — Peminjaman page date row not responsive

**Severity:** bug · **Scope:** S · **Surface affected:** Peminjaman
form (`PeminjamanForm.tsx`).

User quote:

> "bug saat peminjaman hari ini keluar dari tombol buat tombol tombol
>  responsive ketika di windowed atau full screen"

Screenshot: `screenshots/06-peminjaman-buttons-overflow.png`.

`PeminjamanForm` puts the two `DatePicker`s in a `sm:grid-cols-2` row
inside a card that itself sits in a `lg:grid-cols-2` grid. At certain
window widths each column is too narrow for `[icon + dd/mm/yyyy + Hari
Ini]` and the "Hari Ini" button overflows / clips, leaving just an "H"
visible on the second row.

---

## #6 — Sinkronisasi Google Sheets — add setup tutorial

**Severity:** enhancement (with caveat) · **Scope:** S–M (UI only) /
L (if backend has been removed and we need to bring it back).

User quote:

> "saya ingin kamu memberikan tutor dibawah tabel singkronasi saat user
>  ingin sinkronasi ke google spreasheet"

Screenshot: `screenshots/08-sinkronisasi-google-sheets.png`.

⚠️ Open question — per
`.devin/handoff/v1.0.2/comparison-v1.0.1-vs-v1.0.2.md`, the Google
Sheets sync feature was **dropped permanently in v2** and replaced by
the local backup scheduler. The Sinkronisasi tab is still rendered
in Settings, though, so we need to confirm:

- Are the `sheets_sync_*` Tauri commands still wired up?
- Or is the tab a placeholder that should either be deleted or marked
  "coming soon" rather than receiving a tutorial?

The fix depends on which of those is true. See
[`bug-analysis.md`](bug-analysis.md#6-sinkronisasi-google-sheets) for
the next investigation step.

---

## #7 — Hak Akses table readability

**Severity:** enhancement · **Scope:** S · **Surface affected:**
Pengaturan → Hak Akses.

User quote:

> "apa bila ada table sepert ini lagi di bagi bagi ceklis nya dengan
>  tabel susah melihatnya"

Screenshot: `screenshots/09-hak-akses-table.png`.

The 8-column matrix (`ADMIN × {Lihat, Tambah, Ubah, Hapus} +
PUSTAKAWAN × {Lihat, Tambah, Ubah, Hapus}`) is hard to scan because all
columns share the same border colour and width. Plan: zebra-striped
rows, a thicker divider between the ADMIN and PUSTAKAWAN groups, a
`hover:` row highlight, and a sticky first column for the resource
labels.

---

## #8 — CRUD form max-width too narrow on fullscreen

**Severity:** bug · **Scope:** S · **Surfaces affected:**
`/anggota/$id`, `/anggota/new`, and likely every other CRUD form
(`max-w-3xl` is hard-coded across many routes).

User quote:

> "saya ingin juga ketika full screen layout ubah data anggota ini juga
>  menyesuaikan size windows"

Screenshot: `screenshots/10-form-edit-anggota-fullscreen.png`.

The `Ubah Data Anggota` form caps at `max-w-3xl` (~768px) regardless
of viewport, leaving huge empty gutters on a 1080p / 1440p / 4K
display. Fix: bump the cap responsively (e.g.
`max-w-3xl xl:max-w-5xl 2xl:max-w-7xl`) or switch to a fluid
container with `px-` padding.

---

## #9 — Cetak KTA: "Open output folder" button

**Severity:** feature · **Scope:** S · **Surface affected:**
`CetakKtaPage`.

User quote:

> "kasih tombol untuk otomatis membuka ke path folder hasil cetak kta"

Screenshot: `screenshots/11-cetak-kta-button.png`.

After the KTA file is generated, show a "Buka Folder Hasil" button that
calls the Tauri shell plugin (already a dependency) with the output
directory path. Should reveal the file in Explorer / Finder / the
host file manager rather than opening it.

---

## #10 — KTA template library (10 designs + customisation)

**Severity:** feature · **Scope:** XL · **Surface affected:**
KTA print pipeline + Settings (new "KTA Template" tab).

User quote (across two messages):

> "untuk template kta saya ingin anda memberikan 10 opsi desain kta
>  ambil source dari internet kta perpustakaan lalu tampilkan list
>  template kta, dan template kta itu bisa di customized juga ya"
> "untuk ukuran kta 8,56 cm x 5,398 cm seperti bentu atm atau credit
>  card"

Screenshot: `screenshots/12-kta-template-current.png`.

Confirmed dimensions: **CR-80 standard** — 85.60 mm × 53.98 mm
(credit-card / SIM / ATM card).

Plan (high level):

- 10 original template variants (different photo placement, accent
  colour, optional QR position, single-side vs dual-side).
- Settings → KTA Template tab with a thumbnail picker and a per-template
  customisation form (primary colour, secondary colour, heading font,
  optional background image, optional fields like NIS / kelas /
  tanggal terbit / berlaku sampai).
- Output rendered at 300 DPI for print, plus a print-preview modal
  honouring the active template.

⚠️ "Ambil source dari internet" — won't lift other people's designs
verbatim (copyright). The 10 templates will be original designs
inspired by common Indonesian school library card patterns, with
references kept in the PR description for transparency.

This is large enough to warrant its own milestone (proposed v1.0.5).

---

## #11 — Laporan Kas: editable entries + manual entries

**Severity:** feature · **Scope:** L · **Surface affected:**
Laporan → Kas + the SQLite `kas` table + `commands/laporan.rs`.

User quote:

> "untuk kas ini bisa di edit juga pemasukan dan pengeluarnya mungkin
>  nanti user salah memasukan input data bisa di edit di kas ini"

Screenshot: `screenshots/13-laporan-kas.png`.

Today the Kas list is read-only — entries are auto-generated when a
`pengembalian` records a denda, and there is no manual entry path.
User wants both:

- Add manual kas entries (jenis pemasukan / pengeluaran, kategori,
  nominal, keterangan, tanggal).
- Edit / delete existing entries (with a warning when deleting an
  auto-generated entry that is linked to a peminjaman / pengembalian).
- Audit log line for every edit / delete so the change is traceable.

Schema impact: add `manually_adjusted` boolean + a `kas_audit` table
(or reuse `audit_log`).

---

## #12 — Dashboard quote-of-the-day + live clock

**Severity:** feature · **Scope:** S · **Surface affected:**
Dashboard route.

User quote:

> "saya ingin di dashboard disini ada yang auto generate quotes berbeda
>  setiap hari nya selalu update dan tanggal atau jam sikron dengan
>  komputer"

Screenshot: `screenshots/14-dashboard-header.png`.

Two small additions:

- A bundled quotes file (~365 entries, Indonesian + English) and a
  deterministic `dayOfYear`-based selector so the same quote shows for
  every user on a given day, regardless of network state.
- A live clock + locale-formatted date in the dashboard header, ticking
  every second from `Date.now()` (no timezone conversion needed — uses
  the OS locale already).

---

## #13 — Modern custom title bar

**Severity:** feature · **Scope:** M · **Surface affected:**
Tauri config (`decorations: false`) + new `TitleBar` React component +
window-control IPC.

User quote:

> "untuk atas aplikasi ini saya ingin lebih tampil moderen mungkin
>  seperti itu"

Screenshots:

- `screenshots/15-titlebar-current.png`
- `screenshots/16-titlebar-edge-reference.png`

Replace the native OS title bar with a custom 32–40 px React title bar:
app icon + product name on the left, `data-tauri-drag-region` filling
the middle, custom min/max/close buttons on the right, theme-aware
styling matching dark / light. Double-clicking the drag region toggles
maximise.

Pre-requisite: confirm `tauri-plugin-window-state` (or equivalent
window control IPC) is configured.

---

## #14 — NSIS / WiX installer artwork stretched

**Severity:** bug · **Scope:** S · **Surface affected:**
`apps/desktop/src-tauri/icons/source/{nsis-sidebar,nsis-header,wix-banner,wix-dialog}.bmp`.

User quotes:

> "perbagus lagi untuk tampilan instaler logo sebelah kiri streching
>  seperti itu"
> "logo ini juga streching"

Screenshots:

- `screenshots/17-installer-welcome-stretched.png`
- `screenshots/18-installer-complete-stretched.png`

The current bitmaps look like a small source image upscaled to fill
the slot, leaving the open-book + lamp logo visibly distorted. Plan:
re-export each bitmap from a vector master at the exact slot dimensions
(NSIS sidebar 164×314, NSIS header 150×57, WiX banner 493×58, WiX
dialog 493×312). Validate visually by running an installer build in
CI and inspecting the artefacts.

---

## #15 — Brand rename: "Perpustakaan Offline" → "Perpustakaan Nusantara"

**Severity:** feature · **Scope:** M · **Surface affected:**
`tauri.conf.json` (`productName`, window title, descriptions),
`README.md`, `docs/manual.md`, login screen, About dialog, sidebar
default identity, installer bitmaps.

User quote:

> "ganti nama dengan perpustakaan offline menjadi perpustakaan
>  nusantara di instaler atau pun software"

Screenshot: `screenshots/19-app-name-current.png`.

Caveat: changing `productName` changes the install directory + Start
Menu shortcut + uninstall key. Existing v1.0.x users will see two
entries in *Apps & features* until they uninstall the old one. The
SQLite database will keep working because the **bundle identifier**
(`id.alviarts.perpustakaan`) stays the same and the DB lives under
`<APPDATA>/<bundle identifier>/`. Need explicit confirmation from the
user before flipping the identifier (which would force a manual
migration).

---

## #16 — User profile dialog (admin biodata)

**Severity:** feature · **Scope:** L · **Surface affected:**
Header user dropdown → new "Profil" route, `users` table schema,
auth store.

User quote:

> "saya ingin disini ada pop up edit admin seperti mengganti foto dan
>  mengganti nama user di dalam tetapi login tetap admin, mungkin
>  tanggal lahir, seperti biodata admin perpustakaan lah"

Screenshot: `screenshots/20-user-dropdown-profil.png`.

Editable fields: foto (using the fixed FilePickerInput from #1, with
auto-compress from #3), nama lengkap (display name shown in the
dropdown instead of "Administrator"), tanggal lahir, tempat lahir,
no. telepon, email, alamat, jenis kelamin, agama. Username remains
immutable.

Schema impact: add nullable biodata columns to `users` (or create a
`user_profiles` table with FK to `users.id`). The avatar slot in the
header should render the user's foto with a fallback to their initial.

Bonus: if multi-user mode is enabled (Pustakawan accounts created in
Hak Akses), each user gets their own biodata.
