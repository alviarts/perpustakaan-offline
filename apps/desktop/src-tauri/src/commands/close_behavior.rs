//! Close-behavior + system-tray plumbing (BUG-011).
//!
//! On Windows the main library application would leave a zombie process in
//! Task Manager after the user clicked the X button. The bug had two parts:
//!
//! 1. Closing the *main window* did not always tear down the WebView2
//!    subprocess + the Tauri event loop on its own — Windows kept the
//!    `PerpustakaanNusantara.exe` process alive in some configurations,
//!    blocking subsequent launches and risking SQLite lock contention if a
//!    user opened a second instance.
//! 2. There was no way to keep the app running in the background as a
//!    minimized icon, which several pustakawan asked for so the workstation
//!    wouldn't have to cold-start the app multiple times a day.
//!
//! This module exposes:
//!
//! * `get_close_behavior` / `set_close_behavior` — typed wrappers around the
//!   `app.close_behavior` row in the generic `settings` k/v table. Default is
//!   `Exit` (the historical behavior the user expected).
//! * `close_behavior_get` / `close_behavior_set` — `#[tauri::command]` stubs
//!   for the frontend Settings page.
//! * `force_quit` — a Tauri command the system tray's "Keluar" menu item
//!   invokes to force a clean shutdown regardless of the current setting.
//!
//! The actual `WindowEvent::CloseRequested` + tray plumbing lives in
//! `lib.rs::run` so the close handler can intercept the event before Tauri
//! tears the window down.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::AppState;

/// What happens when the user clicks the X button on the main window.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseBehavior {
    /// Terminate the application (default). Equivalent to "File → Keluar".
    #[default]
    Exit,
    /// Hide the main window into the system tray. The app keeps running in
    /// the background and is restored via tray icon click / "Buka" menu.
    Tray,
}

impl CloseBehavior {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exit => "exit",
            Self::Tray => "tray",
        }
    }

    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "tray" => Self::Tray,
            // Anything else falls back to the safe default so a corrupt
            // settings row never bricks the close button.
            _ => Self::Exit,
        }
    }
}

pub const SETTINGS_KEY: &str = "app.close_behavior";

/// Read the persisted close behavior, returning the default if the row is
/// missing or unparseable. This helper is used both by the Tauri command and
/// by the runtime close-event handler so they always agree.
pub fn get_close_behavior(state: &AppState) -> AppResult<CloseBehavior> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![SETTINGS_KEY],
            |row| row.get::<_, Option<String>>(0),
        )
        .or_else(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    Ok(raw.as_deref().map(CloseBehavior::parse).unwrap_or_default())
}

/// Persist the close behavior using upsert semantics on the existing
/// `settings` table.
pub fn set_close_behavior(state: &AppState, behavior: CloseBehavior) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![SETTINGS_KEY, behavior.as_str()],
    )?;
    Ok(())
}

#[tauri::command]
pub fn close_behavior_get(state: State<'_, AppState>) -> AppResult<CloseBehavior> {
    get_close_behavior(&state)
}

#[tauri::command]
pub fn close_behavior_set(
    state: State<'_, AppState>,
    behavior: CloseBehavior,
) -> AppResult<CloseBehavior> {
    set_close_behavior(&state, behavior)?;
    Ok(behavior)
}

/// Tray "Keluar" menu item handler, also exposed to the frontend so a
/// "File → Keluar" menu can use it. Tries `app.exit(0)` first (lets Tauri
/// tear down windows cleanly) and follows up with `std::process::exit(0)`
/// so any lingering WebView2 child process is force-terminated even if the
/// runtime gets stuck shutting down — this is the BUG-011 root-cause fix.
#[tauri::command]
pub fn force_quit(app: AppHandle) {
    log::info!("force_quit invoked — exiting application");
    app.exit(0);
    // BUG-011 belt-and-suspenders: a small subset of WebView2 builds on
    // Windows do not unwind cleanly when only `app.exit(0)` is called
    // (see https://github.com/tauri-apps/tauri/issues/8631). The hard
    // exit guarantees the .exe disappears from Task Manager.
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_exit() {
        assert_eq!(CloseBehavior::default(), CloseBehavior::Exit);
    }

    #[test]
    fn parse_known_values() {
        assert_eq!(CloseBehavior::parse("exit"), CloseBehavior::Exit);
        assert_eq!(CloseBehavior::parse("tray"), CloseBehavior::Tray);
        assert_eq!(CloseBehavior::parse("TRAY"), CloseBehavior::Tray);
        assert_eq!(CloseBehavior::parse("  Tray  "), CloseBehavior::Tray);
    }

    #[test]
    fn parse_unknown_falls_back_to_exit() {
        // BUG-011: a corrupted settings row must NEVER make the close button
        // unresponsive — fall back to the safe (terminate) default.
        assert_eq!(CloseBehavior::parse(""), CloseBehavior::Exit);
        assert_eq!(CloseBehavior::parse("garbage"), CloseBehavior::Exit);
        assert_eq!(CloseBehavior::parse("hide"), CloseBehavior::Exit);
    }

    #[test]
    fn round_trip_serde() {
        let raw = serde_json::to_string(&CloseBehavior::Tray).unwrap();
        assert_eq!(raw, "\"tray\"");
        let parsed: CloseBehavior = serde_json::from_str("\"exit\"").unwrap();
        assert_eq!(parsed, CloseBehavior::Exit);
    }

    #[test]
    fn as_str_is_stable() {
        // Frontend stores the string verbatim — keep these literals stable
        // so old SQLite rows keep working after upgrades.
        assert_eq!(CloseBehavior::Exit.as_str(), "exit");
        assert_eq!(CloseBehavior::Tray.as_str(), "tray");
    }
}
