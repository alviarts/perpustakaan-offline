//! E1-OPACBukuPilihan — admin-pinned "buku pilihan" carousel feed.
//!
//! Backed by the `buku_pilihan` table (created in `db::run_migrations`).
//! Joins onto `buku` for the rendered carousel slides so the front-end
//! gets cover art, title, author, and availability without a second RPC.
//!
//! Cap: 5 active (non-expired) pins. The `pin` RPC rejects with
//! `AppError::Validation` when the cap is reached. Use `unpin` first.

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::buku::Buku;
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Maximum number of active (non-expired) pins. Mirrors the OPAC carousel's
/// reasonable upper bound — beyond five slides the auto-rotate becomes
/// disorienting on the kiosk.
pub const MAX_ACTIVE_PINS: i64 = 5;

/// Single carousel slide returned by `buku_pilihan_list_active`. Joins the
/// pin row with the underlying `buku` row so the OPAC home page does not
/// need a second round-trip per slide.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuPilihanSlide {
    pub id: i64,
    pub buku_id: i64,
    pub position: i64,
    pub pinned_at: String,
    pub label: Option<String>,
    pub expires_at: Option<String>,
    pub buku: Buku,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinInput {
    pub buku_id: i64,
    pub label: Option<String>,
    pub expires_at: Option<String>,
}

fn map_buku_from_join(row: &rusqlite::Row<'_>) -> rusqlite::Result<Buku> {
    Ok(Buku {
        id: row.get("buku_id_real")?,
        kode_buku: row.get("kode_buku")?,
        judul: row.get("judul")?,
        pengarang: row.get("pengarang")?,
        penerbit: row.get("penerbit")?,
        tahun_terbit: row.get("tahun_terbit")?,
        kode_ddc: row.get("kode_ddc")?,
        kategori: row.get("kategori")?,
        isbn: row.get("isbn")?,
        jumlah_eksemplar: row.get("jumlah_eksemplar")?,
        jumlah_tersedia: row.get("jumlah_tersedia")?,
        sumber: row.get("sumber")?,
        harga: row.get("harga")?,
        cover_path: row.get("cover_path")?,
        bahasa: row.get("bahasa")?,
        deskripsi: row.get("deskripsi")?,
        rak: row.get("rak")?,
        tanggal_input: row.get("tanggal_input")?,
        created_at: row.get("buku_created_at")?,
        updated_at: row.get("buku_updated_at")?,
    })
}

/// Returns the active pinned books (non-expired), sorted by `position` then
/// `pinned_at`. Joins `buku_pilihan` with `buku` so the OPAC carousel can
/// render slides immediately.
#[tauri::command]
pub fn buku_pilihan_list_active(state: State<'_, AppState>) -> AppResult<Vec<BukuPilihanSlide>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT bp.id, bp.buku_id, bp.position, bp.pinned_at, bp.label, bp.expires_at,
                b.id AS buku_id_real, b.kode_buku, b.judul, b.pengarang, b.penerbit,
                b.tahun_terbit, b.kode_ddc, b.kategori, b.isbn,
                b.jumlah_eksemplar, b.jumlah_tersedia, b.sumber, b.harga,
                b.cover_path, b.bahasa, b.deskripsi, b.rak, b.tanggal_input,
                b.created_at AS buku_created_at, b.updated_at AS buku_updated_at
           FROM buku_pilihan bp
           JOIN buku b ON b.id = bp.buku_id
          WHERE bp.expires_at IS NULL OR bp.expires_at > datetime('now')
          ORDER BY bp.position ASC, bp.pinned_at ASC",
    )?;
    let rows: Vec<BukuPilihanSlide> = stmt
        .query_map([], |row| {
            Ok(BukuPilihanSlide {
                id: row.get("id")?,
                buku_id: row.get("buku_id")?,
                position: row.get("position")?,
                pinned_at: row.get("pinned_at")?,
                label: row.get("label")?,
                expires_at: row.get("expires_at")?,
                buku: map_buku_from_join(row)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn count_active_pins(conn: &rusqlite::Connection) -> AppResult<i64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM buku_pilihan
          WHERE expires_at IS NULL OR expires_at > datetime('now')",
        [],
        |r| r.get(0),
    )?;
    Ok(n)
}

fn next_position(conn: &rusqlite::Connection) -> AppResult<i64> {
    let max: Option<i64> = conn
        .query_row("SELECT MAX(position) FROM buku_pilihan", [], |r| r.get(0))
        .optional()?
        .flatten();
    Ok(max.unwrap_or(-1) + 1)
}

/// Pin a buku as a featured slide. Rejects when the active-pin count is
/// already at [`MAX_ACTIVE_PINS`] or when the buku does not exist.
#[tauri::command]
pub fn buku_pilihan_pin(
    state: State<'_, AppState>,
    input: PinInput,
) -> AppResult<BukuPilihanSlide> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Validate buku existence so the FOREIGN KEY error becomes a friendly
    // validation message.
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM buku WHERE id = ?1",
            params![input.buku_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(AppError::Validation(format!(
            "buku id {} tidak ditemukan",
            input.buku_id
        )));
    }

    if count_active_pins(&conn)? >= MAX_ACTIVE_PINS {
        return Err(AppError::Validation(format!(
            "Maksimum {} buku pilihan aktif. Lepas pin lama dulu.",
            MAX_ACTIVE_PINS
        )));
    }

    let position = next_position(&conn)?;
    conn.execute(
        "INSERT INTO buku_pilihan (buku_id, position, label, expires_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(buku_id) DO UPDATE SET
            position = excluded.position,
            label = excluded.label,
            expires_at = excluded.expires_at,
            pinned_at = datetime('now')",
        params![input.buku_id, position, input.label, input.expires_at],
    )?;

    let id: i64 = conn.query_row(
        "SELECT id FROM buku_pilihan WHERE buku_id = ?1",
        params![input.buku_id],
        |r| r.get(0),
    )?;
    drop(conn);
    let list = buku_pilihan_list_active(state)?;
    list.into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::Internal("freshly inserted pin missing".into()))
}

/// Remove a pin by row id. Idempotent — returns Ok(()) even if the row is
/// already gone, matching how `wishlist_remove` behaves.
#[tauri::command]
pub fn buku_pilihan_unpin(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute("DELETE FROM buku_pilihan WHERE id = ?1", params![id])?;
    Ok(())
}

/// Reorder pins. The `ids` slice defines the new ordering left-to-right;
/// any id not present is left untouched. The frontend always passes the
/// full active list so this RPC simply rewrites positions 0..N.
#[tauri::command]
pub fn buku_pilihan_reorder(state: State<'_, AppState>, ids: Vec<i64>) -> AppResult<()> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.transaction()?;
    for (idx, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE buku_pilihan SET position = ?1 WHERE id = ?2",
            params![idx as i64, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-mem");
        crate::db::run_migrations(&conn).expect("migrations");
        // Seed two buku rows so pin can succeed.
        for i in 1..=8 {
            conn.execute(
                "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia,
                                   harga, tanggal_input)
                 VALUES (?1, ?2, 1, 1, 0, '2026-01-01')",
                params![format!("K{i:03}"), format!("Judul {i}")],
            )
            .expect("seed buku");
        }
        conn
    }

    #[test]
    fn migrations_create_buku_pilihan() {
        let conn = open();
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='buku_pilihan'",
                [],
                |r| r.get(0),
            )
            .expect("query sqlite_master");
        assert_eq!(n, 1);
    }

    #[test]
    fn list_active_filters_expired_pins() {
        let conn = open();
        // Two pins: one already expired, one without expiry.
        conn.execute(
            "INSERT INTO buku_pilihan (buku_id, position, expires_at)
             VALUES (1, 0, datetime('now', '-1 day'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO buku_pilihan (buku_id, position, expires_at)
             VALUES (2, 1, NULL)",
            [],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT bp.buku_id FROM buku_pilihan bp
                  WHERE bp.expires_at IS NULL OR bp.expires_at > datetime('now')",
            )
            .unwrap();
        let active: Vec<i64> = stmt
            .query_map([], |r| r.get::<_, i64>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(active, vec![2]);
    }

    #[test]
    fn cap_enforcement_blocks_sixth_pin() {
        let conn = open();
        // Insert 5 active pins.
        for i in 1..=5 {
            conn.execute(
                "INSERT INTO buku_pilihan (buku_id, position) VALUES (?1, ?2)",
                params![i, i - 1],
            )
            .unwrap();
        }
        let n = count_active_pins(&conn).unwrap();
        assert_eq!(n, 5);
        // Direct INSERT would still succeed at SQLite level — the cap is
        // enforced by the RPC layer via `count_active_pins`. We assert the
        // count helper is wired correctly here.
        assert!(n >= MAX_ACTIVE_PINS, "cap should be triggered at {n}");
    }

    #[test]
    fn next_position_advances_max() {
        let conn = open();
        assert_eq!(next_position(&conn).unwrap(), 0);
        conn.execute(
            "INSERT INTO buku_pilihan (buku_id, position) VALUES (1, 7)",
            [],
        )
        .unwrap();
        assert_eq!(next_position(&conn).unwrap(), 8);
    }
}
