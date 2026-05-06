# v1.1.0 — Session Audit Log

Append-only log of every Devin session that touched this batch.
Serves as the "who did what when" for cross-session debugging.

**Format:**

```
- session_id: devin-<uuid>
  status:    STARTED | PR_OPEN | PAUSED | COMPLETED | PAT_ROTATED
  item:      <ITEM-ID> | RELEASE | (none)
  pr:        #NNN | -
  started_at:   <ISO-8601 UTC>
  paused_at:    <ISO-8601 UTC>          # only on PAUSED
  completed_at: <ISO-8601 UTC>          # only on COMPLETED
  notes:     <one-line free-form>
```

---

## Entries

- session_id: devin-7ade6502dcdd44d7a8e8a7103ff82a54
  status:    HANDOFF_AUTHORED
  item:      (none)
  pr:        -
  started_at:   2026-05-06T19:00Z
  notes:     Wrote v1.1.0 handoff after shipping v1.0.12. The session
             also drafted apps/desktop/src/features/sirkulasi/ScanSearchInput.tsx
             as the v1.0.13 starter; that file is committed under a
             wip: prefix on this branch and is the seed for
             FEAT-Sirkulasi-Search.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      BUG-Pengembalian-DendaDup
  pr:        #145
  started_at:   2026-05-06T20:48Z
  completed_at: 2026-05-06T20:57Z
  notes:     Extracted apps/desktop/src/lib/dendaPresets.ts helper +
             refactored PengembalianPage + added 7-test unit file at
             apps/desktop/tests/unit/dendaPresets.test.ts. Local gates
             green (typecheck/lint/i18n:lint/test 512✓/build), CI green
             (Lint+Typecheck+Test + Rust check), squash-merged via PAT.
             Helper is exported with default constants ready for
             FEAT-Peminjaman-DendaInline to import.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    SCOPE_EXPANDED
  item:      (none)
  pr:        -
  started_at:   2026-05-06T21:05Z
  notes:     User redirected mid-batch to add 6 "biar mantap" features
             before release. Appended A1-CommandPalette, A2-SkeletonScreens,
             C1-LaporanEksekutifPDF, D1-SystemHealthWidget, D5-SandboxDemoMode,
             E1-OPACBukuPilihan to PROGRESS.md (between item 8 and RELEASE),
             added full spec sections to BUGS.md, updated SESSION_HANDOFF.md
             scope summary table from 8 → 14 items + parallelism notes.
             Scope-expansion-only commit; no code changes. Resumed claim
             flow on FEAT-Peminjaman-DendaInline next.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Peminjaman-DendaInline
  pr:        '#146'
  started_at:   2026-05-06T21:08Z
  completed_at: 2026-05-06T21:21Z
  notes:     Implemented as a shared <DendaQuickPresetRow> component
             rather than duplicating JSX. PengembalianPage migrated to
             the shared component (testids preserved verbatim from
             #145); PeminjamanDetail mounts it under the existing
             peminjaman-bayar Input, gated by activeItems.length > 0.
             New tests at apps/desktop/tests/unit/dendaQuickPresetRow.test.tsx
             cover dendaPerHari = 5000 / 2000 / 0, onSelect payload
             for both kinds, and testidPrefix isolation. Local gates
             clean (typecheck/lint/i18n:lint/build + 519 tests, +7 new).
             CI green (Lint+Typecheck+Test + Rust check). Squash-merged
             via alviarts PAT (commit d67ae1c).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Dashboard-Clickable-KPI
  pr:        '#147'
  started_at:   2026-05-06T21:24Z
  completed_at: 2026-05-06T21:30Z
  notes:     Added optional href to KpiCard + InsightCard. When set
             AND loading=false, the card is wrapped in a TanStack
             <Link to={href} aria-label={label}>; loading-state
             skeletons stay non-clickable. Wired Total Anggota /
             Total Buku / Buku Dipinjam to /anggota /buku /peminjaman.
             Buku terlaris and Peminjam teraktif Insights link to the
             detail page of the top item (null-data falls back to
             read-only card). Static averages keep their non-clickable
             presentation. Spec note about ?status=aktif is left as a
             follow-up since the route doesnt validate search params.
             New tests at apps/desktop/tests/unit/kpiCard.test.tsx
             mock the Link to a plain anchor and cover all four
             href / loading combinations. Local gates clean (523
             tests, +4 new). CI green. Squash-merged via PAT
             (commit fd587a8).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Dashboard-Quotes-2min
  pr:        '#148'
  started_at:   2026-05-06T21:32Z
  completed_at: 2026-05-06T21:48Z
  notes:     Lowered QUOTE_ROTATE_MS from 5 min to 2 min per user
             feedback. Refactor: extracted rotation state machine to
             a useQuoteRotation hook (apps/desktop/src/features/dashboard/
             useQuoteRotation.ts) with re-entrant-safe advance() guarded
             by a leave-timeout ref. Hook returns { quoteIndex,
             quoteLeaving, advance } and is fully unit-tested with
             vitest fake timers. Added a ghost ChevronRight icon-button
             next to the quote that calls advance(); same animation
             phases as the auto-rotate. Added i18n key dashboard:quote.next
             (id+en). Local gates clean (529 tests, +6 new). CI green.
             Squash-merged via PAT (commit 698eb65).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Quotes-Library
  pr:        '#149'
  started_at:   2026-05-06T21:50Z
  completed_at: 2026-05-06T21:55Z
  notes:     Appended 35 new perpustakaan/literasi quotes to
             apps/desktop/src/content/quotes.json. Diverse author pool
             (Indonesian: Pramoedya, Andrea Hirata, Buya Hamka, Tere
             Liye, Soekarno, Ki Hadjar Dewantara, B.J. Habibie, R.A.
             Kartini, Dahlan Iskan; Foreign: Bradbury, Cicero, Sagan,
             Eco, Calvino, Bacon, Dr. Seuss, Aurelius, Burke, Verne;
             Hadis: HR. Ibnu Majah, Muslim, Tirmidzi, Dailami, Imam
             Malik). Dedup pass via Python helper validated case-
             insensitive trim against existing 122 entries + within
             new batch. Total 122 -> 157. dailyQuote.test.ts already
             asserts QUOTE_COUNT >= 60 so no test update needed; ran
             10/10. Local gates clean. CI green. Squash-merged via
             PAT (commit b20be2d).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-Sirkulasi-Search
  pr:        '#150'
  started_at:   2026-05-06T21:55Z
  completed_at: 2026-05-06T22:05Z
  notes:     Promoted the previously-WIP ScanSearchInput component to
             a first-class control and wired it into SirkulasiPage,
             replacing the old <Input>+<form> manual-scan block. USB
             hand-scanner burst guard (<= 35 ms inter-key) keeps the
             dropdown closed when a barcode arrives; slow human typing
             (>= 180 ms debounce) opens a two-section dropdown
             (Anggota / Buku) backed by anggotaApi.list + bukuApi.list.
             enableBukuSearch is bound to (mode==pinjam && anggota!=null)
             so kembalikan mode + the no-anggota-yet state both hide
             the buku section. Picks route through handleScan: anggota
             goes through anggotaSet toast (or legacy kode path in
             kembalikan), buku resolves the first available eksemplar
             via bukuApi.get + handleScan. focusManual / clearManual
             now operate via the imperative handle. Six new tests in
             scanSearchInput.test.tsx cover slow query, USB burst,
             keyboard nav, Escape, enableBukuSearch=false, and manual
             kode fallthrough. Local gates clean (535 tests, +6 new).
             CI green. Squash-merged via PAT (commit b82aa7b).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    PAUSED
  item:      FEAT-OPAC-PostScanProfile
  pr:        null
  paused_at: 2026-05-06T22:06Z
  notes:     User said "pause di 7" — the v1.1.0 batch is paused
             before starting item 7 (FEAT-OPAC-PostScanProfile).
             No code work has begun on this item. To resume, paste
             the v1.1.0 master prompt into a fresh Devin session and
             it will pick up from this PROGRESS.md row (PAUSED -> claim
             -> implement). Items 1-6 are all DONE. Items 8-13 (top-6
             new features added mid-batch) and item 14 (release) are
             still OPEN.
             Pickup hint: read .devin/handoff/v1.1.0/BUGS.md section
             "FEAT-OPAC-PostScanProfile" for the spec. Files affected:
             apps/desktop/src/features/opac/* and the post-KTA-scan
             flow inside OpacKtaScanFlow.tsx.

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    STARTED
  item:      FEAT-OPAC-PostScanProfile
  pr:        null
  started_at:   2026-05-06T22:08Z
  notes:     Resumed after user said "lanjut pause di 8". Claiming
             item 7 now; will implement and merge then pause before
             item 8 (FEAT-OPAC-Scan-Locked).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    COMPLETED
  item:      FEAT-OPAC-PostScanProfile
  pr:        '#151'
  started_at:   2026-05-06T22:08Z
  completed_at: 2026-05-06T22:30Z
  notes:     PR #151 squash-merged into main (commit 9bc0d7e9). All
             three sub-features shipped: Sub-feature A (full member
             profile component with active loans, denda, reservasi,
             collapsible riwayat), Sub-feature B (auto kunjungan on
             scan with 5-minute localStorage throttle), Sub-feature C
             (reservasi wired into existing reservasi_buku table via
             OpacBookDetailDialog and a "Reservasi Saya" panel inside
             OpacMemberProfile with cancel buttons). Reservasi schema
             migration NOT needed — backend already exists in
             apps/desktop/src-tauri/src/commands/reservasi.rs and
             reservasiApi facade in apps/desktop/src/lib/reservasi.ts.
             7 new unit tests added (opacMemberProfile.test.tsx); 542
             tests pass. CI green (Rust + Lint+Typecheck+Tests).

- session_id: devin-c6e882bf432b47a0bd0340b111941348
  status:    PAUSED
  item:      FEAT-OPAC-Scan-Locked
  pr:        null
  paused_at: 2026-05-06T22:30Z
  notes:     Pause requested by user ("lanjut pause di 8") — pause
             before starting item 8 (FEAT-OPAC-Scan-Locked). Items
             1-7 are all DONE. Items 8-13 (top-6 polish) and item 14
             (release) are still OPEN. To resume, paste the v1.1.0
             master prompt into a fresh Devin session and it will
             pick up from this PROGRESS.md row (PAUSED -> claim ->
             implement).
             Pickup hint: read .devin/handoff/v1.1.0/BUGS.md section
             "FEAT-OPAC-Scan-Locked". Spec is small (~45 min): if
             member != null and the user presses "Scan KTA Saya",
             intercept with a confirmation dialog
             "Anggota lain masih login: <nama>" with [Logout & Scan]
             [Batal] buttons. Touches OpacApp.tsx + OpacHomePage.tsx.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    STARTED
  item:      FEAT-OPAC-Scan-Locked
  pr:        null
  started_at:   2026-05-06T22:30Z
  notes:     Resumed after user said "selalu update master prompt di akhir
             session devin agar devin berikutnya langsung lanjut pekerjaan
             kamu biar ga misskom begini" + earlier pick "lanjut v1.1.0
             paused di item 8". Claiming item 8 (FEAT-OPAC-Scan-Locked)
             — depends_on FEAT-OPAC-PostScanProfile which is DONE (#151).
             PAT ghp_c1xaCP... verified via 4-test (login=alviarts,
             admin/push true, rate_limit 4971/5000). Will implement
             OpacScanLockedDialog.tsx + wire into OpacApp.tsx +
             unit tests, then continue continuous-autonomous loop
             through items A1, A2, C1, D1, D5, E1, RELEASE.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    COMPLETED
  item:      FEAT-OPAC-Scan-Locked
  pr:        152
  started_at:   2026-05-06T22:30Z
  completed_at: 2026-05-06T22:46Z
  notes:     Implemented OpacScanLockedDialog + wired into OpacApp
             handleScanKtaRequest/handleLogoutAndScan. Also added
             optional onScanKta prop to OpacMemberProfile so a
             different student can request a scan from inside the
             previous member's profile (the realistic real-world
             trigger; the home-page "Scan KTA Saya" is unreachable
             once goHome redirects to profile). i18n keys
             opac.scanLocked.{title,description,logoutAndScan,cancel}
             and opac.profile.scanOtherKta added in id+en. 4 new
             unit tests in opacScanLockedDialog.test.tsx. All 5
             local gates green; PR #152 merged via PAT (sha
             f5c6c126). 8/14 items DONE — A1, A2, C1, D1, D5, E1,
             RELEASE remaining. Continuing to A1-CommandPalette next.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    STARTED
  item:      A1-CommandPalette
  pr:        null
  started_at: 2026-05-06T22:48Z
  notes:     Extend GlobalSearchDialog into a true command palette
             (routes + actions registry). Will create
             commandPaletteRegistry.ts with COMMAND_PALETTE_ROUTES
             (~15) and COMMAND_PALETTE_ACTIONS (~8). Empty query →
             Aksi Cepat + Halaman top 6. Non-empty query → fuzzy
             filter routes/actions + existing data search. Skip
             "Toggle Mode Demo" because D5-DemoMode is OPEN
             (forward-reference). i18n keys
             commandPalette.action.{key} + commandPalette.route.{key}
             in id+en. Test file commandPalette.test.tsx with
             ≥4 cases.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    COMPLETED
  item:      A1-CommandPalette
  pr:        153
  started_at:   2026-05-06T22:48Z
  completed_at: 2026-05-06T22:55Z
  notes:     Created commandPaletteRegistry.ts with 17 routes + 8
             actions (Backup Sekarang, Cetak Laporan Bulanan,
             Tambah Anggota/Buku/Peminjaman, Toggle Theme, Buka
             OPAC, Logout). addCommandPaletteAction() lets future
             features (D5, C1) register their own. Refactored
             GlobalSearchDialog to fuzzy-match routes/actions and
             render extra groups. Action callbacks deferred via
             setTimeout(0) so dialog close doesn't steal focus.
             Added jsdom polyfills (ResizeObserver,
             scrollIntoView) to setup.ts so cmdk renders cleanly.
             5 new unit tests in commandPalette.test.tsx; all 5
             gates green; PR #153 merged via PAT (sha 2da15989).
             9/14 items DONE — A2, C1, D1, D5, E1, RELEASE
             remaining. Continuing to A2-SkeletonScreens next.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    STARTED
  item:      A2-SkeletonScreens
  pr:        null
  started_at: 2026-05-06T22:57Z
  notes:     Add TableSkeleton + CardSkeleton; wire into Anggota/
             Buku/Peminjaman/Pengembalian list pages and OPAC home/
             search grids. Honor prefers-reduced-motion.

- session_id: devin-81dbfdf5cf0a4377a2612b1ac3922053
  status:    COMPLETED
  item:      A2-SkeletonScreens
  pr:        154
  started_at:   2026-05-06T22:57Z
  completed_at: 2026-05-06T23:05Z
  notes:     Added TableSkeleton + CardSkeleton (motion-reduce
             aware, aria-busy). Refactored DataTable loading
             branch to render 8 skeleton rows so all tables
             using DataTable (Anggota/Buku/Peminjaman/Stocktake/
             Audit Log/Reservasi/Wishlist/Sirkulasi etc.)
             benefit. OpacHomePage + OpacSearchPage now render
             CardSkeleton. PengembalianPage search panel renders
             5 skeleton list-items on first load. 9 new tests.
             All 5 gates green; PR #154 merged via PAT (sha
             2ce70436). 10/14 items DONE — C1, D1, D5, E1,
             RELEASE remaining. Continuing to C1-LaporanEksekutifPDF.
