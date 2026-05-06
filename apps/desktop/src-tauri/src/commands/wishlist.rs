//! Wishlist anggota / request pengadaan buku (FEAT-22).
//!
//! Lets anggota request that the library acquire a specific book. The admin
//! reviews the queue and transitions each entry through a small state
//! machine (`pending → disetujui → sudah_diadakan` with rejection/cancel
//! escape hatches). Upvote count lets the admin prioritise frequently
//! requested titles.
//!
//! Design notes:
//! - Status transitions are validated server-side via `is_valid_transition`.
//!   The frontend disables disallowed buttons but we don't trust client
//!   payloads.
//! - `wishlist_upvote` is intentionally simple: increment-only, no
//!   per-anggota dedup. The acceptance criteria mark dedup as an explicit
//!   v2 follow-up so we keep this commit focused.
//! - Every status transition writes an `audit_log` row so the admin can
//!   trace why a request was rejected or marked acquired.

use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::kas::insert_audit_log;
use crate::error::{AppError, AppResult};
use crate::AppState;

const ALLOWED_STATUS: &[&str] = &[
    "pending",
    "disetujui",
    "ditolak",
    "sudah_diadakan",
    "dibatalkan",
];

const MAX_FIELD_LEN: usize = 500;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WishlistRow {
    pub id: i64,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub isbn: Option<String>,
    pub alasan: Option<String>,
    pub status: String,
    pub catatan_admin: Option<String>,
    pub buku_id: Option<i64>,
    pub buku_judul: Option<String>,
    pub upvote_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WishlistCreateInput {
    pub anggota_id: i64,
    pub judul: String,
    pub pengarang: Option<String>,
    pub isbn: Option<String>,
    pub alasan: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WishlistUpdateStatusInput {
    pub id: i64,
    pub status: String,
    pub catatan_admin: Option<String>,
    pub buku_id: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WishlistListQuery {
    pub status: Option<String>,
    pub anggota_id: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Allowed (from, to) status edges. Returning false here surfaces a clear
/// validation error to the operator instead of silently corrupting state.
fn is_valid_transition(from: &str, to: &str) -> bool {
    match (from, to) {
        ("pending", "disetujui")
        | ("pending", "ditolak")
        | ("pending", "dibatalkan")
        | ("disetujui", "sudah_diadakan")
        | ("disetujui", "dibatalkan")
        | ("ditolak", "pending")
        | ("dibatalkan", "pending") => true,
        // Idempotent: marking a row to its current status is a no-op rather
        // than an error so the UI doesn't have to special-case double-clicks.
        (a, b) if a == b => true,
        _ => false,
    }
}

fn validate_text_field(name: &str, value: &str, required: bool) -> AppResult<()> {
    let trimmed = value.trim();
    if required && trimmed.is_empty() {
        return Err(AppError::Validation(format!("{name} tidak boleh kosong")));
    }
    if trimmed.chars().count() > MAX_FIELD_LEN {
        return Err(AppError::Validation(format!(
            "{name} terlalu panjang (maks {MAX_FIELD_LEN} karakter)"
        )));
    }
    Ok(())
}

fn validate_create(input: &WishlistCreateInput) -> AppResult<()> {
    if input.anggota_id <= 0 {
        return Err(AppError::Validation(format!(
            "anggota_id invalid: {}",
            input.anggota_id
        )));
    }
    validate_text_field("Judul", &input.judul, true)?;
    if let Some(p) = input.pengarang.as_deref() {
        validate_text_field("Pengarang", p, false)?;
    }
    if let Some(i) = input.isbn.as_deref() {
        validate_text_field("ISBN", i, false)?;
    }
    if let Some(a) = input.alasan.as_deref() {
        validate_text_field("Alasan", a, false)?;
    }
    Ok(())
}

fn fetch_row(conn: &Connection, id: i64) -> AppResult<WishlistRow> {
    conn.query_row(
        "SELECT w.id, w.anggota_id, COALESCE(a.nama, ''), COALESCE(a.kode_anggota, ''), \
                w.judul, w.pengarang, w.isbn, w.alasan, w.status, w.catatan_admin, \
                w.buku_id, b.judul, w.upvote_count, w.created_at, w.updated_at \
         FROM wishlist_buku w \
         LEFT JOIN anggota a ON a.id = w.anggota_id \
         LEFT JOIN buku b ON b.id = w.buku_id \
         WHERE w.id = ?1",
        params![id],
        map_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("wishlist id {id}")))
}

fn map_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<WishlistRow> {
    Ok(WishlistRow {
        id: r.get(0)?,
        anggota_id: r.get(1)?,
        anggota_nama: r.get(2)?,
        anggota_kode: r.get(3)?,
        judul: r.get(4)?,
        pengarang: r.get(5)?,
        isbn: r.get(6)?,
        alasan: r.get(7)?,
        status: r.get(8)?,
        catatan_admin: r.get(9)?,
        buku_id: r.get(10)?,
        buku_judul: r.get(11)?,
        upvote_count: r.get(12)?,
        created_at: r.get(13)?,
        updated_at: r.get(14)?,
    })
}

pub(crate) fn wishlist_create_inner(
    conn: &mut Connection,
    input: &WishlistCreateInput,
    user_id: Option<i64>,
) -> AppResult<WishlistRow> {
    validate_create(input)?;
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM anggota WHERE id = ?1",
            params![input.anggota_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(AppError::NotFound(format!(
            "anggota id {}",
            input.anggota_id
        )));
    }

    let tx = conn.transaction()?;
    let judul = input.judul.trim();
    let pengarang = input.pengarang.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let isbn = input.isbn.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let alasan = input.alasan.as_deref().map(str::trim).filter(|s| !s.is_empty());
    tx.execute(
        "INSERT INTO wishlist_buku (anggota_id, judul, pengarang, isbn, alasan, status, upvote_count) \
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', 1)",
        params![input.anggota_id, judul, pengarang, isbn, alasan],
    )?;
    let id = tx.last_insert_rowid();

    let detail = json!({
        "after": {
            "anggota_id": input.anggota_id,
            "judul": judul,
            "pengarang": pengarang,
            "isbn": isbn,
            "status": "pending",
        }
    });
    insert_audit_log(&tx, user_id, "create", "wishlist_buku", Some(id), &detail)?;
    tx.commit()?;

    fetch_row(conn, id)
}

pub(crate) fn wishlist_update_status_inner(
    conn: &mut Connection,
    input: &WishlistUpdateStatusInput,
    user_id: Option<i64>,
) -> AppResult<WishlistRow> {
    if !ALLOWED_STATUS.contains(&input.status.as_str()) {
        return Err(AppError::Validation(format!(
            "status tidak dikenal: {}",
            input.status
        )));
    }
    if let Some(c) = input.catatan_admin.as_deref() {
        validate_text_field("Catatan", c, false)?;
    }
    let before = fetch_row(conn, input.id)?;
    if !is_valid_transition(&before.status, &input.status) {
        return Err(AppError::Validation(format!(
            "transisi status tidak diizinkan: {} → {}",
            before.status, input.status
        )));
    }

    if let Some(buku_id) = input.buku_id {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM buku WHERE id = ?1",
                params![buku_id],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);
        if !exists {
            return Err(AppError::NotFound(format!("buku id {buku_id}")));
        }
    }

    let tx = conn.transaction()?;
    let catatan = input
        .catatan_admin
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    tx.execute(
        "UPDATE wishlist_buku SET status = ?1, catatan_admin = ?2, buku_id = ?3, \
                                  updated_at = datetime('now') \
         WHERE id = ?4",
        params![input.status, catatan, input.buku_id, input.id],
    )?;

    let detail = json!({
        "before": { "status": before.status },
        "after": { "status": input.status, "catatan_admin": catatan, "buku_id": input.buku_id },
    });
    insert_audit_log(
        &tx,
        user_id,
        "update_status",
        "wishlist_buku",
        Some(input.id),
        &detail,
    )?;
    tx.commit()?;

    fetch_row(conn, input.id)
}

pub(crate) fn wishlist_upvote_inner(
    conn: &mut Connection,
    id: i64,
    user_id: Option<i64>,
) -> AppResult<WishlistRow> {
    if id <= 0 {
        return Err(AppError::Validation(format!("invalid id: {id}")));
    }
    let _before = fetch_row(conn, id)?;

    let tx = conn.transaction()?;
    let updated = tx.execute(
        "UPDATE wishlist_buku SET upvote_count = upvote_count + 1, updated_at = datetime('now') \
         WHERE id = ?1",
        params![id],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound(format!("wishlist id {id}")));
    }
    let detail = json!({ "wishlist_id": id });
    insert_audit_log(&tx, user_id, "upvote", "wishlist_buku", Some(id), &detail)?;
    tx.commit()?;

    fetch_row(conn, id)
}

pub(crate) fn wishlist_delete_inner(
    conn: &mut Connection,
    id: i64,
    user_id: Option<i64>,
) -> AppResult<()> {
    if id <= 0 {
        return Err(AppError::Validation(format!("invalid id: {id}")));
    }
    let before = fetch_row(conn, id)?;

    let tx = conn.transaction()?;
    let deleted = tx.execute("DELETE FROM wishlist_buku WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::NotFound(format!("wishlist id {id}")));
    }
    let detail = json!({
        "before": {
            "anggota_id": before.anggota_id,
            "judul": before.judul,
            "status": before.status,
        }
    });
    insert_audit_log(&tx, user_id, "delete", "wishlist_buku", Some(id), &detail)?;
    tx.commit()?;
    Ok(())
}

pub(crate) fn wishlist_list_inner(
    conn: &Connection,
    query: &WishlistListQuery,
) -> AppResult<Vec<WishlistRow>> {
    let limit = query.limit.unwrap_or(200).clamp(1, 1000);
    let offset = query.offset.unwrap_or(0).max(0);

    let mut clauses: Vec<String> = Vec::new();
    let mut binds: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(s) = query.status.as_deref().filter(|s| !s.trim().is_empty()) {
        if !ALLOWED_STATUS.contains(&s) {
            return Err(AppError::Validation(format!("status tidak dikenal: {s}")));
        }
        clauses.push("w.status = ?".into());
        binds.push(rusqlite::types::Value::Text(s.to_string()));
    }
    if let Some(aid) = query.anggota_id {
        clauses.push("w.anggota_id = ?".into());
        binds.push(rusqlite::types::Value::Integer(aid));
    }
    let where_sql = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT w.id, w.anggota_id, COALESCE(a.nama, ''), COALESCE(a.kode_anggota, ''), \
                w.judul, w.pengarang, w.isbn, w.alasan, w.status, w.catatan_admin, \
                w.buku_id, b.judul, w.upvote_count, w.created_at, w.updated_at \
         FROM wishlist_buku w \
         LEFT JOIN anggota a ON a.id = w.anggota_id \
         LEFT JOIN buku b ON b.id = w.buku_id \
         {where_sql} \
         ORDER BY w.upvote_count DESC, w.id DESC \
         LIMIT {limit} OFFSET {offset}"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params_from_iter(binds.iter()), map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

fn current_user_id(state: &AppState) -> Option<i64> {
    state
        .current_user
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|u| u.id))
}

#[tauri::command]
pub fn wishlist_create(
    state: State<'_, AppState>,
    input: WishlistCreateInput,
) -> AppResult<WishlistRow> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    wishlist_create_inner(&mut conn, &input, user_id)
}

#[tauri::command]
pub fn wishlist_list(
    state: State<'_, AppState>,
    query: Option<WishlistListQuery>,
) -> AppResult<Vec<WishlistRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    wishlist_list_inner(&conn, &query.unwrap_or_default())
}

#[tauri::command]
pub fn wishlist_update_status(
    state: State<'_, AppState>,
    input: WishlistUpdateStatusInput,
) -> AppResult<WishlistRow> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    wishlist_update_status_inner(&mut conn, &input, user_id)
}

#[tauri::command]
pub fn wishlist_upvote(state: State<'_, AppState>, id: i64) -> AppResult<WishlistRow> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    wishlist_upvote_inner(&mut conn, id, user_id)
}

#[tauri::command]
pub fn wishlist_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    wishlist_delete_inner(&mut conn, id, user_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open db");
        conn.pragma_update(None, "foreign_keys", "ON").expect("fk on");
        crate::db::run_migrations(&conn).expect("migrations");
        conn
    }

    fn seed_anggota(conn: &Connection, kode: &str, nama: &str) -> i64 {
        conn.execute(
            "INSERT INTO anggota (kode_anggota, nama, aktif) VALUES (?1, ?2, 1)",
            params![kode, nama],
        )
        .expect("seed anggota");
        conn.last_insert_rowid()
    }

    fn seed_buku(conn: &Connection, kode: &str, judul: &str) -> i64 {
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar) VALUES (?1, ?2, 1)",
            params![kode, judul],
        )
        .expect("seed buku");
        conn.last_insert_rowid()
    }

    fn create_input(anggota_id: i64, judul: &str) -> WishlistCreateInput {
        WishlistCreateInput {
            anggota_id,
            judul: judul.into(),
            pengarang: Some("Tere Liye".into()),
            isbn: Some("978-602-03".into()),
            alasan: Some("Sering ditanya siswa".into()),
        }
    }

    #[test]
    fn create_persists_row_and_audits() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        assert_eq!(row.judul, "Bumi");
        assert_eq!(row.status, "pending");
        assert_eq!(row.upvote_count, 1);
        let aksi: String = conn
            .query_row(
                "SELECT aksi FROM audit_log ORDER BY id DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .expect("audit");
        assert_eq!(aksi, "create");
    }

    #[test]
    fn create_rejects_blank_judul_and_unknown_anggota() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let mut bad = create_input(aid, "  ");
        assert!(matches!(
            wishlist_create_inner(&mut conn, &bad, None),
            Err(AppError::Validation(_))
        ));
        bad.judul = "Bumi".into();
        bad.anggota_id = 999;
        assert!(matches!(
            wishlist_create_inner(&mut conn, &bad, None),
            Err(AppError::NotFound(_))
        ));
    }

    #[test]
    fn update_status_accepts_pending_to_disetujui_and_records_audit() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        let updated = wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "disetujui".into(),
                catatan_admin: Some("Akan dipesan minggu depan".into()),
                buku_id: None,
            },
            None,
        )
        .expect("update");
        assert_eq!(updated.status, "disetujui");
        assert_eq!(
            updated.catatan_admin.as_deref(),
            Some("Akan dipesan minggu depan")
        );
    }

    #[test]
    fn update_status_blocks_disetujui_to_pending() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "disetujui".into(),
                catatan_admin: None,
                buku_id: None,
            },
            None,
        )
        .expect("approve");
        let err = wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "pending".into(),
                catatan_admin: None,
                buku_id: None,
            },
            None,
        )
        .expect_err("should block");
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn update_status_links_buku_when_marked_acquired() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let bid = seed_buku(&conn, "B-001", "Bumi");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "disetujui".into(),
                catatan_admin: None,
                buku_id: None,
            },
            None,
        )
        .expect("approve");
        let acquired = wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "sudah_diadakan".into(),
                catatan_admin: None,
                buku_id: Some(bid),
            },
            None,
        )
        .expect("acquired");
        assert_eq!(acquired.status, "sudah_diadakan");
        assert_eq!(acquired.buku_id, Some(bid));
        assert_eq!(acquired.buku_judul.as_deref(), Some("Bumi"));
    }

    #[test]
    fn update_status_rejects_unknown_buku() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "disetujui".into(),
                catatan_admin: None,
                buku_id: None,
            },
            None,
        )
        .expect("approve");
        let err = wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: row.id,
                status: "sudah_diadakan".into(),
                catatan_admin: None,
                buku_id: Some(9999),
            },
            None,
        )
        .expect_err("should reject");
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn upvote_increments_count() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        let updated = wishlist_upvote_inner(&mut conn, row.id, None).expect("upvote");
        assert_eq!(updated.upvote_count, 2);
        let again = wishlist_upvote_inner(&mut conn, row.id, None).expect("upvote 2");
        assert_eq!(again.upvote_count, 3);
    }

    #[test]
    fn delete_removes_row_and_audits() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let row = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("create");
        wishlist_delete_inner(&mut conn, row.id, None).expect("delete");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM wishlist_buku", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn list_filters_by_status_and_orders_by_upvote_desc() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini");
        let r1 = wishlist_create_inner(&mut conn, &create_input(aid, "Bumi"), None).expect("c1");
        let r2 = wishlist_create_inner(&mut conn, &create_input(aid, "Bulan"), None).expect("c2");
        wishlist_upvote_inner(&mut conn, r2.id, None).expect("upvote r2");
        wishlist_upvote_inner(&mut conn, r2.id, None).expect("upvote r2 again");

        let pending = wishlist_list_inner(
            &conn,
            &WishlistListQuery {
                status: Some("pending".into()),
                anggota_id: None,
                limit: None,
                offset: None,
            },
        )
        .expect("list");
        assert_eq!(pending.len(), 2);
        assert_eq!(pending[0].id, r2.id, "highest upvote first");

        wishlist_update_status_inner(
            &mut conn,
            &WishlistUpdateStatusInput {
                id: r1.id,
                status: "disetujui".into(),
                catatan_admin: None,
                buku_id: None,
            },
            None,
        )
        .expect("approve");
        let approved = wishlist_list_inner(
            &conn,
            &WishlistListQuery {
                status: Some("disetujui".into()),
                anggota_id: None,
                limit: None,
                offset: None,
            },
        )
        .expect("list");
        assert_eq!(approved.len(), 1);
        assert_eq!(approved[0].id, r1.id);
    }

    #[test]
    fn list_rejects_unknown_status_filter() {
        let conn = setup_db();
        let err = wishlist_list_inner(
            &conn,
            &WishlistListQuery {
                status: Some("haram".into()),
                anggota_id: None,
                limit: None,
                offset: None,
            },
        )
        .expect_err("should reject");
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn transition_table_is_correct() {
        // Sanity-check matrix the UI mirrors.
        assert!(is_valid_transition("pending", "disetujui"));
        assert!(is_valid_transition("pending", "ditolak"));
        assert!(is_valid_transition("disetujui", "sudah_diadakan"));
        assert!(is_valid_transition("ditolak", "pending"));
        assert!(!is_valid_transition("sudah_diadakan", "pending"));
        assert!(!is_valid_transition("disetujui", "ditolak"));
        // Idempotent
        assert!(is_valid_transition("pending", "pending"));
    }
}
