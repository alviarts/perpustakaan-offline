//! Cron-like runner that triggers automatic backups based on the schedule
//! stored in the `settings` table (PR-6).
//!
//! The runner is a plain `std::thread` background loop that ticks every 60s
//! (matching the granularity of standard 5-field cron). On each tick it:
//!
//! 1. Reads the current schedule via `commands::backup::backup_schedule_get`.
//! 2. Calls the pure helper [`should_run_now`] to decide whether a backup is
//!    due. The helper compares against the stored `last_run` timestamp so a
//!    single cron tick never fires twice within the same minute even if the
//!    loop overshoots slightly.
//! 3. If due, ensures `<app_data_dir>/backups/` exists, calls
//!    `backup::backup_create_at`, and persists the new `last_run` back into
//!    the `settings` table so subsequent ticks (and the UI's "Terakhir
//!    berjalan" indicator) see the update.
//!
//! No Tauri command is exported from this module — the only public surface
//! the rest of the crate uses is [`spawn_backup_scheduler`] (called once
//! during `tauri::Builder::setup`) and [`should_run_now`] (used by tests).
//! Manual `backup_create` invocations are unaffected because they target a
//! user-picked directory that's disjoint from the auto-backup folder.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use chrono::{DateTime, Datelike, Local, NaiveDateTime, TimeZone, Timelike};
use tauri::Manager;

use crate::commands::backup::{backup_create_at, BackupSchedule};
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Format string used when persisting `backup.schedule.last_run` to the
/// settings table. ISO-8601-ish, no timezone, second precision — matches
/// what the existing UI already renders verbatim.
pub const LAST_RUN_FMT: &str = "%Y-%m-%d %H:%M:%S";

/// Parse a `last_run` settings value back into a `DateTime<Local>`. Returns
/// `None` if the string is empty / malformed; callers treat that as "never
/// ran" which means the next matching tick will fire.
pub fn parse_last_run(s: &str) -> Option<DateTime<Local>> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    NaiveDateTime::parse_from_str(trimmed, LAST_RUN_FMT)
        .ok()
        .and_then(|naive| Local.from_local_datetime(&naive).single())
}

/// Pure-logic "should we run a backup at `now`?" check. Extracted so the
/// scheduler core can be unit-tested without touching the filesystem, the
/// DB, or a Tauri AppHandle.
pub fn should_run_now(
    schedule: &BackupSchedule,
    now: DateTime<Local>,
    last_run: Option<DateTime<Local>>,
) -> bool {
    if !schedule.enabled {
        return false;
    }
    let parts: Vec<&str> = schedule.cron.split_whitespace().collect();
    if parts.len() != 5 {
        return false;
    }
    let (min_f, hour_f, dom_f, mon_f, dow_f) = (parts[0], parts[1], parts[2], parts[3], parts[4]);

    if !cron_field_matches(min_f, now.minute())
        || !cron_field_matches(hour_f, now.hour())
        || !cron_field_matches(dom_f, now.day())
        || !cron_field_matches(mon_f, now.month())
        || !cron_field_matches(dow_f, now.weekday().num_days_from_sunday())
    {
        return false;
    }

    // Dedupe within the same minute slot — even if the runner ticks twice
    // inside the matching minute (e.g. the OS scheduler woke us 59s + 1s
    // apart) we only fire once.
    if let Some(prev) = last_run {
        let now_slot = minute_slot(now);
        let prev_slot = minute_slot(prev);
        if prev_slot >= now_slot {
            return false;
        }
    }

    true
}

fn minute_slot(t: DateTime<Local>) -> DateTime<Local> {
    t.with_second(0)
        .and_then(|d| d.with_nanosecond(0))
        .unwrap_or(t)
}

/// Tiny in-house cron field matcher. Supports `*`, single values, ranges
/// `M-N`, comma lists `A,B,C`, and the `*/N` step form. Anything else
/// returns `false` and the field is treated as "never matches" — better to
/// silently no-op than panic on the user's typo.
fn cron_field_matches(field: &str, value: u32) -> bool {
    if field == "*" {
        return true;
    }
    field.split(',').any(|raw| {
        let term = raw.trim();
        if let Some(rest) = term.strip_prefix("*/") {
            return rest
                .parse::<u32>()
                .ok()
                .filter(|step| *step > 0)
                .map(|step| value % step == 0)
                .unwrap_or(false);
        }
        if let Some((lhs, rhs)) = term.split_once('-') {
            return match (lhs.parse::<u32>(), rhs.parse::<u32>()) {
                (Ok(lo), Ok(hi)) => lo <= value && value <= hi,
                _ => false,
            };
        }
        term.parse::<u32>().map(|n| n == value).unwrap_or(false)
    })
}

/// Reads the schedule, decides whether to run, and on success writes a new
/// `last_run` back into the settings table. Public-in-crate so future
/// integration tests can drive a single tick deterministically.
pub fn run_tick_once(
    state: &AppState,
    backup_dir: &std::path::Path,
    db_src: &std::path::Path,
    now: DateTime<Local>,
) -> AppResult<bool> {
    let (schedule, last_run) = read_schedule_and_last_run(state)?;
    if !should_run_now(&schedule, now, last_run) {
        return Ok(false);
    }

    if !backup_dir.exists() {
        std::fs::create_dir_all(backup_dir).map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let stamp = now.format("%Y%m%d-%H%M%S").to_string();
    let _result = backup_create_at(db_src, backup_dir, &stamp)?;

    let stamp_str = now.format(LAST_RUN_FMT).to_string();
    write_last_run(state, &stamp_str)?;

    Ok(true)
}

fn read_schedule_and_last_run(
    state: &AppState,
) -> AppResult<(BackupSchedule, Option<DateTime<Local>>)> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let read = |key: &str| -> Option<String> {
        conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
            r.get::<_, String>(0)
        })
        .ok()
    };

    let enabled = read("backup.schedule.enabled")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    let cron = read("backup.schedule.cron").unwrap_or_else(|| "0 2 * * *".to_string());
    let last_run_raw = read("backup.schedule.last_run");
    let last_run = last_run_raw.as_deref().and_then(parse_last_run);

    Ok((
        BackupSchedule {
            enabled,
            cron,
            last_run: last_run_raw,
        },
        last_run,
    ))
}

fn write_last_run(state: &AppState, stamp: &str) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('backup.schedule.last_run', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        [stamp],
    )
    .map_err(AppError::from)?;
    Ok(())
}

/// Resolve `<app_data_dir>/backups/` — the default landing zone for files
/// produced by the auto-backup runner. The directory is created lazily
/// inside `run_tick_once` so a freshly-installed app doesn't pre-create it
/// before the user has even opted in.
fn resolve_default_backup_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(base.join("backups"))
}

/// Spawn the background runner. Idempotent in the sense that callers should
/// only invoke this once per `tauri::Builder::setup`; the function does not
/// guard against multiple invocations because the existing setup is single-
/// threaded.
pub fn spawn_backup_scheduler(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    let busy = Arc::new(AtomicBool::new(false));
    thread::Builder::new()
        .name("backup-scheduler".into())
        .spawn(move || {
            // Initial grace period so app startup doesn't immediately do IO.
            thread::sleep(Duration::from_secs(30));
            loop {
                if busy
                    .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                    .is_ok()
                {
                    if let Err(err) = tick(&app_handle) {
                        log::error!("backup-scheduler tick failed: {err}");
                    }
                    busy.store(false, Ordering::SeqCst);
                }
                thread::sleep(Duration::from_secs(60));
            }
        })
        .expect("spawn backup-scheduler thread");
}

fn tick(app: &tauri::AppHandle) -> AppResult<()> {
    let state: tauri::State<'_, AppState> = app.state::<AppState>();
    // D5-SandboxDemoMode — never auto-back-up the demo DB. Manual backups
    // from the Settings page still target the active connection, but the
    // cron-driven auto-backup short-circuits here so demo data stays out
    // of the regular cloud target.
    if state
        .sandbox_mode
        .lock()
        .map(|g| *g)
        .unwrap_or(false)
    {
        return Ok(());
    }
    let backup_dir = resolve_default_backup_dir(app)?;
    let db_src = crate::db::resolve_db_path(app)?;
    let did_run = run_tick_once(&state, &backup_dir, &db_src, Local::now())?;
    if did_run {
        log::info!(
            "backup-scheduler: wrote auto-backup to {}",
            backup_dir.display()
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(s: &str) -> DateTime<Local> {
        let naive = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap();
        Local.from_local_datetime(&naive).single().unwrap()
    }

    fn schedule(cron: &str) -> BackupSchedule {
        BackupSchedule {
            enabled: true,
            cron: cron.into(),
            last_run: None,
        }
    }

    #[test]
    fn should_run_skips_when_disabled() {
        let mut s = schedule("0 2 * * *");
        s.enabled = false;
        assert!(!should_run_now(&s, at("2026-05-04 02:00:30"), None));
    }

    #[test]
    fn should_run_skips_when_cron_invalid() {
        let s = schedule("not a cron");
        assert!(!should_run_now(&s, at("2026-05-04 02:00:30"), None));
    }

    #[test]
    fn should_run_fires_at_matching_minute() {
        let s = schedule("0 2 * * *");
        // First time the runner sees the matching minute.
        assert!(should_run_now(&s, at("2026-05-04 02:00:00"), None));
        assert!(should_run_now(&s, at("2026-05-04 02:00:45"), None));
    }

    #[test]
    fn should_run_skips_non_matching_minute() {
        let s = schedule("0 2 * * *");
        assert!(!should_run_now(&s, at("2026-05-04 02:01:30"), None));
        assert!(!should_run_now(&s, at("2026-05-04 03:00:30"), None));
    }

    #[test]
    fn should_run_dedupes_within_same_minute_slot() {
        let s = schedule("0 2 * * *");
        let now = at("2026-05-04 02:00:30");
        let last = at("2026-05-04 02:00:05");
        assert!(!should_run_now(&s, now, Some(last)));
    }

    #[test]
    fn should_run_fires_again_on_next_match() {
        let s = schedule("0 2 * * *");
        let last = at("2026-05-04 02:00:05");
        let next = at("2026-05-05 02:00:10");
        assert!(should_run_now(&s, next, Some(last)));
    }

    #[test]
    fn should_run_supports_step_minute() {
        let s = schedule("*/15 * * * *");
        assert!(should_run_now(&s, at("2026-05-04 03:00:00"), None));
        assert!(should_run_now(&s, at("2026-05-04 03:15:00"), None));
        assert!(should_run_now(&s, at("2026-05-04 03:30:00"), None));
        assert!(!should_run_now(&s, at("2026-05-04 03:01:00"), None));
        assert!(!should_run_now(&s, at("2026-05-04 03:14:00"), None));
    }

    #[test]
    fn should_run_supports_dow_range() {
        // Every weekday (Mon..Fri) at 02:00.
        let s = schedule("0 2 * * 1-5");
        // Sunday 2026-05-03 → don't fire.
        assert!(!should_run_now(&s, at("2026-05-03 02:00:00"), None));
        // Monday 2026-05-04 → fire.
        assert!(should_run_now(&s, at("2026-05-04 02:00:00"), None));
        // Saturday 2026-05-09 → don't fire.
        assert!(!should_run_now(&s, at("2026-05-09 02:00:00"), None));
    }

    #[test]
    fn should_run_supports_comma_list_hour() {
        let s = schedule("0 2,14 * * *");
        assert!(should_run_now(&s, at("2026-05-04 02:00:00"), None));
        assert!(should_run_now(&s, at("2026-05-04 14:00:00"), None));
        assert!(!should_run_now(&s, at("2026-05-04 08:00:00"), None));
    }

    #[test]
    fn parse_last_run_round_trip() {
        let now = at("2026-05-04 02:00:00");
        let stamp = now.format(LAST_RUN_FMT).to_string();
        let parsed = parse_last_run(&stamp).unwrap();
        assert_eq!(parsed, now);
    }

    #[test]
    fn parse_last_run_handles_blank() {
        assert!(parse_last_run("").is_none());
        assert!(parse_last_run("   ").is_none());
        assert!(parse_last_run("not-a-date").is_none());
    }

    #[test]
    fn cron_field_matches_handles_singletons_and_lists() {
        assert!(cron_field_matches("*", 0));
        assert!(cron_field_matches("*", 59));
        assert!(cron_field_matches("0", 0));
        assert!(!cron_field_matches("0", 1));
        assert!(cron_field_matches("0,15,30,45", 30));
        assert!(!cron_field_matches("0,15,30,45", 31));
    }
}
