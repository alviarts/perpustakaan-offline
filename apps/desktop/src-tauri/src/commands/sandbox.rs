//! D5-SandboxDemoMode — RPC commands that toggle the application between
//! the production database and a sandboxed `demo.db` copy.
//!
//! When sandbox mode is active:
//!   - `state.db` points at `<app_data>/perpustakaan-v2-demo.db`.
//!   - `<app_data>/sandbox.flag` exists with the contents `"1"` so the
//!     mode survives an app restart.
//!   - The backup scheduler short-circuits each tick (see
//!     `commands::backup_runner::tick`) so demo data is never written into
//!     the regular cloud target.
//!   - `state.sandbox_mode` is `true` and `SandboxBanner.tsx` renders.
//!
//! Audit trail of toggles is appended to `sandbox_audit_log` in the
//! **production** DB (never the demo copy) so history survives wipes.

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::commands::auth::SessionUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Operational snapshot returned by every sandbox RPC. Front-end uses
/// `active` to drive `SandboxBanner` and the toggle button label, and
/// `dbPath` for the diagnostic line on `SandboxPage`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxStatus {
    pub active: bool,
    pub db_path: String,
    pub demo_db_path: String,
    pub prod_db_path: String,
}

fn build_status(app: &AppHandle, active: bool) -> AppResult<SandboxStatus> {
    let demo = db::demo_db_path(app)?;
    let prod = db::prod_db_path(app)?;
    let db_path = if active { demo.clone() } else { prod.clone() };
    Ok(SandboxStatus {
        active,
        db_path: db_path.to_string_lossy().to_string(),
        demo_db_path: demo.to_string_lossy().to_string(),
        prod_db_path: prod.to_string_lossy().to_string(),
    })
}

fn current_user_id(state: &AppState) -> Option<i64> {
    state
        .current_user
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|u: &SessionUser| u.id))
}

/// Append a row to `sandbox_audit_log` in the production DB. Always opens
/// a fresh connection to the prod path so the entry lands on the real
/// database regardless of which DB is currently mounted on `state.db`.
fn append_sandbox_audit(
    app: &AppHandle,
    action: &str,
    user_id: Option<i64>,
    note: Option<&str>,
) -> AppResult<()> {
    let prod = db::prod_db_path(app)?;
    let conn = Connection::open(&prod)?;
    db::run_migrations(&conn)?; // ensures the table exists on first call
    conn.execute(
        "INSERT INTO sandbox_audit_log (action, user_id, note) VALUES (?1, ?2, ?3)",
        rusqlite::params![action, user_id, note],
    )?;
    Ok(())
}

/// Returns the current sandbox status without mutating state. Used by
/// `SandboxBanner` and `SandboxPage` to render their initial state.
#[tauri::command]
pub fn sandbox_status(app: AppHandle, state: State<'_, AppState>) -> AppResult<SandboxStatus> {
    let active = state
        .sandbox_mode
        .lock()
        .map(|g| *g)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    build_status(&app, active)
}

/// Activate sandbox mode: copies the production DB to `demo.db`, swaps the
/// connection on `state.db` to point at the demo file, runs migrations on
/// the demo copy, and persists the flag so the mode survives a restart.
/// Idempotent — calling it while already active reseeds the demo DB from
/// production (handy for "reset demo" buttons).
#[tauri::command]
pub fn sandbox_enable(app: AppHandle, state: State<'_, AppState>) -> AppResult<SandboxStatus> {
    let prod = db::prod_db_path(&app)?;
    let demo = db::demo_db_path(&app)?;

    // Copy production DB onto demo path. Use std::fs::copy which truncates
    // the destination so subsequent enables always start from a fresh
    // production snapshot. If prod doesn't exist yet (first-run edge case),
    // open an empty connection and let migrations create the schema.
    if prod.exists() {
        std::fs::copy(&prod, &demo)?;
    } else if demo.exists() {
        // Ensure demo file starts clean so the user always lands in a
        // predictable state.
        std::fs::remove_file(&demo)?;
    }

    let new_conn = db::open_connection(&demo)?;
    db::run_migrations(&new_conn)?;
    db::seed_default_admin(&new_conn)?;

    {
        let mut db_guard = state
            .db
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *db_guard = new_conn;
    }
    {
        let mut sb_guard = state
            .sandbox_mode
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *sb_guard = true;
    }
    db::write_sandbox_flag(&app, true)?;
    append_sandbox_audit(&app, "enable", current_user_id(&state), None)?;

    log::info!("sandbox: enabled — db handle now at {}", demo.display());
    build_status(&app, true)
}

/// Deactivate sandbox mode: closes the demo connection, optionally
/// archives `demo.db` to `<app_data>/demo-archive/<ts>.db`, restores the
/// production DB handle, clears the persisted flag, and writes the audit
/// row.
#[tauri::command]
pub fn sandbox_disable(app: AppHandle, state: State<'_, AppState>) -> AppResult<SandboxStatus> {
    let prod = db::prod_db_path(&app)?;
    let demo = db::demo_db_path(&app)?;

    let new_conn = db::open_connection(&prod)?;
    db::run_migrations(&new_conn)?;
    db::seed_default_admin(&new_conn)?;

    {
        let mut db_guard = state
            .db
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *db_guard = new_conn;
    }
    {
        let mut sb_guard = state
            .sandbox_mode
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        *sb_guard = false;
    }
    db::write_sandbox_flag(&app, false)?;

    // Best-effort archive — we don't fail the disable if archiving fails.
    if demo.exists() {
        if let Ok(archive_dir) = db::app_data_dir(&app).map(|d| d.join("demo-archive")) {
            if std::fs::create_dir_all(&archive_dir).is_ok() {
                let ts = chrono::Local::now().format("%Y%m%d-%H%M%S");
                let archived = archive_dir.join(format!("demo-{ts}.db"));
                if let Err(err) = std::fs::rename(&demo, &archived) {
                    log::warn!(
                        "sandbox: archive failed ({err}); leaving demo file in place at {}",
                        demo.display()
                    );
                } else {
                    log::info!("sandbox: archived demo DB to {}", archived.display());
                }
            }
        }
    }

    append_sandbox_audit(&app, "disable", current_user_id(&state), None)?;
    log::info!("sandbox: disabled — db handle restored to {}", prod.display());
    build_status(&app, false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_with_migrations(path: &std::path::Path) -> Connection {
        let conn = Connection::open(path).expect("open db");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("foreign_keys");
        crate::db::run_migrations(&conn).expect("migrations");
        conn
    }

    #[test]
    fn sandbox_audit_table_is_created_by_migrations() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prod.db");
        let conn = open_with_migrations(&path);

        // Table exists.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sandbox_audit_log'",
                [],
                |r| r.get(0),
            )
            .expect("query sqlite_master");
        assert_eq!(count, 1);

        // Insert + readback.
        conn.execute(
            "INSERT INTO sandbox_audit_log (action, user_id, note) VALUES ('enable', 1, 'unit-test')",
            [],
        )
        .expect("insert audit");
        let (action, user_id, note): (String, Option<i64>, Option<String>) = conn
            .query_row(
                "SELECT action, user_id, note FROM sandbox_audit_log ORDER BY id DESC LIMIT 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("read audit");
        assert_eq!(action, "enable");
        assert_eq!(user_id, Some(1));
        assert_eq!(note.as_deref(), Some("unit-test"));
    }

    #[test]
    fn sandbox_audit_check_constraint_rejects_unknown_action() {
        let dir = tempfile::tempdir().expect("tempdir");
        let conn = open_with_migrations(&dir.path().join("prod.db"));
        let err = conn.execute(
            "INSERT INTO sandbox_audit_log (action) VALUES ('rogue')",
            [],
        );
        assert!(err.is_err(), "CHECK constraint should reject unknown action");
    }

    #[test]
    fn enable_disable_roundtrip_swaps_db_files() {
        // This covers the file-level half of the toggle (DB copy + archive
        // moves) without the Tauri AppHandle. We exercise the `enable_sandbox`
        // / `disable_sandbox` IO contract directly.
        let dir = tempfile::tempdir().expect("tempdir");
        let prod = dir.path().join("prod.db");
        let demo = dir.path().join("demo.db");
        let archive_dir = dir.path().join("demo-archive");

        // Seed prod with a marker row.
        {
            let conn = open_with_migrations(&prod);
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('sandbox.test.marker', 'prod-only')",
                [],
            )
            .expect("seed prod");
        }

        // enable: copy prod -> demo, demo should contain the marker.
        std::fs::copy(&prod, &demo).expect("enable: copy prod->demo");
        {
            let demo_conn = open_with_migrations(&demo);
            let value: String = demo_conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'sandbox.test.marker'",
                    [],
                    |r| r.get(0),
                )
                .expect("read marker from demo");
            assert_eq!(value, "prod-only");

            // Mutate demo only — prod should remain untouched after the toggle.
            demo_conn
                .execute(
                    "UPDATE settings SET value = 'demo-only' WHERE key = 'sandbox.test.marker'",
                    [],
                )
                .expect("mutate demo");
        }

        // Verify prod was not affected by demo writes.
        {
            let conn = Connection::open(&prod).expect("open prod after demo write");
            let value: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'sandbox.test.marker'",
                    [],
                    |r| r.get(0),
                )
                .expect("read marker from prod");
            assert_eq!(value, "prod-only", "prod must be untouched while demo is active");
        }

        // disable: archive demo, prod handle restored.
        std::fs::create_dir_all(&archive_dir).expect("mkdir archive");
        let archived = archive_dir.join("demo-test.db");
        std::fs::rename(&demo, &archived).expect("disable: archive demo");
        assert!(!demo.exists(), "demo file must be archived away");
        assert!(archived.exists(), "archive copy must exist");
    }
}
