# Migration v2 — Perpustakaan Offline v0.6.2 → v1.0.0

This folder contains the planning artifacts for the major rewrite of Perpustakaan Offline from Python + customtkinter to a modern stack (Tauri 2.0 / Electron + React + TypeScript + Tailwind + shadcn/ui).

## Status

**Current phase**: Pre-bootstrap. Visual references uploaded. Migration plan documents (REVISION_BACKLOG, STACK_DECISION, ARCHITECTURE, ASSETS_REUSE, PROGRESS, sessions/, INSTRUCTION_TEMPLATE) **not yet created** — that is the responsibility of Devin session 1 (see "Workflow" below).

## Folder structure (target)

```
docs/migration-v2/
├── README.md                       # this file
├── REVISION_BACKLOG.md             # 26 user-requested revisions (created by Devin 1)
├── STACK_DECISION.md               # Tauri vs Electron analysis (created by Devin 1)
├── ARCHITECTURE.md                 # Proposed v2 architecture (created by Devin 1)
├── ASSETS_REUSE.md                 # What to reuse from v1 Python codebase (created by Devin 1)
├── PROGRESS.md                     # Machine-parseable session status (created by Devin 1, updated each session)
├── INSTRUCTION_TEMPLATE.md         # Universal prompt for Devin sessions 1-12 (created by Devin 1)
├── sessions/
│   ├── SESSION_01.md               # Bootstrap migration plan (created by Devin 1 — meta)
│   ├── SESSION_02.md               # Auth, theme, i18n
│   ├── SESSION_03.md               # Layout shell + responsive
│   ├── SESSION_04.md               # Data Anggota + autocomplete + live search
│   ├── SESSION_05.md               # Data Buku + Master Data
│   ├── SESSION_06.md               # Peminjaman + Pengembalian
│   ├── SESSION_07.md               # Kunjungan
│   ├── SESSION_08.md               # Dashboard with charts
│   ├── SESSION_09.md               # Laporan with sub-sections
│   ├── SESSION_10.md               # KTA system + barcode
│   ├── SESSION_11.md               # Settings + manual + audit wording
│   └── SESSION_12.md               # Installer + release v1.0.0
└── references/                     # Visual references (already uploaded)
    ├── INDEX.md
    └── revision-NN-*.png           # 36 screenshots
```

## Workflow

The migration is split into **12 sequential Devin sessions**. The user runs one prompt per session (the same universal prompt — Devin self-detects which session is next based on `PROGRESS.md`).

1. User pastes the universal prompt to a fresh Devin session.
2. Devin pulls the latest `main` branch.
3. Devin reads `PROGRESS.md` to find the first PENDING session.
4. Devin reads `sessions/SESSION_NN.md` for that session's spec.
5. Devin executes the tasks, commits to a feature branch, pushes, and creates a PR.
6. User reviews and merges the PR.
7. Repeat for the next session.

The first session (Devin 1) is **meta**: it creates the missing planning documents (REVISION_BACKLOG, STACK_DECISION, ARCHITECTURE, ASSETS_REUSE, PROGRESS, sessions/SESSION_01..12, INSTRUCTION_TEMPLATE).

## Visual references

`references/` contains **36 screenshots** collected during the planning phase showing current bugs and target mockups across 23 of the 26 revisions. See [`references/INDEX.md`](./references/INDEX.md) for the full mapping.

## Why migrate

The current customtkinter UI has hit framework limitations that make many of the user's requested revisions either impossible or require heavy workarounds:
- Limited animation primitives (no CSS transitions; `after()` loops only)
- No native responsive layout (manual `<Configure>` listeners required)
- Treeview = ttk = Windows XP look that cannot be styled to modern
- Manual mouse wheel binding per widget
- Popover/dropdown width matching is awkward
- `tkinter.Toplevel` modals freeze on resize transitions

Migrating to a web-based UI layer (React + Tailwind + shadcn/ui) wrapped in a native shell (Tauri or Electron) unlocks all of these patterns trivially with mature ecosystem libraries.

## Reused from v1

The Python service-layer business logic, SQLite schema, i18n strings, and test fixtures are all candidates for reuse. The detailed list will be in `ASSETS_REUSE.md` (created by Devin 1).
