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
    conn.execute_batch(KTA_SQL)?;
    conn.execute_batch(LABEL_BUKU_SQL)?;
    apply_additive_migrations(conn)?;
    seed_master_data(conn)?;
    seed_kta_default_template(conn)?;
    seed_label_buku_default_template(conn)?;
    log::info!("schema migrations applied (idempotent)");
    Ok(())
}

const KTA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS kta_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nama        TEXT    NOT NULL UNIQUE,
    deskripsi   TEXT,
    layout_json TEXT    NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kta_default ON kta_templates(is_default);
"#;

/// Label Buku templates — mirror of `kta_templates` for spine/cover labels
/// (v1.0.6 #22). Schema is identical so we can reuse the editor pattern; the
/// `layout_json` carries Avery-style field arrays with a different `kind`
/// vocabulary (`barcode`, `judul`, `kodeBuku`, `kodeEksemplar`, …).
const LABEL_BUKU_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS label_buku_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nama        TEXT    NOT NULL UNIQUE,
    deskripsi   TEXT,
    layout_json TEXT    NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_label_buku_default ON label_buku_templates(is_default);
"#;

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
    seed_ddc_if_empty(conn)?;
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
    "7A", "7B", "7C", "8A", "8B", "8C", "9A", "9B", "9C", "10A", "10B", "10C", "11A", "11B", "11C",
    "12A", "12B", "12C",
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

fn seed_if_empty<F>(conn: &Connection, table: &str, items: &[&str], mut insert: F) -> AppResult<()>
where
    F: FnMut(&Connection, usize, &str) -> rusqlite::Result<()>,
{
    let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
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

/// Dewey Decimal Classification — 10 main classes (000-900). Indonesian
/// labels match the conventions used by Indonesian school libraries (BUG-004).
const DDC_MAIN_CLASSES: &[(&str, &str)] = &[
    ("000", "Karya Umum"),
    ("100", "Filsafat & Psikologi"),
    ("200", "Agama"),
    ("300", "Ilmu Sosial"),
    ("400", "Bahasa"),
    ("500", "Sains Murni"),
    ("600", "Teknologi & Sains Terapan"),
    ("700", "Kesenian, Hiburan, Olahraga"),
    ("800", "Sastra"),
    ("900", "Sejarah & Geografi"),
];

fn seed_ddc_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM ddc", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    for (kode, deskripsi) in DDC_MAIN_CLASSES {
        conn.execute(
            "INSERT INTO ddc (kode, deskripsi, parent, depth) VALUES (?1, ?2, NULL, 0)",
            rusqlite::params![kode, deskripsi],
        )?;
    }
    log::info!("seeded {} default DDC main classes", DDC_MAIN_CLASSES.len());
    Ok(())
}

/// Idempotent additive column migrations. Each entry adds a column to a table
/// only if it doesn't already exist, so old v1 databases keep working while
/// new v2 features (e.g. `anggota.agama` for session 4) get the columns they
/// need.
fn apply_additive_migrations(conn: &Connection) -> AppResult<()> {
    add_column_if_missing(conn, "anggota", "agama", "TEXT")?;
    // Forgot-password flow (PR-5): security question + bcrypt-hashed answer.
    // Nullable on existing rows so older v2 DBs upgrade in place; users that
    // never set a question simply cannot use the offline reset flow until an
    // admin fills it in via Settings → Akun.
    add_column_if_missing(conn, "users", "security_question", "TEXT")?;
    add_column_if_missing(conn, "users", "security_answer_hash", "TEXT")?;
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
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
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

/// Default KTA template seeded on first launch (BUG-005).
///
/// Mirrors `defaultLayout()` in `apps/desktop/src/lib/kta.ts` so the seeded
/// row matches what the frontend's mock store and "Reset ke template default"
/// button produce. ID-1 card (85.6mm × 53.98mm) with header, identitas
/// subtitle, foto, nama, kodeAnggota, kelas, and a QR for `member:<id>`.
const KTA_DEFAULT_TEMPLATE_NAME: &str = "Template Default";
const KTA_DEFAULT_TEMPLATE_DESC: &str = "Layout standar ID-1 dengan foto + QR";
const KTA_DEFAULT_LAYOUT_JSON: &str = r##"{
  "widthMm": 85.6,
  "heightMm": 53.98,
  "background": "#ffffff",
  "fields": [
    {"id":"header","kind":"static","text":"KARTU TANDA ANGGOTA","x":4,"y":6,"width":92,"height":8,"fontSize":10,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"identitas","kind":"identitas","x":4,"y":14,"width":92,"height":8,"fontSize":8,"color":"#475569","align":"center"},
    {"id":"foto","kind":"foto","x":4,"y":26,"width":22,"height":28},
    {"id":"nama","kind":"nama","x":30,"y":28,"width":50,"height":10,"fontSize":12,"fontWeight":"bold","color":"#0f172a","align":"left"},
    {"id":"kode","kind":"kodeAnggota","x":30,"y":38,"width":50,"height":6,"fontSize":8,"color":"#334155","align":"left"},
    {"id":"kelas","kind":"kelas","x":30,"y":44,"width":50,"height":6,"fontSize":8,"color":"#475569","align":"left"},
    {"id":"qr","kind":"qr","x":78,"y":28,"width":18,"height":18}
  ]
}"##;

/// Idempotently seed a single default KTA template if `kta_templates` is empty.
/// Without this, a fresh install opens "Cetak KTA → Pilih template" with an
/// empty dropdown and a disabled "Cetak" button (BUG-005).
fn seed_kta_default_template(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM kta_templates", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO kta_templates (nama, deskripsi, layout_json, is_default)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![
            KTA_DEFAULT_TEMPLATE_NAME,
            KTA_DEFAULT_TEMPLATE_DESC,
            KTA_DEFAULT_LAYOUT_JSON,
        ],
    )?;
    log::info!("seeded default kta_templates row (is_default=1)");
    Ok(())
}

/// Default Label Buku template seeded on first launch (v1.0.6 #22). Mirrors
/// `defaultLayout()` in `apps/desktop/src/lib/labelBuku.ts`. 70 × 35 mm
/// (Avery J8160-style) with header, judul, kodeBuku, kodeEksemplar, and a
/// Code-128 barcode of the kodeEksemplar.
const LABEL_BUKU_DEFAULT_TEMPLATE_NAME: &str = "Template Default";
const LABEL_BUKU_DEFAULT_TEMPLATE_DESC: &str = "Layout standar 70 × 35 mm dengan judul + barcode";
const LABEL_BUKU_DEFAULT_LAYOUT_JSON: &str = r##"{
  "widthMm": 70,
  "heightMm": 35,
  "background": "#ffffff",
  "fields": [
    {"id":"identitas","kind":"identitas","x":4,"y":4,"width":92,"height":10,"fontSize":9,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"judul","kind":"judul","x":4,"y":18,"width":92,"height":12,"fontSize":10,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"kode","kind":"kodeBuku","x":4,"y":34,"width":40,"height":10,"fontSize":11,"fontWeight":"bold","color":"#0f172a","align":"left"},
    {"id":"barcode","kind":"barcode","x":4,"y":50,"width":92,"height":36},
    {"id":"kodeek","kind":"kodeEksemplar","x":4,"y":88,"width":92,"height":10,"fontSize":8,"color":"#475569","align":"center"}
  ]
}"##;

fn seed_label_buku_default_template(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM label_buku_templates", [], |row| {
        row.get(0)
    })?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO label_buku_templates (nama, deskripsi, layout_json, is_default)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![
            LABEL_BUKU_DEFAULT_TEMPLATE_NAME,
            LABEL_BUKU_DEFAULT_TEMPLATE_DESC,
            LABEL_BUKU_DEFAULT_LAYOUT_JSON,
        ],
    )?;
    log::info!("seeded default label_buku_templates row (is_default=1)");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign_keys");
        run_migrations(&conn).expect("run migrations");
        conn
    }

    #[test]
    fn fresh_install_seeds_one_default_kta_template() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let default_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM kta_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(default_count, 1);
    }

    #[test]
    fn seeded_kta_template_layout_is_valid_json() {
        let conn = fresh_conn();
        let layout: String = conn
            .query_row(
                "SELECT layout_json FROM kta_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&layout).expect("layout_json must be valid JSON");
        assert!(parsed.is_object());
        let fields = parsed
            .get("fields")
            .and_then(|f| f.as_array())
            .expect("layout.fields must be array");
        assert!(
            fields.len() >= 5,
            "default layout must include the core KTA fields"
        );
        for f in fields {
            assert!(
                f.get("kind").and_then(|k| k.as_str()).is_some(),
                "every field must declare a kind"
            );
        }
        // Sanity: the kinds the frontend renderer expects.
        let kinds: std::collections::HashSet<&str> = fields
            .iter()
            .filter_map(|f| f.get("kind").and_then(|k| k.as_str()))
            .collect();
        for required in ["nama", "kodeAnggota", "kelas", "foto", "qr"] {
            assert!(
                kinds.contains(required),
                "default layout must include kind={required}"
            );
        }
    }

    #[test]
    fn kta_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        // Re-running migrations on the same connection must not duplicate the row.
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn kta_seed_skips_when_user_already_has_templates() {
        let conn = fresh_conn();
        // Simulate a v1.0.0 user who already manually added a template via
        // Settings → KTA before upgrading. Seeding must NOT overwrite or
        // duplicate it.
        conn.execute("DELETE FROM kta_templates", []).unwrap();
        conn.execute(
            "INSERT INTO kta_templates (nama, deskripsi, layout_json, is_default)
             VALUES ('Custom', NULL, '{\"fields\":[]}', 0)",
            [],
        )
        .unwrap();
        seed_kta_default_template(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let nama: String = conn
            .query_row("SELECT nama FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nama, "Custom");
    }

    #[test]
    fn fresh_install_seeds_ten_ddc_main_classes() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 10);
    }

    #[test]
    fn ddc_seed_includes_canonical_kode_and_deskripsi() {
        let conn = fresh_conn();
        let mut stmt = conn
            .prepare("SELECT kode, deskripsi FROM ddc ORDER BY kode")
            .unwrap();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        let kodes: Vec<&str> = rows.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(
            kodes,
            vec!["000", "100", "200", "300", "400", "500", "600", "700", "800", "900",],
        );
        // Spot-check a couple of descriptions to guard against a future
        // careless edit reordering or rewriting the array.
        let by_kode: std::collections::HashMap<&str, &str> =
            rows.iter().map(|(k, d)| (k.as_str(), d.as_str())).collect();
        assert_eq!(by_kode.get("000").copied(), Some("Karya Umum"));
        assert_eq!(by_kode.get("400").copied(), Some("Bahasa"));
        assert_eq!(by_kode.get("900").copied(), Some("Sejarah & Geografi"));
    }

    #[test]
    fn ddc_seed_rows_are_main_classes_at_depth_zero() {
        let conn = fresh_conn();
        let depths: Vec<i64> = conn
            .prepare("SELECT depth FROM ddc")
            .unwrap()
            .query_map([], |r| r.get::<_, i64>(0))
            .unwrap()
            .collect::<rusqlite::Result<Vec<_>>>()
            .unwrap();
        assert!(depths.iter().all(|d| *d == 0));
        let parent_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ddc WHERE parent IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(parent_count, 0);
    }

    #[test]
    fn ddc_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 10);
    }

    #[test]
    fn fresh_install_seeds_one_default_label_buku_template() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        let default_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM label_buku_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(default_count, 1);
    }

    #[test]
    fn seeded_label_buku_template_layout_is_valid_json_with_required_kinds() {
        let conn = fresh_conn();
        let layout: String = conn
            .query_row(
                "SELECT layout_json FROM label_buku_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&layout).expect("layout_json must be valid JSON");
        assert!(parsed.is_object());
        let fields = parsed
            .get("fields")
            .and_then(|f| f.as_array())
            .expect("layout.fields must be array");
        let kinds: std::collections::HashSet<&str> = fields
            .iter()
            .filter_map(|f| f.get("kind").and_then(|k| k.as_str()))
            .collect();
        for required in ["judul", "kodeBuku", "kodeEksemplar", "barcode"] {
            assert!(
                kinds.contains(required),
                "default label layout must include kind={required}"
            );
        }
    }

    #[test]
    fn label_buku_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn label_buku_seed_skips_when_user_already_has_templates() {
        let conn = fresh_conn();
        conn.execute("DELETE FROM label_buku_templates", [])
            .unwrap();
        conn.execute(
            "INSERT INTO label_buku_templates (nama, deskripsi, layout_json, is_default)
             VALUES ('Custom', NULL, '{\"fields\":[]}', 0)",
            [],
        )
        .unwrap();
        seed_label_buku_default_template(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        let nama: String = conn
            .query_row("SELECT nama FROM label_buku_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nama, "Custom");
    }

    #[test]
    fn ddc_seed_skips_when_user_already_has_rows() {
        // Simulate a v1.0.0 user who manually inserted DDC entries before
        // upgrading. Seeding must NOT duplicate or override them.
        let conn = fresh_conn();
        conn.execute("DELETE FROM ddc", []).unwrap();
        conn.execute(
            "INSERT INTO ddc (kode, deskripsi, parent, depth)
             VALUES ('CUSTOM', 'My local class', NULL, 0)",
            [],
        )
        .unwrap();
        seed_ddc_if_empty(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let kode: String = conn
            .query_row("SELECT kode FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(kode, "CUSTOM");
    }
}
