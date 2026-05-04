# Stack Decision — Migration v2

> Analisis keputusan stack untuk migrasi v1 (Python + customtkinter) → v2.
> Setiap keputusan didukung tabel pro/kontra + rekomendasi default.
> Devin 2 dst. WAJIB ikut keputusan ini kecuali ada alasan kuat (didiskusikan
> di PR review user).

## Ringkasan keputusan

| Layer | Pilihan | Default v2 |
|---|---|---|
| Desktop runtime | Tauri 2.0 vs Electron | **Tauri 2.0** |
| Frontend framework | React 18 + TS | React 18 + TS |
| Styling | Tailwind 3 + shadcn/ui | Tailwind 3 + shadcn/ui |
| State management | Zustand vs Redux Toolkit | **Zustand** |
| Routing | TanStack Router vs React Router | **TanStack Router** |
| DB strategy | better-sqlite3 vs sqlx (Rust) vs Python sidecar | **sqlx (Rust)** via `tauri-plugin-sql` |
| Build tool | Vite | Vite |
| Package manager | pnpm | pnpm |
| Unit test | Vitest | Vitest |
| E2E test | Playwright (Tauri WebView) | Playwright |
| Charts | recharts vs chart.js vs visx | **recharts** |
| Icons | `@phosphor-icons/react` | Phosphor (port dari v1) |
| Animation | Framer Motion (selektif) + Tailwind | Framer Motion |
| PDF | `pdf-lib` (browser) atau `printpdf` (Rust) | **`pdf-lib`** (frontend) |

---

## 1. Desktop runtime — Tauri 2.0 vs Electron

| Kriteria | Tauri 2.0 | Electron |
|---|---|---|
| Bundle size | 5–15 MB | 80–150 MB |
| RAM idle | 50–80 MB | 200–400 MB |
| Performa | Native WebView OS (WebKit/WebView2) | Chromium bundled |
| Update mechanism | `tauri-plugin-updater` | electron-updater |
| Native API | Rust + `tauri-plugin-*` | Node.js + native modules |
| Distribusi Windows | MSI / NSIS / Inno Setup | NSIS / MSI / squirrel |
| Maturity | Stable v2.0 (2024+) | Stable bertahun-tahun |
| Ecosystem React | Cocok via Vite | Cocok via webpack/vite |
| Security model | Allowlist per-command, default-deny | Lebih permissive |
| Cross-platform build | Linux / macOS / Windows (native per OS) | Linux / macOS / Windows |

**Rekomendasi: Tauri 2.0**

- Bundle size jauh lebih kecil → installer ~5–10 MB (vs ~80 MB Electron).
  Cocok untuk distribusi sekolah dengan koneksi terbatas.
- RAM footprint kecil → cocok untuk PC pustakawan generasi lama.
- Security model lebih baik → cocok untuk app yang manage data anggota.
- Sudah punya plugin official: `tauri-plugin-sql`, `tauri-plugin-fs`,
  `tauri-plugin-dialog`, `tauri-plugin-printer` (community), `tauri-plugin-stronghold`.

**Trade-off yang diterima:**

- Native WebView per-OS bisa ada perbedaan rendering. Mitigasi: Playwright
  test di Windows runner (utama target).
- Rust learning curve untuk plugin custom. Mitigasi: minim Rust code, sebagian
  besar logic di TS.

---

## 2. State management — Zustand vs Redux Toolkit

| Kriteria | Zustand | Redux Toolkit |
|---|---|---|
| Boilerplate | Minimal | Moderate (slice, reducer) |
| DevTools | Yes (zustand/middleware) | Yes (RTK built-in) |
| Persist | `zustand/middleware/persist` | `redux-persist` |
| Async | Built-in (just async function) | `createAsyncThunk` / RTK Query |
| Bundle size | 2 KB | 11 KB (RTK) |
| Tipe TS | Inferensi otomatis | Inferensi otomatis |
| Familiar di team | Modern, simpler API | Klasik, banyak referensi |

**Rekomendasi: Zustand**

- App ini scope-nya medium (tidak super complex). Redux overkill.
- Boilerplate Zustand lebih sedikit → speed iterasi 12 sesi.
- Persist middleware cocok untuk theme / sidebar state.

**Store yang akan dibuat:**

- `themeStore` — light/dark/system + persist.
- `sidebarStore` — collapsed state + persist.
- `authStore` — user, token, permissions.
- `identityStore` — nama_perpustakaan, logo, alamat (subscribe Tauri event).
- `i18nStore` — bahasa aktif (ID/EN) + persist.

---

## 3. Routing — TanStack Router vs React Router

| Kriteria | TanStack Router | React Router 6 |
|---|---|---|
| Type safety | Full TS inference (search params + path params) | Partial (manual typing) |
| Data loaders | Built-in (mirip Remix) | `loader` (RR 6.4+) |
| File-based routing | Optional via `@tanstack/router-plugin/vite` | No (manual) |
| Maturity | Stable v1 (2024) | Sangat matang |
| Bundle size | ~12 KB | ~15 KB |
| Devtools | Yes (router-devtools) | No (built-in browser) |
| Learning curve | Moderate (route tree concept) | Familiar untuk React dev |

**Rekomendasi: TanStack Router**

- Type safety end-to-end critical untuk app data-heavy.
- Search param parsing built-in cocok untuk filter date range / pagination.
- Devin akan generate route tree dari file structure (less boilerplate).

**Struktur route:**

```
/login
/dashboard
/anggota
/anggota/$id
/buku
/buku/$id
/peminjaman
/pengembalian
/kunjungan
/laporan/grafik
/laporan/top-peminjam
/laporan/top-buku
/laporan/kas
/laporan/backup
/settings/identitas
/settings/aturan-peminjaman
/settings/master-data/$kategori
/settings/kta
/settings/tampilan
... (12 sub-page settings)
```

---

## 4. DB strategy — better-sqlite3 vs sqlx vs Python sidecar

| Kriteria | better-sqlite3 (Node.js) | sqlx via tauri-plugin-sql (Rust) | Python sidecar |
|---|---|---|---|
| Tauri compat | ❌ Butuh Node.js (Electron) | ✅ Native plugin | ⚠️ Spawn subprocess |
| Performance | Fast (sync API) | Fast (async) | Slower (IPC overhead) |
| Bundle size | +3 MB sqlite + Node | +1 MB Rust binary | +20 MB Python embed |
| Reuse v1 logic | ❌ Rewrite di TS/Rust | ❌ Rewrite di Rust | ✅ Reuse models/services |
| Migration script | Manual SQL | Manual SQL / sqlx-migrate | Reuse `db/connection.py` |
| Type safety | Manual schema typing | Strong (sqlx + macros) | Manual |

**Rekomendasi: sqlx via `tauri-plugin-sql`**

- Tidak butuh Node.js runtime di production (Tauri murni native).
- Schema v1 (`src/perpustakaan/db/schema.sql`) di-reuse copy-paste karena
  SQLite portable.
- Logic CRUD ditulis di Rust (~30% rewrite) dengan TS interface untuk command.
- Untuk Devin 12 migration script v1 → v2: bisa bikin Rust binary yang
  baca DB v1 (sama schema, tinggal copy dengan validasi).

**Struktur layer:**

```
apps/desktop/src-tauri/src/
├── db/
│   ├── mod.rs            # SQL pool + migrations
│   ├── schema.sql        # COPY dari v1
│   ├── anggota.rs        # CRUD anggota
│   ├── buku.rs           # CRUD buku
│   ├── peminjaman.rs     # CRUD + business logic
│   └── ...
├── commands/             # Tauri commands (bridge ke frontend)
└── main.rs
```

**Alternatif fallback (kalau sqlx terlalu berat):**

- Pakai `rusqlite` (lebih simple, sync API).
- Trade-off: tidak pakai async, tapi cocok untuk app desktop kecil.

---

## 5. Frontend framework + utilities

### React 18 + TypeScript

- Wajib React 18 (concurrent features, automatic batching).
- TS strict mode: `strict: true`, `noUncheckedIndexedAccess: true`.

### Tailwind 3 + shadcn/ui

- Tailwind 3 (jangan v4 yang masih shifting). PostCSS pipeline standar.
- shadcn/ui = copy-paste components ke `src/components/ui/`.
  - Pilih komponen yang dipakai: `Button`, `Input`, `Form`, `Card`,
    `Dialog`, `DropdownMenu`, `Tooltip`, `Sheet`, `Tabs`, `Table`,
    `Calendar`, `Popover`, `Select`, `Combobox`, `Toast`, `Sidebar`.
- Theme: `cn()` utility + `class-variance-authority` (cva) untuk variants.

### State + form

- Zustand (state global) — section 2.
- `react-hook-form` + `zod` (form validation, TS schema).

### Charts

- `recharts` — paling matang, theming via CSS var, cocok untuk
  Dashboard + Laporan.
- Alternatif: `visx` (lebih low-level, untuk chart custom).

### Animation

- Framer Motion (selektif: login entrance, sidebar collapse, dialog open).
- Tailwind `animate-in` / `animate-out` untuk yang sederhana.

### Icons

- `@phosphor-icons/react` (port dari v1 `gui/phosphor.py`).
- Konsisten dengan v1 → user familiar.

---

## 6. Build & tooling

### Vite

- Vite 5+ untuk React (support React 18 + TS via @vitejs/plugin-react).
- Tauri sudah recommend Vite di template default.

### pnpm

- Workspace support penting karena struktur monorepo (`apps/desktop`,
  `apps/web` (future), `packages/shared`).
- Lebih cepat & disk-efficient dari npm/yarn.

### Vitest

- Unit test (komponen, hooks, utils, store).
- Compat dengan Vite config → no separate jest config.

### Playwright

- E2E test via Tauri WebView (bisa attach via CDP).
- Smoke flow: login → dashboard → tambah anggota → tambah buku → peminjaman.

### GitHub Actions

- Workflow baru `apps/desktop/.github/workflows/ci.yml` (atau di root).
- Job:
  - `lint-typecheck` (pnpm lint, pnpm typecheck)
  - `unit-test` (pnpm test)
  - `e2e-test` (pnpm e2e, Playwright pada Tauri build)
  - `build-windows` (Tauri build MSI di Windows runner — di Devin 12)

---

## 7. PDF / Print

| Tool | Pros | Cons |
|---|---|---|
| `pdf-lib` (frontend) | TS-native, no native dep, theme-aware | Tidak support print direct ke printer |
| `printpdf` (Rust) | Native print API, ICC profile | Rust learning curve, bundle size +1 MB |
| `react-pdf` | React component → PDF | Heavy bundle (~500 KB) |

**Rekomendasi: `pdf-lib` (frontend)**

- Generate PDF di TS, save lewat Tauri `dialog.save` + `fs.writeBinaryFile`.
- Untuk print direct: pakai `tauri-plugin-printer` (community) di Devin 6/9/10.

---

## 8. i18n

- Library: `react-i18next` (matang, plural rules, namespace).
- File JSON: `apps/desktop/src/i18n/{id,en}/{common,auth,dashboard,...}.json`.
- Default language: `id` (Indonesia). Fallback: `en`.
- Reuse string dari v1 `src/perpustakaan/i18n.py` (extract → JSON).

---

## 9. Mengapa **bukan** opsi lain?

### Mengapa tidak Electron?

Sudah dijawab di section 1. Singkatnya: bundle size 8–10× lebih besar, RAM
2–4× lebih besar. Untuk app sekolah offline yang harus jalan di PC kentang,
Tauri menang telak.

### Mengapa tidak Next.js?

Next.js untuk SSR / SSG web app. Untuk desktop offline, Vite + React SPA
sudah cukup dan lebih ringan.

### Mengapa tidak Solid / Svelte?

Ekosistem React untuk shadcn/ui + recharts paling lengkap. Devin lebih
familiar React → speed iterasi.

### Mengapa tidak Drizzle ORM?

Bisa dipakai sebagai layer abstraksi di atas sqlx (TS-side typing). Tapi
karena CRUD ditulis di Rust (server-side), Drizzle hanya cocok kalau pakai
better-sqlite3 di Node.js (yang kita reject). Sqlx + Rust sudah type-safe
via macro.
