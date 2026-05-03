# SESSION 03 — Layout shell

> **Devin session 3/12.** Sidebar + Header + responsive window. Setelah sesi
> ini, app punya layout final yang reusable untuk semua page.

## Goal

- Sidebar collapsible (revisi #7) dengan chevron toggle, persist, Ctrl+B,
  tooltip on-hover, auto-collapse <1024px.
- Header dengan logo + nama perpustakaan, theme switcher, user menu, manual
  button.
- Window responsive (revisi #13, #22): resize tanpa glitch, fullscreen
  works, minWidth 800×600.
- Identitas perpustakaan sync foundation (revisi #11): Zustand store +
  Tauri event listener.

## Revisi tercover

- #7 (sidebar collapsible) — full
- #11 (sync identitas) — foundation (apply ke sidebar/header; component
  lain ngikut di sesi masing-masing)
- #13 (resize glitch fix) — full
- #22 (window resize fleksibel) — full

## Dependencies

- Sesi 2 COMPLETED.

## Tasks breakdown

### 1. AppShell layout

- `src/components/layout/AppShell.tsx`:
  - Grid 2-kolom: Sidebar | (Header + main content).
  - Apply ke route `_authed.tsx` (TanStack Router).

### 2. Sidebar (revisi #7)

- `src/components/layout/Sidebar.tsx`:
  - Width: 240px expanded, 64px collapsed.
  - Chevron toggle button di top (icon `CaretDoubleLeft` / `CaretDoubleRight`).
  - Nav items: Dashboard, Anggota, Buku, Peminjaman, Pengembalian, Kunjungan,
    Laporan, Settings (dengan icon Phosphor + label).
  - Active state highlight (route match).
  - Tooltip on-hover saat collapsed (shadcn `Tooltip`).
  - Logo + nama perpustakaan di top (sync via `identityStore`).
- `src/stores/sidebarStore.ts`:
  - `collapsed: boolean`, `toggle()`, persist localStorage.
  - Auto-collapse saat viewport <1024px (`useMediaQuery` + effect).
- Keyboard shortcut `Ctrl+B`: register di `AppShell` lewat `useEffect`
  + `keydown` listener.

### 3. Header

- `src/components/layout/Header.tsx`:
  - Breadcrumbs (current route).
  - Search global placeholder (Devin 4 yang isi).
  - Manual button (placeholder, Devin 11 isi).
  - Theme switcher (already done in Devin 2).
  - User menu (avatar, name, "Logout").

### 4. Identitas store (revisi #11)

- `src/stores/identityStore.ts`:
  - State: `nama`, `logo_path`, `alamat`, `kepala_perpustakaan`.
  - Initial: load via Tauri command `identity.get`.
  - Subscribe Tauri event `identity:changed` → update store.
- Tauri command `identity.get` di `src-tauri/src/commands/identity.rs`:
  - Read dari tabel `settings` (key `nama_perpustakaan`, dll.).
- Apply di Sidebar logo + nama, Header (kalau dipakai), Login screen
  (Devin 2 udah pakai placeholder, sekarang pakai store).

### 5. Window config (revisi #22)

- `tauri.conf.json`:
  - `resizable: true`, `minWidth: 800`, `minHeight: 600`, `fullscreen: false`.
  - `maximized: true` di first launch (boleh di-override user, save di
    settings).
- Rust: capture window state on close → save ke settings → restore on next
  launch.

### 6. Responsive (revisi #13)

- Tailwind breakpoints standar (`md: 768`, `lg: 1024`, `xl: 1280`).
- Sidebar auto-collapse <1024px.
- Layout container: `min-h-screen`, `overflow-hidden` di shell, scroll di
  main content area.
- Test resize: drag dari 800×600 → 1920×1080 → 800×600 = no flicker, no
  hidden buttons.

### 7. E2E test

- `tests/e2e/sidebar.spec.ts`:
  - Klik chevron → sidebar collapse.
  - Reload → sidebar tetap collapsed (persist).
  - Press Ctrl+B → toggle.
  - Resize ke 1023px → auto-collapse.

### 8. Update PROGRESS.md

- Sesi 3 → COMPLETED.

## Deliverables

- File baru:
  - `src/components/layout/{AppShell,Sidebar,Header}.tsx`
  - `src/stores/{sidebar,identity}.ts`
  - `src-tauri/src/commands/identity.rs`
  - `tests/e2e/sidebar.spec.ts`
- Tests: e2e sidebar + responsive + Ctrl+B.
- Screenshot/recording sidebar collapse + resize.

## Definition of Done

- [ ] Toggle chevron expand/collapse smooth (CSS transition 200ms).
- [ ] State persist setelah reload (Zustand + localStorage).
- [ ] `Ctrl+B` toggle works global (dari mana pun di app).
- [ ] Tooltip muncul on-hover saat collapsed.
- [ ] Resize <1024px → auto-collapse.
- [ ] Resize 800×600 → 1920×1080 → no glitch, no hidden tombol.
- [ ] Identitas perpustakaan muncul di Sidebar header (dari `identityStore`).
- [ ] CI v2 + legacy Python pass.
- [ ] PROGRESS.md updated.
