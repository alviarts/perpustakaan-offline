# Post-v1.0.0 Bugfix — Devin Instruction Template

Copy-paste prompt for any new Devin session that should pick up the next open
bug from [`POST_V1_BUGS.md`](./POST_V1_BUGS.md) / [`PROGRESS.md`](./PROGRESS.md).

The protocol is intentionally close to the v2-migration `INSTRUCTION_TEMPLATE.md`
the user is already used to, but the unit of work is now **one bug per PR**
instead of "session NN of 12".

---

## Copy-paste prompt

```
Repo: alviarts/perpustakaan-offline
Branch utama: main
Bahasa komunikasi: Indonesia. Bahasa commit/PR: English (conventional commits).

Migrasi v2 sudah selesai (v1.0.0, semua 12 sesi merged). Sekarang fase
post-v1.0.0 bugfix. Ada 9 bug yang ke-discover dari smoke test + Windows
manual install testing. Detail lengkap di repo:

- `docs/bugs/POST_V1_BUGS.md`        → 9 bug full detail (where/trigger/observed/expected/suggested fix/DoD)
- `docs/bugs/PROGRESS.md`            → status table machine-parseable (OPEN/IN_PR/DONE/BLOCKED)
- `docs/bugs/INSTRUCTION_TEMPLATE.md`→ protokol ini

== PROTOKOL ==

STEP 1 — Sync state
1. `git clone https://github.com/alviarts/perpustakaan-offline.git`
   (atau `git checkout main && git pull origin main` kalau sudah ada).
2. Baca `docs/bugs/PROGRESS.md`. Ambil baris pertama dengan `status: OPEN`
   sesuai urutan di tabel.
3. Baca entry bug-nya di `docs/bugs/POST_V1_BUGS.md` (where, trigger,
   suggested fix, definition of done).

STEP 2 — Pre-flight
4. Setup repo (lihat `.agents/skills/smoke-test-v2/SKILL.md` kalau ada,
   atau jalan: `pnpm install --frozen-lockfile && pnpm --filter @perpustakaan/desktop exec tsr generate`).
5. Pastikan baseline pass: `pnpm lint && pnpm typecheck && pnpm i18n:lint && pnpm test`.
   Kalau ada yang fail di main BEFORE perubahan kamu, STOP dan kasih tau user.

STEP 3 — Implement fix
6. Branch: `devin/<unix-timestamp>-fix-<bug-id>`
   (contoh `devin/1704067200-fix-bug-001-eksemplar-seed`).
7. Implement perbaikan sesuai "Suggested fix" di entry bug-nya. JANGAN
   langsung kerjain bug LAIN walaupun kelihatannya gampang — buat 1 PR per
   bug supaya gampang di-review dan di-revert kalau perlu.
8. Tambah unit test sesuai "Definition of done". Untuk perubahan
   Rust (`apps/desktop/src-tauri/`), pakai `#[cfg(test)] mod tests` di file
   yang sama atau di `src-tauri/tests/`. Untuk frontend, pakai
   `apps/desktop/tests/unit/<feature>.test.ts` (Vitest).
9. Pastikan `pnpm lint && pnpm typecheck && pnpm i18n:lint && pnpm test`
   semua pass. Untuk Rust changes juga jalan `cargo fmt` + `cargo clippy
   --all-targets --all-features -- -D warnings` di `apps/desktop/src-tauri/`.

STEP 4 — Update progress
10. Update `docs/bugs/PROGRESS.md`: ubah baris bug-nya dari `OPEN` →
    `IN_PR`, isi kolom `pr` dengan placeholder `PENDING` (akan di-update
    setelah PR dibuat).

STEP 5 — Commit + PR
11. Commit: `fix(<scope>): <description> (BUG-NNN)` (conventional commit).
    Contoh: `fix(buku): insert eksemplar rows on buku_create (BUG-001)`.
12. Push branch (kalau dapat 403 dari git-manager proxy, request PAT via
    secret form `GITHUB_PAT_PERPUSTAKAAN` dan push pakai
    `git push https://x-access-token:${GITHUB_PAT_PERPUSTAKAAN}@github.com/alviarts/perpustakaan-offline.git <branch>`).
13. Bikin PR. Title: `fix(<scope>): <description> (BUG-NNN)`. Body harus
    berisi:
    - Link ke entry bug di `docs/bugs/POST_V1_BUGS.md`.
    - Root cause ringkas.
    - Daftar perubahan file.
    - Definition-of-done checklist (copy dari entry bug, tick yang sudah
      di-cover oleh PR ini).
    - Test plan untuk reviewer (langkah manual repro yang membuktikan fix
      bekerja).
14. Update `docs/bugs/PROGRESS.md` lagi: ganti `PENDING` dengan URL PR.
    Commit + push update tersebut ke branch yang sama.
15. Tunggu CI pass via `git_pr` action `pr_checks` `wait_mode=all`. CI fail
    → fix max 3 attempt, masih fail eskalasi ke user.
16. Final message ke user: link PR + minta review + reminder bahwa setelah
    merge mereka boleh kasih kamu instruksi yang sama lagi untuk pick bug
    berikutnya.

== ATURAN GLOBAL ==
- 1 PR = 1 bug. JANGAN gabung beberapa bug di 1 PR walaupun touching the
  same file.
- JANGAN merge PR sendiri (review gate user).
- JANGAN modify entry bug lain di `POST_V1_BUGS.md` di luar yang lagi kamu
  kerjain. Kalau nemu bug baru, append entry baru di `POST_V1_BUGS.md` +
  baris baru di `PROGRESS.md` di akhir tabel — jangan reorder.
- JANGAN force push ke main atau bypass branch protection.
- WAJIB pull main dulu sebelum mulai.
- WAJIB push branch + bikin PR sebelum stop.
- WAJIB tunggu CI pass sebelum minta merge.
- Pakai `git_pr` tool untuk PR (bukan gh CLI). Kalau git-manager 403, fall
  back ke direct GitHub API + PAT secret seperti dijelaskan di STEP 5.

== PRIORITAS ==

Kerjain bug pertama dengan `status: OPEN` di `PROGRESS.md` (urutan tabel
sudah ascending priority, jangan re-order tanpa instruksi user). Kalau bug
itu kebetulan `BLOCKED` (mis. BUG-008 nunggu design decision), skip ke bug
OPEN berikutnya dan kasih tau user kenapa kamu skip.

Mulai eksekusi STEP 1 sekarang.
```

---

## Notes for the user

- The prompt above is **stateless** — every new Devin session starts from
  STEP 1 and figures out which bug to tackle from `PROGRESS.md`. So you can
  reuse the exact same prompt for every subsequent session; you only need to
  merge the previous session's PR before launching the next one.
- If you want a Devin session to fix a **specific** bug (not just "the next
  open one"), append at the end of the prompt:
  `Override: kerjain BUG-NNN saja, abaikan urutan PROGRESS.md.`
- If you grant the Devin GitHub App write access on the repo (Settings →
  Integrations → GitHub Apps → Devin), STEP 5's PAT fallback becomes
  unnecessary and PRs go through Devin's normal `git_pr` tool without 403.
