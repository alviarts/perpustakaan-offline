//! DB backup / restore + schedule helpers (revisi #23 — Backup section).

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::State;

use crate::db;
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

/// Returns the path to the live runtime DB (BUG-007).
///
/// Previously this resolved to the v1 filename `perpustakaan.db` while the
/// actual runtime DB lives at `perpustakaan-v2.db` (see `db::resolve_db_path`).
/// That meant the Backup tab displayed the wrong path and `backup_create`
/// would either copy the wrong file or fail with `NotFound`. Delegate to the
/// single source of truth so the two can never drift again.
fn db_file_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    db::resolve_db_path(app)
}

fn sha256_of(path: &PathBuf) -> AppResult<String> {
    let mut file = fs::File::open(path).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| AppError::Internal(e.to_string()))?;
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
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    backup_create_at(&src, Path::new(&target_dir), &stamp)
}

/// Pure-IO core of [`backup_create`] split out so it's unit-testable without a
/// Tauri AppHandle. Copies `src` to `<target_dir>/perpustakaan-<stamp>.db`,
/// streaming the bytes through a SHA-256 hasher and writing the checksum to a
/// `.db.sha256` sidecar.
pub fn backup_create_at(src: &Path, target_dir: &Path, stamp: &str) -> AppResult<BackupResult> {
    if !src.exists() {
        return Err(AppError::NotFound(format!(
            "DB tidak ditemukan: {}",
            src.to_string_lossy()
        )));
    }
    if !target_dir.exists() {
        return Err(AppError::Validation(format!(
            "target dir tidak ditemukan: {}",
            target_dir.to_string_lossy()
        )));
    }

    let dst = target_dir.join(format!("perpustakaan-{stamp}.db"));

    let mut input = fs::File::open(src).map_err(|e| AppError::Internal(e.to_string()))?;
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
        return Err(AppError::NotFound(format!(
            "file tidak ditemukan: {file_path}"
        )));
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
        let conn = state
            .db
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
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

    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Allocate a fresh, isolated tempdir for each test. Avoids pulling in a
    /// new dev-dependency while still keeping test artifacts off the rest of
    /// the system.
    fn fresh_tempdir(prefix: &str) -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!("perpus-bug007-{prefix}-{pid}-{n}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create tempdir");
        dir
    }

    #[test]
    fn backup_create_at_emits_perpustakaan_stamp_filename() {
        let workdir = fresh_tempdir("emit");
        let src = workdir.join("perpustakaan-v2.db");
        fs::write(&src, b"fake-sqlite-bytes").unwrap();
        let target = workdir.join("out");
        fs::create_dir_all(&target).unwrap();

        let res = backup_create_at(&src, &target, "20260101-000000").unwrap();

        let dst = target.join("perpustakaan-20260101-000000.db");
        assert_eq!(res.path, dst.to_string_lossy());
        assert!(dst.exists());
        // Sidecar checksum file written alongside.
        assert!(target
            .join("perpustakaan-20260101-000000.db.sha256")
            .exists());
        assert_eq!(res.size_bytes, fs::metadata(&dst).unwrap().len());
        // SHA-256 of "fake-sqlite-bytes".
        assert_eq!(
            res.checksum,
            "5fe380923f6641af3257d8d3d57bda77b36bc46df09de6f1b6c8a3d02cefd731",
        );

        fs::remove_dir_all(&workdir).ok();
    }

    #[test]
    fn backup_create_at_actually_copies_byte_for_byte() {
        let workdir = fresh_tempdir("bytes");
        let src = workdir.join("perpustakaan-v2.db");
        let payload: Vec<u8> = (0u8..=255).cycle().take(20_000).collect();
        fs::write(&src, &payload).unwrap();
        let target = workdir.join("out");
        fs::create_dir_all(&target).unwrap();

        let res = backup_create_at(&src, &target, "stamp").unwrap();
        let dst_bytes = fs::read(&res.path).unwrap();
        assert_eq!(dst_bytes, payload);

        fs::remove_dir_all(&workdir).ok();
    }

    #[test]
    fn backup_create_at_errors_when_source_missing() {
        let workdir = fresh_tempdir("missing-src");
        let src = workdir.join("perpustakaan-v2.db");
        // Don't create src.
        let target = workdir.join("out");
        fs::create_dir_all(&target).unwrap();

        let err = backup_create_at(&src, &target, "stamp").unwrap_err();
        match err {
            AppError::NotFound(msg) => {
                assert!(msg.contains("perpustakaan-v2.db"), "message: {msg}");
            }
            other => panic!("expected NotFound, got {other:?}"),
        }

        fs::remove_dir_all(&workdir).ok();
    }

    #[test]
    fn backup_create_at_errors_when_target_dir_missing() {
        let workdir = fresh_tempdir("missing-tgt");
        let src = workdir.join("perpustakaan-v2.db");
        fs::write(&src, b"x").unwrap();
        let target = workdir.join("does-not-exist");

        let err = backup_create_at(&src, &target, "stamp").unwrap_err();
        match err {
            AppError::Validation(msg) => assert!(msg.contains("does-not-exist")),
            other => panic!("expected Validation, got {other:?}"),
        }

        fs::remove_dir_all(&workdir).ok();
    }

    /// Regression guard for BUG-007: every code path that resolves the live
    /// runtime DB filename must emit `perpustakaan-v2.db`, not the v1
    /// filename. We verify by inspecting the `db::resolve_db_path` end of
    /// the chain.
    #[test]
    fn db_filename_is_v2() {
        let workdir = fresh_tempdir("v2");
        let p = workdir.join("perpustakaan-v2.db");
        assert!(p.to_string_lossy().ends_with("perpustakaan-v2.db"));
        // Also assert that the source file references the v2 filename literal.
        // This catches accidental reverts of `db::resolve_db_path` back to v1.
        let db_mod = include_str!("../db/mod.rs");
        assert!(
            db_mod.contains("perpustakaan-v2.db"),
            "db::resolve_db_path must use v2 filename"
        );
        assert!(
            !db_mod.contains("\"perpustakaan.db\""),
            "db::resolve_db_path must NOT reference the v1 filename literal"
        );
        fs::remove_dir_all(&workdir).ok();
    }
}
