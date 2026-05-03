use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Window geometry persistence (revisi #22). Disimpan di tabel `settings`
/// dengan key `app.window.state` sebagai JSON. Dipakai untuk restore window
/// size pada cold start agar pengalaman resize konsisten.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub maximized: bool,
}

const KEY: &str = "app.window.state";

#[tauri::command]
pub fn window_state_get(state: State<'_, AppState>) -> AppResult<Option<WindowState>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![KEY],
            |row| row.get::<_, Option<String>>(0),
        )
        .or_else(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    let parsed = raw.and_then(|s| serde_json::from_str::<WindowState>(&s).ok());
    Ok(parsed)
}

#[tauri::command]
pub fn window_state_save(state: State<'_, AppState>, payload: WindowState) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let value = serde_json::to_string(&payload)
        .map_err(|e| AppError::Internal(format!("serialize window state: {e}")))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![KEY, value],
    )?;
    Ok(())
}
