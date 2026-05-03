//! Manual book opener (revisi #4).
//!
//! Opens the bundled HTML user manual in a separate Tauri webview window.
//! The manual is built from `docs/manual.md` into `dist/manual/index.html` by
//! the `apps/manual` workspace package and shipped as a regular frontend asset.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};

const MANUAL_WINDOW_LABEL: &str = "manual";
const MANUAL_PATH: &str = "/manual/index.html";

#[tauri::command]
pub fn open_manual(app: AppHandle) -> AppResult<()> {
    if let Some(existing) = app.get_webview_window(MANUAL_WINDOW_LABEL) {
        existing.set_focus().ok();
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        MANUAL_WINDOW_LABEL,
        WebviewUrl::App(MANUAL_PATH.trim_start_matches('/').into()),
    )
    .title("Buku Manual — Perpustakaan Offline")
    .inner_size(960.0, 720.0)
    .min_inner_size(640.0, 480.0)
    .resizable(true)
    // Pin the chrome flags explicitly — these match Tauri's documented
    // defaults but defensively rule out any Windows-specific platform
    // default that could otherwise leave the manual window non-closable
    // (BUG-009 / BUG-010).
    .closable(true)
    .minimizable(true)
    .maximizable(true)
    .decorations(true)
    .visible(true)
    .center()
    .build()
    .map_err(|e| AppError::Internal(format!("open_manual: {e}")))?;
    Ok(())
}
