# SESSION 12 — Installer + release v1.0.0

> **Devin session 12/12.** Bundle Windows installer (Tauri MSI / Inno Setup),
> swap final asset high-res, scrollbar polish, migration script v1 → v2,
> tag release.

## Goal

- Installer Windows polish:
  - Logo `.ico` di Start Menu / Search / Taskbar (revisi #1).
  - Hapus "Select Setup Language" dialog (revisi #2).
  - License page custom kredit + replace CD/box wizard graphic (revisi #3).
- Swap final asset high-res unDraw/Storyset (revisi #6).
- Mouse wheel scroll + scrollbar fade-auto (revisi #26).
- Migration script `.db` v1 → v2.
- Cleanup legacy v1 (move ke `legacy/v1/` atau hapus, lihat ASSETS_REUSE.md §6).
- Tag release `v1.0.0`.

## Revisi tercover

- #1 (logo installer + .exe icon) — full
- #2 (hapus language picker) — full
- #3 (license + wizard graphic) — full
- #6 (asset high-res) — full (final pass; sebagian ditambah di sesi UI)
- #26 (scrollbar polish) — full

## Dependencies

- Sesi 2..11 SEMUA COMPLETED.

## Tasks breakdown

### 1. Icon bundle (revisi #1)

- `apps/desktop/src-tauri/icons/`:
  - `32x32.png`, `128x128.png`, `128x128@2x.png` (256×256), `icon.icns` (mac),
    `icon.ico` (win, multi-size 16/32/48/256).
- Source: 1024×1024 SVG / PNG di `apps/desktop/src-tauri/icons/source/`.
- Generate via `tauri icon <source.png>`.
- Verifikasi di Windows: install MSI → Start Menu / Search / Taskbar /
  Alt-Tab semua pakai logo.

### 2. Inno Setup config (revisi #2, #3)

- Pilihan A: pakai Tauri NSIS bundler (default Tauri).
- Pilihan B: pakai Tauri WiX MSI (untuk MSI).
- Untuk customisasi license + wizard graphic + no-language-picker:
  - Pakai Tauri Inno Setup template via custom `tauri-plugin-` atau
    standalone Inno setelah build Tauri.
  - File `apps/desktop/src-tauri/installer/inno-setup.iss`:
    - `[Setup] ShowLanguageDialog=no`
    - `LicenseFile=docs/legal/LICENSE-installer.txt`
    - `WizardImageFile=installer/assets/wizard-banner.bmp` (164×314)
    - `WizardSmallImageFile=installer/assets/wizard-small.bmp` (55×58)
- Wizard graphic: render logo Nusantara → BMP (atau pakai `WizardStyle=modern`
  yang support PNG).

### 3. License file

- `docs/legal/LICENSE-installer.txt`:
  - Header: "Perpustakaan Offline v2 — alvi arts / vwrks"
  - Body: isi LICENSE root (MIT / GPL).
  - Footer: link GitHub.

### 4. Swap asset high-res (revisi #6)

- Replace placeholder SVG/PNG di `apps/desktop/public/illustrations/` dengan
  asset final (download dari unDraw / Storyset).
- Update `CREDITS.md` dengan attribution.
- Verifikasi: tidak ada lagi PIL procedural rendering di runtime; semua asset
  SVG / 1024px+.

### 5. Scrollbar polish (revisi #26)

- Install `tailwind-scrollbar` atau pakai `overlayscrollbars-react`.
- Apply ke main scroll area + tabel.
- CSS: scrollbar fade-out setelah idle 1.5s, fade-in saat scroll.
- `scroll-behavior: smooth` di `<html>`.
- Test: scroll di Dashboard / tabel besar / Settings → smooth + fade works.

### 6. Migration script v1 → v2

- `scripts/migrate-v1-to-v2.ts` (TS, run via `tsx` atau Node):
  - Argv: input `.db` v1 path, output v2 path.
  - Open v1 read-only.
  - Buat v2 fresh dengan schema (apply migrations).
  - Copy row tabel inti (anggota, buku, peminjaman, dll.).
  - Seed tabel baru kalau perlu.
  - Validasi count match.
  - Backup `.db` v1 → `<filename>.v1-backup-<timestamp>.db`.
  - Print summary.
- UI button "Import dari v1" di Settings → Backup tab (call command bridge
  ke script).

### 7. Cleanup legacy v1 (opsional, behind flag)

- Move `src/perpustakaan/`, `tests/`, `build.spec`, `installer/` ke
  `legacy/v1/`, atau biarkan di main lalu hapus di tag berikut (v1.1).
- Disable `.github/workflows/ci.yml` (rename `.disabled` atau hapus).
- Update `README.md` jadi panduan v2.

### 8. Release v1.0.0

- Bump `apps/desktop/src-tauri/tauri.conf.json` `version` → `1.0.0`.
- Bump `apps/desktop/package.json` `version` → `1.0.0`.
- Tag git `v1.0.0` (Devin push tag, user yang final approve).
- Workflow `ci-v2.yml` job `build-windows` triggered on tag → upload MSI
  + EXE artifact + GitHub Release draft.

### 9. Tests

- E2E full smoke: `tests/e2e/smoke-full.spec.ts`:
  - Login → Dashboard → Anggota add → Buku add → Peminjaman → Pengembalian
    → Laporan export → Logout.
- Migration test: `tests/migration.test.ts` — pakai sample `.db` v1
  fixture, run script, validate count.
- Build smoke test (CI): `pnpm --filter desktop tauri build` selesai tanpa
  error di Windows runner.

### 10. Update PROGRESS.md

- Sesi 12 → COMPLETED.

## Deliverables

- File:
  - `apps/desktop/src-tauri/icons/*` (8+ size variants)
  - `apps/desktop/src-tauri/installer/inno-setup.iss` + assets
  - `docs/legal/LICENSE-installer.txt`
  - `apps/desktop/public/illustrations/*` (final asset)
  - `apps/desktop/public/illustrations/CREDITS.md`
  - `scripts/migrate-v1-to-v2.ts`
  - Bump version
  - Git tag `v1.0.0`
- Tests: 1 e2e full smoke + 1 migration unit + CI build success.
- Artifact: MSI + EXE installer di GitHub Release.
- Recording: install MSI di Windows VM → launch → login → flow lengkap.

## Definition of Done

- [ ] MSI installer Windows generated tanpa error.
- [ ] Install: no "Select Setup Language" dialog.
- [ ] License page tampil custom + kredit alvi arts / vwrks.
- [ ] Wizard graphic = logo Nusantara, bukan box CD.
- [ ] Logo .ico muncul di Start Menu / Search / Taskbar / Alt-Tab.
- [ ] Migration script: ambil `.db` v1 → output v2 valid, count match.
- [ ] Scrollbar fade-auto + smooth scroll.
- [ ] Asset high-res semua.
- [ ] Release `v1.0.0` tag pushed (CI build artifact).
- [ ] CI pass.
- [ ] PROGRESS.md updated.
- [ ] User confirm dengan install MSI + smoke test manual sebelum publish
      release ke publik.
