# Code Review — PR #75: Backup Cron Scheduler Runner

**PR:** https://github.com/alviarts/perpustakaan-offline/pull/75
**Branch:** `devin/1777899874-backup-scheduler` → `main`
**Author:** alviarts (devin-ai-integration[bot])
**Diff:** 6 files, +401 / -12 (net +389)
**CI:** ✓ Lint+Typecheck+Unit Test (Node 20), ✓ Rust check
**Reviewer:** Devin (this session), 2026-05-04

---

## Verdict: **Approve with comments**

Tight, well-architected scheduler. The "thin OS thread + pure-logic helper" split is exactly right: the cron-matching logic is fully unit-testable without an `AppHandle`, the OS thread does nothing but `sleep` and call into pure functions, and the dedupe-via-`last_run` defends against the obvious "tick fired twice in the same minute" race. 12 Rust tests cover the cron field matcher, dedupe behavior, and edge cases. Three minor observations, none blocking.

---

## What this PR does

Closes the deferred PR-6 placeholder from session 11/12. Backup schedule storage was already in `main` (`commands::backup::backup_schedule_set/get`); this PR adds the **runner** that actually fires backups when the schedule matches.

### Backend (`apps/desktop/src-tauri/src/commands/backup_runner.rs`, 369 lines)

**Architecture (3 layers, separated for testability):**

1. **Pure helpers** (no Tauri / no I/O):
   - `cron_field_matches(field, value)` — supports `*`, single value, range `M-N`, comma list `A,B,C`, step `*/N`. Anything else returns `false` ("never matches" — silent no-op on user typo, no panic).
   - `should_run_now(schedule, now, last_run)` — combines all 5 cron fields + dedupe via `last_run` minute slot.
   - `parse_last_run(s)` / `LAST_RUN_FMT = "%Y-%m-%d %H:%M:%S"` — round-trips to/from settings table value.

2. **Crate-internal orchestrator** (touches DB, but pure-Rust API):
   - `run_tick_once(state, backup_dir, db_src, now)` — reads schedule, calls `should_run_now`, on match calls `backup_create_at` and writes new `last_run`. Public-in-crate so future integration tests can drive a single tick.

3. **Tauri-aware glue** (the only OS-thread part):
   - `spawn_backup_scheduler(app)` — spawns a named `backup-scheduler` thread, sleeps 30s grace, then loops `tick(); sleep(60)` forever.
   - `tick(app)` — resolves backup_dir + db_src from Tauri, calls `run_tick_once(Local::now())`.

### Lifecycle (`lib.rs:92–97`)

```rust
// PR-6: spawn the backup-scheduler runner. It ticks every 60s,
// reads the schedule from settings, and writes auto-backups into
// <app_data_dir>/backups/. No-op if the schedule is disabled.
commands::backup_runner::spawn_backup_scheduler(app.handle());
```

Single invocation in `tauri::Builder::setup`. The runner is the only thing that ever writes into `<app_data>/backups/`. Manual backups still target the user-picked directory (disjoint folder).

### Defenses

- **30s startup grace** — prevents I/O storm on cold start.
- **`AtomicBool` busy flag** — double-tick guard inside `compare_exchange`. Ensures one tick can't overlap with itself even if it took >60s (e.g. 1 GB DB on a slow disk).
- **Minute-slot dedupe** in `should_run_now` — even if the OS scheduler wakes us 59s + 1s apart, we only fire once per matching minute.
- **Silent no-op on cron typo** — `cron_field_matches` returns `false` rather than panicking, so a malformed schedule turns into a silently-disabled scheduler instead of a thread crash.
- **Lazy directory creation** — `<app_data>/backups/` is created on first matching tick, not at startup. Freshly-installed app doesn't pre-create folders the user hasn't opted into.

### Settings storage

Three keys in `settings` table (already defined in `commands::backup` from a previous session, this PR consumes them):

- `backup.schedule.enabled` — `"true"` / `"1"` → on, anything else off
- `backup.schedule.cron` — 5-field cron string, default `"0 2 * * *"` (daily 02:00 local)
- `backup.schedule.last_run` — ISO-ish stamp written by the runner after a successful backup

`UPSERT` via `INSERT ... ON CONFLICT(key) DO UPDATE` — correct way to bump `updated_at`.

### Frontend

`BackupSubPage.tsx` only has minor changes:
- `scheduleHint` updated to remove "Devin 12 akan menambahkan…" placeholder text → now describes the actual runner behavior
- Tailwind class reordering noise (formatter artifact, ~70% of the diff)
- Multi-line button reformatting (formatter artifact)

Functionally the page is unchanged. The schedule editor was already wired to `backup_schedule_set` in main; only the **explanatory copy** needed updating.

### i18n

`laporan.{en,id}.json` — single key `scheduleHint` updated. No new keys.

### Tests (12 `#[test]` cases in `backup_runner.rs:393–512`)

- `should_run_skips_when_disabled` — feature flag respected
- `should_run_skips_when_cron_invalid` — graceful no-op on garbage
- `should_run_fires_at_matching_minute` — happy path (twice within the minute)
- `should_run_skips_non_matching_minute` — minute mismatch + hour mismatch
- `should_run_dedupes_within_same_minute_slot` — dedupe with prior `last_run`
- `should_run_fires_again_on_next_match` — next-day fire after a matching minute the day before
- `should_run_supports_step_minute` — `*/15 * * * *` fires at :00, :15, :30
- `should_run_supports_dow_range` — `0 2 * * 1-5` fires Mon–Fri only
- `should_run_supports_comma_list_hour` — `0 2,14 * * *` fires at 02:00 + 14:00
- `parse_last_run_round_trip` — format → parse equality
- `parse_last_run_handles_blank` — empty / whitespace / garbage → `None`
- `cron_field_matches_handles_singletons_and_lists` — `*`, single, comma-list

---

## Strengths

1. **The 3-layer split is textbook.** Pure-logic / crate-internal-orchestrator / OS-thread-glue means the entire scheduler decision tree is unit-testable without spinning up Tauri or touching the filesystem. 12 tests cover every branch.
2. **`should_run_now` dedupe is correct.** The `prev_slot >= now_slot` check against `Local::now()` minute-truncated catches both "two ticks within the same minute" and "clock went backwards" cases. Subtle but right.
3. **`AtomicBool` busy flag uses `SeqCst` for correctness.** Slightly stronger ordering than required but no perf impact at 1-tick-per-minute.
4. **30s startup grace** is the right default. Prevents runaway I/O on cold start, especially on Windows where the antivirus tax on first boot is real.
5. **Silent no-op on cron typo.** A user typo in the cron field shouldn't crash the background thread. `cron_field_matches` returning `false` for unparseable input is the right call.
6. **Lazy `<app_data>/backups/` creation.** No directories created until the user actually opts in.
7. **Reuses `backup::backup_create_at`.** No code duplication with the manual-backup flow. Manual + auto backups have the same on-disk format.
8. **`thread::Builder::name("backup-scheduler".into())`** — the thread is named, so it shows up identifiable in `ps` / Process Explorer / a debugger. Tiny touch but appreciated.
9. **`UPSERT` for `last_run`.** Avoids the SELECT-then-INSERT-or-UPDATE race that a naïve implementation would have.
10. **`log::error!` on tick failure**, not `panic!`. The thread keeps ticking even if one backup fails. Robust.

---

## Concerns

### 🟡 1. Day-of-month + day-of-week semantics differ from POSIX cron

POSIX cron has a quirky rule for the DoM and DoW fields: when *both* are restricted (i.e. neither is `*`), the job runs when *either* matches. The current implementation requires *both* to match (logical AND, not OR).

```rust
if !cron_field_matches(min_f, now.minute())
    || !cron_field_matches(hour_f, now.hour())
    || !cron_field_matches(dom_f, now.day())
    || !cron_field_matches(mon_f, now.month())
    || !cron_field_matches(dow_f, now.weekday().num_days_from_sunday())
{
    return false;
}
```

So `0 2 1 * 1-5` ("at 02:00 on the 1st of the month, but only if it's a weekday") matches POSIX-cron-style "1st OR weekday at 02:00" with strict-AND semantics here.

**Risk:** practical impact is low. Most schedules people actually configure use only one of DoM / DoW (with the other set to `*`), in which case both interpretations agree. The few schedules where it matters are advanced users.

**Suggestion (low priority):** either:
- Document the AND semantics in the `scheduleHint` UI string + the file docstring (cheapest), or
- Implement the POSIX OR rule (more code, matches user expectation if they migrated from a real cron daemon).

Add a unit test pinning the chosen behavior either way.

### 🟡 2. Day-of-week numbering uses Sunday-as-0 (POSIX) but no comment

`now.weekday().num_days_from_sunday()` returns `0..=6` (Sun=0, Mon=1, …, Sat=6). The unit test `should_run_supports_dow_range` uses `0 2 * * 1-5` and verifies Mon=1..Fri=5 fire. That's correct POSIX.

A future maintainer reading just the implementation might not realize this is intentional. **Suggestion:** add a one-line comment next to the `num_days_from_sunday()` call documenting "Sun=0..Sat=6, matches POSIX cron". Cosmetic.

### 🟢 3. No `7 = Sun` alias

POSIX cron also accepts `7` as Sunday (alongside `0`). The current matcher rejects it (the pure-numeric `term.parse::<u32>().map(|n| n == value)` only matches if `value` (which is 0..=6) equals the parsed number, so `7` never matches anything).

Practical impact: very low. Nobody writes `7` for Sunday when `0` is also accepted. But mentioning for completeness.

### 🟢 4. Tailwind reordering noise in `BackupSubPage.tsx`

Same flavor as PR #69, #74, #76: ~70% of `BackupSubPage.tsx` diff is Tailwind class reordering and multi-line reformatting. None of the visual behavior changes. Not actionable; flagging for review-friction awareness.

### 🟢 5. No retry-on-failure

If `backup_create_at` fails (e.g., disk full mid-write), the runner logs an error and waits another 60s for the next tick. The next tick won't match the same minute slot anymore, so the failed backup won't be retried until the next *scheduled* tick.

For most schedules (daily, hourly) that's fine — the user's data is only one failure away from being backed up again. For weekly schedules, a one-off failure means a 7-day gap.

**Suggestion (low priority):** out of scope for this PR. Could be a follow-up that tracks `backup.schedule.last_failure` separately and retries within a bounded window. Don't block on this.

---

## Coordination with other open PRs

### 🟢 `tauri::Builder::setup` (`lib.rs:92–97`) — shared with #82 area only

PR #75 adds 5 lines inside `setup` after the tray-icon block. Other PRs adding `setup` logic would conflict, but the only one I see touching `lib.rs` `setup` is #75 itself — every other PR adds to `tauri::generate_handler!` (the macro list, which is in a separate function).

### 🟢 `tauri::generate_handler!` — shared with #69, #70, #74, #76

PR #75 does **not** add a Tauri command. The runner is internal-only. So it doesn't touch the macro list at all. No conflict here.

### 🟢 `commands/mod.rs` — shared with #69, #70, #76

PR #75 adds `pub mod backup_runner;`. Additive, mechanical rebase.

### 🟢 `i18n/laporan.{en,id}.json` — exclusive

No other open PR touches `laporan.json`. Clean.

### 🟢 No semantic conflicts.

---

## Summary recommendation

1. **Merge #75 — it's ready.** The runner architecture is sound, dedupe logic is correct, defenses (busy flag, startup grace, silent no-op on typo) are appropriate, and test coverage is excellent.
2. **Optional follow-ups (file separately, do not block):**
   - Document or implement POSIX cron's "DoM OR DoW when both restricted" semantics.
   - Add a one-line comment next to `num_days_from_sunday()` documenting the chosen DoW numbering.
   - Track `backup.schedule.last_failure` for retry-within-window on weekly schedules.
3. **No coordination friction.** This PR doesn't add Tauri commands and doesn't touch hot files like Cargo.lock. The only shared file is `commands/mod.rs` (additive line) and `lib.rs:setup` (additive 5 lines, no other open PR contends).
4. **Accept Tailwind diff noise** in `BackupSubPage.tsx` — same auto-formatter pattern across the recent feature PRs.
