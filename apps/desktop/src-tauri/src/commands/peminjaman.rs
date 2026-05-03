//! Peminjaman + Pengembalian commands.
//!
//! Mirrors the v1 Python flow in `src/perpustakaan/models/peminjaman.py`:
//! create a `peminjaman` header, insert one `peminjaman_item` row per
//! eksemplar dipinjam, decrement `buku.jumlah_tersedia`, flip eksemplar
//! status to `dipinjam`. Pengembalian computes denda = max(0, days_late) *
//! denda_per_hari (from `settings`).

use chrono::NaiveDate;
use rusqlite::{params, params_from_iter, OptionalExtension, ToSql};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

const DEFAULT_LAMA_PINJAM_HARI: i64 = 7;
const DEFAULT_DENDA_PER_HARI: i64 = 500;
const DEFAULT_MAKS_PINJAM: i64 = 2;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanRow {
    pub id: i64,
    pub nomor_pinjam: String,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub tanggal_pinjam: String,
    pub tanggal_jatuh_tempo: String,
    pub tanggal_kembali: Option<String>,
    pub status: String,
    pub total_denda: i64,
    pub total_bayar: i64,
    pub total_item: i64,
    pub item_dipinjam: i64,
    pub catatan: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanItemRow {
    pub id: i64,
    pub peminjaman_id: i64,
    pub buku_id: i64,
    pub buku_judul: String,
    pub buku_kode: String,
    pub eksemplar_id: Option<i64>,
    pub eksemplar_kode: Option<String>,
    pub status: String,
    pub tanggal_kembali: Option<String>,
    pub denda: i64,
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanDetail {
    pub header: PeminjamanRow,
    pub items: Vec<PeminjamanItemRow>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanListArgs {
    pub query: Option<String>,
    pub status: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub anggota_id: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanListResult {
    pub items: Vec<PeminjamanRow>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanCreateInput {
    pub anggota_id: i64,
    pub buku_ids: Vec<i64>,
    pub tanggal_pinjam: Option<String>,
    pub tanggal_jatuh_tempo: Option<String>,
    pub catatan: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanReturnInput {
    pub peminjaman_id: i64,
    pub item_ids: Vec<i64>,
    pub bayar: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanReturnResult {
    pub items: Vec<PeminjamanItemRow>,
    pub total_denda: i64,
    pub total_bayar: i64,
    pub status_header: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanQuickStats {
    pub aktif_hari_ini: i64,
    pub aktif_minggu_ini: i64,
    pub overdue: i64,
    pub total_aktif: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaSummary {
    pub id: i64,
    pub kode_anggota: String,
    pub nama: String,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub aktif: bool,
    pub foto_path: Option<String>,
    pub aktif_count: i64,
    pub overdue_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuSummary {
    pub id: i64,
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub cover_path: Option<String>,
    pub jumlah_tersedia: i64,
    pub jumlah_eksemplar: i64,
}

const SORT_FIELDS: &[&str] = &[
    "tanggal_pinjam",
    "tanggal_jatuh_tempo",
    "status",
    "nomor_pinjam",
    "created_at",
];

fn validate_sort(sort_by: &str, sort_dir: &str) -> AppResult<(String, String)> {
    let by = SORT_FIELDS
        .iter()
        .find(|f| **f == sort_by)
        .ok_or_else(|| AppError::Validation(format!("unsupported sort_by '{sort_by}'")))?;
    let dir = match sort_dir.to_ascii_uppercase().as_str() {
        "ASC" => "ASC",
        "DESC" => "DESC",
        other => {
            return Err(AppError::Validation(format!(
                "unsupported sort_dir '{other}'"
            )))
        }
    };
    Ok(((*by).to_string(), dir.to_string()))
}

fn parse_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|e| AppError::Validation(format!("tanggal '{value}' tidak valid: {e}")))
}

fn today_iso() -> String {
    chrono::Local::now()
        .date_naive()
        .format("%Y-%m-%d")
        .to_string()
}

fn setting_int(conn: &rusqlite::Connection, key: &str, default: i64) -> i64 {
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

fn next_nomor_pinjam(conn: &rusqlite::Connection) -> AppResult<String> {
    let prefix = format!("PJ-{}-", today_iso().replace('-', ""));
    let last: Option<String> = conn
        .query_row(
            "SELECT nomor_pinjam FROM peminjaman WHERE nomor_pinjam LIKE ?1 \
             ORDER BY nomor_pinjam DESC LIMIT 1",
            params![format!("{prefix}%")],
            |r| r.get(0),
        )
        .optional()?;
    let next = last
        .as_deref()
        .and_then(|s| s.strip_prefix(&prefix))
        .and_then(|tail| tail.parse::<i64>().ok())
        .map(|n| n + 1)
        .unwrap_or(1);
    Ok(format!("{prefix}{next:04}"))
}

fn map_peminjaman_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PeminjamanRow> {
    Ok(PeminjamanRow {
        id: row.get("id")?,
        nomor_pinjam: row.get("nomor_pinjam")?,
        anggota_id: row.get("anggota_id")?,
        anggota_nama: row.get("anggota_nama")?,
        anggota_kode: row.get("anggota_kode")?,
        tanggal_pinjam: row.get("tanggal_pinjam")?,
        tanggal_jatuh_tempo: row.get("tanggal_jatuh_tempo")?,
        tanggal_kembali: row.get("tanggal_kembali")?,
        status: row.get("status")?,
        total_denda: row.get("total_denda")?,
        total_bayar: row.get("total_bayar")?,
        total_item: row.get("total_item")?,
        item_dipinjam: row.get("item_dipinjam")?,
        catatan: row.get("catatan")?,
        created_at: row.get("created_at")?,
    })
}

fn map_item_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PeminjamanItemRow> {
    Ok(PeminjamanItemRow {
        id: row.get("id")?,
        peminjaman_id: row.get("peminjaman_id")?,
        buku_id: row.get("buku_id")?,
        buku_judul: row.get("buku_judul")?,
        buku_kode: row.get("buku_kode")?,
        eksemplar_id: row.get("eksemplar_id")?,
        eksemplar_kode: row.get("eksemplar_kode")?,
        status: row.get("status")?,
        tanggal_kembali: row.get("tanggal_kembali")?,
        denda: row.get("denda")?,
        catatan: row.get("catatan")?,
    })
}

fn select_peminjaman_row(conn: &rusqlite::Connection, id: i64) -> AppResult<PeminjamanRow> {
    let sql = peminjaman_select_sql(" WHERE p.id = ?1 ");
    conn.query_row(&sql, params![id], map_peminjaman_row)
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("peminjaman id={id}")))
}

fn peminjaman_select_sql(where_clause: &str) -> String {
    format!(
        "SELECT p.id, p.nomor_pinjam, p.anggota_id, a.nama AS anggota_nama, \
                a.kode_anggota AS anggota_kode, p.tanggal_pinjam, \
                p.tanggal_jatuh_tempo, p.tanggal_kembali, p.status, \
                p.total_denda, p.total_bayar, p.catatan, p.created_at, \
                COALESCE((SELECT COUNT(*) FROM peminjaman_item pi \
                          WHERE pi.peminjaman_id = p.id), 0) AS total_item, \
                COALESCE((SELECT COUNT(*) FROM peminjaman_item pi \
                          WHERE pi.peminjaman_id = p.id \
                            AND pi.status = 'dipinjam'), 0) AS item_dipinjam \
         FROM peminjaman p JOIN anggota a ON a.id = p.anggota_id{where_clause}"
    )
}

fn list_items_for(
    conn: &rusqlite::Connection,
    peminjaman_id: i64,
) -> AppResult<Vec<PeminjamanItemRow>> {
    let mut stmt = conn.prepare(
        "SELECT pi.id, pi.peminjaman_id, pi.buku_id, b.judul AS buku_judul, \
                b.kode_buku AS buku_kode, pi.eksemplar_id, \
                e.kode_eksemplar AS eksemplar_kode, pi.status, \
                pi.tanggal_kembali, pi.denda, pi.catatan \
         FROM peminjaman_item pi JOIN buku b ON b.id = pi.buku_id \
         LEFT JOIN eksemplar e ON e.id = pi.eksemplar_id \
         WHERE pi.peminjaman_id = ?1 ORDER BY pi.id ASC",
    )?;
    let rows = stmt
        .query_map(params![peminjaman_id], map_item_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn refresh_header_status(conn: &rusqlite::Connection, peminjaman_id: i64) -> AppResult<String> {
    let mut stmt = conn.prepare("SELECT status FROM peminjaman_item WHERE peminjaman_id = ?1")?;
    let statuses: Vec<String> = stmt
        .query_map(params![peminjaman_id], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let new_status = if statuses.is_empty() {
        "dipinjam".to_string()
    } else if statuses
        .iter()
        .all(|s| s == "dikembalikan" || s == "hilang")
    {
        "dikembalikan".to_string()
    } else if statuses.iter().any(|s| s == "dipinjam")
        && statuses
            .iter()
            .any(|s| s == "dikembalikan" || s == "hilang")
    {
        "sebagian".to_string()
    } else {
        // semua dipinjam — cek overdue
        let jt: Option<String> = conn
            .query_row(
                "SELECT tanggal_jatuh_tempo FROM peminjaman WHERE id = ?1",
                params![peminjaman_id],
                |r| r.get(0),
            )
            .optional()?;
        match jt {
            Some(s) => match parse_date(&s) {
                Ok(d) if d < chrono::Local::now().date_naive() => "terlambat".to_string(),
                _ => "dipinjam".to_string(),
            },
            None => "dipinjam".to_string(),
        }
    };

    let kembali_at = if new_status == "dikembalikan" {
        Some(today_iso())
    } else {
        None
    };

    conn.execute(
        "UPDATE peminjaman SET status = ?1, tanggal_kembali = ?2, \
         updated_at = datetime('now') WHERE id = ?3",
        params![new_status, kembali_at, peminjaman_id],
    )?;
    Ok(new_status)
}

#[tauri::command]
pub fn peminjaman_list(
    state: State<'_, AppState>,
    args: PeminjamanListArgs,
) -> AppResult<PeminjamanListResult> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = args.limit.unwrap_or(50).clamp(1, 500);
    let offset = args.offset.unwrap_or(0).max(0);
    let (sort_by, sort_dir) = validate_sort(
        args.sort_by.as_deref().unwrap_or("tanggal_pinjam"),
        args.sort_dir.as_deref().unwrap_or("DESC"),
    )?;

    let mut filters: Vec<String> = Vec::new();
    let mut bind: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(q) = args
        .query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filters.push(format!(
            "(p.nomor_pinjam LIKE ?{i} OR a.nama LIKE ?{i} OR a.kode_anggota LIKE ?{i})",
            i = bind.len() + 1
        ));
        bind.push(Box::new(format!("%{q}%")));
    }
    if let Some(s) = args
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if s == "overdue" {
            filters.push("p.status = 'terlambat'".to_string());
        } else if s != "all" {
            filters.push(format!("p.status = ?{i}", i = bind.len() + 1));
            bind.push(Box::new(s.to_string()));
        }
    }
    if let Some(from) = args.from.as_deref() {
        filters.push(format!("p.tanggal_pinjam >= ?{i}", i = bind.len() + 1));
        bind.push(Box::new(from.to_string()));
    }
    if let Some(to) = args.to.as_deref() {
        filters.push(format!("p.tanggal_pinjam <= ?{i}", i = bind.len() + 1));
        bind.push(Box::new(to.to_string()));
    }
    if let Some(aid) = args.anggota_id {
        filters.push(format!("p.anggota_id = ?{i}", i = bind.len() + 1));
        bind.push(Box::new(aid));
    }

    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", filters.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM peminjaman p JOIN anggota a ON a.id = p.anggota_id{where_clause}"
    );
    let total: i64 = conn.query_row(&count_sql, params_from_iter(bind.iter()), |r| r.get(0))?;

    let select = peminjaman_select_sql(&where_clause);
    let list_sql = format!(
        "{select} ORDER BY p.{sort_by} {sort_dir} LIMIT ?{lim} OFFSET ?{off}",
        lim = bind.len() + 1,
        off = bind.len() + 2
    );
    let mut stmt = conn.prepare(&list_sql)?;
    let mut all_params: Vec<Box<dyn ToSql>> = bind;
    all_params.push(Box::new(limit));
    all_params.push(Box::new(offset));
    let rows = stmt
        .query_map(params_from_iter(all_params.iter()), map_peminjaman_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(PeminjamanListResult { items: rows, total })
}

#[tauri::command]
pub fn peminjaman_get(state: State<'_, AppState>, id: i64) -> AppResult<PeminjamanDetail> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let header = select_peminjaman_row(&conn, id)?;
    let items = list_items_for(&conn, id)?;
    Ok(PeminjamanDetail { header, items })
}

#[tauri::command]
pub fn peminjaman_create(
    state: State<'_, AppState>,
    input: PeminjamanCreateInput,
) -> AppResult<PeminjamanDetail> {
    if input.buku_ids.is_empty() {
        return Err(AppError::Validation("buku_ids tidak boleh kosong".into()));
    }
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let anggota: Option<(i64, bool)> = conn
        .query_row(
            "SELECT id, aktif FROM anggota WHERE id = ?1",
            params![input.anggota_id],
            |r| Ok((r.get(0)?, r.get::<_, i64>(1)? != 0)),
        )
        .optional()?;
    let (_, aktif) =
        anggota.ok_or_else(|| AppError::Validation("anggota tidak ditemukan".into()))?;
    if !aktif {
        return Err(AppError::Validation("anggota tidak aktif".into()));
    }

    let maks = setting_int(&conn, "transaksi.maks_buku_pinjam", DEFAULT_MAKS_PINJAM);
    let aktif_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1 AND pi.status = 'dipinjam'",
        params![input.anggota_id],
        |r| r.get(0),
    )?;
    if aktif_count + (input.buku_ids.len() as i64) > maks {
        return Err(AppError::Validation(format!(
            "melebihi maksimal {maks} buku per anggota (saat ini {aktif_count})"
        )));
    }

    let lama = setting_int(
        &conn,
        "transaksi.lama_pinjam_hari",
        DEFAULT_LAMA_PINJAM_HARI,
    );
    let tgl_pinjam = input
        .tanggal_pinjam
        .clone()
        .filter(|s| !s.is_empty())
        .map(|s| parse_date(&s))
        .transpose()?
        .unwrap_or_else(|| chrono::Local::now().date_naive());
    let tgl_jt = input
        .tanggal_jatuh_tempo
        .clone()
        .filter(|s| !s.is_empty())
        .map(|s| parse_date(&s))
        .transpose()?
        .unwrap_or(tgl_pinjam + chrono::Duration::days(lama));
    if tgl_jt < tgl_pinjam {
        return Err(AppError::Validation(
            "tanggal jatuh tempo tidak boleh sebelum tanggal pinjam".into(),
        ));
    }

    let tx = conn.transaction()?;
    let nomor = next_nomor_pinjam(&tx)?;
    tx.execute(
        "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, \
         tanggal_jatuh_tempo, status, catatan) \
         VALUES (?1, ?2, ?3, ?4, 'dipinjam', ?5)",
        params![
            nomor,
            input.anggota_id,
            tgl_pinjam.format("%Y-%m-%d").to_string(),
            tgl_jt.format("%Y-%m-%d").to_string(),
            input.catatan,
        ],
    )?;
    let peminjaman_id = tx.last_insert_rowid();

    for buku_id in &input.buku_ids {
        let eks: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, kode_eksemplar FROM eksemplar \
                 WHERE buku_id = ?1 AND status = 'tersedia' \
                 ORDER BY id ASC LIMIT 1",
                params![buku_id],
                |r| Ok((r.get(0)?, r.get::<_, String>(1)?)),
            )
            .optional()?;
        let (eksemplar_id, _kode) = eks.ok_or_else(|| {
            AppError::Validation(format!(
                "tidak ada eksemplar tersedia untuk buku id={buku_id}"
            ))
        })?;
        tx.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, eksemplar_id, status) \
             VALUES (?1, ?2, ?3, 'dipinjam')",
            params![peminjaman_id, buku_id, eksemplar_id],
        )?;
        tx.execute(
            "UPDATE eksemplar SET status = 'dipinjam', updated_at = datetime('now') WHERE id = ?1",
            params![eksemplar_id],
        )?;
        tx.execute(
            "UPDATE buku SET jumlah_tersedia = MAX(jumlah_tersedia - 1, 0), \
             updated_at = datetime('now') WHERE id = ?1",
            params![buku_id],
        )?;
    }

    tx.execute(
        "INSERT INTO kunjungan (anggota_id, sumber, keperluan) \
         VALUES (?1, 'peminjaman', 'Peminjaman buku')",
        params![input.anggota_id],
    )?;

    tx.commit()?;

    let header = select_peminjaman_row(&conn, peminjaman_id)?;
    let items = list_items_for(&conn, peminjaman_id)?;
    Ok(PeminjamanDetail { header, items })
}

#[tauri::command]
pub fn peminjaman_kembalikan(
    state: State<'_, AppState>,
    input: PeminjamanReturnInput,
) -> AppResult<PeminjamanReturnResult> {
    if input.item_ids.is_empty() {
        return Err(AppError::Validation("item_ids tidak boleh kosong".into()));
    }
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Pre-validate header exists
    let _header_row: i64 = conn
        .query_row(
            "SELECT id FROM peminjaman WHERE id = ?1",
            params![input.peminjaman_id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("peminjaman id={}", input.peminjaman_id)))?;

    let denda_per_hari = setting_int(&conn, "transaksi.denda_per_hari", DEFAULT_DENDA_PER_HARI);
    let today = chrono::Local::now().date_naive();
    let bayar = input.bayar.unwrap_or(0).max(0);

    let tx = conn.transaction()?;
    let mut total_denda = 0_i64;

    for item_id in &input.item_ids {
        let row: Option<(i64, String, String, Option<i64>, i64)> = tx
            .query_row(
                "SELECT pi.id, pi.status, p.tanggal_jatuh_tempo, pi.eksemplar_id, pi.buku_id \
                 FROM peminjaman_item pi \
                 JOIN peminjaman p ON p.id = pi.peminjaman_id \
                 WHERE pi.id = ?1 AND pi.peminjaman_id = ?2",
                params![item_id, input.peminjaman_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .optional()?;
        let (id, status, tgl_jt, eksemplar_id, buku_id) = row.ok_or_else(|| {
            AppError::Validation(format!(
                "item id={item_id} bukan bagian dari peminjaman id={}",
                input.peminjaman_id
            ))
        })?;
        if status != "dipinjam" {
            return Err(AppError::Validation(format!(
                "item id={id} sudah berstatus {status}"
            )));
        }
        let jt = parse_date(&tgl_jt)?;
        let hari_telat = (today - jt).num_days().max(0);
        let denda = hari_telat * denda_per_hari;
        total_denda += denda;

        tx.execute(
            "UPDATE peminjaman_item SET status = 'dikembalikan', \
             tanggal_kembali = ?1, denda = ?2 WHERE id = ?3",
            params![today.format("%Y-%m-%d").to_string(), denda, id],
        )?;
        if let Some(eid) = eksemplar_id {
            tx.execute(
                "UPDATE eksemplar SET status = 'tersedia', updated_at = datetime('now') WHERE id = ?1",
                params![eid],
            )?;
        }
        tx.execute(
            "UPDATE buku SET jumlah_tersedia = jumlah_tersedia + 1, \
             updated_at = datetime('now') WHERE id = ?1",
            params![buku_id],
        )?;
    }

    tx.execute(
        "UPDATE peminjaman SET total_denda = total_denda + ?1, total_bayar = total_bayar + ?2, \
         updated_at = datetime('now') WHERE id = ?3",
        params![total_denda, bayar, input.peminjaman_id],
    )?;
    if bayar > 0 {
        tx.execute(
            "INSERT INTO kas (keterangan, jenis, nominal, sumber, referensi_id, referensi_tipe) \
             VALUES (?1, 'masuk', ?2, 'denda', ?3, 'peminjaman')",
            params![
                format!("Denda pengembalian #{} ", input.peminjaman_id),
                bayar,
                input.peminjaman_id,
            ],
        )?;
    }

    let new_status = refresh_header_status(&tx, input.peminjaman_id)?;
    tx.commit()?;

    let items = list_items_for(&conn, input.peminjaman_id)?;
    let header = select_peminjaman_row(&conn, input.peminjaman_id)?;

    Ok(PeminjamanReturnResult {
        items,
        total_denda: header.total_denda,
        total_bayar: header.total_bayar,
        status_header: new_status,
    })
}

#[tauri::command]
pub fn peminjaman_quick_stats(state: State<'_, AppState>) -> AppResult<PeminjamanQuickStats> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let aktif_total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item WHERE status = 'dipinjam'",
        [],
        |r| r.get(0),
    )?;
    let aktif_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman p \
         WHERE p.tanggal_pinjam = date('now')",
        [],
        |r| r.get(0),
    )?;
    let aktif_week: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman p \
         WHERE p.tanggal_pinjam >= date('now', '-6 days')",
        [],
        |r| r.get(0),
    )?;
    let overdue: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE pi.status = 'dipinjam' AND p.tanggal_jatuh_tempo < date('now')",
        [],
        |r| r.get(0),
    )?;
    Ok(PeminjamanQuickStats {
        aktif_hari_ini: aktif_today,
        aktif_minggu_ini: aktif_week,
        overdue,
        total_aktif: aktif_total,
    })
}

#[tauri::command]
pub fn anggota_summary(state: State<'_, AppState>, id: i64) -> AppResult<AnggotaSummary> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let row = conn
        .query_row(
            "SELECT id, kode_anggota, nama, kelas, jurusan, aktif, foto_path FROM anggota WHERE id = ?1",
            params![id],
            |r| {
                Ok(AnggotaSummary {
                    id: r.get(0)?,
                    kode_anggota: r.get(1)?,
                    nama: r.get(2)?,
                    kelas: r.get(3)?,
                    jurusan: r.get(4)?,
                    aktif: r.get::<_, i64>(5)? != 0,
                    foto_path: r.get(6)?,
                    aktif_count: 0,
                    overdue_count: 0,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("anggota id={id}")))?;

    let aktif_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1 AND pi.status = 'dipinjam'",
        params![id],
        |r| r.get(0),
    )?;
    let overdue_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1 AND pi.status = 'dipinjam' \
           AND p.tanggal_jatuh_tempo < date('now')",
        params![id],
        |r| r.get(0),
    )?;
    Ok(AnggotaSummary {
        aktif_count,
        overdue_count,
        ..row
    })
}

#[tauri::command]
pub fn buku_summary(state: State<'_, AppState>, id: i64) -> AppResult<BukuSummary> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.query_row(
        "SELECT id, kode_buku, judul, pengarang, cover_path, jumlah_tersedia, jumlah_eksemplar \
         FROM buku WHERE id = ?1",
        params![id],
        |r| {
            Ok(BukuSummary {
                id: r.get(0)?,
                kode_buku: r.get(1)?,
                judul: r.get(2)?,
                pengarang: r.get(3)?,
                cover_path: r.get(4)?,
                jumlah_tersedia: r.get(5)?,
                jumlah_eksemplar: r.get(6)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("buku id={id}")))
}

#[tauri::command]
pub fn pengembalian_search(
    state: State<'_, AppState>,
    query: String,
) -> AppResult<Vec<PeminjamanRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let q = query.trim();
    let select = peminjaman_select_sql(
        " WHERE p.status IN ('dipinjam','sebagian','terlambat') \
          AND (p.nomor_pinjam LIKE ?1 OR a.nama LIKE ?1 OR a.kode_anggota LIKE ?1) \
          ORDER BY p.tanggal_pinjam DESC LIMIT 20",
    );
    let pat = if q.is_empty() {
        "%".to_string()
    } else {
        format!("%{q}%")
    };
    let mut stmt = conn.prepare(&select)?;
    let rows = stmt
        .query_map(params![pat], map_peminjaman_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}
