# Migration v2 — Progress Tracker

> **Source of truth** untuk state migrasi `Perpustakaan Offline` dari Python +
> customtkinter (v1) ke Tauri 2.0 + React 18 + TypeScript + Tailwind 3 +
> shadcn/ui + Zustand + Vite + pnpm + Vitest + Playwright (v2).
>
> **Total 12 sesi Devin sequential.** Setiap sesi = 1 PR.
> File ini di-update oleh setiap Devin di akhir sesinya. Devin berikutnya membaca
> file ini untuk menentukan sesi mana yang harus dikerjakan (sesi pertama dengan
> status `PENDING` dan semua dependency `COMPLETED`).
>
> Format: machine-parseable (YAML front-matter + tabel Markdown).
> Jangan ubah field `id` / `dependencies` tanpa diskusi — itu memutus rantai sesi.

---

## Meta

```yaml
project: perpustakaan-offline
migration: v1 (python+customtkinter) -> v2 (tauri 2.0 + react 18 + ts + tailwind 3 + shadcn + zustand)
total_sessions: 12
schema_version: 1
last_updated: 2026-05-03 (session 08)
```

## Sessions

```yaml
sessions:
  - id: 1
    title: Bootstrap migration plan (no kode, dokumen saja)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/35
    completed_at: 2026-05-03
    dependencies: []

  - id: 2
    title: Scaffolding Tauri+React+TS+Tailwind+shadcn + CI/CD baru + reuse SQLite schema + login + theme + i18n
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/36
    completed_at: 2026-05-03
    dependencies: [1]
    note: Bundled by Devin 1 sebagai stacked PR di atas #35.

  - id: 3
    title: Layout shell (sidebar collapsible + header + window responsive + identitas sync foundation)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/37
    completed_at: 2026-05-03
    dependencies: [2]
    note: Bundled by Devin 1 sebagai stacked PR di atas #36.

  - id: 4
    title: Data Anggota CRUD + autocomplete + live search + dropdown styled
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/41
    completed_at: 2026-05-03
    dependencies: [3]

  - id: 5
    title: Data Buku CRUD + Master Data komplit (DDC/Kategori/Bahasa/Jurusan/Kelas/Agama)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/42
    completed_at: 2026-05-03
    dependencies: [4]
    note: Bundled by Devin 4 sebagai stacked PR di atas #41.

  - id: 6
    title: Peminjaman + Pengembalian (date picker, panel info, validasi, print nota)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/43
    completed_at: 2026-05-03
    dependencies: [4, 5]
    note: Bundled by Devin 4 sebagai stacked PR di atas #42.

  - id: 7
    title: Kunjungan redesign (transparent illustrations, quick stats, filter date range)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/44
    completed_at: 2026-05-03
    dependencies: [3, 4]
    note: Bundled by Devin 4 sebagai stacked PR di atas #43.

  - id: 8
    title: Dashboard modern dengan charts (3 hero card + donut + bar + featured row)
    status: COMPLETED
    pr: https://github.com/alviarts/perpustakaan-offline/pull/45
    completed_at: 2026-05-03
    dependencies: [4, 5, 6]

  - id: 9
    title: Laporan komplit (Grafik / Top Peminjam / Top Buku / Kas / Backup)
    status: PENDING
    pr: PENDING
    completed_at: null
    dependencies: [6, 7, 8]

  - id: 10
    title: KTA system komplit (template editor + barcode + auto-fill + print)
    status: PENDING
    pr: PENDING
    completed_at: null
    dependencies: [4, 5]

  - id: 11
    title: Settings comprehensive 12 kategori + manual book HTML + audit wording final
    status: PENDING
    pr: PENDING
    completed_at: null
    dependencies: [3, 5, 10]

  - id: 12
    title: Installer Tauri MSI (logo, license, no language picker, scrollbar polish, asset bundle) + release v1.0.0
    status: PENDING
    pr: PENDING
    completed_at: null
    dependencies: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
```

## Quick view (human)

| # | Session | Status | PR | Completed | Deps |
|---|---|---|---|---|---|
| 1 | Bootstrap migration plan | COMPLETED | [#35](https://github.com/alviarts/perpustakaan-offline/pull/35) | 2026-05-03 | — |
| 2 | Scaffolding + login + theme + i18n | COMPLETED | [#36](https://github.com/alviarts/perpustakaan-offline/pull/36) | 2026-05-03 | 1 |
| 3 | Layout shell (sidebar + header + responsive) | COMPLETED | [#37](https://github.com/alviarts/perpustakaan-offline/pull/37) | 2026-05-03 | 2 |
| 4 | Data Anggota CRUD + search/autocomplete | COMPLETED | [#41](https://github.com/alviarts/perpustakaan-offline/pull/41) | 2026-05-03 | 3 |
| 5 | Data Buku CRUD + Master Data | COMPLETED | [#42](https://github.com/alviarts/perpustakaan-offline/pull/42) | 2026-05-03 | 4 |
| 6 | Peminjaman + Pengembalian | COMPLETED | [#43](https://github.com/alviarts/perpustakaan-offline/pull/43) | 2026-05-03 | 4, 5 |
| 7 | Kunjungan redesign | COMPLETED | [#44](https://github.com/alviarts/perpustakaan-offline/pull/44) | 2026-05-03 | 3, 4 |
| 8 | Dashboard modern + charts | COMPLETED | [#45](https://github.com/alviarts/perpustakaan-offline/pull/45) | 2026-05-03 | 4, 5, 6 |
| 9 | Laporan komplit | PENDING | PENDING | — | 6, 7, 8 |
| 10 | KTA system | PENDING | PENDING | — | 4, 5 |
| 11 | Settings 12 kategori + manual + audit wording | PENDING | PENDING | — | 3, 5, 10 |
| 12 | Installer MSI + release v1.0.0 | PENDING | PENDING | — | 2..11 |

## Update protocol

Setiap Devin di akhir sesinya WAJIB:

1. Update field `status` sesi yang dikerjakan dari `PENDING` → `COMPLETED`.
2. Set `pr` ke URL PR yang dibuat.
3. Set `completed_at` ke tanggal ISO (`YYYY-MM-DD`).
4. JANGAN ubah `id`, `dependencies`, atau urutan sesi.
5. Update juga tabel "Quick view" supaya konsisten.

Kalau sesi blocked (misal dependency belum COMPLETED), STOP dan kasih tau user.
JANGAN bypass dependency.

## Status legend

- `PENDING` — belum dikerjakan, menunggu giliran.
- `IN_PROGRESS` — sedang dikerjakan oleh Devin (branch belum merge).
- `COMPLETED` — PR sudah merged ke `main`.
- `BLOCKED` — dependency belum kelar atau ada blocker eksternal.
