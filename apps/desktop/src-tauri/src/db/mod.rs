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
    conn.execute_batch(MASTER_DATA_SQL)?;
    apply_additive_migrations(conn)?;
    seed_master_data(conn)?;
    log::info!("schema migrations applied (idempotent)");
    Ok(())
}

const MASTER_DATA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS kategori (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    urutan INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bahasa (
    kode TEXT PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS jurusan (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    kode  TEXT,
    urutan INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agama (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    urutan INTEGER NOT NULL DEFAULT 0
);
"#;

/// Default seed values for master data tables. Inserted only on first launch
/// (when the table is empty) so manual edits in Settings persist across upgrades.
fn seed_master_data(conn: &Connection) -> AppResult<()> {
    seed_if_empty(conn, "agama", AGAMA_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO agama (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "kategori", KATEGORI_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO kategori (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "kelas", KELAS_SEED, |conn, idx, name| {
        let tingkat = name
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse::<i64>()
            .ok();
        conn.execute(
            "INSERT INTO kelas (nama, tingkat, urutan) VALUES (?1, ?2, ?3)",
            rusqlite::params![name, tingkat, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "jurusan", JURUSAN_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO jurusan (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_bahasa_if_empty(conn)?;
    Ok(())
}

const AGAMA_SEED: &[&str] = &["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

const KATEGORI_SEED: &[&str] = &[
    "Fiksi",
    "Non-fiksi",
    "Referensi",
    "Buku Pelajaran",
    "Karya Ilmiah",
    "Majalah",
    "Komik",
    "Biografi",
];

const KELAS_SEED: &[&str] = &[
    "7A", "7B", "7C", "8A", "8B", "8C", "9A", "9B", "9C", "10A", "10B", "10C", "11A", "11B",
    "11C", "12A", "12B", "12C",
];

const JURUSAN_SEED: &[&str] = &["IPA", "IPS", "Bahasa", "TKJ", "RPL", "Multimedia"];

const BAHASA_SEED: &[(&str, &str)] = &[
    ("id", "Indonesia"),
    ("en", "Inggris"),
    ("ar", "Arab"),
    ("jw", "Jawa"),
    ("su", "Sunda"),
    ("zh", "Mandarin"),
    ("ja", "Jepang"),
    ("fr", "Prancis"),
    ("de", "Jerman"),
    ("ms", "Melayu"),
];

fn seed_if_empty<F>(
    conn: &Connection,
    table: &str,
    items: &[&str],
    mut insert: F,
) -> AppResult<()>
where
    F: FnMut(&Connection, usize, &str) -> rusqlite::Result<()>,
{
    let count: i64 =
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })?;
    if count > 0 {
        return Ok(());
    }
    for (idx, name) in items.iter().enumerate() {
        insert(conn, idx, name)?;
    }
    log::info!("seeded {} default rows into {table}", items.len());
    Ok(())
}

fn seed_bahasa_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM bahasa", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    for (kode, nama) in BAHASA_SEED {
        conn.execute(
            "INSERT INTO bahasa (kode, nama) VALUES (?1, ?2)",
            rusqlite::params![kode, nama],
        )?;
    }
    log::info!("seeded {} default bahasa rows", BAHASA_SEED.len());
    Ok(())
}

/// Idempotent additive column migrations. Each entry adds a column to a table
/// only if it doesn't already exist, so old v1 databases keep working while
/// new v2 features (e.g. `anggota.agama` for session 4) get the columns they
/// need.
fn apply_additive_migrations(conn: &Connection) -> AppResult<()> {
    add_column_if_missing(conn, "anggota", "agama", "TEXT")?;
    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    decl: &str,
) -> AppResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let existing: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    if !existing.iter().any(|c| c == column) {
        conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"))?;
        log::info!("added column {table}.{column}");
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
