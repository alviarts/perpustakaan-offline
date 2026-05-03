//! Kunjungan (visit log) commands.
//!
//! Backs the Kunjungan page (revisi #18). Reuses the existing `kunjungan`
//! table populated by Peminjaman/Pengembalian flows plus manual entries.

use chrono::NaiveDate;
use rusqlite::{params, params_from_iter, ToSql};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KunjunganRow {
    pub id: i64,
    pub anggota_id: Option<i64>,
    pub anggota_nama: Option<String>,
    pub anggota_kode: Option<String>,
    pub anggota_kelas: Option<String>,
    pub tanggal: String,
    pub jam: String,
    pub keperluan: Option<String>,
    pub sumber: String,
    pub jumlah_orang: i64,
    pub kelas: Option<String>,
    pub catatan: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KunjunganListArgs {
    pub query: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub sumber: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KunjunganListResult {
    pub items: Vec<KunjunganRow>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KunjunganCreateInput {
    pub anggota_id: Option<i64>,
    pub keperluan: Option<String>,
    pub sumber: Option<String>,
    pub jumlah_orang: Option<i64>,
    pub kelas: Option<String>,
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KunjunganQuickStats {
    pub hari_ini: i64,
    pub minggu_ini: i64,
    pub bulan_ini: i64,
    pub total: i64,
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<KunjunganRow> {
    Ok(KunjunganRow {
        id: row.get(0)?,
        anggota_id: row.get(1)?,
        anggota_nama: row.get(2)?,
        anggota_kode: row.get(3)?,
        anggota_kelas: row.get(4)?,
        tanggal: row.get(5)?,
        jam: row.get(6)?,
        keperluan: row.get(7)?,
        sumber: row.get(8)?,
        jumlah_orang: row.get(9)?,
        kelas: row.get(10)?,
        catatan: row.get(11)?,
        created_at: row.get(12)?,
    })
}

const SELECT_FIELDS: &str = "
    k.id,
    k.anggota_id,
    a.nama AS anggota_nama,
    a.kode_anggota AS anggota_kode,
    a.kelas AS anggota_kelas,
    k.tanggal,
    k.jam,
    k.keperluan,
    k.sumber,
    k.jumlah_orang,
    k.kelas,
    k.catatan,
    k.created_at
";

fn validate_date(value: &str, field: &str) -> AppResult<()> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::Validation(format!("{field} bukan tanggal valid (YYYY-MM-DD)")))
}

#[tauri::command]
pub fn kunjungan_list(
    state: State<'_, AppState>,
    args: Option<KunjunganListArgs>,
) -> AppResult<KunjunganListResult> {
    let args = args.unwrap_or_default();
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut conditions: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(query) = args
        .query
        .as_ref()
        .map(|q| q.trim())
        .filter(|q| !q.is_empty())
    {
        conditions.push("(LOWER(a.nama) LIKE ?1 OR LOWER(a.kode_anggota) LIKE ?1 OR LOWER(COALESCE(k.keperluan, '')) LIKE ?1)".into());
        params_vec.push(Box::new(format!("%{}%", query.to_lowercase())));
    }
    if let Some(from) = args.from.as_ref().filter(|v| !v.is_empty()) {
        validate_date(from, "from")?;
        conditions.push(format!("k.tanggal >= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(from.clone()));
    }
    if let Some(to) = args.to.as_ref().filter(|v| !v.is_empty()) {
        validate_date(to, "to")?;
        conditions.push(format!("k.tanggal <= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(to.clone()));
    }
    if let Some(sumber) = args
        .sumber
        .as_ref()
        .filter(|v| !v.is_empty() && v.as_str() != "all")
    {
        conditions.push(format!("k.sumber = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(sumber.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let total_sql = format!(
        "SELECT COUNT(*) FROM kunjungan k LEFT JOIN anggota a ON a.id = k.anggota_id {where_clause}"
    );
    let total: i64 = conn
        .query_row(
            &total_sql,
            params_from_iter(params_vec.iter().map(|b| b.as_ref())),
            |r| r.get(0),
        )
        .map_err(AppError::from)?;

    let limit = args.limit.unwrap_or(50).clamp(1, 500);
    let offset = args.offset.unwrap_or(0).max(0);

    let list_sql = format!(
        "SELECT {SELECT_FIELDS}
         FROM kunjungan k
         LEFT JOIN anggota a ON a.id = k.anggota_id
         {where_clause}
         ORDER BY k.tanggal DESC, k.jam DESC, k.id DESC
         LIMIT ?{} OFFSET ?{}",
        params_vec.len() + 1,
        params_vec.len() + 2,
    );
    params_vec.push(Box::new(limit));
    params_vec.push(Box::new(offset));

    let mut stmt = conn.prepare(&list_sql).map_err(AppError::from)?;
    let rows = stmt
        .query_map(
            params_from_iter(params_vec.iter().map(|b| b.as_ref())),
            map_row,
        )
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;

    Ok(KunjunganListResult { items: rows, total })
}

#[tauri::command]
pub fn kunjungan_create(
    state: State<'_, AppState>,
    input: KunjunganCreateInput,
) -> AppResult<KunjunganRow> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let sumber = input.sumber.unwrap_or_else(|| "manual".to_string());
    if !matches!(
        sumber.as_str(),
        "manual" | "peminjaman" | "pengembalian" | "kelas"
    ) {
        return Err(AppError::Validation(format!(
            "sumber '{sumber}' tidak dikenal"
        )));
    }
    let jumlah = input.jumlah_orang.unwrap_or(1);
    if jumlah < 1 {
        return Err(AppError::Validation("jumlah_orang minimal 1".into()));
    }

    if let Some(aid) = input.anggota_id {
        let exists: bool = conn
            .query_row("SELECT 1 FROM anggota WHERE id = ?1", params![aid], |_| {
                Ok(true)
            })
            .unwrap_or(false);
        if !exists {
            return Err(AppError::Validation(format!(
                "anggota id={aid} tidak ditemukan"
            )));
        }
    }

    let id: i64 = conn
        .query_row(
            "INSERT INTO kunjungan (anggota_id, keperluan, sumber, jumlah_orang, kelas, catatan)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id",
            params![
                input.anggota_id,
                input.keperluan,
                sumber,
                jumlah,
                input.kelas,
                input.catatan,
            ],
            |r| r.get(0),
        )
        .map_err(AppError::from)?;

    let row = conn
        .query_row(
            &format!(
                "SELECT {SELECT_FIELDS}
                 FROM kunjungan k
                 LEFT JOIN anggota a ON a.id = k.anggota_id
                 WHERE k.id = ?1"
            ),
            params![id],
            map_row,
        )
        .map_err(AppError::from)?;
    Ok(row)
}

#[tauri::command]
pub fn kunjungan_quick_stats(state: State<'_, AppState>) -> AppResult<KunjunganQuickStats> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let hari_ini: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(jumlah_orang), 0) FROM kunjungan WHERE tanggal = date('now', 'localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(AppError::from)?;
    let minggu_ini: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(jumlah_orang), 0) FROM kunjungan
             WHERE tanggal >= date('now', 'weekday 0', '-6 days', 'localtime')
               AND tanggal <= date('now', 'localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(AppError::from)?;
    let bulan_ini: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(jumlah_orang), 0) FROM kunjungan
             WHERE tanggal >= date('now', 'start of month', 'localtime')
               AND tanggal <= date('now', 'localtime')",
            [],
            |r| r.get(0),
        )
        .map_err(AppError::from)?;
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(jumlah_orang), 0) FROM kunjungan",
            [],
            |r| r.get(0),
        )
        .map_err(AppError::from)?;
    Ok(KunjunganQuickStats {
        hari_ini,
        minggu_ini,
        bulan_ini,
        total,
    })
}

#[tauri::command]
pub fn kunjungan_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let affected = conn
        .execute("DELETE FROM kunjungan WHERE id = ?1", params![id])
        .map_err(AppError::from)?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("kunjungan id={id}")));
    }
    Ok(())
}
