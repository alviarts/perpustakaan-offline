# Architecture — Migration v2

> Arsitektur target Perpustakaan Offline v2: monorepo Tauri 2.0 + React 18 +
> Rust backend + SQLite (reuse schema v1).
>
> Dokumen ini blueprint untuk Devin 2 dst. Diagram pakai ASCII supaya bisa
> diff di git.

## 1. Tinjauan tinggi

```
┌────────────────────────────────────────────────────────────────────┐
│                       Perpustakaan Offline v2                       │
│                                                                    │
│   ┌─────────────────────────────┐    ┌──────────────────────────┐  │
│   │   Frontend (WebView)        │    │   Native Layer (Rust)    │  │
│   │   apps/desktop/src/         │    │   apps/desktop/src-tauri/│  │
│   │                             │    │                          │  │
│   │   React 18 + TS             │    │   Tauri 2.0 runtime      │  │
│   │   Tailwind 3 + shadcn/ui    │    │   tauri-plugin-sql       │  │
│   │   Zustand (state)           │ ◄──►   tauri-plugin-fs        │  │
│   │   TanStack Router           │IPC │   tauri-plugin-dialog    │  │
│   │   recharts (charts)         │    │   tauri-plugin-printer   │  │
│   │   pdf-lib (PDF gen)         │    │   tauri-plugin-stronghold│  │
│   │   react-i18next             │    │                          │  │
│   │                             │    │   Custom commands:       │  │
│   │   Vite dev server (dev)     │    │   - auth.* (bcrypt+AES)  │  │
│   │                             │    │   - db.* (CRUD)          │  │
│   └─────────────────────────────┘    │   - kta.* (PDF/print)    │  │
│                                      │   - report.* (export)    │  │
│                                      │   - identity.* (events)  │  │
│                                      └──────────────────────────┘  │
│                                              │                      │
│                                              ▼                      │
│                              ┌─────────────────────────────────┐    │
│                              │  SQLite DB                      │    │
│                              │  ~/AppData/PerpustakaanOffline/ │    │
│                              │     perpustakaan-v2.db          │    │
│                              │  (schema reuse dari v1 + add    │    │
│                              │  tabel master_data baru)        │    │
│                              └─────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

## 2. File structure (monorepo)

```
perpustakaan-offline/
├── apps/
│   ├── desktop/                # Tauri desktop app (utama)
│   │   ├── src/                # Frontend React + TS
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/         # shadcn primitives (copy-paste)
│   │   │   │   ├── layout/     # Sidebar, Header, AppShell
│   │   │   │   └── shared/     # DataTable, EmptyState, ...
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── anggota/
│   │   │   │   ├── buku/
│   │   │   │   ├── peminjaman/
│   │   │   │   ├── pengembalian/
│   │   │   │   ├── kunjungan/
│   │   │   │   ├── laporan/
│   │   │   │   ├── kta/
│   │   │   │   └── settings/
│   │   │   ├── hooks/
│   │   │   ├── lib/            # utils (cn, format, dll.)
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── routes/         # TanStack Router file-based
│   │   │   ├── i18n/
│   │   │   │   ├── index.ts
│   │   │   │   ├── id/
│   │   │   │   └── en/
│   │   │   └── types/          # TS types (shared dengan packages/shared)
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── commands/   # Tauri commands per domain
│   │   │   │   │   ├── auth.rs
│   │   │   │   │   ├── anggota.rs
│   │   │   │   │   ├── buku.rs
│   │   │   │   │   ├── peminjaman.rs
│   │   │   │   │   ├── kunjungan.rs
│   │   │   │   │   ├── laporan.rs
│   │   │   │   │   ├── kta.rs
│   │   │   │   │   └── identity.rs
│   │   │   │   └── db/
│   │   │   │       ├── mod.rs
│   │   │   │       ├── schema.sql       # COPY dari v1 + extend
│   │   │   │       └── migrations/
│   │   │   ├── icons/          # 32/128/128@2x/icon.ico/icon.icns
│   │   │   ├── resources/      # bundled: fonts, manual HTML, seed data
│   │   │   ├── installer/
│   │   │   │   ├── inno-setup.iss
│   │   │   │   └── assets/     # wizard images (#3)
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── build.rs
│   │   ├── public/
│   │   │   └── illustrations/  # SVG / PNG 1024px+
│   │   ├── tests/
│   │   │   └── e2e/            # Playwright
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.cjs
│   │   ├── vite.config.ts
│   │   └── vitest.config.ts
│   └── web/                    # (FUTURE) browser-only demo, optional
│
├── packages/
│   └── shared/                 # Tipe TS dipakai bersama (DTO IPC)
│       ├── src/
│       │   ├── types/
│       │   │   ├── anggota.ts
│       │   │   ├── buku.ts
│       │   │   └── ...
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── migration-v2/           # planning + state (file ini, dll.)
│   ├── manual.md               # legacy v1, akan di-port di Devin 11
│   └── screenshots/            # legacy v1 screenshots (referensi)
│
├── scripts/
│   ├── migrate-v1-to-v2.ts     # Devin 12: convert .db v1 → v2
│   └── dev.sh
│
├── pnpm-workspace.yaml
├── package.json                # root workspace
├── .github/
│   └── workflows/
│       ├── ci.yml              # legacy Python CI (akan jadi disable di Devin 12)
│       └── ci-v2.yml           # baru: pnpm lint/test/typecheck + Tauri build
└── .gitignore
```

> v1 source (`src/perpustakaan/`, `tests/`, `build.spec`, `installer/`) **tidak**
> dihapus selama migrasi (dipertahankan di branch `main`) sampai Devin 12
> melakukan release v1.0.0 dan sweep cleanup.

## 3. IPC layer (Tauri commands + events)

### Naming convention

- Command: `<domain>:<action>` → di Rust pakai `#[tauri::command]`.
- Event: `<domain>:<event>` → di Rust pakai `app.emit_all(...)`.

### Contoh command (Rust → TS)

```rust
// apps/desktop/src-tauri/src/commands/anggota.rs
#[tauri::command]
pub async fn anggota_list(
    state: tauri::State<'_, DbPool>,
    query: Option<String>,
    limit: usize,
    offset: usize,
) -> Result<Vec<Anggota>, String> { ... }
```

```ts
// apps/desktop/src/features/anggota/api.ts
import { invoke } from '@tauri-apps/api/core';
import type { Anggota } from '@perpustakaan/shared/types';

export async function anggotaList(
  query: string | null,
  limit: number,
  offset: number,
): Promise<Anggota[]> {
  return invoke('anggota_list', { query, limit, offset });
}
```

### Event yang dipakai

| Event | Emitter | Listener | Payload |
|---|---|---|---|
| `identity:changed` | Settings save | Sidebar/Header/Dashboard/KTA | `{ nama, logo_path, alamat, ... }` |
| `db:migrated` | App startup | Splash screen | `{ from: int, to: int }` |
| `auth:logout` | Logout button | App root | `{}` |
| `print:complete` | Printer plugin | Toast | `{ status: 'ok' \| 'error' }` |

## 4. DB layer

### Reuse schema v1

File `src/perpustakaan/db/schema.sql` (15 tabel) di-copy ke
`apps/desktop/src-tauri/src/db/schema.sql`. Tabel:

- `schema_version`, `settings`, `users`
- `ddc`, `kelas`, `penerbit`
- `anggota`, `buku`, `eksemplar`
- `peminjaman`, `peminjaman_item`
- `kunjungan`, `kas`
- `permissions`, `user_permissions`, `audit_log`

### Tabel baru di v2

Untuk revisi #17 (master data lengkap), tambah migration:

```sql
-- migrations/002_master_data.sql
CREATE TABLE IF NOT EXISTS kategori (
    id INTEGER PRIMARY KEY,
    nama TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bahasa (
    kode TEXT PRIMARY KEY,        -- ISO 639-1 (id, en, ar, jw, ...)
    nama TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jurusan (
    id INTEGER PRIMARY KEY,
    nama TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agama (
    id INTEGER PRIMARY KEY,
    nama TEXT UNIQUE NOT NULL
);

-- Tabel untuk template KTA (revisi #14)
CREATE TABLE IF NOT EXISTS kta_templates (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL,
    layout_json TEXT NOT NULL,    -- JSON struktur field positions
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabel untuk remember-me token (revisi #10)
CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migration runner

Pakai `tauri-plugin-sql` migration loader:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:perpustakaan-v2.db", vec![
            Migration { version: 1, description: "init", sql: include_str!("db/schema.sql"), kind: MigrationKind::Up },
            Migration { version: 2, description: "master_data", sql: include_str!("db/migrations/002_master_data.sql"), kind: MigrationKind::Up },
        ])
        .build())
    .run(...);
```

## 5. Build pipeline

### Dev

```bash
pnpm install                       # root install (workspace-aware)
pnpm --filter desktop tauri dev    # Vite dev + Tauri webview
```

### Production build

```bash
pnpm --filter desktop tauri build  # bundle MSI / .exe / .deb sesuai OS host
```

Output:

- Windows: `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
  + `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe`
- Linux: `target/release/bundle/{deb,appimage}/`
- macOS: `target/release/bundle/{dmg,macos}/`

### CI (GitHub Actions, mulai Devin 2)

Workflow `.github/workflows/ci-v2.yml`:

```yaml
name: CI v2

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter desktop lint
      - run: pnpm --filter desktop typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter desktop test

  build-windows:
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    runs-on: windows-latest
    needs: [lint-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter desktop tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: apps/desktop/src-tauri/target/release/bundle/msi/*.msi
```

### CI legacy

`ci.yml` (Python lint/test) **tetap aktif** sampai Devin 12 melakukan
release v1.0.0, lalu di-switch ke `if: false` (atau dihapus). Selama
migrasi, Devin 1–11 hanya menambah file baru di `apps/`, `packages/`, `docs/`,
sehingga tidak break Python CI.

## 6. Konfigurasi Tauri penting

`apps/desktop/src-tauri/tauri.conf.json` (highlight):

```json
{
  "productName": "PerpustakaanOffline",
  "version": "0.0.0",
  "identifier": "id.alviarts.perpustakaan",
  "app": {
    "windows": [
      {
        "title": "Perpustakaan Offline",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline';"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "wix": { "language": "en-US" },
      "nsis": { "languages": ["English"] }
    }
  }
}
```

## 7. Ringkasan tanggung jawab tiap layer

| Layer | Tanggung jawab |
|---|---|
| Frontend React | UI, animasi, form validation, state ephemeral, charts, PDF gen (pdf-lib) |
| Zustand store | State global lintas page (theme, sidebar, auth, identity, i18n) |
| TanStack Router | Routing + search params + data loaders |
| Tauri commands (Rust) | Business logic kritis (auth, peminjaman validation), DB CRUD, file I/O |
| Tauri events (Rust) | Push notifikasi ke frontend (identity changed, print complete) |
| sqlx + SQLite | Persistent storage (offline-first) |
| Stronghold/keyring | Token "Ingat Saya" terenkripsi |
| Inno Setup / WiX | Windows installer (MSI atau .exe wizard) |

## 8. Constraint penting

- **Offline-first**: tidak boleh ada API call ke external server (kecuali
  Google Sheets sync, opt-in di Settings).
- **Single-tenant**: 1 sekolah = 1 instalasi DB.
- **Windows is primary target**: tidak ada gating fitur untuk Linux/macOS,
  tapi prioritas QA Windows.
- **Backward compat**: data v1 harus bisa di-migrate (Devin 12 script).
