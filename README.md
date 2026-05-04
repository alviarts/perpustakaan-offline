# Perpustakaan Offline (SIM-Perpus Reborn) — v2

> Aplikasi **Sistem Informasi Manajemen Perpustakaan** (SIM-Perpus) berbasis **Tauri 2 + React 18 + TypeScript + SQLite** yang berjalan **100% offline** dan dapat dikemas menjadi **MSI / NSIS installer** Windows, `.deb` Linux, atau `.app` macOS. Cocok untuk perpustakaan **sekolah / madrasah**.

Inspirasi: SIM-Perpus v.1.2.2 (Excel + VBA) oleh **Kang Sur**, ditulis ulang menjadi aplikasi desktop modern dengan tetap mempertahankan alur kerja yang familiar bagi pustakawan sekolah.

---

## Fitur Utama

- **Login multi-user** (admin + pustakawan + role custom) dengan hashing bcrypt
- **Lupa password offline** via security question (PR #74)
- **Dashboard** real-time: total anggota, total buku (titles + eksemplar), buku dipinjam, kunjungan hari ini, distribusi DDC (donut + bar), kunjungan harian (line)
- **Master Data Anggota**: input/edit/hapus, **import/export Excel**, foto profil (file picker), filter & sort, **Naik Kelas batch**, **Surat Bebas Pustaka**, cetak KTA per anggota / batch
- **Master Data Buku**: input/edit/hapus, **import Excel**, cover (file picker), klasifikasi DDC (seeded), filter & sort, **cetak label & barcode** per eksemplar
- **Transaksi**: Kunjungan, Peminjaman, Pengembalian, Buku Hilang — lengkap dengan **riwayat per anggota** dan dukungan barcode scanner
- **Laporan**: Backup manual + **scheduler cron-like** (PR #75), Top Peminjam, Top Buku, **Grafik Kunjungan** (harian / bulanan / tahunan), **Kas** (otomatis dari denda + entry manual)
- **Settings (12 tab)**: Identitas + logo, Akun + security question, Hak Akses (RBAC), Aturan Peminjaman, Tampilan (theme + bahasa), Master Data (kelas / jurusan / agama / kategori / penerbit / DDC override), Backup, Sinkronisasi, Audit Log, Manual book inline (PR #76), Tentang
- **Bilingual full**: Indonesia / English — toggle live di Settings → Tampilan, parity dijaga oleh `pnpm i18n:lint`
- **Header tools**: Ctrl+K **global search palette** (anggota + buku + peminjaman, PR #72), bantuan inline, theme toggle
- **System tray** + close-behavior setting (minimize-to-tray vs close)
- **Build native** untuk Windows (MSI + NSIS), Linux (.deb), macOS (.app) lewat `tauri build`

---

## Stack Tech

- **Backend:** Rust 1.95.0 + Tauri 2.11 + rusqlite 0.32 + bcrypt 0.16 + sha2 + chrono
- **Frontend:** React 18 + TypeScript 5 + Vite 5 + Tailwind 3 + shadcn/ui (Radix primitives) + Zustand + TanStack Router (file-based) + React Hook Form + Vitest
- **i18n:** i18next + react-i18next, locale di `apps/desktop/src/i18n/{id,en}/*.json`
- **Charts:** Recharts (dashboard + laporan)
- **Excel:** `xlsx` (SheetJS)
- **Markdown:** `react-markdown` + `remark-gfm` (manual book inline)
- **Workspace:** pnpm 9 monorepo (`apps/desktop/`, `apps/desktop/src-tauri/`, `apps/manual/`, `packages/shared/`)
- **Identifier:** `id.alviarts.perpustakaan` (`apps/desktop/src-tauri/tauri.conf.json`)

---

## Persyaratan Development

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0 (`corepack enable && corepack prepare pnpm@9.15.1 --activate`)
- **Rust** stable ≥ 1.95.0 (`rustup update stable`) — required for `edition2024` di transitive deps
- **OS-specific Tauri prereqs:**
  - **Linux (Ubuntu 22.04+):** `sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev pkg-config`
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Windows:** WebView2 (sudah ada di Windows 11), [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

---

## Quick Start (Development)

```bash
# 1. Clone
git clone https://github.com/alviarts/perpustakaan-offline.git
cd perpustakaan-offline

# 2. Install dependencies (semua workspace)
pnpm install --frozen-lockfile

# 3. Jalankan dev server (hot reload + Tauri devtools)
pnpm tauri:dev
```

`pnpm tauri:dev` akan:
1. Bundle frontend Vite di `http://localhost:1420`
2. Compile backend Rust + Tauri runtime
3. Buka window aplikasi langsung — DB SQLite + seed data otomatis dibuat saat pertama jalan

**Login default:** `admin` / `admin123` (wajib diubah saat login pertama).

### Alternatif: dev frontend saja (browser-mode mock)

Untuk iterasi cepat di UI tanpa compile Rust:

```bash
pnpm --filter @perpustakaan/desktop dev
# buka http://localhost:1420 di browser
```

Browser-mode akan otomatis pakai `mockRpc` di tiap `lib/<feature>.ts` — RPC ke Tauri di-stub dengan in-memory state, jadi sebagian besar UI bisa dieksplorasi tanpa backend.

---

## Build Production

```bash
# Build native installer (Windows: MSI+NSIS, Linux: .deb, macOS: .app)
pnpm tauri:build
```

Output ada di `apps/desktop/src-tauri/target/release/bundle/`:

- **Windows:** `msi/PerpustakaanOffline_<version>_x64_en-US.msi` + `nsis/PerpustakaanOffline_<version>_x64-setup.exe`
- **Linux:** `deb/perpustakaan-offline_<version>_amd64.deb` + `appimage/perpustakaan-offline_<version>_amd64.AppImage`
- **macOS:** `dmg/PerpustakaanOffline_<version>_aarch64.dmg`

Cross-build tidak didukung Tauri — build di OS target masing-masing (atau pakai CI matrix).

---

## Database & Data Files

SQLite database + asset files dibuat otomatis di app data dir:

- **Linux:** `~/.local/share/id.alviarts.perpustakaan/`
- **Windows:** `%APPDATA%\id.alviarts.perpustakaan\`
- **macOS:** `~/Library/Application Support/id.alviarts.perpustakaan/`

Isi:
- `perpustakaan-v2.db` — main SQLite database
- `uploads/{anggota,buku,identitas}/` — foto anggota, cover buku, logo perpus (PR #69)
- `backups/perpustakaan-<timestamp>.db[.sha256]` — output backup manual + scheduler

---

## Struktur Project

```
perpustakaan-offline/
├── apps/
│   ├── desktop/                  # Frontend React + backend Tauri
│   │   ├── src/                  # React + TypeScript
│   │   │   ├── components/       # shadcn/ui primitives + layout
│   │   │   ├── features/         # Feature modules (anggota, buku, dashboard, ...)
│   │   │   ├── i18n/{id,en}/     # JSON locale files (parity-checked)
│   │   │   ├── lib/              # RPC wrappers (Tauri impl + browser-mode mock)
│   │   │   ├── routes/           # TanStack Router file-based routes
│   │   │   └── stores/           # Zustand global stores
│   │   ├── src-tauri/            # Rust backend
│   │   │   ├── src/
│   │   │   │   ├── commands/     # Tauri commands per fitur
│   │   │   │   ├── db/           # SQLite schema + migrations
│   │   │   │   ├── error.rs      # AppError enum
│   │   │   │   └── lib.rs        # Tauri::Builder + invoke_handler
│   │   │   ├── capabilities/     # Tauri 2 capability allowlists
│   │   │   ├── icons/            # App icons (.ico/.icns/.png)
│   │   │   └── tauri.conf.json   # Tauri runtime config
│   │   └── tests/unit/           # Vitest tests
│   └── manual/                   # (legacy v0.1, scheduled to be removed in PR #76)
├── packages/shared/              # Shared TS types between frontend & dev tooling
├── docs/
│   ├── manual.md                 # End-user manual (rendered inline by PR #76)
│   ├── bugs/                     # Post-v1 bug tracker (POST_V1_BUGS.md, PROGRESS.md)
│   └── migration-v2/             # Sesi 1–12 migration notes (REVISION_BACKLOG.md, PROGRESS.md)
├── scripts/                      # Dev tooling (i18n-lint, extract-changelog)
├── package.json                  # v2 root: workspace scripts
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── CHANGELOG.md                  # Keep-a-Changelog format (PR #73)
└── README.md
```

---

## Quality Gates (run sebelum commit / push)

```bash
# Frontend (root + apps/desktop)
pnpm i18n:lint                                                # id ↔ en parity
pnpm typecheck                                                # tsc --noEmit semua workspace
pnpm --filter @perpustakaan/desktop lint                      # eslint --max-warnings=0
pnpm --filter @perpustakaan/desktop test -- --run             # Vitest semua
pnpm --filter @perpustakaan/desktop build                     # produce dist/ (dipakai Tauri)
pnpm exec prettier --write <files-yang-diubah>                # format

# Backend (apps/desktop/src-tauri)
cd apps/desktop/src-tauri
cargo check --all-targets
cargo clippy --all-targets -- -D warnings
cargo test --lib
rustfmt src/path/to/changed.rs                                # format per-file (lihat catatan di bawah)
```

> ℹ️ **Catatan rustfmt:** Hindari `cargo fmt --all` kecuali kamu memang mau bersihkan drift di seluruh repo. Per file lebih aman supaya scope diff tetap jelas.

CI (`.github/workflows/ci-v2.yml`) menjalankan:
- **Lint + Typecheck + Unit Test (Node 20)** — required untuk semua PR
- **Rust check (Tauri backend)** — required untuk semua PR
- **Build Windows installer** — hanya di tag push (skip di PR)
- **Publish v2 GitHub Release** — hanya di tag push (skip di PR)

---

## Untuk Kontributor / AI Agent

Kalau kamu mengerjakan task baru:

1. **Baca dulu** `docs/manual.md` (end-user) dan `docs/migration-v2/PROGRESS.md` (engineering history)
2. **Pull latest main** dan buat branch baru: `git checkout -b devin/$(date +%s)-<short-name>`
3. **Setup environment**: `pnpm install --frozen-lockfile` (lihat Persyaratan Development di atas untuk Tauri prereqs per OS)
4. **Run dev**: `pnpm tauri:dev` (untuk full Tauri experience) atau `pnpm --filter @perpustakaan/desktop dev` (browser-mode mock)
5. **Tulis tests**: Vitest di `apps/desktop/tests/unit/`, cargo `#[cfg(test)] mod tests` inline di file Rust
6. **Run quality gates** (lihat section di atas) — semua harus pass sebelum commit
7. **i18n parity**: kalau ada string baru, tambah di `i18n/id/<ns>.json` **dan** `i18n/en/<ns>.json`. `pnpm i18n:lint` harus clean.
8. **PR ke `main`** dengan deskripsi yang jelas + Review Checklist for Human. CI di `ci-v2.yml` otomatis verify lint + typecheck + vitest + rust-check
9. **Tag baru → auto-release**: lihat section [Release process](#release-process) di bawah

Konvensi:

- **Conventional commits** (English): `<type>(<scope>): <description>` — `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Branch naming:** `devin/<unix-timestamp>-<short-kebab-name>` (timestamp prevents collisions)
- **Tanggal/waktu** disimpan sebagai TEXT ISO-8601 di SQLite, uang INTEGER rupiah
- **Kode anggota** auto `A0001`, kode buku auto `B0001`, eksemplar `B0001-01`/`-02`/...
- **DB path runtime** ditentukan di `apps/desktop/src-tauri/src/db/mod.rs::resolve_db_path()` (cross-platform via `directories::ProjectDirs`)
- **JANGAN commit** `*.db`, `target/`, `node_modules/`, file binary, atau secret apa pun
- **Path-traversal safety** wajib di tiap command yang nerima path user — lihat `commands/assets.rs` sebagai pola

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
- Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Router](https://tanstack.com/router), [Recharts](https://recharts.org/), [SheetJS](https://sheetjs.com/), [react-markdown](https://github.com/remarkjs/react-markdown)
