//! DB backup / restore + schedule helpers (revisi #23 — Backup section).

use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

use chrono::Local;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{Manager, State};

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub checksum: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSchedule {
    pub enabled: bool,
    pub cron: String,
    pub last_run: Option<String>,
}

fn db_file_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    Ok(dir.join("perpustakaan.db"))
}

fn sha256_of(path: &PathBuf) -> AppResult<String> {
    let mut file = fs::File::open(path).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf).map_err(|e| AppError::Internal(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[tauri::command]
pub fn backup_create(app: tauri::AppHandle, target_dir: String) -> AppResult<BackupResult> {
    let src = db_file_path(&app)?;
    if !src.exists() {
        return Err(AppError::NotFound("perpustakaan.db not found".into()));
    }
    let target_dir_path = PathBuf::from(&target_dir);
    if !target_dir_path.exists() {
        return Err(AppError::Validation(format!(
            "target dir tidak ditemukan: {target_dir}"
        )));
    }

    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let dst = target_dir_path.join(format!("perpustakaan-{stamp}.db"));

    let mut input = fs::File::open(&src).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut output = fs::File::create(&dst).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    let mut total = 0u64;
    loop {
        let n = input
            .read(&mut buf)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        output
            .write_all(&buf[..n])
            .map_err(|e| AppError::Internal(e.to_string()))?;
        total += n as u64;
    }

    let checksum = hex::encode(hasher.finalize());
    let sidecar = dst.with_extension("db.sha256");
    fs::write(&sidecar, &checksum).map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(BackupResult {
        path: dst.to_string_lossy().to_string(),
        checksum,
        size_bytes: total,
    })
}

#[tauri::command]
pub fn backup_restore(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    file_path: String,
    expected_checksum: Option<String>,
) -> AppResult<BackupResult> {
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err(AppError::NotFound(format!("file tidak ditemukan: {file_path}")));
    }

    let actual = sha256_of(&src)?;
    if let Some(expected) = expected_checksum.as_ref() {
        if !expected.eq_ignore_ascii_case(&actual) {
            return Err(AppError::Validation(
                "checksum tidak cocok, file backup mungkin korup".into(),
            ));
        }
    }

    // Lock DB sebentar untuk pastikan tidak ada transaksi aktif.
    {
        let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
        let _ = conn.execute_batch("VACUUM");
    }

    let dst = db_file_path(&app)?;
    let backup_old = dst.with_extension("db.preview-restore");
    if dst.exists() {
        fs::copy(&dst, &backup_old).map_err(|e| AppError::Internal(e.to_string()))?;
    }
    fs::copy(&src, &dst).map_err(|e| AppError::Internal(e.to_string()))?;
    let size = fs::metadata(&dst)
        .map(|m| m.len())
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(BackupResult {
        path: dst.to_string_lossy().to_string(),
        checksum: actual,
        size_bytes: size,
    })
}

#[tauri::command]
pub fn backup_schedule_get(state: State<'_, AppState>) -> AppResult<BackupSchedule> {
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let read = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |r| r.get::<_, String>(0),
        )
        .ok()
    };

    let enabled = read("backup.schedule.enabled")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    let cron = read("backup.schedule.cron").unwrap_or_else(|| "0 2 * * *".to_string());
    let last_run = read("backup.schedule.last_run");

    Ok(BackupSchedule {
        enabled,
        cron,
        last_run,
    })
}

#[tauri::command]
pub fn backup_schedule_set(
    state: State<'_, AppState>,
    enabled: bool,
    cron: String,
) -> AppResult<BackupSchedule> {
    if cron.split_whitespace().count() != 5 {
        return Err(AppError::Validation(
            "Cron harus 5 field (mis. \"0 2 * * *\")".into(),
        ));
    }

    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('backup.schedule.enabled', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        [if enabled { "true" } else { "false" }],
    )
    .map_err(AppError::from)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('backup.schedule.cron', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        [&cron],
    )
    .map_err(AppError::from)?;

    drop(conn);
    backup_schedule_get(state)
}

#[tauri::command]
pub fn backup_db_path(app: tauri::AppHandle) -> AppResult<String> {
    let p = db_file_path(&app)?;
    Ok(p.to_string_lossy().to_string())
}
