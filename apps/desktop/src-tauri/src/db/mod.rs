use std::path::{Path, PathBuf};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

const SCHEMA_SQL: &str = include_str!("schema.sql");
const DEFAULT_ADMIN_USERNAME: &str = "admin";
const DEFAULT_ADMIN_PASSWORD: &str = "admin123";

pub fn resolve_db_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("perpustakaan-v2.db"))
}

pub fn open_connection(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    log::info!("schema migrations applied (idempotent)");
    Ok(())
}

pub fn seed_default_admin(conn: &Connection) -> AppResult<()> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let hash = bcrypt::hash(DEFAULT_ADMIN_PASSWORD, bcrypt::DEFAULT_COST)?;
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role, aktif)
         VALUES (?1, ?2, ?3, 'admin', 1)",
        rusqlite::params![DEFAULT_ADMIN_USERNAME, hash, "Administrator"],
    )?;
    log::info!("seeded default admin user (username=admin)");
    Ok(())
}
