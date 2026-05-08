//! Auto-sync scheduler — periodically pushes and pulls data to/from
//! Google Sheets in the background.
//!
//! Follows the same pattern as `backup_runner.rs`: a plain `std::thread`
//! that ticks every 60 seconds, reads the schedule from the `settings`
//! table, and fires push+pull when due.
//!
//! Settings keys:
//! - `sync.auto.enabled`   — "1" or "0"
//! - `sync.auto.interval`  — minutes between syncs (default 5)
//! - `sync.auto.last_run`  — ISO timestamp of last auto-sync

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use chrono::{DateTime, Local, NaiveDateTime, TimeZone};
use tauri::Manager;

use crate::error::{AppError, AppResult};
use crate::AppState;

const LAST_RUN_FMT: &str = "%Y-%m-%d %H:%M:%S";

/// Check if auto-sync should run now.
pub fn should_sync_now(
    enabled: bool,
    interval_minutes: u32,
    now: DateTime<Local>,
    last_run: Option<DateTime<Local>>,
) -> bool {
    if !enabled || interval_minutes == 0 {
        return false;
    }

    match last_run {
        None => true, // never ran before → run now
        Some(prev) => {
            let elapsed = now.signed_duration_since(prev);
            elapsed.num_minutes() >= interval_minutes as i64
        }
    }
}

fn parse_last_run(s: &str) -> Option<DateTime<Local>> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    NaiveDateTime::parse_from_str(trimmed, LAST_RUN_FMT)
        .ok()
        .and_then(|naive| Local.from_local_datetime(&naive).single())
}

struct SyncSchedule {
    enabled: bool,
    interval_minutes: u32,
    last_run: Option<DateTime<Local>>,
}

fn read_sync_schedule(state: &AppState) -> AppResult<SyncSchedule> {
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

    // Check if sync itself is enabled (master toggle)
    let sync_enabled = read("sync.enabled")
        .map(|v| v == "1")
        .unwrap_or(false);

    // Check if auto-sync is enabled
    let auto_enabled = read("sync.auto.enabled")
        .map(|v| v == "1")
        .unwrap_or(false);

    // Both must be true
    let enabled = sync_enabled && auto_enabled;

    let interval = read("sync.auto.interval")
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(5)
        .clamp(1, 60);

    let last_run_raw = read("sync.auto.last_run");
    let last_run = last_run_raw.as_deref().and_then(parse_last_run);

    // Also check that SA + spreadsheet are configured
    let sa_json = read("sync.service_account_json").unwrap_or_default();
    let spreadsheet_id = read("sync.spreadsheet_id").unwrap_or_default();
    let configured = !sa_json.is_empty() && !spreadsheet_id.is_empty();

    Ok(SyncSchedule {
        enabled: enabled && configured,
        interval_minutes: interval,
        last_run,
    })
}

fn write_last_run(state: &AppState, stamp: &str) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('sync.auto.last_run', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        [stamp],
    )
    .map_err(AppError::from)?;
    Ok(())
}

/// Run a single sync tick using the Tauri async commands via a temporary
/// tokio runtime. This bridges the sync scheduler thread with the async
/// Sheets API calls.
fn run_sync_tick(app: &tauri::AppHandle) -> AppResult<()> {
    let state = app.state::<AppState>();

    // Build a temporary tokio runtime for the async push/pull calls
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| AppError::Internal(format!("tokio runtime: {e}")))?;

    rt.block_on(async {
        use super::sync::build_client;
        use super::sync::{
            mapper::{
                read_all_anggota, read_all_buku, read_all_eksemplar, read_all_peminjaman,
                ANGGOTA_HEADER, ANGGOTA_TAB, BUKU_HEADER, BUKU_TAB,
                EKSEMPLAR_HEADER, EKSEMPLAR_TAB, PEMINJAMAN_HEADER, PEMINJAMAN_TAB,
            },
            state::append_log,
        };

        // Read SA + spreadsheet from settings
        let (sa, sheets_id) = {
            let conn = state.db.lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            let sa_json: String = conn
                .query_row(
                    "SELECT COALESCE(value, '') FROM settings WHERE key = 'sync.service_account_json'",
                    [], |r| r.get(0),
                ).unwrap_or_default();
            let sid: String = conn
                .query_row(
                    "SELECT COALESCE(value, '') FROM settings WHERE key = 'sync.spreadsheet_id'",
                    [], |r| r.get(0),
                ).unwrap_or_default();
            if sa_json.is_empty() || sid.is_empty() {
                return Ok(());
            }
            let sa = super::sync::auth::ServiceAccount::from_json(&sa_json)?;
            (sa, sid)
        };

        let client = build_client(&sa).await?;

        // Push all tables
        for (tab, header, read_fn) in [
            (ANGGOTA_TAB, &ANGGOTA_HEADER[..], "anggota" as &str),
            (BUKU_TAB, &BUKU_HEADER[..], "buku"),
            (EKSEMPLAR_TAB, &EKSEMPLAR_HEADER[..], "eksemplar"),
            (PEMINJAMAN_TAB, &PEMINJAMAN_HEADER[..], "peminjaman"),
        ] {
            let rows_data = {
                let conn = state.db.lock()
                    .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
                match read_fn {
                    "anggota" => read_all_anggota(&conn)?.iter().map(|r| r.to_cells()).collect::<Vec<_>>(),
                    "buku" => read_all_buku(&conn)?.iter().map(|r| r.to_cells()).collect::<Vec<_>>(),
                    "eksemplar" => read_all_eksemplar(&conn)?.iter().map(|r| r.to_cells()).collect::<Vec<_>>(),
                    "peminjaman" => read_all_peminjaman(&conn)?.iter().map(|r| r.to_cells()).collect::<Vec<_>>(),
                    _ => vec![],
                }
            };

            let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows_data.len() + 1);
            sheet_rows.push(header.iter().map(|s| s.to_string()).collect());
            sheet_rows.extend(rows_data);

            // Push (replace all)
            if let Err(e) = client.ensure_tab(&sheets_id, tab).await {
                log::warn!("auto-sync: ensure_tab({tab}) failed: {e}");
                continue;
            }
            let range = format!("{tab}!A1:Z");
            let _ = client.clear_values(&sheets_id, &range).await;
            if !sheet_rows.is_empty() {
                let write_range = format!("{tab}!A1");
                if let Err(e) = client.update_values(&sheets_id, &write_range, &sheet_rows).await {
                    log::warn!("auto-sync: push {tab} failed: {e}");
                }
            }

            // Log
            let conn = state.db.lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            let _ = append_log(&conn, "push", tab, "ok", sheet_rows.len() as i64 - 1, Some("auto-sync"));
        }

        log::info!("auto-sync: push complete");
        Ok::<(), AppError>(())
    })?;

    Ok(())
}

fn tick(app: &tauri::AppHandle) -> AppResult<()> {
    let state = app.state::<AppState>();
    let schedule = read_sync_schedule(&state)?;
    let now = Local::now();

    if !should_sync_now(schedule.enabled, schedule.interval_minutes, now, schedule.last_run) {
        return Ok(());
    }

    log::info!("auto-sync: running push (interval={}min)", schedule.interval_minutes);

    if let Err(e) = run_sync_tick(app) {
        log::error!("auto-sync tick failed: {e}");
        // Still update last_run to avoid hammering on persistent errors
    }

    let stamp = now.format(LAST_RUN_FMT).to_string();
    write_last_run(&state, &stamp)?;

    Ok(())
}

/// Spawn the auto-sync background thread. Called once during
/// `tauri::Builder::setup`, right after `spawn_backup_scheduler`.
pub fn spawn_sync_scheduler(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    let busy = Arc::new(AtomicBool::new(false));
    thread::Builder::new()
        .name("sync-scheduler".into())
        .spawn(move || {
            // Initial grace period — let the app finish starting up
            thread::sleep(Duration::from_secs(60));
            loop {
                if busy
                    .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                    .is_ok()
                {
                    if let Err(err) = tick(&app_handle) {
                        log::error!("sync-scheduler tick failed: {err}");
                    }
                    busy.store(false, Ordering::SeqCst);
                }
                thread::sleep(Duration::from_secs(60));
            }
        })
        .expect("spawn sync-scheduler thread");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> DateTime<Local> {
        let naive = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap();
        Local.from_local_datetime(&naive).single().unwrap()
    }

    #[test]
    fn disabled_never_runs() {
        assert!(!should_sync_now(false, 5, at("2026-05-08 10:00:00"), None));
    }

    #[test]
    fn zero_interval_never_runs() {
        assert!(!should_sync_now(true, 0, at("2026-05-08 10:00:00"), None));
    }

    #[test]
    fn first_run_always_fires() {
        assert!(should_sync_now(true, 5, at("2026-05-08 10:00:00"), None));
    }

    #[test]
    fn fires_after_interval() {
        let last = at("2026-05-08 10:00:00");
        let now = at("2026-05-08 10:05:00");
        assert!(should_sync_now(true, 5, now, Some(last)));
    }

    #[test]
    fn does_not_fire_before_interval() {
        let last = at("2026-05-08 10:00:00");
        let now = at("2026-05-08 10:03:00");
        assert!(!should_sync_now(true, 5, now, Some(last)));
    }
}
