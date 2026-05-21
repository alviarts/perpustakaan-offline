# v1.0.7 Bug & Feature Batch — Devin Workflow

**Audience:** future Devin sessions picking up unfinished work in this batch.
**Owner (user):** [@alviarts](https://github.com/alviarts).
**Status:** see [`PROGRESS.md`](./PROGRESS.md) for the per-item live status table.

---

## TL;DR for the next Devin

1. Read [`PROGRESS.md`](./PROGRESS.md). Pick the **first row with `status: OPEN`** in the order it is listed (planned PR order = priority order).
2. Read the corresponding entry in [`BUGS.md`](./BUGS.md) for the full description, repro, expected behaviour, and starting code pointers.
3. Look at the matching screenshot under [`screenshots/`](./screenshots) so you understand what the user reported visually.
4. Implement the fix on a new branch `devin/<unix-ts>-<short-slug>` off `main`.
5. Run gates locally: `pnpm lint && pnpm typecheck && pnpm i18n:lint && pnpm test && pnpm build`. All must pass.
6. Open a PR. Use `git_pr` (action=`fetch_template`, then `create`). Do NOT use `gh` CLI.
7. Update the row in [`PROGRESS.md`](./PROGRESS.md) to `status: IN_PR` and add the `pr` URL — commit this change as part of the PR (single commit fine, OR a follow-up commit on the same branch).
8. Wait for CI green via `git pr_checks`. Iterate on failures.
9. When the user merges, update the row to `status: DONE` + `completed_at: YYYY-MM-DD` in a follow-up tiny PR (or batched with another PROGRESS update).
10. Pick the next OPEN row. Repeat until the table is all DONE, then bump version (chore release PR) → `v1.0.7`.

If the user redirects priorities, follow them and update PROGRESS.md to match. Do NOT re-order rows otherwise — the order _is_ the priority.

---

## Planned PR sequence

The 18 items have been grouped into 5 PRs by area + a final release. Stick to this grouping unless the user says otherwise — it minimises review burden and keeps each PR self-contained.

| PR    | Title                                                                                                        | Items                                            | Branch suggestion                          |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------ |
| **A** | fix(sirkulasi): scanner accuracy + lookup + button rename                                                    | BUG-01, BUG-17, BUG-18, FEAT-07                  | `devin/<ts>-sirkulasi-scanner-fixes`       |
| **B** | fix(peminjaman): setting sync + error toast + denda quick-input                                              | BUG-09, BUG-10, FEAT-08                          | `devin/<ts>-peminjaman-settings-and-denda` |
| **C** | feat(kta): biodata + ttd + back-side + qr aspect + foto fix                                                  | BUG-02, BUG-06, FEAT-03, FEAT-04                 | `devin/<ts>-kta-biodata-back-side`         |
| **D** | fix(layout): horizontal/bottom padding + topbar search + sticky settings sidebar + label folder + manual fab | BUG-05, BUG-12, BUG-14, BUG-16, FEAT-13, FEAT-15 | `devin/<ts>-layout-polish`                 |
| **E** | feat(dashboard): rotating quote with animation                                                               | FEAT-11                                          | `devin/<ts>-dashboard-quote-rotation`      |
| **F** | chore(release): v1.0.7                                                                                       | bump versions + CHANGELOG                        | `devin/<ts>-release-v1.0.7`                |

**A goes first** because it includes the highest-impact bugs (scanner is unusable until BUG-01, BUG-17, BUG-18 are fixed). After A, B/C/D can be done in parallel by separate sessions if needed; E is independent. F lands last after everything is merged.

---

## Conventions to follow

### Branches & commits

- Branch name format: `devin/<unix-ts>-<short-kebab-slug>` (matches existing pattern in repo).
- Commit message format follows Conventional Commits + scope, e.g.:
  - `fix(sirkulasi): trim whitespace before lookup so scanned codes match db`
  - `feat(kta): add biodata fields, principal signature, and back-side editor`
- Co-author line REQUIRED on every commit:
  ```
  Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>
  ```

### PR description

- Use `git_pr` action=`fetch_template` then `create` — this enforces the repo's PR template.
- Required sections in body:
  - **Summary** — one-paragraph context + what changed
  - **Detail per item** — for each BUG/FEAT in the PR, link to its row in this folder's BUGS.md and explain what the fix does
  - **Test plan / Review checklist** — step-by-step manual repro the user can run to verify
  - **Screenshots / video** — before/after for any UI change (use `upload_attachment` if needed)
- Include the BUG IDs (e.g. `BUG-01`, `FEAT-08`) verbatim so they can be grep'd against PROGRESS.md.

### Gates (must pass before opening PR)

Run from repo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @perpustakaan/desktop exec tsr generate   # if you touched routes
pnpm lint
pnpm typecheck
pnpm i18n:lint
pnpm test
pnpm build
```

If you add a new i18n key, you MUST add it in BOTH `apps/desktop/src/i18n/id/<ns>.json` and `apps/desktop/src/i18n/en/<ns>.json` — `pnpm i18n:lint` will fail otherwise.

If you add a new Tauri command, you MUST register it in `apps/desktop/src-tauri/src/lib.rs` `tauri::generate_handler![…]` AND add a frontend wrapper in `apps/desktop/src/lib/<area>.ts`.

### Testing in the Tauri app

This repo has a smoke-test skill at [`.agents/skills/smoke-test-v2/SKILL.md`](../../../.agents/skills/smoke-test-v2/SKILL.md). Read it before running the app — it documents:

- Default credentials (`admin` / `admin123`)
- DB location: `~/.local/share/id.alviarts.perpustakaan/perpustakaan-v2.db`
- Known fresh-install gotchas (eksemplar seed, KTA template empty, etc.)
- The 14-step recommended smoke flow

Use `pnpm tauri:dev` to run. First Rust compile is slow (~5 min); subsequent rebuilds are seconds.

### Git hygiene reminders

- Never `git push --force` on `main`.
- Never `git add .` — stage explicitly to avoid committing screenshots, scratch files, or local DB dumps.
- Never commit secrets. There are no env-vars currently in use, but if you add any, they go in `apps/desktop/src-tauri/tauri.conf.json` plugin permissions, not in `.env`.

---

## Where to find things in the codebase

| Area                   | Frontend                                                         | Backend (Rust / Tauri)                              |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Sirkulasi (Webcam)     | `apps/desktop/src/features/sirkulasi/SirkulasiPage.tsx`          | n/a (uses peminjaman + anggota commands)            |
| Barcode scanner        | `apps/desktop/src/features/sirkulasi/useBarcodeScanner.ts`       | n/a (browser `getUserMedia` + `BarcodeDetector`)    |
| Peminjaman             | `apps/desktop/src/features/peminjaman/PeminjamanForm.tsx`        | `apps/desktop/src-tauri/src/commands/peminjaman.rs` |
| Pengembalian           | `apps/desktop/src/features/pengembalian/PengembalianPage.tsx`    | `commands/peminjaman.rs` (return endpoints)         |
| KTA template editor    | `apps/desktop/src/features/kta/TemplateEditor.tsx`               | `commands/kta_templates.rs`                         |
| KTA cetak / pdf        | `apps/desktop/src/features/kta/{CetakKtaPage,pdf,print}.tsx/.ts` | `commands/kta_export.rs`                            |
| Label barcode buku     | `apps/desktop/src/features/label-buku/`                          | (label printing happens client-side via jsPDF)      |
| Settings (Pengaturan)  | `apps/desktop/src/features/settings/`                            | `commands/settings.rs`                              |
| Dashboard              | `apps/desktop/src/features/dashboard/DashboardPage.tsx`          | n/a                                                 |
| Manual                 | `apps/desktop/src/features/settings/ManualPage.tsx` (or similar) | n/a (markdown bundled)                              |
| Topbar / global search | `apps/desktop/src/components/AppShell.tsx` or `Topbar.tsx`       | n/a                                                 |
| i18n                   | `apps/desktop/src/i18n/{id,en}/<ns>.json`                        | n/a                                                 |
| Tauri command registry | n/a                                                              | `apps/desktop/src-tauri/src/lib.rs`                 |

For exact file paths, run from repo root:

```bash
rg -l "<symbol or string>"
fd -e tsx -e ts <basename>
```

---

## When to involve the user

The user prefers nonblocking updates over blocking questions. Block only when:

1. You can't reproduce a bug locally and need them to clarify the steps.
2. CI fails on something that requires a design decision (e.g. fix forward vs revert).
3. A scope question affects multiple PRs (e.g. should we also touch X area while we're at it).

Otherwise: send a nonblocking `message_user` after each PR is opened (with the PR URL), and another nonblocking message after CI passes — no blocking calls in between.

---

## Reference: original session

This batch was scoped during session `90b87abd638645d0acab414e7ade5ec5` (2026-05-05). The user reported bugs interactively with screenshots; this folder is the durable record of that conversation. If anything in BUGS.md is ambiguous, look at the corresponding screenshot — it usually answers the question.
