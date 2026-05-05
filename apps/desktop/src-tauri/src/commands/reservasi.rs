//! Reservasi buku (FEAT-18) — antrian saat buku sedang dipinjam orang lain.
//!
//! Schema:
//! - `reservasi_buku` (id, anggota_id, buku_id, urutan, status, slot_rak,
//!   tanggal_request, tanggal_siap_diambil, expired_at, catatan, created_at,
//!   updated_at)
//! - Status alur: `menunggu` → `siap_diambil` → `diambil`. Side branches:
//!   `expired` (tidak diambil sebelum `expired_at`), `dibatalkan` (manual).
//!
//! Lifecycle:
//! 1. `reservasi_create` adds a row with status=`menunggu` and `urutan` =
//!    last `menunggu` urutan + 1 for the same `buku_id`. Cannot reserve a
//!    book the requesting anggota already has on loan, and cannot reserve
//!    the same `buku_id` twice while the previous reservasi is still
//!    active.
//! 2. When that buku is returned via `peminjaman_kembalikan`, the inner
//!    helper [`promote_next_in_queue`] flips the front-of-queue
//!    `menunggu` row to `siap_diambil`, attaches a `slot_rak` label
//!    (`R-{id:04}`) and `expired_at = today + N` days (controlled by
//!    setting `reservasi.hari_tahan`, default 3). The promoted row is
//!    returned to the caller as a [`ReservasiPromotedNotif`] so the
//!    Pengembalian UI can show "Buku ini di-reserve oleh ...".
//! 3. `reservasi_mark_diambil` is invoked when the anggota physically
//!    picks up the book; it just records the status change so the audit
//!    trail is intact. Issuing the actual peminjaman is a separate flow.
//! 4. `reservasi_check_expired_tick` (idempotent, runs on a timer) flips
//!    every overdue `siap_diambil` row to `expired` and tries to promote
//!    the next `menunggu` for the same buku.
//!
//! Audit log: every state transition (`create`, `cancel`, `mark_diambil`,
//! auto-`siap_diambil`, auto-`expired`) writes a row to `audit_log` so
//! Settings → Audit Log can render the history.

use chrono::{Days, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::kas::insert_audit_log;
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Default `expired_at` window for `siap_diambil` rows in days. Mirrors
/// `apps/desktop/src/lib/reservasi.ts::DEFAULT_RESERVASI_HARI_TAHAN`.
const DEFAULT_RESERVASI_HARI_TAHAN: i64 = 3;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservasiRow {
    pub id: i64,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub buku_id: i64,
    pub buku_judul: String,
    pub buku_kode: String,
    pub urutan: i64,
    pub status: String,
    pub slot_rak: Option<String>,
    pub tanggal_request: String,
    pub tanggal_siap_diambil: Option<String>,
    pub expired_at: Option<String>,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservasiPromotedNotif {
    pub reservasi_id: i64,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub buku_id: i64,
    pub buku_judul: String,
    pub buku_kode: String,
    pub slot_rak: String,
    pub expired_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservasiCreateInput {
    pub anggota_id: i64,
    pub buku_id: i64,
    #[serde(default)]
    pub catatan: Option<String>,
}

const SELECT_SQL: &str = "SELECT r.id, r.anggota_id, a.nama AS anggota_nama, \
        a.kode_anggota AS anggota_kode, r.buku_id, b.judul AS buku_judul, \
        b.kode_buku AS buku_kode, r.urutan, r.status, r.slot_rak, \
        r.tanggal_request, r.tanggal_siap_diambil, r.expired_at, r.catatan, \
        r.created_at, r.updated_at \
     FROM reservasi_buku r \
     JOIN anggota a ON a.id = r.anggota_id \
     JOIN buku b ON b.id = r.buku_id";

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReservasiRow> {
    Ok(ReservasiRow {
        id: row.get("id")?,
        anggota_id: row.get("anggota_id")?,
        anggota_nama: row.get("anggota_nama")?,
        anggota_kode: row.get("anggota_kode")?,
        buku_id: row.get("buku_id")?,
        buku_judul: row.get("buku_judul")?,
        buku_kode: row.get("buku_kode")?,
        urutan: row.get("urutan")?,
        status: row.get("status")?,
        slot_rak: row.get("slot_rak")?,
        tanggal_request: row.get("tanggal_request")?,
        tanggal_siap_diambil: row.get("tanggal_siap_diambil")?,
        expired_at: row.get("expired_at")?,
        catatan: row.get("catatan")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn slot_rak_label(reservasi_id: i64) -> String {
    format!("R-{reservasi_id:04}")
}

fn setting_int(conn: &Connection, key: &str, default: i64) -> i64 {
    let row: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()
        .unwrap_or(None);
    row.and_then(|v| v.trim().parse::<i64>().ok())
        .unwrap_or(default)
}

fn hari_tahan(conn: &Connection) -> i64 {
    setting_int(conn, "reservasi.hari_tahan", DEFAULT_RESERVASI_HARI_TAHAN).clamp(1, 30)
}

/// Returns true when at least one peminjaman_item is currently
/// `dipinjam` for this buku. We allow reservasi only when the book is
/// actually unavailable — a tersedia book should be borrowed directly,
/// not reserved.
fn buku_is_currently_borrowed(conn: &Connection, buku_id: i64) -> AppResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item WHERE buku_id = ?1 AND status = 'dipinjam'",
        params![buku_id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

fn anggota_has_active_reservasi(conn: &Connection, anggota_id: i64, buku_id: i64) -> AppResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM reservasi_buku \
         WHERE anggota_id = ?1 AND buku_id = ?2 \
           AND status IN ('menunggu', 'siap_diambil')",
        params![anggota_id, buku_id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

fn anggota_has_buku_borrowed(conn: &Connection, anggota_id: i64, buku_id: i64) -> AppResult<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1 AND pi.buku_id = ?2 AND pi.status = 'dipinjam'",
        params![anggota_id, buku_id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

fn next_urutan(conn: &Connection, buku_id: i64) -> AppResult<i64> {
    let last: Option<i64> = conn
        .query_row(
            "SELECT MAX(urutan) FROM reservasi_buku \
             WHERE buku_id = ?1 AND status IN ('menunggu', 'siap_diambil')",
            params![buku_id],
            |r| r.get::<_, Option<i64>>(0),
        )
        .optional()?
        .flatten();
    Ok(last.unwrap_or(0) + 1)
}

pub fn reservasi_create_inner(
    conn: &mut Connection,
    input: &ReservasiCreateInput,
    user_id: Option<i64>,
) -> AppResult<ReservasiRow> {
    // Validate anggota exists & aktif.
    let anggota: Option<(i64, bool)> = conn
        .query_row(
            "SELECT id, aktif FROM anggota WHERE id = ?1",
            params![input.anggota_id],
            |r| Ok((r.get(0)?, r.get::<_, i64>(1)? != 0)),
        )
        .optional()?;
    let (_, aktif) = anggota
        .ok_or_else(|| AppError::Validation("anggota tidak ditemukan".into()))?;
    if !aktif {
        return Err(AppError::Validation("anggota tidak aktif".into()));
    }

    // Validate buku exists.
    let buku_exists: bool = conn
        .query_row(
            "SELECT 1 FROM buku WHERE id = ?1",
            params![input.buku_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !buku_exists {
        return Err(AppError::Validation("buku tidak ditemukan".into()));
    }

    if !buku_is_currently_borrowed(conn, input.buku_id)? {
        return Err(AppError::Validation(
            "Buku ini tersedia — silakan langsung pinjam".into(),
        ));
    }

    if anggota_has_active_reservasi(conn, input.anggota_id, input.buku_id)? {
        return Err(AppError::Validation(
            "Anggota sudah memiliki reservasi aktif untuk buku ini".into(),
        ));
    }

    if anggota_has_buku_borrowed(conn, input.anggota_id, input.buku_id)? {
        return Err(AppError::Validation(
            "Anggota sedang meminjam buku ini — tidak perlu reservasi".into(),
        ));
    }

    let urutan = next_urutan(conn, input.buku_id)?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO reservasi_buku (anggota_id, buku_id, urutan, status, catatan) \
         VALUES (?1, ?2, ?3, 'menunggu', ?4)",
        params![input.anggota_id, input.buku_id, urutan, input.catatan],
    )?;
    let id = tx.last_insert_rowid();
    let detail = json!({
        "after": {
            "anggota_id": input.anggota_id,
            "buku_id": input.buku_id,
            "urutan": urutan,
            "status": "menunggu",
        }
    });
    insert_audit_log(&tx, user_id, "create", "reservasi_buku", Some(id), &detail)?;
    tx.commit()?;

    fetch_reservasi(conn, id)
}

pub fn reservasi_cancel_inner(
    conn: &mut Connection,
    id: i64,
    user_id: Option<i64>,
) -> AppResult<()> {
    let row: Option<(String, i64, i64)> = conn
        .query_row(
            "SELECT status, anggota_id, buku_id FROM reservasi_buku WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let (status, anggota_id, buku_id) =
        row.ok_or_else(|| AppError::NotFound(format!("reservasi id={id}")))?;
    if status != "menunggu" && status != "siap_diambil" {
        return Err(AppError::Validation(format!(
            "reservasi sudah berstatus {status}, tidak bisa dibatalkan"
        )));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE reservasi_buku SET status = 'dibatalkan', \
         updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    let detail = json!({
        "before": { "status": status },
        "after": { "status": "dibatalkan" },
        "anggota_id": anggota_id,
        "buku_id": buku_id,
    });
    insert_audit_log(&tx, user_id, "cancel", "reservasi_buku", Some(id), &detail)?;
    tx.commit()?;
    Ok(())
}

pub fn reservasi_mark_diambil_inner(
    conn: &mut Connection,
    id: i64,
    user_id: Option<i64>,
) -> AppResult<()> {
    let row: Option<(String, i64, i64)> = conn
        .query_row(
            "SELECT status, anggota_id, buku_id FROM reservasi_buku WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    let (status, anggota_id, buku_id) =
        row.ok_or_else(|| AppError::NotFound(format!("reservasi id={id}")))?;
    if status != "siap_diambil" {
        return Err(AppError::Validation(format!(
            "reservasi belum siap_diambil (status={status})"
        )));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE reservasi_buku SET status = 'diambil', \
         updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    let detail = json!({
        "before": { "status": "siap_diambil" },
        "after": { "status": "diambil" },
        "anggota_id": anggota_id,
        "buku_id": buku_id,
    });
    insert_audit_log(&tx, user_id, "mark_diambil", "reservasi_buku", Some(id), &detail)?;
    tx.commit()?;
    Ok(())
}

/// Promote the front-of-queue `menunggu` row for `buku_id` to
/// `siap_diambil`. No-op when the queue is empty. Runs inside an open
/// transaction supplied by the caller (e.g. `peminjaman_kembalikan` or
/// the expired-tick).
pub fn promote_next_in_queue(
    tx: &Connection,
    buku_id: i64,
    today: NaiveDate,
) -> AppResult<Option<ReservasiPromotedNotif>> {
    let row: Option<(i64, i64, String, String, String, String, String)> = tx
        .query_row(
            "SELECT r.id, r.anggota_id, a.nama, a.kode_anggota, b.judul, b.kode_buku, r.tanggal_request \
             FROM reservasi_buku r \
             JOIN anggota a ON a.id = r.anggota_id \
             JOIN buku b ON b.id = r.buku_id \
             WHERE r.buku_id = ?1 AND r.status = 'menunggu' \
             ORDER BY r.urutan ASC, r.id ASC LIMIT 1",
            params![buku_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                ))
            },
        )
        .optional()?;
    let Some((id, anggota_id, anggota_nama, anggota_kode, buku_judul, buku_kode, _req_date)) = row
    else {
        return Ok(None);
    };

    let hari = hari_tahan(tx);
    let expired = today
        .checked_add_days(Days::new(hari as u64))
        .expect("date overflow");
    let slot = slot_rak_label(id);
    let today_str = today.format("%Y-%m-%d").to_string();
    let expired_str = expired.format("%Y-%m-%d").to_string();

    tx.execute(
        "UPDATE reservasi_buku SET status = 'siap_diambil', \
         slot_rak = ?1, tanggal_siap_diambil = ?2, expired_at = ?3, \
         updated_at = datetime('now') WHERE id = ?4",
        params![slot, today_str, expired_str, id],
    )?;
    let detail = json!({
        "before": { "status": "menunggu" },
        "after": {
            "status": "siap_diambil",
            "slot_rak": slot,
            "tanggal_siap_diambil": today_str,
            "expired_at": expired_str,
        },
        "anggota_id": anggota_id,
        "buku_id": buku_id,
    });
    // Caller's user context isn't always available here (e.g.
    // expired-tick scheduler runs without a user); record as system.
    insert_audit_log(tx, None, "promote", "reservasi_buku", Some(id), &detail)?;

    Ok(Some(ReservasiPromotedNotif {
        reservasi_id: id,
        anggota_id,
        anggota_nama,
        anggota_kode,
        buku_id,
        buku_judul,
        buku_kode,
        slot_rak: slot,
        expired_at: expired_str,
    }))
}

/// Idempotent expired-tick: flip all `siap_diambil` rows whose
/// `expired_at < today` to `expired`, then attempt to promote the next
/// menunggu for the same buku (so the queue keeps moving even when the
/// front person ghosts). Returns the number of expired rows transitioned.
pub fn reservasi_check_expired_inner(conn: &mut Connection) -> AppResult<i64> {
    let today = chrono::Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    let to_expire: Vec<(i64, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, buku_id FROM reservasi_buku \
             WHERE status = 'siap_diambil' AND expired_at IS NOT NULL \
               AND expired_at < ?1",
        )?;
        let rows = stmt
            .query_map(params![today_str], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };

    if to_expire.is_empty() {
        return Ok(0);
    }

    let tx = conn.transaction()?;
    let mut changed = 0_i64;
    for (id, buku_id) in &to_expire {
        tx.execute(
            "UPDATE reservasi_buku SET status = 'expired', \
             updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        let detail = json!({
            "before": { "status": "siap_diambil" },
            "after": { "status": "expired" },
            "buku_id": buku_id,
        });
        insert_audit_log(&tx, None, "expire", "reservasi_buku", Some(*id), &detail)?;
        changed += 1;

        // Try to promote next menunggu for this buku. The freshly
        // expired slot is "released" — but only promote when no one
        // else is currently borrowing the book (otherwise the next
        // menunggu would wrongly skip its turn).
        let still_borrowed: i64 = tx.query_row(
            "SELECT COUNT(*) FROM peminjaman_item WHERE buku_id = ?1 AND status = 'dipinjam'",
            params![buku_id],
            |r| r.get(0),
        )?;
        if still_borrowed == 0 {
            promote_next_in_queue(&tx, *buku_id, today)?;
        }
    }
    tx.commit()?;
    Ok(changed)
}

fn fetch_reservasi(conn: &Connection, id: i64) -> AppResult<ReservasiRow> {
    let sql = format!("{SELECT_SQL} WHERE r.id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("reservasi id={id}")))
}

pub fn reservasi_list_active_inner(conn: &Connection) -> AppResult<Vec<ReservasiRow>> {
    let sql = format!(
        "{SELECT_SQL} WHERE r.status IN ('menunggu', 'siap_diambil') \
         ORDER BY r.buku_id ASC, r.urutan ASC, r.id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn reservasi_list_by_buku_inner(
    conn: &Connection,
    buku_id: i64,
) -> AppResult<Vec<ReservasiRow>> {
    let sql = format!("{SELECT_SQL} WHERE r.buku_id = ?1 ORDER BY r.urutan ASC, r.id ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![buku_id], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn reservasi_list_by_anggota_inner(
    conn: &Connection,
    anggota_id: i64,
) -> AppResult<Vec<ReservasiRow>> {
    let sql = format!(
        "{SELECT_SQL} WHERE r.anggota_id = ?1 \
         ORDER BY r.created_at DESC, r.id DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![anggota_id], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// Returns the active (menunggu | siap_diambil) reservasi rows for any of
/// the given `buku_ids`. Used by `peminjaman_perpanjang` to refuse
/// extending a peminjaman whose book(s) someone else is queued for.
pub fn reservasi_active_for_buku_ids(
    conn: &Connection,
    buku_ids: &[i64],
) -> AppResult<Vec<ReservasiRow>> {
    if buku_ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = buku_ids
        .iter()
        .map(|_| "?".to_string())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "{SELECT_SQL} WHERE r.buku_id IN ({placeholders}) \
         AND r.status IN ('menunggu', 'siap_diambil') \
         ORDER BY r.buku_id ASC, r.urutan ASC, r.id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let bind: Vec<rusqlite::types::Value> = buku_ids
        .iter()
        .map(|id| rusqlite::types::Value::Integer(*id))
        .collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(bind.iter()), map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn reservasi_create(
    state: State<'_, AppState>,
    input: ReservasiCreateInput,
) -> AppResult<ReservasiRow> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_create_inner(&mut conn, &input, None)
}

#[tauri::command]
pub fn reservasi_cancel(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_cancel_inner(&mut conn, id, None)
}

#[tauri::command]
pub fn reservasi_mark_diambil(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_mark_diambil_inner(&mut conn, id, None)
}

#[tauri::command]
pub fn reservasi_list_active(state: State<'_, AppState>) -> AppResult<Vec<ReservasiRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_list_active_inner(&conn)
}

#[tauri::command]
pub fn reservasi_list_by_buku(
    state: State<'_, AppState>,
    buku_id: i64,
) -> AppResult<Vec<ReservasiRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_list_by_buku_inner(&conn, buku_id)
}

#[tauri::command]
pub fn reservasi_list_by_anggota(
    state: State<'_, AppState>,
    anggota_id: i64,
) -> AppResult<Vec<ReservasiRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_list_by_anggota_inner(&conn, anggota_id)
}

#[tauri::command]
pub fn reservasi_check_expired_tick(state: State<'_, AppState>) -> AppResult<i64> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    reservasi_check_expired_inner(&mut conn)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia) \
             VALUES (?1, ?2, 1, 0)",
            params![kode, judul],
        )
        .expect("seed buku");
        conn.last_insert_rowid()
    }

    /// Mark `buku_id` as currently borrowed by `borrower_id` so reservasi
    /// validation passes. Returns the synthetic peminjaman_item id.
    fn seed_active_loan(conn: &Connection, borrower_id: i64, buku_id: i64) -> (i64, i64) {
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, \
             tanggal_jatuh_tempo, status) \
             VALUES (?1, ?2, '2026-05-01', '2026-05-08', 'dipinjam')",
            params![format!("PJ-T-{borrower_id}-{buku_id}"), borrower_id],
        )
        .expect("seed peminjaman");
        let pmj_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status) \
             VALUES (?1, ?2, 'dipinjam')",
            params![pmj_id, buku_id],
        )
        .expect("seed peminjaman_item");
        let item_id = conn.last_insert_rowid();
        (pmj_id, item_id)
    }

    #[test]
    fn cannot_reserve_when_buku_is_tersedia() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi");
        let bid = seed_buku(&conn, "B001", "Matematika 1");
        // No active loan — buku is tersedia.
        let err = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: aid,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect_err("should reject tersedia book");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("tersedia")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn create_assigns_incrementing_urutan_per_buku() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);

        let a1 = seed_anggota(&conn, "A001", "Antri 1");
        let a2 = seed_anggota(&conn, "A002", "Antri 2");

        let r1 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create r1");
        let r2 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a2,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create r2");
        assert_eq!(r1.urutan, 1);
        assert_eq!(r2.urutan, 2);
        assert_eq!(r1.status, "menunggu");
    }

    #[test]
    fn cannot_double_reserve_same_buku() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);
        let a1 = seed_anggota(&conn, "A001", "Antri");
        reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("first create");
        let err = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect_err("should reject duplicate");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("sudah memiliki reservasi")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn promote_next_in_queue_flips_status_and_assigns_slot() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);
        let a1 = seed_anggota(&conn, "A001", "Antri 1");
        let r1 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create r1");

        let today = NaiveDate::from_ymd_opt(2026, 5, 10).unwrap();
        let tx = conn.transaction().expect("tx");
        let promoted = promote_next_in_queue(&tx, bid, today)
            .expect("promote")
            .expect("queue had front");
        tx.commit().expect("commit");

        assert_eq!(promoted.reservasi_id, r1.id);
        assert_eq!(promoted.anggota_id, a1);
        assert_eq!(promoted.slot_rak, format!("R-{:04}", r1.id));
        assert_eq!(promoted.expired_at, "2026-05-13");

        // Row must reflect the promotion.
        let row = fetch_reservasi(&conn, r1.id).expect("fetch r1");
        assert_eq!(row.status, "siap_diambil");
        assert_eq!(row.slot_rak.as_deref(), Some(promoted.slot_rak.as_str()));
        assert_eq!(row.tanggal_siap_diambil.as_deref(), Some("2026-05-10"));
    }

    #[test]
    fn cancel_active_reservasi_writes_audit() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);
        let a1 = seed_anggota(&conn, "A001", "Antri");
        let r1 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create");

        reservasi_cancel_inner(&mut conn, r1.id, None).expect("cancel");
        let row = fetch_reservasi(&conn, r1.id).expect("fetch");
        assert_eq!(row.status, "dibatalkan");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM audit_log WHERE entitas = 'reservasi_buku' AND aksi = 'cancel'",
                [],
                |r| r.get(0),
            )
            .expect("audit count");
        assert_eq!(count, 1);
    }

    #[test]
    fn expired_tick_flips_overdue_siap_diambil_to_expired() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);
        let a1 = seed_anggota(&conn, "A001", "Antri");
        let r1 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create");

        // Promote then back-date `expired_at` to yesterday.
        let yesterday = chrono::Local::now()
            .date_naive()
            .checked_sub_days(Days::new(1))
            .unwrap();
        let yesterday_str = yesterday.format("%Y-%m-%d").to_string();
        let tx = conn.transaction().unwrap();
        promote_next_in_queue(&tx, bid, yesterday).unwrap();
        tx.execute(
            "UPDATE reservasi_buku SET expired_at = ?1 WHERE id = ?2",
            params![yesterday_str, r1.id],
        )
        .unwrap();
        tx.commit().unwrap();

        let changed = reservasi_check_expired_inner(&mut conn).expect("tick");
        assert_eq!(changed, 1);
        let row = fetch_reservasi(&conn, r1.id).expect("fetch");
        assert_eq!(row.status, "expired");
    }

    #[test]
    fn list_active_returns_only_menunggu_and_siap_diambil() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A000", "Borrower");
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        seed_active_loan(&conn, borrower, bid);
        let a1 = seed_anggota(&conn, "A001", "Antri 1");
        let a2 = seed_anggota(&conn, "A002", "Antri 2");
        let r1 = reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a1,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create r1");
        reservasi_create_inner(
            &mut conn,
            &ReservasiCreateInput {
                anggota_id: a2,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create r2");
        reservasi_cancel_inner(&mut conn, r1.id, None).expect("cancel r1");

        let rows = reservasi_list_active_inner(&conn).expect("list");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].anggota_id, a2);
    }
}
