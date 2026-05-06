//! Stocktake / Opname mode (FEAT-23, v1.0.8).
//!
//! Flow:
//! 1. Admin starts a session → creates `stocktake_session` row with status
//!    `berlangsung` and snapshots all current `eksemplar` rows into
//!    `stocktake_item` (one row per eksemplar, default `belum_scan`).
//! 2. Admin scans barcodes one by one → each scan looks up the eksemplar
//!    by `kode_eksemplar`, then flips its `stocktake_item` row to
//!    `ditemukan` with current timestamp.
//! 3. Admin clicks "Selesaikan" → session status flips to `selesai`,
//!    `tanggal_selesai` populated. Eksemplar still `belum_scan` are
//!    treated as "missing" for the report.
//!
//! Sessions are resumeable (open while `berlangsung`), and multiple
//! parallel sessions are allowed (audit-trail-style).

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeSessionRow {
    pub id: i64,
    pub nama: Option<String>,
    pub tanggal_mulai: String,
    pub tanggal_selesai: Option<String>,
    pub status: String,
    pub catatan: Option<String>,
    pub petugas_id: Option<i64>,
    pub petugas_nama: Option<String>,
    pub total: i64,
    pub ditemukan: i64,
    pub missing: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeItemRow {
    pub id: i64,
    pub session_id: i64,
    pub eksemplar_id: i64,
    pub eksemplar_kode: String,
    pub buku_id: i64,
    pub buku_judul: String,
    pub buku_pengarang: Option<String>,
    pub status: String,
    pub eksemplar_status: String,
    pub tanggal_scan: Option<String>,
    pub catatan: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeStartInput {
    pub nama: Option<String>,
    pub catatan: Option<String>,
    pub petugas_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeScanInput {
    pub session_id: i64,
    pub kode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeScanResult {
    pub item: StocktakeItemRow,
    pub already_scanned: bool,
    pub session: StocktakeSessionRow,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeListArgs {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeItemListArgs {
    pub session_id: i64,
    pub status: Option<String>,
    pub query: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StocktakeFinishInput {
    pub session_id: i64,
    pub status: Option<String>, // selesai (default) | dibatalkan
    pub catatan: Option<String>,
}

const ALLOWED_FINISH_STATUSES: &[&str] = &["selesai", "dibatalkan"];

fn load_session(
    conn: &rusqlite::Connection,
    session_id: i64,
) -> AppResult<StocktakeSessionRow> {
    let row = conn
        .query_row(
            r#"SELECT s.id,
                      s.nama,
                      s.tanggal_mulai,
                      s.tanggal_selesai,
                      s.status,
                      s.catatan,
                      s.petugas_id,
                      u.full_name,
                      (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id) AS total,
                      (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id
                          AND i.status = 'ditemukan') AS ditemukan,
                      (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id
                          AND i.status <> 'ditemukan') AS missing
                 FROM stocktake_session s
                 LEFT JOIN users u ON u.id = s.petugas_id
                WHERE s.id = ?1"#,
            params![session_id],
            |row| {
                Ok(StocktakeSessionRow {
                    id: row.get(0)?,
                    nama: row.get(1)?,
                    tanggal_mulai: row.get(2)?,
                    tanggal_selesai: row.get(3)?,
                    status: row.get(4)?,
                    catatan: row.get(5)?,
                    petugas_id: row.get(6)?,
                    petugas_nama: row.get(7)?,
                    total: row.get(8)?,
                    ditemukan: row.get(9)?,
                    missing: row.get(10)?,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    row.ok_or_else(|| AppError::NotFound(format!("stocktake_session {session_id} not found")))
}

#[tauri::command]
pub fn stocktake_start(
    state: State<'_, AppState>,
    input: StocktakeStartInput,
) -> AppResult<StocktakeSessionRow> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let nama = input.nama.as_deref().map(str::trim).map(str::to_owned);
    let catatan = input.catatan.as_deref().map(str::trim).map(str::to_owned);
    let petugas = input.petugas_id;

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.execute(
        "INSERT INTO stocktake_session (nama, catatan, petugas_id, status)
         VALUES (?1, ?2, ?3, 'berlangsung')",
        params![nama, catatan, petugas],
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;
    let session_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO stocktake_item (session_id, eksemplar_id, status)
         SELECT ?1, e.id, 'belum_scan' FROM eksemplar e",
        params![session_id],
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.commit()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    load_session(&conn, session_id)
}

#[tauri::command]
pub fn stocktake_session_list(
    state: State<'_, AppState>,
    args: Option<StocktakeListArgs>,
) -> AppResult<Vec<StocktakeSessionRow>> {
    let args = args.unwrap_or_default();
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = args.limit.unwrap_or(100).clamp(1, 500);
    let offset = args.offset.unwrap_or(0).max(0);
    let mut sql = String::from(
        r#"SELECT s.id,
                  s.nama,
                  s.tanggal_mulai,
                  s.tanggal_selesai,
                  s.status,
                  s.catatan,
                  s.petugas_id,
                  u.full_name,
                  (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id) AS total,
                  (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id
                      AND i.status = 'ditemukan') AS ditemukan,
                  (SELECT COUNT(*) FROM stocktake_item i WHERE i.session_id = s.id
                      AND i.status <> 'ditemukan') AS missing
             FROM stocktake_session s
             LEFT JOIN users u ON u.id = s.petugas_id"#,
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(status) = args
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sql.push_str(" WHERE s.status = ?1");
        params_vec.push(Box::new(status.to_string()));
    }
    sql.push_str(" ORDER BY s.id DESC LIMIT ");
    sql.push_str(&limit.to_string());
    sql.push_str(" OFFSET ");
    sql.push_str(&offset.to_string());

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(StocktakeSessionRow {
                id: row.get(0)?,
                nama: row.get(1)?,
                tanggal_mulai: row.get(2)?,
                tanggal_selesai: row.get(3)?,
                status: row.get(4)?,
                catatan: row.get(5)?,
                petugas_id: row.get(6)?,
                petugas_nama: row.get(7)?,
                total: row.get(8)?,
                ditemukan: row.get(9)?,
                missing: row.get(10)?,
            })
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| AppError::Internal(e.to_string()))?);
    }
    Ok(out)
}

#[tauri::command]
pub fn stocktake_session_get(
    state: State<'_, AppState>,
    session_id: i64,
) -> AppResult<StocktakeSessionRow> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    load_session(&conn, session_id)
}

#[tauri::command]
pub fn stocktake_item_list(
    state: State<'_, AppState>,
    args: StocktakeItemListArgs,
) -> AppResult<Vec<StocktakeItemRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = args.limit.unwrap_or(500).clamp(1, 5000);
    let offset = args.offset.unwrap_or(0).max(0);
    let q = args
        .query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{s}%"));
    let mut sql = String::from(
        r#"SELECT i.id,
                  i.session_id,
                  i.eksemplar_id,
                  e.kode_eksemplar,
                  b.id   AS buku_id,
                  b.judul,
                  b.pengarang,
                  i.status,
                  e.status AS eksemplar_status,
                  i.tanggal_scan,
                  i.catatan
             FROM stocktake_item i
             JOIN eksemplar e ON e.id = i.eksemplar_id
             JOIN buku       b ON b.id = e.buku_id
            WHERE i.session_id = ?1"#,
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> =
        vec![Box::new(args.session_id)];
    if let Some(status) = args
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sql.push_str(" AND i.status = ?");
        sql.push_str(&(params_vec.len() + 1).to_string());
        params_vec.push(Box::new(status.to_string()));
    }
    if let Some(q) = q.as_deref() {
        sql.push_str(" AND (e.kode_eksemplar LIKE ?");
        sql.push_str(&(params_vec.len() + 1).to_string());
        sql.push_str(" OR b.judul LIKE ?");
        sql.push_str(&(params_vec.len() + 1).to_string());
        sql.push(')');
        params_vec.push(Box::new(q.to_string()));
    }
    sql.push_str(" ORDER BY (i.status = 'ditemukan'), b.judul COLLATE NOCASE, e.kode_eksemplar");
    sql.push_str(" LIMIT ");
    sql.push_str(&limit.to_string());
    sql.push_str(" OFFSET ");
    sql.push_str(&offset.to_string());

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(StocktakeItemRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                eksemplar_id: row.get(2)?,
                eksemplar_kode: row.get(3)?,
                buku_id: row.get(4)?,
                buku_judul: row.get(5)?,
                buku_pengarang: row.get(6)?,
                status: row.get(7)?,
                eksemplar_status: row.get(8)?,
                tanggal_scan: row.get(9)?,
                catatan: row.get(10)?,
            })
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| AppError::Internal(e.to_string()))?);
    }
    Ok(out)
}

#[tauri::command]
pub fn stocktake_scan(
    state: State<'_, AppState>,
    input: StocktakeScanInput,
) -> AppResult<StocktakeScanResult> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let kode = input.kode.trim().to_string();
    if kode.is_empty() {
        return Err(AppError::Validation("kode eksemplar tidak boleh kosong".to_string()));
    }

    let session_status: String = conn
        .query_row(
            "SELECT status FROM stocktake_session WHERE id = ?1",
            params![input.session_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| {
            AppError::NotFound(format!("stocktake_session {} not found", input.session_id))
        })?;
    if session_status != "berlangsung" {
        return Err(AppError::Validation(format!(
            "sesi stocktake sudah {session_status}, tidak bisa scan lagi"
        )));
    }

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let eksemplar_id: Option<i64> = tx
        .query_row(
            "SELECT id FROM eksemplar WHERE kode_eksemplar = ?1",
            params![kode],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let eksemplar_id = eksemplar_id.ok_or_else(|| {
        AppError::NotFound(format!("eksemplar dengan kode '{kode}' tidak ditemukan"))
    })?;

    // Try to update existing snapshot row first.
    let already_scanned: bool = tx
        .query_row(
            "SELECT status = 'ditemukan' FROM stocktake_item
              WHERE session_id = ?1 AND eksemplar_id = ?2",
            params![input.session_id, eksemplar_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .unwrap_or(false);

    let updated = tx
        .execute(
            "UPDATE stocktake_item
                SET status = 'ditemukan',
                    tanggal_scan = COALESCE(tanggal_scan, datetime('now'))
              WHERE session_id = ?1 AND eksemplar_id = ?2",
            params![input.session_id, eksemplar_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if updated == 0 {
        // Eksemplar created after session start — insert a fresh row.
        tx.execute(
            "INSERT INTO stocktake_item (session_id, eksemplar_id, status, tanggal_scan)
             VALUES (?1, ?2, 'ditemukan', datetime('now'))",
            params![input.session_id, eksemplar_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    tx.commit()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let item = stocktake_item_for(&conn, input.session_id, eksemplar_id)?;
    let session = load_session(&conn, input.session_id)?;
    Ok(StocktakeScanResult {
        item,
        already_scanned,
        session,
    })
}

fn stocktake_item_for(
    conn: &rusqlite::Connection,
    session_id: i64,
    eksemplar_id: i64,
) -> AppResult<StocktakeItemRow> {
    conn.query_row(
        r#"SELECT i.id,
                  i.session_id,
                  i.eksemplar_id,
                  e.kode_eksemplar,
                  b.id   AS buku_id,
                  b.judul,
                  b.pengarang,
                  i.status,
                  e.status AS eksemplar_status,
                  i.tanggal_scan,
                  i.catatan
             FROM stocktake_item i
             JOIN eksemplar e ON e.id = i.eksemplar_id
             JOIN buku       b ON b.id = e.buku_id
            WHERE i.session_id = ?1 AND i.eksemplar_id = ?2"#,
        params![session_id, eksemplar_id],
        |row| {
            Ok(StocktakeItemRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                eksemplar_id: row.get(2)?,
                eksemplar_kode: row.get(3)?,
                buku_id: row.get(4)?,
                buku_judul: row.get(5)?,
                buku_pengarang: row.get(6)?,
                status: row.get(7)?,
                eksemplar_status: row.get(8)?,
                tanggal_scan: row.get(9)?,
                catatan: row.get(10)?,
            })
        },
    )
    .map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
pub fn stocktake_finish(
    state: State<'_, AppState>,
    input: StocktakeFinishInput,
) -> AppResult<StocktakeSessionRow> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let status = input.status.as_deref().unwrap_or("selesai").to_string();
    if !ALLOWED_FINISH_STATUSES.contains(&status.as_str()) {
        return Err(AppError::Validation(format!(
            "status finish '{status}' tidak valid (selesai|dibatalkan)"
        )));
    }
    let session_status: String = conn
        .query_row(
            "SELECT status FROM stocktake_session WHERE id = ?1",
            params![input.session_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| {
            AppError::NotFound(format!("stocktake_session {} not found", input.session_id))
        })?;
    if session_status != "berlangsung" {
        return Err(AppError::Validation(format!(
            "sesi stocktake sudah {session_status}, tidak bisa difinalisasi lagi"
        )));
    }
    let tx = conn
        .transaction()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    tx.execute(
        "UPDATE stocktake_session
            SET status = ?2,
                tanggal_selesai = datetime('now'),
                catatan = COALESCE(?3, catatan)
          WHERE id = ?1",
        params![input.session_id, status, input.catatan],
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if status == "selesai" {
        // Mark all unscanned snapshot rows as `tidak_ditemukan` for the report.
        tx.execute(
            "UPDATE stocktake_item SET status = 'tidak_ditemukan'
              WHERE session_id = ?1 AND status = 'belum_scan'",
            params![input.session_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    tx.commit()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    load_session(&conn, input.session_id)
}

#[tauri::command]
pub fn stocktake_session_delete(state: State<'_, AppState>, session_id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "DELETE FROM stocktake_session WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::load_session;
    use crate::db::run_migrations;
    use rusqlite::{params, Connection};

    // Stocktake tests exercise the DB layer directly to keep them fast and
    // independent of the Tauri runtime. The Tauri `State` wrappers above are
    // covered by the e2e harness.

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory");
        run_migrations(&conn).expect("migrations");
        conn
    }

    fn seed_buku(conn: &Connection, count: usize) -> Vec<i64> {
        conn.execute(
            "INSERT INTO buku (judul, pengarang, kode_buku, jumlah_eksemplar)
             VALUES ('Buku Test', 'Penulis', 'B0001', ?1)",
            params![count as i64],
        )
        .expect("insert buku");
        let buku_id = conn.last_insert_rowid();
        let mut ids = Vec::new();
        for i in 0..count {
            let kode = format!("B0001-{:02}", i + 1);
            conn.execute(
                "INSERT INTO eksemplar (buku_id, kode_eksemplar) VALUES (?1, ?2)",
                params![buku_id, kode],
            )
            .expect("insert eksemplar");
            ids.push(conn.last_insert_rowid());
        }
        ids
    }

    fn start_session(conn: &mut Connection) -> i64 {
        let tx = conn.transaction().unwrap();
        tx.execute(
            "INSERT INTO stocktake_session (status) VALUES ('berlangsung')",
            [],
        )
        .unwrap();
        let id = tx.last_insert_rowid();
        tx.execute(
            "INSERT INTO stocktake_item (session_id, eksemplar_id, status)
             SELECT ?1, e.id, 'belum_scan' FROM eksemplar e",
            params![id],
        )
        .unwrap();
        tx.commit().unwrap();
        id
    }

    #[test]
    fn start_session_snapshots_all_eksemplar() {
        let mut conn = fresh_conn();
        seed_buku(&conn, 5);
        let id = start_session(&mut conn);
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(total, 5);
        let belum: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1 AND status = 'belum_scan'",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(belum, 5);
    }

    #[test]
    fn scan_marks_item_ditemukan() {
        let mut conn = fresh_conn();
        let eks_ids = seed_buku(&conn, 3);
        let session_id = start_session(&mut conn);
        let updated = conn
            .execute(
                "UPDATE stocktake_item
                    SET status = 'ditemukan', tanggal_scan = datetime('now')
                  WHERE session_id = ?1 AND eksemplar_id = ?2",
                params![session_id, eks_ids[0]],
            )
            .unwrap();
        assert_eq!(updated, 1);
        let status: String = conn
            .query_row(
                "SELECT status FROM stocktake_item WHERE session_id = ?1 AND eksemplar_id = ?2",
                params![session_id, eks_ids[0]],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "ditemukan");
    }

    #[test]
    fn finish_marks_unscanned_as_tidak_ditemukan() {
        let mut conn = fresh_conn();
        let eks_ids = seed_buku(&conn, 4);
        let session_id = start_session(&mut conn);
        // Scan 2 of 4
        for id in &eks_ids[..2] {
            conn.execute(
                "UPDATE stocktake_item SET status = 'ditemukan', tanggal_scan = datetime('now')
                  WHERE session_id = ?1 AND eksemplar_id = ?2",
                params![session_id, id],
            )
            .unwrap();
        }
        // Finish: flip unscanned -> tidak_ditemukan
        conn.execute(
            "UPDATE stocktake_session SET status = 'selesai', tanggal_selesai = datetime('now')
              WHERE id = ?1",
            params![session_id],
        )
        .unwrap();
        conn.execute(
            "UPDATE stocktake_item SET status = 'tidak_ditemukan'
              WHERE session_id = ?1 AND status = 'belum_scan'",
            params![session_id],
        )
        .unwrap();
        let missing: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1
                  AND status = 'tidak_ditemukan'",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(missing, 2);
        let ditemukan: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1 AND status = 'ditemukan'",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(ditemukan, 2);
    }

    #[test]
    fn unique_session_eksemplar_constraint_prevents_duplicates() {
        let mut conn = fresh_conn();
        let eks_ids = seed_buku(&conn, 2);
        let session_id = start_session(&mut conn);
        let res = conn.execute(
            "INSERT INTO stocktake_item (session_id, eksemplar_id, status)
             VALUES (?1, ?2, 'belum_scan')",
            params![session_id, eks_ids[0]],
        );
        assert!(res.is_err(), "duplicate insert should violate UNIQUE constraint");
    }

    #[test]
    fn cascade_delete_session_removes_items() {
        let mut conn = fresh_conn();
        seed_buku(&conn, 3);
        let session_id = start_session(&mut conn);
        let count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_before, 3);
        conn.execute("DELETE FROM stocktake_session WHERE id = ?1", params![session_id])
            .unwrap();
        let count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_after, 0);
    }

    #[test]
    fn multiple_parallel_sessions_isolated() {
        let mut conn = fresh_conn();
        seed_buku(&conn, 2);
        let s1 = start_session(&mut conn);
        let s2 = start_session(&mut conn);
        // Scan eksemplar 1 in session s1 only
        conn.execute(
            "UPDATE stocktake_item SET status = 'ditemukan'
              WHERE session_id = ?1 AND eksemplar_id = (SELECT id FROM eksemplar LIMIT 1)",
            params![s1],
        )
        .unwrap();
        let s1_done: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1 AND status = 'ditemukan'",
                params![s1],
                |row| row.get(0),
            )
            .unwrap();
        let s2_done: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_item WHERE session_id = ?1 AND status = 'ditemukan'",
                params![s2],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(s1_done, 1);
        assert_eq!(s2_done, 0);
    }

    /// Regression test for the v1.0.8 stocktake bug where `load_session` and
    /// `stocktake_session_list` referenced `u.nama_lengkap` instead of
    /// `u.full_name`, causing every Mulai-Sesi click to fail with
    /// `no such column: u.nama_lengkap`.
    #[test]
    fn load_session_joins_users_full_name() {
        let mut conn = fresh_conn();
        seed_buku(&conn, 2);
        // Seed a petugas in `users` so the LEFT JOIN actually has a row to
        // hit (pre-fix, even a NULL petugas_id triggered the column error
        // because SQLite parses the SELECT list before walking the join).
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role, aktif)
             VALUES ('petugas1', 'x', 'Pak Petugas', 'pustakawan', 1)",
            [],
        )
        .unwrap();
        let petugas_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO stocktake_session (nama, status, petugas_id)
             VALUES ('Opname 2026', 'berlangsung', ?1)",
            params![petugas_id],
        )
        .unwrap();
        let session_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO stocktake_item (session_id, eksemplar_id, status)
             SELECT ?1, e.id, 'belum_scan' FROM eksemplar e",
            params![session_id],
        )
        .unwrap();

        let row = load_session(&conn, session_id).expect("load_session must succeed");
        assert_eq!(row.id, session_id);
        assert_eq!(row.nama.as_deref(), Some("Opname 2026"));
        assert_eq!(row.petugas_id, Some(petugas_id));
        assert_eq!(row.petugas_nama.as_deref(), Some("Pak Petugas"));
        assert_eq!(row.total, 2);
        assert_eq!(row.ditemukan, 0);
        assert_eq!(row.missing, 2);
    }

    #[test]
    fn load_session_handles_null_petugas() {
        let mut conn = fresh_conn();
        seed_buku(&conn, 1);
        let session_id = start_session(&mut conn);
        let row = load_session(&conn, session_id).expect("load_session must succeed");
        assert_eq!(row.petugas_id, None);
        assert_eq!(row.petugas_nama, None);
    }

}
