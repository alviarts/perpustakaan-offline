# v1.1.0 — Item Specs

One section per item. Read only the section for the item you've
claimed; pre-reading all 8 specs wastes context.

Order matches `PROGRESS.md`. Each section has the same shape:

- **Symptom / what the user wants** — verbatim from the user where
  possible, plus screenshots described in prose.
- **Root cause / files affected** — concrete file paths + the
  specific lines / functions to touch.
- **Acceptance criteria** — testable bullets.
- **Risks** — things to watch for.
- **Tests** — unit / e2e to add.

---

## BUG-Pengembalian-DendaDup

### Symptom

Screenshot from the user shows the **Detail Pengembalian** card
rendering six denda buttons in two rows:

```
[Rp 5.000]  [Rp 10.000]  [Rp 15.000]  [Rp 5.000]
[Rp 10.000] [Rp 15.000]
```

The user says: "kenapa ada 2x data sama" — why is the same data
duplicated?

### Root cause

`apps/desktop/src/features/pengembalian/PengembalianPage.tsx` declares
two parallel preset arrays:

- `DENDA_QUICK_MULTIPLIERS = [1, 2, 3]` — rendered as
  `dendaPerHari × multiplier` (so with `dendaPerHari = 5000` the
  multipliers produce `5_000`, `10_000`, `15_000`).
- `DENDA_FIXED_PRESETS = [5_000, 10_000, 15_000]` — rendered raw.

When `dendaPerHari` is the default `5_000`, the two sets collide and
six buttons appear with three visible duplicate values.

### Files affected

- `apps/desktop/src/features/pengembalian/PengembalianPage.tsx`
  — lines ~20-21 (preset arrays) and the JSX that renders them
  inside the Detail Pengembalian card (around lines 305-360).

### Acceptance criteria

- Detail Pengembalian renders **at most 6** denda buttons total
  (multiplier set + fixed set), with **no duplicate values**.
- When `dendaPerHari = 0` (denda disabled in settings), the
  multiplier section is hidden entirely; only the fixed presets
  render.
- When a user changes `dendaPerHari` in settings to e.g. `2_000`,
  the buttons render `[Rp 2.000, Rp 4.000, Rp 6.000, Rp 5.000,
  Rp 10.000, Rp 15.000]` (no overlap, all unique).
- The existing `data-testid="pengembalian-bayar-quick"` container
  + `data-testid="pengembalian-bayar-quick-{N}x"` per-button
  attributes still exist for the multiplier buttons. Add
  `data-testid="pengembalian-bayar-quick-fixed-{value}"` for the
  fixed-preset buttons (replacing the current per-index naming if
  any).

### Implementation hint

Compute the deduplicated set once with `useMemo`:

```ts
const dendaQuickValues = useMemo(() => {
  const seen = new Set<number>();
  const buttons: Array<{ kind: 'mult'; mult: number; value: number } | { kind: 'fixed'; value: number }> = [];
  for (const mult of DENDA_QUICK_MULTIPLIERS) {
    const value = loanRules.dendaPerHari * mult;
    if (value <= 0 || seen.has(value)) continue;
    seen.add(value);
    buttons.push({ kind: 'mult', mult, value });
  }
  for (const value of DENDA_FIXED_PRESETS) {
    if (seen.has(value)) continue;
    seen.add(value);
    buttons.push({ kind: 'fixed', value });
  }
  return buttons;
}, [loanRules.dendaPerHari]);
```

Render once instead of in two loops.

### Tests

Add to `apps/desktop/tests/unit/PengembalianPage.test.tsx` (create
if missing):

- `dendaPerHari = 5000` renders 3 buttons total (multiplier set
  fully shadows fixed set).
- `dendaPerHari = 2000` renders 6 buttons, all unique values.
- `dendaPerHari = 0` renders 3 buttons (fixed set only).

### Risks

- The existing `data-testid` per-multiplier (`-1x`, `-2x`, `-3x`)
  is referenced by `apps/desktop/tests/unit/pengembalian.test.tsx`.
  Grep for it before renaming.

---

## FEAT-Peminjaman-DendaInline

### Symptom / what the user wants

User screenshot of `PeminjamanDetail` (`/peminjaman/$id`) shows a
"Daftar Buku" panel with a **single** Bayar Denda input + a
"Kembalikan(1)" button. There's no quick-preset row.

User says: "kita ke peminjaman disini ada bayar denda di tambah
juga disini untuk input instan bayar denda sesuai dengan
pengembalian" — at the peminjaman page there's bayar denda; please
add quick-preset buttons here too matching pengembalian.

### Files affected

- `apps/desktop/src/features/peminjaman/PeminjamanDetail.tsx`
  — find the Bayar Denda input (around the bottom of the page near
  the Kembalikan button) and add the same preset row that
  PengembalianPage uses.

### Implementation steps

1. Extract the dedup logic from BUG-Pengembalian-DendaDup into a
   shared helper, e.g.
   `apps/desktop/src/lib/dendaPresets.ts`:

   ```ts
   export function dendaQuickPresets(
     dendaPerHari: number,
     multipliers: readonly number[] = [1, 2, 3],
     fixed: readonly number[] = [5_000, 10_000, 15_000],
   ): Array<{ kind: 'mult'; mult: number; value: number } | { kind: 'fixed'; value: number }> { ... }
   ```

2. Use the helper in both PengembalianPage and PeminjamanDetail.
3. Render the same button row layout.

### Acceptance criteria

- PeminjamanDetail's Bayar Denda input has a `data-testid="peminjaman-bayar-quick"` container with the same preset
  buttons as Detail Pengembalian.
- Clicking a preset sets the input value (in IDR).
- Submitting "Kembalikan(N)" with a non-zero bayar value records
  the partial denda payment via the existing `peminjamanApi` /
  pengembalian RPC.
- Both pages share the same dedup logic — no copy-paste of
  `DENDA_QUICK_MULTIPLIERS` arrays.

### Tests

- Extend `apps/desktop/tests/unit/peminjamanDetail.test.tsx` (or
  create) to assert the preset row renders with the expected unique
  values.

### Risks

- `PeminjamanDetail` is shared between "active loans" and "history"
  views. Make sure the preset row only renders when the loan is
  still active (status='dipinjam') and the user has permission to
  collect denda. Don't render it in read-only history.

---

## FEAT-Dashboard-Clickable-KPI

### Symptom / what the user wants

User screenshot of dashboard shows the three KPI cards (Total
Anggota, Total Buku, Buku Dipinjam) plus the four insights cards
(Buku Terlaris, Peminjam Teraktif, Rata-rata Pinjam/Anggota,
Rata-rata Durasi Pinjam).

User wants: clicking a card navigates to the relevant page.

- "Total Anggota" → `/anggota`
- "Total Buku" → `/buku`
- "Buku Dipinjam" → `/peminjaman?status=aktif`
- "Buku Terlaris bulan ini" → `/buku/$id` of the top buku (use
  `data.insights.topBukuThisMonth.id`)
- "Peminjam Teraktif" → `/anggota/$id` of the top anggota
- "Rata-rata Pinjam / Anggota" — keep static (no obvious target)
- "Rata-rata Durasi Pinjam" — keep static (no obvious target)

The "Peminjaman Terlambat" panel already has a "Lihat semua di
Peminjaman" link — leave it.

### Files affected

- `apps/desktop/src/components/shared/KpiCard.tsx` — extend props
  to accept an optional `href`. When provided, wrap the rendered
  card content in `<Link to={href}>` (TanStack Router) so the
  whole card is clickable. Keep card hover styling.
- `apps/desktop/src/components/shared/InsightCard.tsx` (if it
  exists separately) or the inline `InsightCard` function in
  `DashboardPage.tsx` (currently around line 646) — same change.
- `apps/desktop/src/features/dashboard/DashboardPage.tsx` — pass
  `href` to each card based on the data.

### TanStack Router

The repo uses `@tanstack/react-router`. Use `Link` from there:

```tsx
import { Link } from '@tanstack/react-router';
<Link to="/anggota" className="...">...</Link>
```

Verify the route path strings match the existing routes in
`src/routes/_authed/`.

### Acceptance criteria

- All five "navigable" cards above are clickable (cursor: pointer,
  hover ring, full-card click target).
- Keyboard accessibility: tab focuses the link; Enter activates it.
- The two static cards retain the original (non-clickable) cursor.
- Loading skeleton state must NOT navigate (don't render the Link
  when `loading=true`).

### Tests

Extend `apps/desktop/tests/unit/dashboard.test.tsx` (or create) to
assert each clickable card renders as a `<a href="...">` after
loading resolves with stub data.

### Risks

- `data.insights.topBukuThisMonth` can be `null` when no loans
  exist this month. Don't render a Link with `href=undefined` —
  fall back to the static card.

---

## FEAT-Dashboard-Quotes-2min

### Symptom / what the user wants

User: "quotes ini interval 2 menit langsung slide up atau animasi
lain". The dashboard quote currently rotates every 5 minutes (see
`QUOTE_ROTATE_MS = 5 * 60 * 1000` at
`apps/desktop/src/features/dashboard/DashboardPage.tsx:66`). User
wants 2-minute rotation with a clear animation.

### Files affected

- `apps/desktop/src/features/dashboard/DashboardPage.tsx`
  - Change `QUOTE_ROTATE_MS` from `5 * 60 * 1000` → `2 * 60 * 1000`.
  - The slide-up keyframe + leave logic is already in place at
    lines 152-171; verify it still feels good. If too subtle,
    bump `QUOTE_LEAVE_MS` to 400 ms and tweak the keyframe.
- `apps/desktop/src/index.css` (or wherever the `slide-up` keyframe
  is defined) — verify the keyframe is symmetric (slide-down enter,
  slide-up leave).

### Bonus (recommended)

Add a small "next quote" arrow button next to the quote card so
users can manually advance without waiting 2 minutes:

- Icon: `ChevronRight` from `lucide-react`.
- Click → calls the same `pickNextQuoteIndex` flow the timer uses,
  including the leave animation.

### Acceptance criteria

- Quote rotates automatically every 2 minutes.
- Manual "next" button advances the quote with the same animation.
- Initial load still uses `quoteIndexForDate(new Date())` so the
  first quote is deterministic per day (don't break the existing
  test).

### Tests

`apps/desktop/tests/unit/dailyQuote.test.ts` already exists.
Extend with a test for the manual-advance helper if you add it.

### Risks

- Mocked `setInterval` in the existing dashboard test may need
  updating if it asserts the 5-minute interval. Search for
  `QUOTE_ROTATE_MS` references in tests before changing.

---

## FEAT-Quotes-Library

### Symptom / what the user wants

"tambahkan quotes tentang perpustakaan database nya" — add
library / books / literacy quotes to the quotes database.

### Files affected

- `apps/desktop/src/content/quotes.json` — currently 124 lines,
  ~62 quotes. Append at least 30 new quotes that are specifically
  about perpustakaan / buku / literasi. Diverse authors. No
  duplicates of existing entries.

### Format

```json
[
  ...existing entries...,
  { "text": "...", "author": "..." },
  ...
]
```

### Source ideas

- Indonesian authors: Pramoedya Ananta Toer, Andrea Hirata,
  Soekarno, B.J. Habibie, Eka Kurniawan, Goenawan Mohamad, Tere
  Liye, Habiburrahman El Shirazy, Buya Hamka, R.A. Kartini, Ki
  Hadjar Dewantara.
- Foreign: Borges, Eco, Calvino, Sagan, Asimov, Sartre, Marcus
  Aurelius, Mark Twain, Dr. Seuss, Maya Angelou, Carl Sagan, Toni
  Morrison.
- Pepatah / hadis tentang ilmu (with author "Pepatah" or "Hadis
  Riwayat …" attribution).

### Acceptance criteria

- ≥ 30 new entries appended.
- No duplicate `text` (case-insensitive) of existing entries.
- All entries have non-empty `text` + `author`.
- File still parses as JSON (run `node -e "JSON.parse(require('fs').readFileSync('apps/desktop/src/content/quotes.json'))"`).

### Tests

`apps/desktop/tests/unit/dailyQuote.test.ts` already validates
file shape. The total count assertion (if any) may need updating.

### Risks

- None; pure-content edit.

---

## FEAT-Sirkulasi-Search

### Symptom / what the user wants

User screenshot of Sirkulasi (Webcam): the manual scan input field
"Atau ketik / scan pakai USB scanner (Enter untuk submit)" only
accepts an exact kode. User wants it to also work as a search box:
type a member name or book title, see a dropdown of matches, pick
one, fall through to the existing scan handler.

### What's already drafted

The previous Devin session created
`apps/desktop/src/features/sirkulasi/ScanSearchInput.tsx` with the
combobox UI + USB-scanner burst guard. **Read this file first.**
It's not yet wired into SirkulasiPage and has no tests.

### Files affected

- `apps/desktop/src/features/sirkulasi/ScanSearchInput.tsx` (already
  exists from WIP commit) — review and adjust.
- `apps/desktop/src/features/sirkulasi/SirkulasiPage.tsx` — replace
  the `<form onSubmit={onSubmitManual}>...</form>` block (around
  line 754) with `<ScanSearchInput onSubmitKode={...}
  onPickAnggota={...} onPickBuku={...} />`. Keep the hand-scanner
  badge above. Pass `enableBukuSearch` based on `mode === 'pinjam'`
  and presence of `anggota` (search buku only after the librarian
  has chosen a member, in pinjam mode).
- `apps/desktop/src/features/stocktake/StocktakePage.tsx` —
  optional in scope; can stay text-only for now. If added, only
  enable `enableBukuSearch` and route picked buku through the
  existing eksemplar resolver.
- `apps/desktop/src/features/opac/OpacKtaScanFlow.tsx` — leave
  alone; OPAC scan dialog is camera-only.

### `onPickAnggota` / `onPickBuku` wiring on SirkulasiPage

```tsx
const handlePickAnggota = (a: Anggota) => {
  if (mode === 'pinjam') {
    setAnggota(a);
    showToast({ title: 'Anggota terpilih', description: `${a.kodeAnggota} · ${a.nama}` });
    beep('ok');
  } else {
    // kembalikan mode — load this member's active loans
    void loadKembalikanForMember(a);
  }
};

const handlePickBuku = async (b: Buku) => {
  // Pinjam mode: pick first available eksemplar.
  if (mode !== 'pinjam' || !anggota) return;
  try {
    const detail = await bukuApi.get(b.id);
    const tersedia = detail.eksemplar.find((e) => e.status === 'tersedia');
    if (!tersedia) {
      showToast({ variant: 'destructive', title: 'Tidak ada eksemplar tersedia' });
      beep('err');
      return;
    }
    void handleScan(tersedia.kodeEksemplar);
  } catch (err) {
    showToast({ variant: 'destructive', title: 'Gagal memuat detail buku', description: formatTauriError(err) });
    beep('err');
  }
};
```

### Acceptance criteria

- Typing 3+ chars with at least one alpha opens a dropdown showing
  Anggota + Buku results split into two sections.
- Scanning a barcode via USB scanner (rapid keystroke burst) does
  NOT open the dropdown — the payload routes straight to
  `handleScan` (existing behavior).
- ↑/↓ keys navigate; Enter picks the highlighted result; Escape
  closes.
- Picking an Anggota in pinjam mode without an existing anggota
  → sets the anggota (same as scanning their KTA).
- Picking an Anggota in pinjam mode WITH an existing anggota →
  swaps the anggota (with a confirm-toast).
- Picking a Buku in pinjam mode → adds the first available
  eksemplar to the basket; shows a toast if none available.
- Buku search is only enabled when `mode === 'pinjam' && anggota
  != null`. In kembalikan mode, only Anggota search is shown.
- The existing `Hand-scanner USB terdeteksi` badge keeps working.

### Tests

Add `apps/desktop/tests/unit/scanSearchInput.test.tsx`:

- Slow typing opens dropdown with stubbed search results.
- Fast burst (<35 ms inter-key) closes the dropdown and submits
  the raw kode.
- ArrowDown / Enter selects a result.
- Escape closes the dropdown without submitting.
- `enableBukuSearch={false}` hides the buku section.

### Risks

- `bukuApi.list({ query })` may be slow on large datasets. Debounce
  is already 180 ms; verify it doesn't fire on every keystroke.
- `anggotaApi.list({ aktif: true })` filters out inactive members
  by design. If the user wants to search inactive members, drop
  the `aktif: true` filter — discuss with the user before changing.

---

## FEAT-OPAC-PostScanProfile

### Symptom / what the user wants

User: "scan kta hanya itu fungsi nya? memuncukan nama? tambah misal
anggota sudah scan muncul peminjaman aktif atau langsung absen
kehadiran, atau bisa resevasi buku apa bila kosong eksemplar nya"

Translation: "Is scan KTA only for showing the name? Add e.g. after
member scans, show active loans, or auto attendance log, or
reservation when eksemplar is empty."

This is the largest item. Three sub-features:

### Sub-feature A — Active loans + denda + history panel

After a successful KTA scan, instead of just a small banner, render
a full-screen profile view showing:

1. **Header**: `<Avatar />` + nama + kode anggota + kelas + jurusan.
2. **Peminjaman aktif** — list of currently-loaned books for this
   anggota:
   - Judul + kode_eksemplar + tgl_pinjam + jatuh_tempo
   - Status badge: 'aktif' (green) or 'terlambat' (red, with days
     overdue)
   - Click row → opens detail dialog with full Buku info
3. **Denda outstanding** — sum of unpaid denda across active loans,
   prominent if > 0.
4. **Riwayat peminjaman** — last 10 loans, collapsible.

#### Backend (Rust + Tauri RPC)

`apps-desktop/src-tauri/src/peminjaman.rs` likely already has a
`peminjaman_aktif_by_anggota` query — if not, add one. Expose via
`peminjamanApi.aktifByAnggota(anggotaId)`.

For denda outstanding: `peminjamanApi.dendaOutstandingByAnggota(anggotaId)` — sum of
calculated denda across active loans where `tanggalKembali > tanggalJatuhTempo`.

#### Frontend

New file `apps/desktop/src/features/opac/OpacMemberProfile.tsx`.
Replace the current "Selamat datang, X" banner with a full panel
that mounts when `member != null`.

### Sub-feature B — Auto absen kehadiran on scan

Every successful KTA scan calls `kunjunganApi.create({
anggotaId: member.id })` exactly once per scan. Toast: "Kehadiran
tercatat". The scan flow already sets `member` via
`onMemberAuthenticated`; insert the kunjungan create call there
(after the existing toast).

If the member has already scanned in the last 5 minutes (check
`kunjunganApi.lastByAnggota(anggotaId)`), skip the duplicate create
and just show "Selamat datang kembali, X" instead.

### Sub-feature C — Reservasi when eksemplar 0

#### Schema

New table `reservasi`:

```sql
CREATE TABLE IF NOT EXISTS reservasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buku_id INTEGER NOT NULL REFERENCES buku(id) ON DELETE CASCADE,
  anggota_id INTEGER NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('antri', 'siap', 'fulfilled', 'cancelled', 'expired')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reservasi_buku ON reservasi(buku_id, status, requested_at);
CREATE INDEX idx_reservasi_anggota ON reservasi(anggota_id, status);
```

Add the migration to `apps/desktop/src-tauri/migrations/` following
the existing naming convention. Don't hand-edit the schema; use the
migration runner.

#### Rust RPC

`apps-desktop/src-tauri/src/reservasi.rs`:

- `reservasi_create(buku_id, anggota_id) -> Reservasi` — only allowed
  when `buku.jumlah_tersedia == 0`. Sets `status='antri'`,
  `expires_at = now + 7 days`. Rejects if the anggota already has an
  active reservasi for this buku.
- `reservasi_list_for_anggota(anggota_id) -> Vec<ReservasiWithBuku>`.
- `reservasi_queue_for_buku(buku_id) -> Vec<ReservasiWithAnggota>` —
  for staff view.
- `reservasi_cancel(id, anggota_id)` — anggota can cancel their own.
- `reservasi_promote(id)` — staff sets status='siap' when an
  eksemplar becomes available; queue is FIFO ordered by
  `requested_at`. Auto-call from the pengembalian flow when an
  eksemplar returns to `tersedia` if there's an `antri` reservasi
  for that buku — promote the head of queue.
- `reservasi_expire_overdue()` — cron-like sweep called on app
  startup that flips `siap` reservations older than `expires_at` to
  `expired`.

Expose via `apps/desktop/src/lib/reservasi.ts` mirroring
`anggota.ts` / `buku.ts` patterns.

#### Frontend

- `OpacBookCard.tsx` — when `tersedia === 0`, replace "Tidak ada
  cover" placeholder + Tersedia badge with a "Reservasi" button.
  Disabled if no `member` is logged in (with tooltip "Login dengan
  KTA untuk reservasi").
- `OpacBookDetailDialog.tsx` — same: add a Reservasi button when
  `tersedia === 0`. Show queue position if the member has an
  existing reservasi: "Posisi antrian: #N".
- `OpacMemberProfile.tsx` — add a "Reservasi Saya" section showing
  status (antri / siap / cancelled) and a cancel button per row.

### Acceptance criteria

- After scan, `OpacMemberProfile` shows nama / kode / kelas /
  jurusan / active loans / denda / riwayat / reservasi.
- Each scan creates a `kunjungan` row (skipped if last scan was
  < 5 min ago).
- Reserving a buku with `tersedia === 0` succeeds and the queue
  position is shown.
- Returning a reserved book auto-promotes the head of queue to
  `siap`.
- The Logout button in the existing banner stays — clicking it
  clears `member` and returns to OpacHomePage.

### Tests

- `apps/desktop/tests/unit/reservasi.test.ts` — RPC mock + queue
  ordering.
- `apps/desktop/tests/unit/opacMemberProfile.test.tsx` — render
  loans / denda / kunjungan history.
- A migration test if the migration framework exposes one (search
  for `migration` in existing tests).

### Risks

- Schema migration must be idempotent and survive an existing DB
  that has no `reservasi` table.
- The existing `useOpacIdleReset` should still tear down the
  member session after the configured idle timeout.
- The auto-promote logic on pengembalian must not double-promote
  if multiple reservations are `siap` already.

---

## FEAT-OPAC-Scan-Locked

### Symptom / what the user wants

User: "ada notifikasi apa bila belum logout lalu siswa mau scan
ada tombol anda masih login klik tombol logout"

If the OPAC member banner is showing (i.e. `member != null` from
`OpacApp.tsx`) and a different student presses "Scan KTA Saya",
intercept with a confirmation dialog before opening the camera /
scan flow:

```
Anggota lain masih login: <nama>

[Logout & Scan]   [Batal]
```

### Files affected

- `apps/desktop/src/features/opac/OpacApp.tsx`
  - The "Scan KTA Saya" button currently calls `setScanOpen(true)`
    directly via `onScanKta`. Wrap it: if `member != null`, set a
    new `scanLockedDialogOpen` flag instead. Render a small
    confirmation dialog. On Confirm, run `setMember(null)` (clear
    session) then `setScanOpen(true)`.
- New file `apps/desktop/src/features/opac/OpacScanLockedDialog.tsx`
  — small alert dialog component using `@/components/ui/dialog`.

### Acceptance criteria

- When `member == null`, "Scan KTA Saya" opens the scan flow
  immediately (existing behavior).
- When `member != null`, "Scan KTA Saya" opens the
  `OpacScanLockedDialog` instead. The dialog shows the current
  member's name, has a primary `Logout & Scan` button and a
  secondary `Batal` button.
- Clicking `Logout & Scan` clears the member session, triggers any
  reservasi expire / kunjungan flush logic if relevant, then
  opens the scan flow.
- Clicking `Batal` closes the dialog without changes.
- The existing `useOpacIdleReset` continues to work (keyboard
  Escape or idle timeout still logs out).

### Tests

- `apps/desktop/tests/unit/opacScanLockedDialog.test.tsx`:
  - Renders with current member name.
  - Logout button calls the clear callback then the open callback.
  - Cancel button is a no-op.

### Risks

- `OpacApp.tsx` is small but central. Don't break the
  `useOpacIdleReset` wiring or the admin unlock button.
- This item depends on FEAT-OPAC-PostScanProfile because the
  "logout" semantics may include closing a Reservasi tab or
  similar. Pick this item only after FEAT-OPAC-PostScanProfile is
  merged.

---

## A1-CommandPalette

### Symptom / what the user wants

The repo already has a `GlobalSearchDialog` component
(`apps/desktop/src/components/layout/GlobalSearchDialog.tsx`) that opens
on Ctrl/Cmd+K and searches anggota / buku / peminjaman. It is a strong
foundation but currently ONLY does data search.

Goal: turn it into a true command palette that also:
- Navigates to any in-app route (Anggota, Buku, Peminjaman, Pengembalian,
  Sirkulasi, Reservasi, Wishlist, KTA, Stocktake, Audit Log, Backup,
  Pengaturan, Manual, Tentang, OPAC, Logout).
- Fires quick actions (Backup Sekarang, Cetak Laporan Bulanan PDF,
  Tambah Anggota, Tambah Buku, Kunci Layar, Toggle Tema, Toggle Mode
  Demo (D5), Buka OPAC).

### Files affected

- `apps/desktop/src/components/layout/GlobalSearchDialog.tsx`
  - Add a new `CommandHit` discriminated union with kinds: `'anggota'`,
    `'buku'`, `'peminjaman'`, `'route'`, `'action'`.
  - Build a static list of route hits (synced with router `__authed`
    children). Filter against `query` with the existing fuzzy matcher.
  - Build a static list of action hits each with an `execute` callback
    + an `icon` (lucide-react) + `i18n key` for label & description.
  - Sort group order: matched data hits first, then routes, then
    actions. Only include groups that have ≥ 1 visible hit.
- New file
  `apps/desktop/src/components/layout/commandPaletteRegistry.ts`
  exporting the route + action lists so other features can register
  more actions later (e.g. FEAT-Sirkulasi-Search may want a
  "Mulai Sirkulasi" action).
- `apps/desktop/src/i18n/{id,en}/common.json` — new namespace block
  `commandPalette.action.{key}` and `commandPalette.route.{key}`.

### Acceptance criteria

- Pressing Ctrl/Cmd+K opens the dialog (existing behavior).
- With an empty query, the palette shows three default groups:
  `Aksi Cepat` (8+ actions), `Halaman` (top 6 most-used routes), and
  no data search section (skip empty searches).
- Typing "back" matches `Aksi Cepat → Backup Sekarang`. Pressing Enter
  triggers an immediate `backupApi.runNow()` call (or the existing
  manual-backup helper) and shows a success toast.
- Typing "lapor" matches `Halaman → Laporan` and `Aksi Cepat → Cetak
  Laporan Bulanan`. Both navigate / execute correctly.
- Typing "ali" still searches anggota (existing data search keeps
  working). Mixed groups render in the order: anggota / buku /
  peminjaman / routes / actions.
- Keyboard navigation (↑/↓, Enter, Esc) works across all groups.
- All labels go through i18n; `id` and `en` parity. The i18n-coverage
  test must pass.

### Tests

- `apps/desktop/tests/unit/commandPalette.test.tsx`:
  - Empty query renders Aksi Cepat + Halaman groups, no data groups.
  - Typing "back" surfaces the Backup action and a "back" data hit
    shouldn't crash if no data matches.
  - Selecting a route hit calls `navigate` with the right path.
  - Selecting an action hit calls the registered `execute` callback.
- Update `tests/unit/globalSearchDialog.test.tsx` if it asserts
  exact group ordering — preserve existing data-search tests.

### Risks

- Don't break the existing global search keyboard wiring in
  `Header.tsx`. The dialog still mounts at the same place.
- Action `execute` callbacks must run AFTER the dialog closes, or the
  dialog will steal focus from any toast / confirm.
- Don't force-await long actions in the dialog handler; fire-and-forget
  + toast for things like Backup Sekarang.

---

## A2-SkeletonScreens

### Symptom / what the user wants

Today most large tables render a centered spinner during initial load.
Spinners delay the user's mental "this page is loaded" signal because
nothing structural is visible. Skeletons (gray pulsing placeholders
matching the final layout) feel snappier and reduce perceived latency
even though backend timing is unchanged.

### Files affected

- New shared component
  `apps/desktop/src/components/shared/TableSkeleton.tsx`:
  - Props: `columns: number`, `rows?: number = 8`,
    `widths?: ReadonlyArray<string>` (per-column width hints).
  - Renders a `<table>` with the same column count + N rows of
    `<Skeleton />` (existing `@/components/ui/skeleton`) cells.
- Wire it into the loading state of:
  - `apps/desktop/src/features/anggota/AnggotaListPage.tsx`
  - `apps/desktop/src/features/buku/BukuListPage.tsx`
  - `apps/desktop/src/features/peminjaman/PeminjamanListPage.tsx`
  - `apps/desktop/src/features/pengembalian/PengembalianPage.tsx`
    (search results panel)
  - `apps/desktop/src/features/dashboard/DashboardPage.tsx` already
    uses Skeleton for KPI cards — leave alone.
- New shared component
  `apps/desktop/src/components/shared/CardSkeleton.tsx` for OPAC book
  grid (`OpacHomePage`, `OpacSearchPage`).

### Acceptance criteria

- On initial load of each listed page, the user sees skeleton placeholders
  matching the final table or grid layout, not a centered spinner.
- Skeletons fade out cleanly when data arrives (no flash of empty state).
- For pages with both filter bar + table, the filter bar renders
  immediately; only the table region uses the skeleton.
- Component respects `prefers-reduced-motion` — if reduced, skeleton
  pulse is disabled.

### Tests

- `apps/desktop/tests/unit/tableSkeleton.test.tsx`:
  - Renders the requested number of rows × columns.
  - Honors per-column width hints.
- `apps/desktop/tests/unit/cardSkeleton.test.tsx`:
  - Renders requested card count.

### Risks

- Tailwind `animate-pulse` already exists (used by existing Skeleton).
  No new keyframes needed.
- Don't change a11y: include a single `aria-busy="true"` on the
  container so screen readers announce loading.

---

## C1-LaporanEksekutifPDF

### Symptom / what the user wants

Pustakawan currently has to copy KPI numbers manually from Dashboard +
Laporan into a Word doc to bring to monthly meetings with the kepala
sekolah. Goal: one button "Cetak Laporan Eksekutif" that produces a
PDF ready to print or email.

### Files affected

- New file `apps/desktop/src/lib/pdf/laporanEksekutifPdf.ts`:
  - Function `generateLaporanEksekutifPdf(period: { startIso, endIso })`
    returns a `Blob`.
  - Uses the existing pdf stack already in
    `apps/desktop/src/lib/pdf/` (look for `kasPdf.ts` or `stocktakePdf.ts`
    as a template — they use `pdf-lib` or similar).
- Page: `apps/desktop/src/features/laporan/LaporanLayout.tsx` adds a
  new "Eksekutif" sub-page (or a button inside an existing sub-page)
  that opens a date-range picker (default = current month) and a
  primary "Cetak PDF" button.
- New i18n keys under `apps/desktop/src/i18n/{id,en}/laporan.json`.

### PDF content

Page 1 (cover):
- Header: school logo + nama sekolah from `appSettings`.
- Title: "Laporan Eksekutif Perpustakaan" + period range.
- Summary KPIs (4-up grid): Total anggota aktif, Total buku, Peminjaman
  bulan ini, Denda outstanding.

Page 2 (trends):
- Line chart: Peminjaman per minggu in period.
- Bar chart: Top 5 buku.
- Bar chart: Top 5 anggota peminjam.

Page 3 (action items):
- Bullet list with auto-generated action items: e.g. "Anggota X
  memiliki denda > Rp 50.000 — kirim surat", "Buku Y memiliki
  reservasi 3 dengan stok 0 — pertimbangkan pengadaan".
- Footer: tanda tangan area for kepala sekolah + pustakawan + tanggal
  cetak.

### Acceptance criteria

- The button opens a small dialog: from-tanggal, ke-tanggal (default
  = bulan berjalan), tombol "Cetak".
- Clicking Cetak calls `generateLaporanEksekutifPdf` and triggers
  download via the existing PDF download helper.
- PDF must contain school name + logo (if set in identitas), correct
  KPI numbers, all three charts on page 2, and the action-item list.
- Operates entirely offline (no fonts fetched from web).

### Tests

- `apps/desktop/tests/unit/laporanEksekutifPdf.test.ts`:
  - Generates a non-empty Blob given a fake dataset.
  - Dataset with no peminjaman gracefully produces a PDF stating
    "Tidak ada peminjaman dalam periode ini".
  - Dataset with denda > 50000 includes the action item.

### Risks

- pdf-lib (or whatever the existing stack uses) needs Indonesian font
  registered for proper rendering of "ñ", curly quotes, etc. Reuse
  whatever existing PDFs use.
- Charts must be rendered server-side / canvas-side, not as DOM
  screenshots, otherwise printout looks blurry. Reuse the existing
  chart-to-PDF helper if any (check `kasPdf.ts`).

---

## D1-SystemHealthWidget

### Symptom / what the user wants

A single dashboard card that summarises the health of the install at
a glance: DB size, last backup, next scheduled backup, pending
reservasi count, version + update available flag.

### Files affected

- New component
  `apps/desktop/src/features/dashboard/SystemHealthCard.tsx`.
- Add a new RPC or extend existing `dashboardApi.getSystemHealth()` in
  `apps/desktop/src/lib/dashboard.ts`. The Rust side may already expose
  some of these (look at `apps/desktop/src-tauri/src/cmd/dashboard.rs`
  + `backup.rs`). If not, add a thin command that returns:
  ```ts
  interface SystemHealth {
    dbSizeBytes: number;
    lastBackupAt: string | null;
    nextBackupAt: string | null;
    pendingReservasi: number;
    appVersion: string;
    updateAvailable: boolean | null;
  }
  ```
- `DashboardPage.tsx` — render the card under the existing KPI grid.

### Acceptance criteria

- Card shows 5 lines: DB size formatted (KB/MB/GB), last backup
  relative ("2 jam lalu" via existing date-fns), next backup absolute,
  pending reservasi count (0 → green checkmark, > 0 → orange bell),
  app version with "Update tersedia" pill if true.
- Clicking the backup line navigates to Settings → Backup.
- Clicking the reservasi line navigates to /reservasi.
- Card has skeleton (A2) while data loads.

### Tests

- `apps/desktop/tests/unit/systemHealthCard.test.tsx`:
  - Renders all 5 lines with mock data.
  - "Update tersedia" pill only renders when `updateAvailable` true.
  - Pending reservasi 0 renders green check.

### Risks

- DB size check must not block UI; use `getMetadata`-style call that
  is fast (< 50ms).
- Version comparison should reuse the existing version-check helper if
  one exists for the manual update flow (jalur C); otherwise this row
  just shows the current version with no pill.

---

## D5-SandboxDemoMode

### Symptom / what the user wants

A toggle in Settings (or via Command Palette → "Mode Demo") that
switches the entire app to a sandboxed copy of the database. Saat
aktif, banner kuning menyala, semua perubahan masuk ke `demo.db`
terpisah, dan tombol "Kembali ke Mode Asli" menonaktifkan kembali.

Use case: pelatihan petugas baru, demo ke sekolah lain, debugging
tanpa risiko menyentuh data produksi.

### Files affected

- Rust: `apps/desktop/src-tauri/src/state.rs` (or wherever the active
  DB path is stored) — add a `sandbox_mode: AtomicBool` and a helper
  `current_db_path()` that picks `demo.db` when the flag is on.
- `apps/desktop/src-tauri/src/cmd/sandbox.rs` (new) with:
  - `enable_sandbox()`: copies a fresh seed (the app's bundled seed
    SQL or a snapshot of the current production DB minus
    audit/sensitive rows) into `demo.db`, sets the flag, returns the
    new active DB path.
  - `disable_sandbox()`: clears the flag, restores production DB
    handle, optionally archives `demo.db` to `~/.config/<app>/demo-archive/<ts>.db`.
  - `is_sandbox_active()`.
- TS: `apps/desktop/src/lib/sandbox.ts` thin wrapper.
- New settings page `apps/desktop/src/features/settings/SandboxPage.tsx`
  + section entry in `sections.ts` ("Mode Demo / Sandbox").
- Banner: `apps/desktop/src/components/layout/SandboxBanner.tsx` mounted
  globally above the Header. Yellow background, message "Mode Demo
  aktif — perubahan tidak menyentuh data asli", primary button
  "Kembali ke Mode Asli".

### Acceptance criteria

- Toggle "Aktifkan Mode Demo" in SandboxPage shows a confirm dialog
  ("Akan membuat salinan DB demo. Lanjut?"), then on Confirm:
  enables sandbox, app reloads (reset all React Query caches), banner
  appears, all data displayed is from `demo.db`.
- Toggle "Kembali ke Mode Asli" disables sandbox, app reloads, banner
  disappears, original data is back.
- Sandbox state persists across app restarts (stored in app config so
  if user restarts mid-demo they're still in demo mode + banner
  shows).
- Audit log records sandbox toggles even though sandbox writes don't
  reach prod DB (audit row goes to a separate sandbox log).

### Tests

- `apps/desktop/tests/unit/sandboxBanner.test.tsx`:
  - Banner renders only when `is_sandbox_active() === true`.
  - "Kembali ke Mode Asli" button calls disable RPC.
- Rust unit test for `enable_sandbox` / `disable_sandbox` flow.

### Risks

- Schema migrations: when `enable_sandbox` is called, the demo DB
  must run migrations to match production schema. Reuse the existing
  migration runner.
- Backup scheduler must skip sandbox mode (don't back up demo DB into
  the regular cloud target).
- Mark this row as schema-touching in the PR description so other
  Devins know to base off main after this merges.

---

## E1-OPACBukuPilihan

### Symptom / what the user wants

OPAC home today renders an alphabetised grid of all books. Member-facing
"wow" is low. Add a curated carousel at the top: admin pins 3-5 buku
weekly (e.g. tema bulan literasi); carousel auto-rotates every 5s,
manual prev/next arrows, click → opens existing
`OpacBookDetailDialog`.

### Files affected

- DB: new table `buku_pilihan` with columns
  `(id, buku_id, position, pinned_at, label, expires_at?)`. Migration
  added under `apps/desktop/src-tauri/migrations/`.
- Rust: `apps/desktop/src-tauri/src/cmd/buku_pilihan.rs` with
  `list_active()`, `pin(buku_id, label)`, `unpin(id)`,
  `reorder(ids[])`. Cap at 5 active pins.
- TS API: `apps/desktop/src/lib/bukuPilihan.ts`.
- New admin page
  `apps/desktop/src/features/buku/BukuPilihanAdminPage.tsx` accessible
  from the Buku list ("Atur Pilihan OPAC" button) — shows current
  pinned books, lets admin add (search + pick), reorder (drag), unpin.
- OPAC: `OpacHomePage.tsx` — render
  `apps/desktop/src/features/opac/OpacFeaturedCarousel.tsx` above the
  existing book grid only when `bukuPilihanApi.listActive()` returns
  ≥ 1 row. Auto-rotate every 5s with pause-on-hover, manual arrows,
  dot indicators.

### Acceptance criteria

- Admin can pin up to 5 buku; pin order is the rendered order.
- OPAC carousel auto-rotates every 5s, pauses when hovered, advances
  with arrow buttons or dot click.
- Clicking a slide opens existing `OpacBookDetailDialog`.
- When 0 pins are active, the carousel section is hidden entirely;
  the existing OPAC grid layout is unchanged.
- Carousel is keyboard-accessible (←/→ + Enter).
- Component respects `prefers-reduced-motion` — disables auto-rotate
  + animation, shows manual arrows only.

### Tests

- `apps/desktop/tests/unit/opacFeaturedCarousel.test.tsx`:
  - Renders N slides given N pinned books.
  - Auto-rotate advances after 5s (use vitest fake timers).
  - Hover pauses auto-rotate.
  - Empty pin list returns null.
- `apps/desktop/tests/unit/bukuPilihanApi.test.ts`:
  - `listActive` filters out expired pins.
  - `pin` rejects when 5 pins already active.

### Risks

- Schema migration: introduces `buku_pilihan`. Sequence with D5
  (sandbox) so both migrations can run in any order — keep the
  migration name unique and strictly additive.
- Carousel must be keyboard-accessible (focus indicators on arrows
  + dots).
- Don't autoplay video / heavy media; only static cover images.
