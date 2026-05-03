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
    ensure_anggota_agama(conn)?;
    log::info!("schema migrations applied (idempotent)");
    Ok(())
}

/// Idempotent migration: tambah kolom `agama` di tabel `anggota` kalau belum ada.
/// Dibutuhkan oleh sesi 04 untuk menyimpan field agama anggota.
fn ensure_anggota_agama(conn: &Connection) -> AppResult<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(anggota)")?;
    let mut rows = stmt.query([])?;
    let mut has_agama = false;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == "agama" {
            has_agama = true;
            break;
        }
    }
    drop(rows);
    drop(stmt);
    if !has_agama {
        conn.execute("ALTER TABLE anggota ADD COLUMN agama TEXT", [])?;
        log::info!("added column anggota.agama");
    }
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
