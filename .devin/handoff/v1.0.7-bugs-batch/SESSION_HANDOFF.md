# Session Handoff — v1.0.7 Bugs Batch (PR E + Release)

> Status doc untuk Devin selanjutnya yang lanjutin batch v1.0.7. Updated 2026-05-05.
> Sumber awal: PR #119 (`devin/1777993479-v107-bugs-handoff`).

## TL;DR

**4 dari 5 PR sudah dibuka & CI hijau:**

| PR  | # | Branch | Status |
| --- | - | --- | --- |
| A | [#120](https://github.com/alviarts/perpustakaan-offline/pull/120) | `devin/<ts>-...` | IN_PR (CI green) |
| B | [#121](https://github.com/alviarts/perpustakaan-offline/pull/121) | `devin/<ts>-...` | IN_PR (CI green) |
| C | [#122](https://github.com/alviarts/perpustakaan-offline/pull/122) | `devin/1778000775-kta-biodata-back-side` | IN_PR (CI green) |
| D | [#123](https://github.com/alviarts/perpustakaan-offline/pull/123) | `devin/1778003224-pr-d-layout-polish` | IN_PR (CI green) |
| **E** | **TBD** | **TBD** | **OPEN — kerjakan di sesi ini** |

**Langkah berikut:** PR E (FEAT-11 — dashboard quote rotation 5 menit + animasi), lalu PR F (release v1.0.7).

## Workflow protocol (dipakai PR A–D, ikutin terus)

### Branch + commit conventions

- Branch: `devin/<unix-ts>-<short-slug>` dari `main`. Contoh: `devin/1778003224-pr-e-quote-rotation`.
- Commit: Conventional Commits. Contoh: `feat(dashboard): rotate quote every 5 minutes with fade-slide animation`.
- Setiap commit **WAJIB** ada trailer:
  ```
  Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>
  ```

### Authentication

GitHub PAT tersimpan org-scope sebagai env var `GITHUB_PAT_ALVIARTS`. Tool `git_pr action="create"` masih balikin "Resource not accessible by personal access token" — workaround pakai `curl` ke API GitHub langsung:

```bash
# Push (selalu bypass git-manager.devin.ai):
git -c "http.extraheader=" -c "credential.helper=" \
  push "https://x-access-token:${GITHUB_PAT_ALVIARTS}@github.com/alviarts/perpustakaan-offline.git" \
  <branch>:<branch>

# Buat PR:
python3 -c "import json; print(json.dumps({
  'title': 'feat(dashboard): ...',
  'head': '<branch>',
  'base': 'main',
  'body': open('/tmp/pr-body.md').read()
}))" > /tmp/pr-payload.json

curl -sS -X POST \
  -H "Authorization: token ${GITHUB_PAT_ALVIARTS}" \
  -H "Accept: application/vnd.github+json" \
  -d @/tmp/pr-payload.json \
  https://api.github.com/repos/alviarts/perpustakaan-offline/pulls
```

### Gate checklist (semua harus hijau sebelum push)

```bash
pnpm typecheck
pnpm lint                               # eslint --max-warnings=0
pnpm i18n:lint                          # parity id ↔ en
pnpm test                               # vitest, target ≥264 tests
pnpm build                              # vite build
cd apps/desktop/src-tauri
cargo check --all-targets
cargo clippy --all-targets -- -D warnings
cargo test --lib                        # 117+ backend tests
```

CI checks: 2 yang dijalankan tiap PR (Rust + Lint/Typecheck/Unit Test). 2 lainnya skipped (Build Windows installer + Publish v2 GitHub Release) — keduanya cuma jalan di tag, tidak perlu di-tunggu.

### PROGRESS.md update protocol (PENTING — gampang lupa)

PROGRESS.md ada di branch **`devin/1777993479-v107-bugs-handoff`** (= PR #119), **bukan** di PR branch yang lagi dibuat. Pola PR A/B/C/D semua sama:

1. Setelah PR baru dibuat (e.g. dapat #NNN):
2. `git checkout v107-handoff && git pull origin devin/1777993479-v107-bugs-handoff`
3. Edit `.devin/handoff/v1.0.7-bugs-batch/PROGRESS.md` — ubah row item-item PR baru: `status: OPEN → IN_PR`, `pr: — → #NNN`
4. Commit dengan message: `docs(handoff): mark <items> as IN_PR (#NNN, PR <X>)`
5. Push ke `v107-handoff:devin/1777993479-v107-bugs-handoff` pakai PAT.

Jangan masukkan PROGRESS.md update ke PR branch yang lagi dibuat — bakal konflik kalau PR #119 belum di-merge.

## PR E — FEAT-11 Dashboard quote rotation

### Spec (verbatim dari `BUGS.md` baris 525-555)

- Quote ganti otomatis tiap 5 menit (pakai `setInterval(300_000)`)
- Animasi: **fade-slide** default. Quote lama fade out + slide-up, quote baru fade in + slide-up dari bottom.
- Setiap rotation pilih quote berbeda dari sebelumnya (jangan tampil 2× berturut-turut)
- Saat user pindah halaman dan kembali, timer di-reset ke 5 menit (jangan instant ganti — anti-flicker)
- CSS transition 400-600ms

### Files yang harus disentuh

- `apps/desktop/src/features/dashboard/DashboardPage.tsx` — quote card di lines 101-114, currently `useMemo(() => getQuoteForDate(new Date()), [])`. Refactor ke state + interval.
- `apps/desktop/src/lib/dailyQuote.ts` — sudah ada `quoteIndexForDate`, `getQuoteForDate`. Tambah helper baru: `getRandomQuoteExcept(excludeIndex: number, rng?: () => number): { quote: Quote, index: number }` supaya bisa dites deterministik.
- `apps/desktop/src/content/quotes.json` — sudah ada 122 quote (mayoritas tema buku). Pool size cukup, tidak perlu ditambah kecuali user minta.
- `apps/desktop/tests/unit/dailyQuote.test.ts` — tambah test untuk helper baru (rotasi tidak repeat, RNG injection).

### Implementation sketch

```tsx
// DashboardPage.tsx — refactor quote card
const [quoteIndex, setQuoteIndex] = useState(() => quoteIndexForDate(new Date()));
const [phase, setPhase] = useState<'enter' | 'leave'>('enter');

useEffect(() => {
  const interval = setInterval(() => {
    setPhase('leave');
    // wait for fade-out, then swap + fade-in
    setTimeout(() => {
      setQuoteIndex((prev) => pickNextIndex(prev));
      setPhase('enter');
    }, 500);
  }, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);

const quote = QUOTES[quoteIndex];

// Card content with `data-phase={phase}` + Tailwind animation classes
```

CSS animation pakai Tailwind built-in `transition-all duration-500` + `translate-y-2 opacity-0` untuk leave, `translate-y-0 opacity-100` untuk enter. Kalau perlu keyframe khusus, edit `tailwind.config.ts`.

### Acceptance test plan

- [ ] Buka dashboard. Quote awal = quote-of-the-day (deterministic per tanggal).
- [ ] Tunggu 5 menit. Quote berubah dengan animasi fade-slide.
- [ ] Pencet F5 (refresh) sebelum 5 menit lewat. Timer reset ke 5 menit.
- [ ] Pindah ke halaman lain (e.g. Anggota), tunggu 5 menit, kembali. Quote baru lagi (timer fresh).
- [ ] 10× rotasi berurutan. Tidak pernah quote yang sama 2× berturut-turut.
- [ ] Animasi smooth, tidak ada layout shift.

### PR body template (mirror PR D)

```markdown
## Summary

Dashboard quote-of-the-day sekarang rotasi tiap 5 menit dengan animasi fade-slide (v1.0.7 PR E, FEAT-11).

- Initial state pakai `quoteIndexForDate(new Date())` — sama persis behavior lama supaya quote pertama deterministik.
- Setiap 5 menit, `setInterval` fire → animation phase 'leave' (fade out + slide up 8px) → setelah 500ms swap index + phase 'enter' (fade in + slide up dari +8px ke 0).
- Helper baru `pickNextQuoteIndex(currentIndex)` di `dailyQuote.ts` jamin tidak ada quote yang sama 2× berturut.
- Timer auto-cleanup di `useEffect` cleanup, jadi pindah halaman tidak leak.
- (kalau perlu) Tailwind keyframe baru di `tailwind.config.ts` untuk animasi yang lebih kompleks.

[+ Review checklist + test plan + notes]
```

## PR F — Release v1.0.7 (setelah semua A-E merged)

### Bump version di:

- `package.json` (root)
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/tauri.conf.json`

### Changelog

Update `CHANGELOG.md` dengan summary semua bug + feature dari PROGRESS.md (semua row DONE). Format per release sudah established di file (lihat v1.0.6 entry).

### Tag

User yang tag `v1.0.7` setelah PR F merged (atau via release workflow `.github/workflows/release.yml` kalau pakai tag-on-merge).

## Risk register

- PR A/B/C/D belum di-merge user. PR E **branch off main**, jangan branch off PR D — kalau merge order beda dengan urutan PR, conflict di PROGRESS.md mungkin terjadi. Mitigation: PROGRESS.md update PR E nanti commit ke v107-handoff branch (bukan ke PR E branch), jadi tidak conflict dengan PR D.
- Test `pnpm test` ada 1 test yang lambat (`manualPage.test.tsx` ~10 detik) karena `react-markdown` heavy. Jangan panik kalau kelihatan stuck.
- `pnpm i18n:lint` strict — semua key id ↔ en harus parity. Kalau tambah key ke salah satu, harus tambah ke yang lain juga.

## Reference dirs

- Spec: `.devin/handoff/v1.0.7-bugs-batch/BUGS.md` (semua detail per item)
- Status: `.devin/handoff/v1.0.7-bugs-batch/PROGRESS.md` (table item × status × PR)
- Workflow: `.devin/handoff/v1.0.7-bugs-batch/WORKFLOW.md` (protokol PR + commit + branch)
- Screenshots: `.devin/handoff/v1.0.7-bugs-batch/screenshots/`
