//! Cashbook (kas) mutations — manual entries, edit, delete.
//!
//! Implements v1.0.4 #11: until now `kas` was append-only and only fed by the
//! denda flow inside `peminjaman_kembalikan` / lost-book bookkeeping. The
//! user reported that operators sometimes mis-key a denda or want to record
//! a one-off pemasukan/pengeluaran (donor cash, equipment purchase, etc.),
//! so this module exposes three mutation commands plus the audit-trail
//! glue so every change is traceable.
//!
//! Design notes:
//! - Mutations always run inside a transaction so the kas row + matching
//!   `audit_log` row commit (or roll back) atomically. Otherwise a crash
//!   between the `INSERT INTO kas` and the audit-log write would leave a
//!   silently un-audited entry on disk.
//! - We deliberately permit edits/deletes on auto-generated rows
//!   (`sumber != 'manual'`). Frontends warn the operator before letting
//!   them touch a denda-linked row, but the backend trusts the call —
//!   matching the user's request that "kalau salah input, bisa diedit di
//!   kas ini".
//! - The audit `detail` payload is a compact JSON snapshot of the
//!   pre/post values so the existing `settings_audit_log_query` viewer
//!   can render a human-readable diff later.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Allowed values for `kas.jenis`. Mirrors the SQLite check the frontend
/// already enforces; kept here so the backend doesn't trust client input.
const ALLOWED_JENIS: &[&str] = &["masuk", "keluar"];

/// Allowed values for `kas.sumber`. New variants must be added in lock-step
/// with the frontend's discriminated union and the breakdown pie chart.
const ALLOWED_SUMBER: &[&str] = &["manual", "denda", "hilang", "modal"];

/// Maximum keterangan length. Matches `INSERT INTO kas …` calls in
/// `peminjaman.rs` (string-formatted descriptions are short) and prevents
/// pathological payloads from blowing up the audit-log JSON detail.
const MAX_KETERANGAN_LEN: usize = 500;

/// Maximum allowed nominal in IDR. 1 trillion is comfortably above any
/// realistic single-school cash entry while still leaving headroom in the
/// `i64` column for the running cumulative balance.
const MAX_NOMINAL: i64 = 1_000_000_000_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KasCreateInput {
    /// `YYYY-MM-DD` (local Asia/Jakarta date). Defaults to today on the
    /// frontend; never blank when sent.
    pub tanggal: String,
    pub keterangan: String,
    pub jenis: String,
    pub sumber: String,
    pub nominal: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KasUpdateInput {
    pub id: i64,
    pub tanggal: String,
    pub keterangan: String,
    pub jenis: String,
    pub sumber: String,
    pub nominal: i64,
}

/// Shape returned to the frontend on every successful mutation. Matches
/// `KasRow` in `commands/laporan.rs` so the UI can splice the result into
/// the cached `KasSummary.rows` list without an extra round-trip.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KasRow {
    pub id: i64,
    pub tanggal: String,
    pub keterangan: String,
    pub jenis: String,
    pub sumber: String,
    pub nominal: i64,
}

fn validate_create(input: &KasCreateInput) -> AppResult<()> {
    validate_common(&input.jenis, &input.sumber, input.nominal, &input.keterangan)?;
    validate_tanggal(&input.tanggal)
}

fn validate_update(input: &KasUpdateInput) -> AppResult<()> {
    if input.id <= 0 {
        return Err(AppError::Validation(format!("invalid id: {}", input.id)));
    }
    validate_common(&input.jenis, &input.sumber, input.nominal, &input.keterangan)?;
    validate_tanggal(&input.tanggal)
}

fn validate_common(jenis: &str, sumber: &str, nominal: i64, keterangan: &str) -> AppResult<()> {
    if !ALLOWED_JENIS.contains(&jenis) {
        return Err(AppError::Validation(format!(
            "invalid jenis: {jenis:?} (allowed: {})",
            ALLOWED_JENIS.join(", ")
        )));
    }
    if !ALLOWED_SUMBER.contains(&sumber) {
        return Err(AppError::Validation(format!(
            "invalid sumber: {sumber:?} (allowed: {})",
            ALLOWED_SUMBER.join(", ")
        )));
    }
    if nominal <= 0 || nominal > MAX_NOMINAL {
        return Err(AppError::Validation(format!(
            "nominal must be 1..={MAX_NOMINAL}: got {nominal}"
        )));
    }
    let trimmed = keterangan.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("keterangan must not be empty".into()));
    }
    if trimmed.chars().count() > MAX_KETERANGAN_LEN {
        return Err(AppError::Validation(format!(
            "keterangan too long: {} chars > {MAX_KETERANGAN_LEN}",
            trimmed.chars().count()
        )));
    }
    Ok(())
}

/// Reject anything that isn't `YYYY-MM-DD` so we don't silently store
/// `2026-13-99` strings the dashboard charts can't bucket.
fn validate_tanggal(tanggal: &str) -> AppResult<()> {
    let s = tanggal.trim();
    if s.len() != 10 {
        return Err(AppError::Validation(format!(
            "tanggal must be YYYY-MM-DD: {tanggal:?}"
        )));
    }
    let bytes = s.as_bytes();
    let dashes_ok = bytes[4] == b'-' && bytes[7] == b'-';
    let digits_ok = (0..10)
        .filter(|i| *i != 4 && *i != 7)
        .all(|i| bytes[i].is_ascii_digit());
    if !dashes_ok || !digits_ok {
        return Err(AppError::Validation(format!(
            "tanggal must be YYYY-MM-DD: {tanggal:?}"
        )));
    }
    Ok(())
}

/// Append a single audit-log entry. `detail` is a JSON object captured from
/// the caller — typically the pre/post snapshot of the kas row — and is
/// stored verbatim so the existing audit viewer can render diffs.
pub(crate) fn insert_audit_log(
    tx: &Connection,
    user_id: Option<i64>,
    aksi: &str,
    entitas: &str,
    entitas_id: Option<i64>,
    detail: &serde_json::Value,
) -> AppResult<()> {
    tx.execute(
        "INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, detail) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![user_id, aksi, entitas, entitas_id, detail.to_string()],
    )?;
    Ok(())
}

fn fetch_kas_row(conn: &Connection, id: i64) -> AppResult<KasRow> {
    let row = conn
        .query_row(
            "SELECT id, tanggal, keterangan, jenis, sumber, nominal \
             FROM kas WHERE id = ?1",
            params![id],
            |r| {
                Ok(KasRow {
                    id: r.get(0)?,
                    tanggal: r.get(1)?,
                    keterangan: r.get(2)?,
                    jenis: r.get(3)?,
                    sumber: r.get(4)?,
                    nominal: r.get(5)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("kas id {id}")))?;
    Ok(row)
}

pub(crate) fn kas_create_inner(
    conn: &mut Connection,
    input: &KasCreateInput,
    user_id: Option<i64>,
) -> AppResult<KasRow> {
    validate_create(input)?;

    let tx = conn.transaction()?;
    let keterangan = input.keterangan.trim();
    tx.execute(
        "INSERT INTO kas (tanggal, keterangan, jenis, nominal, sumber, petugas_id) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.tanggal.trim(),
            keterangan,
            input.jenis,
            input.nominal,
            input.sumber,
            user_id,
        ],
    )?;
    let id = tx.last_insert_rowid();

    let detail = json!({
        "after": {
            "tanggal": input.tanggal,
            "keterangan": keterangan,
            "jenis": input.jenis,
            "sumber": input.sumber,
            "nominal": input.nominal,
        }
    });
    insert_audit_log(&tx, user_id, "create", "kas", Some(id), &detail)?;
    tx.commit()?;

    fetch_kas_row(conn, id)
}

pub(crate) fn kas_update_inner(
    conn: &mut Connection,
    input: &KasUpdateInput,
    user_id: Option<i64>,
) -> AppResult<KasRow> {
    validate_update(input)?;
    let before = fetch_kas_row(conn, input.id)?;

    let tx = conn.transaction()?;
    let keterangan = input.keterangan.trim();
    let updated = tx.execute(
        "UPDATE kas SET tanggal = ?1, keterangan = ?2, jenis = ?3, \
                        sumber = ?4, nominal = ?5 \
         WHERE id = ?6",
        params![
            input.tanggal.trim(),
            keterangan,
            input.jenis,
            input.sumber,
            input.nominal,
            input.id,
        ],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound(format!("kas id {}", input.id)));
    }

    let detail = json!({
        "before": {
            "tanggal": before.tanggal,
            "keterangan": before.keterangan,
            "jenis": before.jenis,
            "sumber": before.sumber,
            "nominal": before.nominal,
        },
        "after": {
            "tanggal": input.tanggal,
            "keterangan": keterangan,
            "jenis": input.jenis,
            "sumber": input.sumber,
            "nominal": input.nominal,
        }
    });
    insert_audit_log(&tx, user_id, "update", "kas", Some(input.id), &detail)?;
    tx.commit()?;

    fetch_kas_row(conn, input.id)
}

pub(crate) fn kas_delete_inner(
    conn: &mut Connection,
    id: i64,
    user_id: Option<i64>,
) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::Validation(format!("invalid id: {id}")));
    }
    let before = fetch_kas_row(conn, id)?;

    let tx = conn.transaction()?;
    let deleted = tx.execute("DELETE FROM kas WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::NotFound(format!("kas id {id}")));
    }

    let detail = json!({
        "before": {
            "tanggal": before.tanggal,
            "keterangan": before.keterangan,
            "jenis": before.jenis,
            "sumber": before.sumber,
            "nominal": before.nominal,
        }
    });
    insert_audit_log(&tx, user_id, "delete", "kas", Some(id), &detail)?;
    tx.commit()?;
    Ok(())
}

fn current_user_id(state: &AppState) -> Option<i64> {
    state
        .current_user
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|u| u.id))
}

#[tauri::command]
pub fn kas_create(state: State<'_, AppState>, input: KasCreateInput) -> AppResult<KasRow> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    kas_create_inner(&mut conn, &input, user_id)
}

#[tauri::command]
pub fn kas_update(state: State<'_, AppState>, input: KasUpdateInput) -> AppResult<KasRow> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    kas_update_inner(&mut conn, &input, user_id)
}

#[tauri::command]
pub fn kas_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    kas_delete_inner(&mut conn, id, user_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign_keys");
        crate::db::run_migrations(&conn).expect("run migrations");
        conn
    }

    /// Insert a stub user with the given id so audit-log foreign keys
    /// (user_id → users.id) are satisfied during tests that exercise the
    /// "petugas attribution" path.
    fn seed_user(conn: &Connection, id: i64, username: &str) {
        conn.execute(
            "INSERT INTO users (id, username, password_hash, full_name, role, aktif) \
             VALUES (?1, ?2, '', ?3, 'admin', 1)",
            params![id, username, username],
        )
        .expect("seed user");
    }

    fn input(tanggal: &str, jenis: &str, sumber: &str, nominal: i64) -> KasCreateInput {
        KasCreateInput {
            tanggal: tanggal.into(),
            keterangan: format!("test {jenis} {sumber}"),
            jenis: jenis.into(),
            sumber: sumber.into(),
            nominal,
        }
    }

    #[test]
    fn create_persists_kas_row_and_writes_audit_log() {
        let mut conn = setup_db();
        let row = kas_create_inner(&mut conn, &input("2026-05-01", "masuk", "manual", 50_000), None)
            .expect("create");
        assert_eq!(row.tanggal, "2026-05-01");
        assert_eq!(row.jenis, "masuk");
        assert_eq!(row.sumber, "manual");
        assert_eq!(row.nominal, 50_000);

        let (aksi, entitas, entitas_id, detail): (String, String, Option<i64>, Option<String>) =
            conn.query_row(
                "SELECT aksi, entitas, entitas_id, detail FROM audit_log ORDER BY id DESC LIMIT 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .expect("read audit_log");
        assert_eq!(aksi, "create");
        assert_eq!(entitas, "kas");
        assert_eq!(entitas_id, Some(row.id));
        let detail = detail.expect("detail json");
        assert!(detail.contains("\"after\""));
        assert!(detail.contains("\"manual\""));
    }

    #[test]
    fn create_rejects_invalid_jenis_sumber_nominal_and_date() {
        let mut conn = setup_db();
        // jenis
        assert!(matches!(
            kas_create_inner(&mut conn, &input("2026-05-01", "tukar", "manual", 1), None),
            Err(AppError::Validation(_))
        ));
        // sumber
        assert!(matches!(
            kas_create_inner(&mut conn, &input("2026-05-01", "masuk", "haram", 1), None),
            Err(AppError::Validation(_))
        ));
        // nominal: zero
        assert!(matches!(
            kas_create_inner(&mut conn, &input("2026-05-01", "masuk", "manual", 0), None),
            Err(AppError::Validation(_))
        ));
        // nominal: negative
        assert!(matches!(
            kas_create_inner(&mut conn, &input("2026-05-01", "masuk", "manual", -10), None),
            Err(AppError::Validation(_))
        ));
        // tanggal
        assert!(matches!(
            kas_create_inner(&mut conn, &input("2026/05/01", "masuk", "manual", 1), None),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn create_rejects_blank_or_oversized_keterangan() {
        let mut conn = setup_db();
        let mut bad = input("2026-05-01", "masuk", "manual", 1);
        bad.keterangan = "   ".into();
        assert!(matches!(
            kas_create_inner(&mut conn, &bad, None),
            Err(AppError::Validation(_))
        ));
        bad.keterangan = "x".repeat(MAX_KETERANGAN_LEN + 1);
        assert!(matches!(
            kas_create_inner(&mut conn, &bad, None),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn update_rewrites_row_records_before_after_in_audit_log() {
        let mut conn = setup_db();
        seed_user(&conn, 7, "petugas7");
        let row = kas_create_inner(
            &mut conn,
            &input("2026-05-01", "masuk", "manual", 50_000),
            None,
        )
        .expect("create");

        let updated = kas_update_inner(
            &mut conn,
            &KasUpdateInput {
                id: row.id,
                tanggal: "2026-05-02".into(),
                keterangan: "after edit".into(),
                jenis: "keluar".into(),
                sumber: "manual".into(),
                nominal: 12_500,
            },
            Some(7),
        )
        .expect("update");
        assert_eq!(updated.tanggal, "2026-05-02");
        assert_eq!(updated.jenis, "keluar");
        assert_eq!(updated.nominal, 12_500);

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM audit_log WHERE entitas = 'kas' AND aksi = 'update'",
                [],
                |r| r.get(0),
            )
            .expect("count update audit");
        assert_eq!(count, 1, "exactly one update audit row");
        let (user_id, detail): (Option<i64>, String) = conn
            .query_row(
                "SELECT user_id, detail FROM audit_log \
                 WHERE entitas = 'kas' AND aksi = 'update' ORDER BY id DESC LIMIT 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("read audit");
        assert_eq!(user_id, Some(7));
        assert!(detail.contains("\"before\""));
        assert!(detail.contains("\"after\""));
    }

    #[test]
    fn update_returns_not_found_for_missing_id() {
        let mut conn = setup_db();
        let err = kas_update_inner(
            &mut conn,
            &KasUpdateInput {
                id: 99,
                tanggal: "2026-05-01".into(),
                keterangan: "x".into(),
                jenis: "masuk".into(),
                sumber: "manual".into(),
                nominal: 1,
            },
            None,
        )
        .expect_err("must reject missing id");
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn delete_removes_row_records_before_in_audit_log() {
        let mut conn = setup_db();
        seed_user(&conn, 3, "petugas3");
        let row = kas_create_inner(
            &mut conn,
            &input("2026-05-01", "keluar", "manual", 10_000),
            None,
        )
        .expect("create");
        kas_delete_inner(&mut conn, row.id, Some(3)).expect("delete");

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM kas WHERE id = ?1",
                params![row.id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(exists, 0, "kas row deleted");

        let detail: String = conn
            .query_row(
                "SELECT detail FROM audit_log \
                 WHERE entitas = 'kas' AND aksi = 'delete' ORDER BY id DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .expect("read audit");
        assert!(detail.contains("\"before\""));
        assert!(detail.contains("\"keluar\""));
    }

    #[test]
    fn delete_returns_not_found_for_missing_id() {
        let mut conn = setup_db();
        let err = kas_delete_inner(&mut conn, 999, None).expect_err("must reject");
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn allows_editing_auto_generated_denda_rows() {
        // Auto-generated rows from peminjaman_kembalikan use sumber='denda';
        // operators must be able to fix typos there too. Bypass kas_create_inner
        // to plant a denda-flavoured row and confirm it edits cleanly.
        let mut conn = setup_db();
        conn.execute(
            "INSERT INTO kas (tanggal, keterangan, jenis, nominal, sumber, referensi_id, referensi_tipe) \
             VALUES ('2026-05-01', 'Denda pengembalian #1 ', 'masuk', 10000, 'denda', 1, 'peminjaman')",
            [],
        )
        .expect("seed denda row");
        let id = conn.last_insert_rowid();

        let edited = kas_update_inner(
            &mut conn,
            &KasUpdateInput {
                id,
                tanggal: "2026-05-01".into(),
                keterangan: "Denda pengembalian #1 (koreksi)".into(),
                jenis: "masuk".into(),
                sumber: "denda".into(),
                nominal: 5_000,
            },
            None,
        )
        .expect("edit denda row allowed");
        assert_eq!(edited.nominal, 5_000);
        assert!(edited.keterangan.contains("koreksi"));
    }
}
