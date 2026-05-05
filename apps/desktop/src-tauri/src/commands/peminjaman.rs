//! Peminjaman + Pengembalian commands.
//!
//! Flow: create a `peminjaman` header, insert one `peminjaman_item` row per
//! eksemplar dipinjam, decrement `buku.jumlah_tersedia`, flip eksemplar
//! status to `dipinjam`. Pengembalian computes denda = max(0, days_late) *
//! denda_per_hari (from `settings`).

use chrono::NaiveDate;
use rusqlite::{params, params_from_iter, OptionalExtension, ToSql};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

// Defaults must match `apps/desktop/src/lib/settings.ts::DEFAULT_LOAN_RULES`.
// When they drift, the frontend Aturan Peminjaman page shows one number
// while the backend enforces another, which is exactly how
// "maksimum 3" became "block at 2" in v1.0.6 (BUG-09 in the v1.0.7
// batch). The Settings page seeds these into the `settings` table on
// first save, but until then the backend falls back to these constants —
// so they MUST agree with the frontend.
const DEFAULT_LAMA_PINJAM_HARI: i64 = 7;
const DEFAULT_DENDA_PER_HARI: i64 = 500;
const DEFAULT_MAKS_PINJAM: i64 = 3;
/// Minggu (`0`) is the default hari libur, matching frontend.
const DEFAULT_HARI_LIBUR: &[u32] = &[0];

// FEAT-17: perpanjangan peminjaman defaults. `MAX_PERPANJANGAN` keeps a
// 0..=3 envelope: 0 disables the feature entirely, 3 caps the upper end so
// "perpanjang sampai semester depan" doesn't accidentally happen via a typo
// in Aturan Peminjaman. `BLOCK_DENDA` defaults to OFF so libraries that
// don't track denda strictly still get the perpanjang button working out
// of the box.
const DEFAULT_MAX_PERPANJANGAN: i64 = 1;
const MAX_PERPANJANGAN_HARD_CAP: i64 = 3;
const DEFAULT_BLOCK_PERPANJANGAN_JIKA_DENDA: bool = false;

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
    /// FEAT-17: how many times this peminjaman has been extended.
    /// Always present (default 0 on legacy rows).
    pub kali_perpanjangan: i64,
    /// FEAT-17: ISO date of the most recent perpanjang call, or `None`
    /// if the peminjaman has never been extended.
    pub tanggal_perpanjangan_terakhir: Option<String>,
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
    /// Optional override telling the backend which physical copy
    /// (`eksemplar.id`) to mark as borrowed for each entry in
    /// `buku_ids`. When provided, the i-th entry MUST belong to the
    /// i-th `buku_ids` and be currently `tersedia`. Used by the webcam
    /// circulation flow so the exact scanned barcode is the one
    /// recorded as on-loan — without this, the backend silently picks
    /// the lowest-id available copy via FIFO and the operator's later
    /// return scan fails to find an active loan
    /// (BUG-17 in v1.0.7 batch).
    #[serde(default)]
    pub eksemplar_ids: Option<Vec<i64>>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanPerpanjangInput {
    pub peminjaman_id: i64,
    /// Optional explicit duration in days. When `None`, the backend
    /// reuses the active `transaksi.lama_pinjam_hari` setting so the
    /// extension matches the current default loan window.
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanPerpanjangResult {
    pub header: PeminjamanRow,
    pub kali_perpanjangan: i64,
    pub max_perpanjangan: i64,
    pub tanggal_jatuh_tempo_lama: String,
    pub tanggal_jatuh_tempo_baru: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeminjamanReturnResult {
    pub items: Vec<PeminjamanItemRow>,
    pub total_denda: i64,
    pub total_bayar: i64,
    pub status_header: String,
    /// FEAT-18: when the returned book(s) had a waiting reservasi, the
    /// front-of-queue entry is auto-promoted to `siap_diambil` and
    /// returned here so the UI can show "Buku ini di-reserve oleh ...,
    /// simpan di rak ..." toast. May contain multiple entries when more
    /// than one returned buku had a queue.
    pub reservasi_promoted: Vec<crate::commands::reservasi::ReservasiPromotedNotif>,
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
pub struct AnggotaLoanSummary {
    pub total_peminjaman: i64,
    pub total_item: i64,
    pub aktif_count: i64,
    pub overdue_count: i64,
    pub total_denda: i64,
    pub total_bayar: i64,
    pub last_pinjam: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaTopBuku {
    pub buku_id: i64,
    pub kode_buku: String,
    pub judul: String,
    pub jumlah: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaLoanHistoryRow {
    pub peminjaman_id: i64,
    pub nomor_pinjam: String,
    pub tanggal_pinjam: String,
    pub tanggal_jatuh_tempo: String,
    pub tanggal_kembali: Option<String>,
    pub status: String,
    pub total_item: i64,
    pub total_denda: i64,
    pub buku_judul_pertama: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaLoanHistory {
    pub summary: AnggotaLoanSummary,
    pub top_buku: Vec<AnggotaTopBuku>,
    pub history: Vec<AnggotaLoanHistoryRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverdueRow {
    pub peminjaman_id: i64,
    pub item_id: i64,
    pub nomor_pinjam: String,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub anggota_kelas: Option<String>,
    pub buku_id: i64,
    pub buku_judul: String,
    pub buku_kode: String,
    pub tanggal_pinjam: String,
    pub tanggal_jatuh_tempo: String,
    pub hari_terlambat: i64,
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

/// Read a boolean-ish setting. Treats `"1"` / `"true"` / `"yes"` as true,
/// `"0"` / `"false"` / `"no"` as false (case-insensitive). Falls back to
/// `default` for missing or unparseable values so a partially-migrated
/// settings row never crashes the perpanjang flow.
fn setting_bool(conn: &rusqlite::Connection, key: &str, default: bool) -> bool {
    let row: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()
        .unwrap_or(None);
    match row.as_deref().map(|s| s.trim().to_ascii_lowercase()) {
        Some(s) if s == "1" || s == "true" || s == "yes" => true,
        Some(s) if s == "0" || s == "false" || s == "no" => false,
        _ => default,
    }
}

/// Read `transaksi.hari_libur` from settings as a comma-separated list of
/// 0..=6 weekday indices (`0=Minggu .. 6=Sabtu`, matching JS
/// `Date.getDay()`). Falls back to `DEFAULT_HARI_LIBUR` when the setting
/// is missing or unparseable.
fn setting_hari_libur(conn: &rusqlite::Connection) -> Vec<u32> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'transaksi.hari_libur'",
            [],
            |r| r.get(0),
        )
        .optional()
        .unwrap_or(None);
    let Some(raw) = raw else {
        return DEFAULT_HARI_LIBUR.to_vec();
    };
    let parsed: Vec<u32> = raw
        .split(',')
        .filter_map(|s| s.trim().parse::<u32>().ok())
        .filter(|d| *d <= 6)
        .collect();
    if parsed.is_empty() {
        DEFAULT_HARI_LIBUR.to_vec()
    } else {
        parsed
    }
}

/// Count days strictly *after* `jatuh_tempo` up to and including `today`,
/// skipping any weekday whose `Datelike::weekday().num_days_from_sunday()`
/// matches a value in `hari_libur` (0=Minggu..6=Sabtu).
///
/// Returns 0 when `today <= jatuh_tempo`. The Aturan Peminjaman tab
/// (`apps/desktop/src/lib/settings.ts`) describes this skip behaviour;
/// the previous backend code multiplied raw calendar days by
/// `denda_per_hari` and ignored hari_libur entirely (BUG-09 audit
/// finding in the v1.0.7 batch).
fn billable_late_days(jatuh_tempo: NaiveDate, today: NaiveDate, hari_libur: &[u32]) -> i64 {
    use chrono::Datelike;
    if today <= jatuh_tempo {
        return 0;
    }
    let mut day = jatuh_tempo;
    let mut count = 0_i64;
    while day < today {
        // Each iteration advances to the *next* day, then counts it if
        // not a holiday weekday.
        day = day.succ_opt().expect("date overflow");
        let dow = day.weekday().num_days_from_sunday();
        if !hari_libur.contains(&dow) {
            count += 1;
        }
    }
    count
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
        kali_perpanjangan: row.get("kali_perpanjangan")?,
        tanggal_perpanjangan_terakhir: row.get("tanggal_perpanjangan_terakhir")?,
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
                COALESCE(p.kali_perpanjangan, 0) AS kali_perpanjangan, \
                p.tanggal_perpanjangan_terakhir, \
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EksemplarResolved {
    pub eksemplar_id: i64,
    pub kode_eksemplar: String,
    pub status: String,
    pub buku_id: i64,
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: Option<String>,
}

pub fn eksemplar_resolve_inner(
    conn: &rusqlite::Connection,
    kode: &str,
) -> AppResult<Option<EksemplarResolved>> {
    let row: Option<EksemplarResolved> = conn
        .query_row(
            "SELECT e.id, e.kode_eksemplar, e.status, b.id, b.kode_buku, b.judul, b.pengarang \
             FROM eksemplar e JOIN buku b ON b.id = e.buku_id \
             WHERE e.kode_eksemplar = ?1",
            params![kode.trim()],
            |r| {
                Ok(EksemplarResolved {
                    eksemplar_id: r.get(0)?,
                    kode_eksemplar: r.get(1)?,
                    status: r.get(2)?,
                    buku_id: r.get(3)?,
                    kode_buku: r.get(4)?,
                    judul: r.get(5)?,
                    pengarang: r.get(6)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Look up an eksemplar by its physical barcode (kode_eksemplar).
/// Returns None if no eksemplar matches. Used by the webcam circulation
/// mode when the operator scans a book copy's spine label.
#[tauri::command]
pub fn eksemplar_resolve(
    state: State<'_, AppState>,
    kode: String,
) -> AppResult<Option<EksemplarResolved>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    eksemplar_resolve_inner(&conn, &kode)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveLoanForEksemplar {
    pub peminjaman_id: i64,
    pub peminjaman_item_id: i64,
    pub nomor_pinjam: String,
    pub anggota_id: i64,
    pub anggota_kode: String,
    pub anggota_nama: String,
    pub buku_id: i64,
    pub kode_buku: String,
    pub judul: String,
    pub eksemplar_id: i64,
    pub kode_eksemplar: String,
    pub tanggal_pinjam: String,
    pub tanggal_jatuh_tempo: String,
}

pub fn peminjaman_aktif_by_eksemplar_inner(
    conn: &rusqlite::Connection,
    kode: &str,
) -> AppResult<Option<ActiveLoanForEksemplar>> {
    let row: Option<ActiveLoanForEksemplar> = conn
        .query_row(
            "SELECT pi.peminjaman_id, pi.id, p.nomor_pinjam, \
                    a.id, a.kode_anggota, a.nama, \
                    b.id, b.kode_buku, b.judul, \
                    e.id, e.kode_eksemplar, \
                    p.tanggal_pinjam, p.tanggal_jatuh_tempo \
             FROM peminjaman_item pi \
             JOIN peminjaman p ON p.id = pi.peminjaman_id \
             JOIN anggota a ON a.id = p.anggota_id \
             JOIN eksemplar e ON e.id = pi.eksemplar_id \
             JOIN buku b ON b.id = pi.buku_id \
             WHERE e.kode_eksemplar = ?1 AND pi.status = 'dipinjam' \
             ORDER BY pi.id DESC LIMIT 1",
            params![kode.trim()],
            |r| {
                Ok(ActiveLoanForEksemplar {
                    peminjaman_id: r.get(0)?,
                    peminjaman_item_id: r.get(1)?,
                    nomor_pinjam: r.get(2)?,
                    anggota_id: r.get(3)?,
                    anggota_kode: r.get(4)?,
                    anggota_nama: r.get(5)?,
                    buku_id: r.get(6)?,
                    kode_buku: r.get(7)?,
                    judul: r.get(8)?,
                    eksemplar_id: r.get(9)?,
                    kode_eksemplar: r.get(10)?,
                    tanggal_pinjam: r.get(11)?,
                    tanggal_jatuh_tempo: r.get(12)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Find the active (status='dipinjam') loan item for the given eksemplar
/// barcode. Returns None when the copy is not currently borrowed. Used
/// during the webcam-driven return flow.
#[tauri::command]
pub fn peminjaman_aktif_by_eksemplar(
    state: State<'_, AppState>,
    kode: String,
) -> AppResult<Option<ActiveLoanForEksemplar>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    peminjaman_aktif_by_eksemplar_inner(&conn, &kode)
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

/// Inner implementation that takes a borrowed `Connection` so unit tests
/// can drive it without spinning up a Tauri `AppState`. The public
/// `peminjaman_create` command is a thin wrapper that locks the shared
/// state and forwards to this function.
pub fn peminjaman_create_inner(
    conn: &mut rusqlite::Connection,
    input: PeminjamanCreateInput,
) -> AppResult<PeminjamanDetail> {
    if input.buku_ids.is_empty() {
        return Err(AppError::Validation("buku_ids tidak boleh kosong".into()));
    }

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

    let maks = setting_int(conn, "transaksi.maks_buku_pinjam", DEFAULT_MAKS_PINJAM);
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
        conn,
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

    // When the caller supplies a per-row eksemplar override, validate the
    // shape upfront so we don't open a transaction we have to roll back.
    let eksemplar_overrides = match input.eksemplar_ids.as_ref() {
        Some(list) if list.is_empty() => None,
        Some(list) => {
            if list.len() != input.buku_ids.len() {
                return Err(AppError::Validation(
                    "eksemplar_ids harus sama panjang dengan buku_ids".into(),
                ));
            }
            Some(list.clone())
        }
        None => None,
    };

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

    for (idx, buku_id) in input.buku_ids.iter().enumerate() {
        let eksemplar_id = if let Some(overrides) = eksemplar_overrides.as_ref() {
            // Caller (typically the Sirkulasi webcam page) scanned a
            // specific physical copy — make sure that copy is tersedia
            // and actually belongs to the requested buku before booking
            // it. Anything else means the operator scanned the wrong
            // barcode or the basket got out of sync, both of which
            // deserve a clear validation error.
            let ek = overrides[idx];
            let row: Option<(i64, i64, String)> = tx
                .query_row(
                    "SELECT id, buku_id, status FROM eksemplar WHERE id = ?1",
                    params![ek],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get::<_, String>(2)?)),
                )
                .optional()?;
            let (_, owner_buku_id, status) = row.ok_or_else(|| {
                AppError::Validation(format!("eksemplar id={ek} tidak ditemukan"))
            })?;
            if owner_buku_id != *buku_id {
                return Err(AppError::Validation(format!(
                    "eksemplar id={ek} bukan milik buku id={buku_id}"
                )));
            }
            if status != "tersedia" {
                return Err(AppError::Validation(format!(
                    "eksemplar id={ek} tidak tersedia (status={status})"
                )));
            }
            ek
        } else {
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
            eksemplar_id
        };
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

    let header = select_peminjaman_row(conn, peminjaman_id)?;
    let items = list_items_for(conn, peminjaman_id)?;
    Ok(PeminjamanDetail { header, items })
}

#[tauri::command]
pub fn peminjaman_create(
    state: State<'_, AppState>,
    input: PeminjamanCreateInput,
) -> AppResult<PeminjamanDetail> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    peminjaman_create_inner(&mut conn, input)
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
    let hari_libur = setting_hari_libur(&conn);
    let today = chrono::Local::now().date_naive();
    let bayar = input.bayar.unwrap_or(0).max(0);

    let tx = conn.transaction()?;
    let mut total_denda = 0_i64;
    let mut returned_buku_ids: Vec<i64> = Vec::new();

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
        let hari_telat = billable_late_days(jt, today, &hari_libur);
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
        if !returned_buku_ids.contains(&buku_id) {
            returned_buku_ids.push(buku_id);
        }
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

    // FEAT-18: for each unique buku just returned, promote the front of
    // the reservasi queue (if any). Only promote when the book is no
    // longer borrowed by anyone — multiple eksemplar with one still on
    // loan should keep the queue waiting.
    let mut reservasi_promoted = Vec::new();
    for buku_id in &returned_buku_ids {
        let still_borrowed: i64 = tx.query_row(
            "SELECT COUNT(*) FROM peminjaman_item WHERE buku_id = ?1 AND status = 'dipinjam'",
            params![buku_id],
            |r| r.get(0),
        )?;
        if still_borrowed == 0 {
            if let Some(notif) =
                crate::commands::reservasi::promote_next_in_queue(&tx, *buku_id, today)?
            {
                reservasi_promoted.push(notif);
            }
        }
    }

    tx.commit()?;

    let items = list_items_for(&conn, input.peminjaman_id)?;
    let header = select_peminjaman_row(&conn, input.peminjaman_id)?;

    Ok(PeminjamanReturnResult {
        items,
        total_denda: header.total_denda,
        total_bayar: header.total_bayar,
        status_header: new_status,
        reservasi_promoted,
    })
}

/// FEAT-17 inner: extend a single peminjaman by `days` (or by the
/// configured default loan window when `days` is `None`). Pure-conn so
/// the unit tests can exercise the blocking logic without a live
/// `AppState`.
pub fn peminjaman_perpanjang_inner(
    conn: &mut rusqlite::Connection,
    input: &PeminjamanPerpanjangInput,
    user_id: Option<i64>,
) -> AppResult<PeminjamanPerpanjangResult> {
    let max_perpanjangan =
        setting_int(conn, "peminjaman.max_perpanjangan", DEFAULT_MAX_PERPANJANGAN)
            .clamp(0, MAX_PERPANJANGAN_HARD_CAP);
    if max_perpanjangan == 0 {
        return Err(AppError::Validation(
            "Perpanjangan dinonaktifkan oleh admin".into(),
        ));
    }
    let block_jika_denda = setting_bool(
        conn,
        "peminjaman.block_perpanjangan_jika_denda",
        DEFAULT_BLOCK_PERPANJANGAN_JIKA_DENDA,
    );
    let lama_pinjam_hari =
        setting_int(conn, "transaksi.lama_pinjam_hari", DEFAULT_LAMA_PINJAM_HARI).clamp(1, 365);
    let days = input
        .days
        .map(|d| d.clamp(1, 365))
        .unwrap_or(lama_pinjam_hari);

    // Snapshot peminjaman header and its item buku_ids.
    let header_row: Option<(i64, String, String, i64, i64, i64)> = conn
        .query_row(
            "SELECT id, status, tanggal_jatuh_tempo, total_denda, total_bayar, \
                    COALESCE(kali_perpanjangan, 0) \
             FROM peminjaman WHERE id = ?1",
            params![input.peminjaman_id],
            |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            },
        )
        .optional()?;
    let (id, status, tanggal_jatuh_tempo_lama, total_denda, total_bayar, kali_now) = header_row
        .ok_or_else(|| AppError::NotFound(format!("peminjaman id={}", input.peminjaman_id)))?;

    if status == "dikembalikan" || status == "hilang" {
        return Err(AppError::Validation(format!(
            "peminjaman sudah berstatus {status}, tidak bisa diperpanjang"
        )));
    }

    // At least one item must still be on loan, otherwise there is nothing
    // left to extend.
    let item_dipinjam: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman_item \
         WHERE peminjaman_id = ?1 AND status = 'dipinjam'",
        params![id],
        |r| r.get(0),
    )?;
    if item_dipinjam == 0 {
        return Err(AppError::Validation(
            "Semua eksemplar sudah dikembalikan, tidak ada yang bisa diperpanjang".into(),
        ));
    }

    if kali_now >= max_perpanjangan {
        return Err(AppError::Validation(format!(
            "Sudah tidak bisa diperpanjang (maksimum {max_perpanjangan}×)"
        )));
    }

    if block_jika_denda {
        let outstanding = total_denda - total_bayar;
        if outstanding > 0 {
            return Err(AppError::Validation(
                "Lunasi denda terlebih dahulu sebelum memperpanjang".into(),
            ));
        }
    }

    // FEAT-17 ↔ FEAT-18: refuse when any of the borrowed buku has an
    // active reservasi. Surfacing the next anggota's name makes the
    // toast actionable ("Buku X sudah dipesan oleh Andi").
    let buku_ids: Vec<i64> = {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT buku_id FROM peminjaman_item \
             WHERE peminjaman_id = ?1 AND status = 'dipinjam'",
        )?;
        let rows = stmt
            .query_map(params![id], |r| r.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let active = crate::commands::reservasi::reservasi_active_for_buku_ids(conn, &buku_ids)?;
    if let Some(first) = active.first() {
        return Err(AppError::Validation(format!(
            "Buku \"{}\" sudah dipesan oleh {} — tidak bisa diperpanjang",
            first.buku_judul, first.anggota_nama
        )));
    }

    // All checks passed — perform the extension inside a transaction.
    let old_jt = parse_date(&tanggal_jatuh_tempo_lama)?;
    let new_jt = old_jt
        .checked_add_days(chrono::Days::new(days as u64))
        .ok_or_else(|| AppError::Validation("tanggal jatuh tempo overflow".into()))?;
    let new_jt_str = new_jt.format("%Y-%m-%d").to_string();
    let today_str = today_iso();
    let kali_baru = kali_now + 1;

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE peminjaman SET tanggal_jatuh_tempo = ?1, \
         kali_perpanjangan = ?2, tanggal_perpanjangan_terakhir = ?3, \
         updated_at = datetime('now') WHERE id = ?4",
        params![new_jt_str, kali_baru, today_str, id],
    )?;
    // Re-evaluate header status — extending may flip 'terlambat' → 'dipinjam'.
    refresh_header_status(&tx, id)?;

    let detail = serde_json::json!({
        "loan_id": id,
        "tanggal_jatuh_tempo_lama": tanggal_jatuh_tempo_lama,
        "tanggal_jatuh_tempo_baru": new_jt_str,
        "kali_ke": kali_baru,
        "max_perpanjangan": max_perpanjangan,
        "days": days,
    });
    crate::commands::kas::insert_audit_log(
        &tx,
        user_id,
        "perpanjang_peminjaman",
        "peminjaman",
        Some(id),
        &detail,
    )?;
    tx.commit()?;

    let header = select_peminjaman_row(conn, id)?;
    Ok(PeminjamanPerpanjangResult {
        kali_perpanjangan: kali_baru,
        max_perpanjangan,
        tanggal_jatuh_tempo_lama,
        tanggal_jatuh_tempo_baru: new_jt_str,
        header,
    })
}

#[tauri::command]
pub fn peminjaman_perpanjang(
    state: State<'_, AppState>,
    input: PeminjamanPerpanjangInput,
) -> AppResult<PeminjamanPerpanjangResult> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    peminjaman_perpanjang_inner(&mut conn, &input, None)
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

pub fn peminjaman_overdue_list_inner(
    conn: &rusqlite::Connection,
    limit: Option<i64>,
) -> AppResult<Vec<OverdueRow>> {
    let cap = limit.unwrap_or(50).clamp(1, 500);
    let mut stmt = conn.prepare(
        "SELECT p.id, pi.id, p.nomor_pinjam, a.id, a.nama, a.kode_anggota, a.kelas, \
                b.id, b.judul, b.kode_buku, p.tanggal_pinjam, p.tanggal_jatuh_tempo, \
                CAST(julianday(date('now')) - julianday(p.tanggal_jatuh_tempo) AS INTEGER) AS hari_terlambat \
         FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         JOIN anggota a ON a.id = p.anggota_id \
         JOIN buku b ON b.id = pi.buku_id \
         WHERE pi.status = 'dipinjam' \
           AND p.tanggal_jatuh_tempo < date('now') \
         ORDER BY hari_terlambat DESC, p.tanggal_jatuh_tempo ASC \
         LIMIT ?1",
    )?;
    let rows = stmt
        .query_map(params![cap], |r| {
            Ok(OverdueRow {
                peminjaman_id: r.get(0)?,
                item_id: r.get(1)?,
                nomor_pinjam: r.get(2)?,
                anggota_id: r.get(3)?,
                anggota_nama: r.get(4)?,
                anggota_kode: r.get(5)?,
                anggota_kelas: r.get(6)?,
                buku_id: r.get(7)?,
                buku_judul: r.get(8)?,
                buku_kode: r.get(9)?,
                tanggal_pinjam: r.get(10)?,
                tanggal_jatuh_tempo: r.get(11)?,
                hari_terlambat: r.get(12)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub fn peminjaman_overdue_list(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<OverdueRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    peminjaman_overdue_list_inner(&conn, limit)
}

pub fn anggota_loan_history_inner(
    conn: &rusqlite::Connection,
    id: i64,
    limit: Option<i64>,
) -> AppResult<AnggotaLoanHistory> {
    let cap = limit.unwrap_or(100).clamp(1, 1000);

    // Reject unknown anggota with NotFound so the UI can redirect.
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM anggota WHERE id = ?1",
            params![id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(AppError::NotFound(format!("anggota id={id}")));
    }

    // Header-level aggregates (one row per peminjaman). Counted separately
    // from item-level aggregates so the LEFT JOIN below does not multiply
    // total_denda / total_bayar by item count.
    let (total_peminjaman, total_denda, total_bayar, last_pinjam): (
        i64,
        i64,
        i64,
        Option<String>,
    ) = conn.query_row(
        "SELECT COUNT(*), \
                COALESCE(SUM(total_denda), 0), \
                COALESCE(SUM(total_bayar), 0), \
                MAX(tanggal_pinjam) \
         FROM peminjaman WHERE anggota_id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;

    // Item-level aggregates. Joined back to peminjaman to filter overdue
    // items via the header's tanggal_jatuh_tempo.
    let (total_item, aktif_count, overdue_count): (i64, i64, i64) = conn.query_row(
        "SELECT \
            COALESCE(COUNT(*), 0), \
            COALESCE(SUM(CASE WHEN pi.status = 'dipinjam' THEN 1 ELSE 0 END), 0), \
            COALESCE(SUM(CASE WHEN pi.status = 'dipinjam' \
                              AND p.tanggal_jatuh_tempo < date('now') THEN 1 ELSE 0 END), 0) \
         FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )?;

    let summary = AnggotaLoanSummary {
        total_peminjaman,
        total_item,
        aktif_count,
        overdue_count,
        total_denda,
        total_bayar,
        last_pinjam,
    };

    let mut top_stmt = conn.prepare(
        "SELECT b.id, b.kode_buku, b.judul, COUNT(*) AS jumlah \
         FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         JOIN buku b ON b.id = pi.buku_id \
         WHERE p.anggota_id = ?1 \
         GROUP BY b.id, b.kode_buku, b.judul \
         ORDER BY jumlah DESC, b.judul ASC \
         LIMIT 5",
    )?;
    let top_buku: Vec<AnggotaTopBuku> = top_stmt
        .query_map(params![id], |r| {
            Ok(AnggotaTopBuku {
                buku_id: r.get(0)?,
                kode_buku: r.get(1)?,
                judul: r.get(2)?,
                jumlah: r.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut hist_stmt = conn.prepare(
        "SELECT p.id, p.nomor_pinjam, p.tanggal_pinjam, p.tanggal_jatuh_tempo, \
                p.tanggal_kembali, p.status, p.total_denda, \
                COALESCE((SELECT COUNT(*) FROM peminjaman_item pi WHERE pi.peminjaman_id = p.id), 0), \
                (SELECT b.judul FROM peminjaman_item pi \
                 JOIN buku b ON b.id = pi.buku_id \
                 WHERE pi.peminjaman_id = p.id ORDER BY pi.id ASC LIMIT 1) \
         FROM peminjaman p \
         WHERE p.anggota_id = ?1 \
         ORDER BY p.tanggal_pinjam DESC, p.id DESC \
         LIMIT ?2",
    )?;
    let history: Vec<AnggotaLoanHistoryRow> = hist_stmt
        .query_map(params![id, cap], |r| {
            Ok(AnggotaLoanHistoryRow {
                peminjaman_id: r.get(0)?,
                nomor_pinjam: r.get(1)?,
                tanggal_pinjam: r.get(2)?,
                tanggal_jatuh_tempo: r.get(3)?,
                tanggal_kembali: r.get(4)?,
                status: r.get(5)?,
                total_denda: r.get(6)?,
                total_item: r.get(7)?,
                buku_judul_pertama: r.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(AnggotaLoanHistory {
        summary,
        top_buku,
        history,
    })
}

#[tauri::command]
pub fn anggota_loan_history(
    state: State<'_, AppState>,
    id: i64,
    limit: Option<i64>,
) -> AppResult<AnggotaLoanHistory> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    anggota_loan_history_inner(&conn, id, limit)
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

    /// Seed an anggota row directly. Returns the assigned id.
    fn seed_anggota(conn: &Connection, kode: &str, nama: &str, kelas: Option<&str>) -> i64 {
        conn.execute(
            "INSERT INTO anggota (kode_anggota, nama, kelas, aktif) VALUES (?1, ?2, ?3, 1)",
            params![kode, nama, kelas],
        )
        .expect("seed anggota");
        conn.last_insert_rowid()
    }

    /// Seed a buku row directly. Returns the assigned id.
    fn seed_buku(conn: &Connection, kode: &str, judul: &str) -> i64 {
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia) \
             VALUES (?1, ?2, 1, 1)",
            params![kode, judul],
        )
        .expect("seed buku");
        conn.last_insert_rowid()
    }

    /// Seed a peminjaman_item with the specified jatuh_tempo. Returns
    /// (peminjaman_id, item_id).
    fn seed_pinjaman(
        conn: &Connection,
        nomor: &str,
        anggota_id: i64,
        buku_id: i64,
        tanggal_pinjam: &str,
        tanggal_jatuh_tempo: &str,
        item_status: &str,
    ) -> (i64, i64) {
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, \
             tanggal_jatuh_tempo, status) VALUES (?1, ?2, ?3, ?4, 'dipinjam')",
            params![nomor, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo],
        )
        .expect("seed peminjaman");
        let pmj_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status) \
             VALUES (?1, ?2, ?3)",
            params![pmj_id, buku_id, item_status],
        )
        .expect("seed peminjaman_item");
        let item_id = conn.last_insert_rowid();
        (pmj_id, item_id)
    }

    #[test]
    fn overdue_list_returns_empty_when_no_data() {
        let conn = setup_db();
        let rows = peminjaman_overdue_list_inner(&conn, None).expect("query");
        assert!(rows.is_empty());
    }

    #[test]
    fn overdue_list_includes_only_due_dates_in_the_past_with_status_dipinjam() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", Some("X-A"));
        let bid = seed_buku(&conn, "B0001", "Matematika 1");

        // overdue (15 days late)
        seed_pinjaman(&conn, "PJ-001", aid, bid, "2020-01-01", "2020-01-08", "dipinjam");
        // due-tomorrow (not overdue)
        let future = chrono::Local::now()
            .date_naive()
            .checked_add_days(chrono::Days::new(7))
            .unwrap()
            .to_string();
        seed_pinjaman(&conn, "PJ-002", aid, bid, "2026-05-01", &future, "dipinjam");
        // overdue but already returned (item status = dikembalikan)
        seed_pinjaman(
            &conn, "PJ-003", aid, bid, "2020-01-01", "2020-01-08", "dikembalikan",
        );

        let rows = peminjaman_overdue_list_inner(&conn, None).expect("query");
        assert_eq!(rows.len(), 1);
        let r = &rows[0];
        assert_eq!(r.nomor_pinjam, "PJ-001");
        assert_eq!(r.anggota_kode, "A0001");
        assert_eq!(r.anggota_kelas.as_deref(), Some("X-A"));
        assert_eq!(r.buku_kode, "B0001");
        assert!(r.hari_terlambat > 0);
    }

    #[test]
    fn overdue_list_orders_by_days_late_descending() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", None);
        let b1 = seed_buku(&conn, "B0001", "A");
        let b2 = seed_buku(&conn, "B0002", "B");
        // 5 days late
        seed_pinjaman(
            &conn,
            "PJ-A",
            aid,
            b1,
            "2020-01-01",
            &chrono::Local::now()
                .date_naive()
                .checked_sub_days(chrono::Days::new(5))
                .unwrap()
                .to_string(),
            "dipinjam",
        );
        // 30 days late
        seed_pinjaman(
            &conn,
            "PJ-B",
            aid,
            b2,
            "2020-01-01",
            &chrono::Local::now()
                .date_naive()
                .checked_sub_days(chrono::Days::new(30))
                .unwrap()
                .to_string(),
            "dipinjam",
        );

        let rows = peminjaman_overdue_list_inner(&conn, None).expect("query");
        assert_eq!(rows.len(), 2);
        // Most-late first.
        assert_eq!(rows[0].nomor_pinjam, "PJ-B");
        assert_eq!(rows[1].nomor_pinjam, "PJ-A");
        assert!(rows[0].hari_terlambat >= 30);
        assert!(rows[1].hari_terlambat >= 5 && rows[1].hari_terlambat < 30);
    }

    #[test]
    fn overdue_list_clamps_limit_to_valid_range() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", None);
        let bid = seed_buku(&conn, "B0001", "X");
        for i in 0..5 {
            seed_pinjaman(
                &conn,
                &format!("PJ-{i}"),
                aid,
                bid,
                "2020-01-01",
                "2020-02-01",
                "dipinjam",
            );
        }

        // limit=2 returns first 2 rows
        let rows = peminjaman_overdue_list_inner(&conn, Some(2)).expect("query");
        assert_eq!(rows.len(), 2);
        // limit=0 → clamped up to 1
        let rows = peminjaman_overdue_list_inner(&conn, Some(0)).expect("query");
        assert_eq!(rows.len(), 1);
        // negative → clamped up to 1
        let rows = peminjaman_overdue_list_inner(&conn, Some(-1)).expect("query");
        assert_eq!(rows.len(), 1);
        // None → default 50, returns all 5
        let rows = peminjaman_overdue_list_inner(&conn, None).expect("query");
        assert_eq!(rows.len(), 5);
    }

    #[test]
    fn loan_history_returns_not_found_for_unknown_anggota() {
        let conn = setup_db();
        let err = anggota_loan_history_inner(&conn, 999, None).expect_err("unknown");
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn loan_history_returns_zeroed_summary_when_no_loans() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", None);
        let h = anggota_loan_history_inner(&conn, aid, None).expect("query");
        assert_eq!(h.summary.total_peminjaman, 0);
        assert_eq!(h.summary.total_item, 0);
        assert_eq!(h.summary.aktif_count, 0);
        assert_eq!(h.summary.overdue_count, 0);
        assert_eq!(h.summary.total_denda, 0);
        assert_eq!(h.summary.total_bayar, 0);
        assert!(h.summary.last_pinjam.is_none());
        assert!(h.history.is_empty());
        assert!(h.top_buku.is_empty());
    }

    #[test]
    fn loan_history_aggregates_summary_top_buku_and_history() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", Some("X-A"));
        let other = seed_anggota(&conn, "A0002", "Ani", None);
        let b1 = seed_buku(&conn, "B0001", "Matematika 1");
        let b2 = seed_buku(&conn, "B0002", "Sejarah");

        // Three peminjaman for Budi:
        //   PJ-1: 2024-01-05, 2 books (b1+b1) - dipinjam (still active, on time)
        //   PJ-2: 2024-02-10, 1 book (b1)     - dikembalikan
        //   PJ-3: 2020-03-01, 1 book (b2)     - overdue (still dipinjam)
        // One peminjaman for Ani — must be excluded.
        seed_pinjaman(&conn, "PJ-1", aid, b1, "2024-01-05", "2099-01-12", "dipinjam");
        // Add second item to PJ-1 so total_item > 1.
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status) \
             SELECT id, ?1, 'dikembalikan' FROM peminjaman WHERE nomor_pinjam = 'PJ-1'",
            params![b1],
        )
        .expect("seed extra item PJ-1");
        // Bump total_denda for PJ-1.
        conn.execute(
            "UPDATE peminjaman SET total_denda = 1500, total_bayar = 1500 \
             WHERE nomor_pinjam = 'PJ-1'",
            [],
        )
        .expect("update denda PJ-1");

        seed_pinjaman(
            &conn, "PJ-2", aid, b1, "2024-02-10", "2024-02-17", "dikembalikan",
        );
        conn.execute(
            "UPDATE peminjaman SET status = 'dikembalikan', total_denda = 500, total_bayar = 500 \
             WHERE nomor_pinjam = 'PJ-2'",
            [],
        )
        .expect("update PJ-2");

        seed_pinjaman(&conn, "PJ-3", aid, b2, "2020-03-01", "2020-03-08", "dipinjam");

        seed_pinjaman(
            &conn, "PJ-X", other, b1, "2024-01-01", "2024-01-08", "dipinjam",
        );

        let h = anggota_loan_history_inner(&conn, aid, None).expect("query");
        assert_eq!(h.summary.total_peminjaman, 3);
        assert_eq!(h.summary.total_item, 4); // 2+1+1
        assert_eq!(h.summary.aktif_count, 2); // PJ-1 first item still dipinjam + PJ-3
        assert_eq!(h.summary.overdue_count, 1); // PJ-3 only
        assert_eq!(h.summary.total_denda, 2000);
        assert_eq!(h.summary.total_bayar, 2000);
        assert_eq!(h.summary.last_pinjam.as_deref(), Some("2024-02-10"));

        // top_buku ordered by count desc; b1 has 3 borrows, b2 has 1.
        assert_eq!(h.top_buku.len(), 2);
        assert_eq!(h.top_buku[0].kode_buku, "B0001");
        assert_eq!(h.top_buku[0].jumlah, 3);
        assert_eq!(h.top_buku[1].kode_buku, "B0002");
        assert_eq!(h.top_buku[1].jumlah, 1);

        // history ordered by tanggal_pinjam DESC.
        assert_eq!(h.history.len(), 3);
        assert_eq!(h.history[0].nomor_pinjam, "PJ-2");
        assert_eq!(h.history[0].total_item, 1);
        assert_eq!(h.history[1].nomor_pinjam, "PJ-1");
        assert_eq!(h.history[1].total_item, 2);
        assert_eq!(h.history[2].nomor_pinjam, "PJ-3");
        assert_eq!(h.history[2].buku_judul_pertama.as_deref(), Some("Sejarah"));
    }

    #[test]
    fn loan_history_clamps_limit() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Budi", None);
        let bid = seed_buku(&conn, "B0001", "X");
        for i in 0..5 {
            seed_pinjaman(
                &conn,
                &format!("PJ-{i}"),
                aid,
                bid,
                &format!("2024-01-0{}", i + 1),
                &format!("2024-01-1{}", i + 1),
                "dikembalikan",
            );
        }
        // limit=2 returns most recent 2
        let h = anggota_loan_history_inner(&conn, aid, Some(2)).expect("query");
        assert_eq!(h.history.len(), 2);
        // limit=0 → clamped to 1
        let h = anggota_loan_history_inner(&conn, aid, Some(0)).expect("query");
        assert_eq!(h.history.len(), 1);
        // None → default 100, returns all 5
        let h = anggota_loan_history_inner(&conn, aid, None).expect("query");
        assert_eq!(h.history.len(), 5);
    }

    /// Helper to seed a buku + named eksemplar with explicit status. Returns
    /// the (buku_id, eksemplar_id) tuple.
    fn seed_buku_with_eksemplar(
        conn: &Connection,
        kode_buku: &str,
        judul: &str,
        kode_eksemplar: &str,
        status: &str,
    ) -> (i64, i64) {
        let bid = seed_buku(conn, kode_buku, judul);
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, ?2, ?3)",
            params![bid, kode_eksemplar, status],
        )
        .expect("seed eksemplar");
        let eid = conn.last_insert_rowid();
        (bid, eid)
    }

    #[test]
    fn eksemplar_resolve_returns_none_for_unknown_kode() {
        let conn = setup_db();
        seed_buku_with_eksemplar(&conn, "B-001", "Sample", "B-001-01", "tersedia");
        let resolved = eksemplar_resolve_inner(&conn, "DOES-NOT-EXIST").expect("query");
        assert!(resolved.is_none());
    }

    #[test]
    fn eksemplar_resolve_trims_input_and_returns_metadata() {
        let conn = setup_db();
        let (bid, eid) =
            seed_buku_with_eksemplar(&conn, "B-001", "Bumi Manusia", "B-001-01", "tersedia");
        let resolved = eksemplar_resolve_inner(&conn, "  B-001-01  ")
            .expect("query")
            .expect("found");
        assert_eq!(resolved.eksemplar_id, eid);
        assert_eq!(resolved.buku_id, bid);
        assert_eq!(resolved.kode_buku, "B-001");
        assert_eq!(resolved.judul, "Bumi Manusia");
        assert_eq!(resolved.kode_eksemplar, "B-001-01");
        assert_eq!(resolved.status, "tersedia");
    }

    #[test]
    fn aktif_by_eksemplar_returns_none_when_kode_not_loaned() {
        let conn = setup_db();
        seed_buku_with_eksemplar(&conn, "B-001", "Sample", "B-001-01", "tersedia");
        let active = peminjaman_aktif_by_eksemplar_inner(&conn, "B-001-01").expect("query");
        assert!(active.is_none());
    }

    #[test]
    fn aktif_by_eksemplar_finds_active_dipinjam_item() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "M-001", "Sari", Some("X-A"));
        let (bid, eid) =
            seed_buku_with_eksemplar(&conn, "B-001", "Bumi Manusia", "B-001-01", "dipinjam");
        // create peminjaman
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, \
             tanggal_jatuh_tempo, status) VALUES (?1, ?2, ?3, ?4, 'dipinjam')",
            params!["PJ-001", aid, "2024-01-01", "2024-01-08"],
        )
        .expect("seed peminjaman");
        let pmj_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, eksemplar_id, status) \
             VALUES (?1, ?2, ?3, 'dipinjam')",
            params![pmj_id, bid, eid],
        )
        .expect("seed item");
        let item_id = conn.last_insert_rowid();

        let active = peminjaman_aktif_by_eksemplar_inner(&conn, "B-001-01")
            .expect("query")
            .expect("found");
        assert_eq!(active.peminjaman_id, pmj_id);
        assert_eq!(active.peminjaman_item_id, item_id);
        assert_eq!(active.anggota_kode, "M-001");
        assert_eq!(active.anggota_nama, "Sari");
        assert_eq!(active.kode_eksemplar, "B-001-01");
        assert_eq!(active.judul, "Bumi Manusia");
    }

    #[test]
    fn peminjaman_create_with_eksemplar_ids_books_the_specific_copies() {
        // Two eksemplar of the same buku — without an override the
        // backend would FIFO-pick e1, but the operator scanned e2 in
        // the webcam basket and we expect e2 to be the one recorded
        // on-loan (BUG-17 regression guard).
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Sari", None);
        let (bid, e1) =
            seed_buku_with_eksemplar(&conn, "B-001", "Bumi Manusia", "B-001-01", "tersedia");
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, 'B-001-02', 'tersedia')",
            params![bid],
        )
        .expect("seed second eksemplar");
        let e2 = conn.last_insert_rowid();

        let detail = peminjaman_create_inner(
            &mut conn,
            PeminjamanCreateInput {
                anggota_id: aid,
                buku_ids: vec![bid],
                eksemplar_ids: Some(vec![e2]),
                tanggal_pinjam: Some("2024-01-01".into()),
                tanggal_jatuh_tempo: Some("2024-01-08".into()),
                catatan: None,
            },
        )
        .expect("create");

        assert_eq!(detail.items.len(), 1);
        assert_eq!(detail.items[0].eksemplar_id, Some(e2));
        // The other eksemplar must remain tersedia.
        let s1: String = conn
            .query_row(
                "SELECT status FROM eksemplar WHERE id = ?1",
                params![e1],
                |r| r.get(0),
            )
            .expect("status e1");
        assert_eq!(s1, "tersedia");
        let s2: String = conn
            .query_row(
                "SELECT status FROM eksemplar WHERE id = ?1",
                params![e2],
                |r| r.get(0),
            )
            .expect("status e2");
        assert_eq!(s2, "dipinjam");
    }

    #[test]
    fn peminjaman_create_without_eksemplar_ids_falls_back_to_fifo() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Sari", None);
        let (bid, e1) =
            seed_buku_with_eksemplar(&conn, "B-001", "Bumi Manusia", "B-001-01", "tersedia");
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, 'B-001-02', 'tersedia')",
            params![bid],
        )
        .expect("seed second eksemplar");

        let detail = peminjaman_create_inner(
            &mut conn,
            PeminjamanCreateInput {
                anggota_id: aid,
                buku_ids: vec![bid],
                eksemplar_ids: None,
                tanggal_pinjam: Some("2024-01-01".into()),
                tanggal_jatuh_tempo: Some("2024-01-08".into()),
                catatan: None,
            },
        )
        .expect("create");

        assert_eq!(detail.items.len(), 1);
        assert_eq!(
            detail.items[0].eksemplar_id,
            Some(e1),
            "FIFO must pick the lowest-id available copy when no override is supplied"
        );
    }

    #[test]
    fn peminjaman_create_rejects_eksemplar_belonging_to_other_buku() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Sari", None);
        let (b1, _e1) =
            seed_buku_with_eksemplar(&conn, "B-001", "Buku Satu", "B-001-01", "tersedia");
        let (_b2, e_other) =
            seed_buku_with_eksemplar(&conn, "B-002", "Buku Dua", "B-002-01", "tersedia");

        let err = peminjaman_create_inner(
            &mut conn,
            PeminjamanCreateInput {
                anggota_id: aid,
                buku_ids: vec![b1],
                eksemplar_ids: Some(vec![e_other]),
                tanggal_pinjam: Some("2024-01-01".into()),
                tanggal_jatuh_tempo: Some("2024-01-08".into()),
                catatan: None,
            },
        )
        .expect_err("must reject eksemplar from another buku");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("bukan milik buku")),
            other => panic!("expected validation error, got {other:?}"),
        }
    }

    #[test]
    fn peminjaman_create_rejects_eksemplar_ids_length_mismatch() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Sari", None);
        let (b1, _) =
            seed_buku_with_eksemplar(&conn, "B-001", "Buku Satu", "B-001-01", "tersedia");

        let err = peminjaman_create_inner(
            &mut conn,
            PeminjamanCreateInput {
                anggota_id: aid,
                buku_ids: vec![b1],
                eksemplar_ids: Some(vec![1, 2]),
                tanggal_pinjam: Some("2024-01-01".into()),
                tanggal_jatuh_tempo: Some("2024-01-08".into()),
                catatan: None,
            },
        )
        .expect_err("must reject mismatched lengths");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("sama panjang")),
            other => panic!("expected validation error, got {other:?}"),
        }
    }

    #[test]
    fn aktif_by_eksemplar_excludes_returned_items() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "M-001", "Sari", None);
        let (bid, eid) =
            seed_buku_with_eksemplar(&conn, "B-001", "Sample", "B-001-01", "tersedia");
        // returned item: status = 'dikembalikan'
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, \
             tanggal_jatuh_tempo, tanggal_kembali, status) \
             VALUES (?1, ?2, ?3, ?4, ?5, 'dikembalikan')",
            params!["PJ-001", aid, "2024-01-01", "2024-01-08", "2024-01-05"],
        )
        .expect("seed peminjaman");
        let pmj_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, eksemplar_id, status, \
             tanggal_kembali) VALUES (?1, ?2, ?3, 'dikembalikan', '2024-01-05')",
            params![pmj_id, bid, eid],
        )
        .expect("seed item");
        let active = peminjaman_aktif_by_eksemplar_inner(&conn, "B-001-01").expect("query");
        assert!(active.is_none(), "returned items must not be reported as active");
    }

    // -----------------------------------------------------------------
    // Aturan Peminjaman audit (BUG-09 in v1.0.7 batch).
    // -----------------------------------------------------------------

    #[test]
    fn default_maks_pinjam_matches_frontend_default() {
        // The frontend `DEFAULT_LOAN_RULES.maksBukuPinjam` is 3 (see
        // apps/desktop/src/lib/settings.ts). When this constant drifts,
        // a fresh install where the user never opens Aturan Peminjaman
        // shows "max 3 buku" in the UI but blocks the 3rd loan in the
        // backend — exactly the BUG-09 report.
        assert_eq!(DEFAULT_MAKS_PINJAM, 3);
    }

    #[test]
    fn setting_hari_libur_falls_back_to_default_when_missing() {
        let conn = setup_db();
        assert_eq!(setting_hari_libur(&conn), DEFAULT_HARI_LIBUR.to_vec());
    }

    #[test]
    fn setting_hari_libur_parses_csv_and_clamps_invalid_entries() {
        let conn = setup_db();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('transaksi.hari_libur', '0,6,99,abc')",
            [],
        ).expect("seed setting");
        // 99 and "abc" must be ignored; 0 (Sun) and 6 (Sat) kept.
        assert_eq!(setting_hari_libur(&conn), vec![0, 6]);
    }

    #[test]
    fn billable_late_days_returns_zero_when_returned_on_or_before_due() {
        let due = NaiveDate::from_ymd_opt(2025, 1, 10).unwrap();
        assert_eq!(billable_late_days(due, due, &[0]), 0);
        let early = NaiveDate::from_ymd_opt(2025, 1, 9).unwrap();
        assert_eq!(billable_late_days(due, early, &[0]), 0);
    }

    #[test]
    fn billable_late_days_skips_sunday_when_configured() {
        // Due 2025-01-10 (Friday). Today 2025-01-13 (Monday).
        // Calendar diff = 3 days (Sat, Sun, Mon). With hari_libur=[0]
        // (Sunday), billable late days = 2.
        let due = NaiveDate::from_ymd_opt(2025, 1, 10).unwrap();
        let today = NaiveDate::from_ymd_opt(2025, 1, 13).unwrap();
        assert_eq!(billable_late_days(due, today, &[0]), 2);
    }

    #[test]
    fn billable_late_days_counts_every_day_when_no_holidays_configured() {
        let due = NaiveDate::from_ymd_opt(2025, 1, 10).unwrap();
        let today = NaiveDate::from_ymd_opt(2025, 1, 20).unwrap();
        assert_eq!(billable_late_days(due, today, &[]), 10);
    }

    #[test]
    fn billable_late_days_skips_full_weekends_when_both_days_configured() {
        // Span Mon 2025-01-13 (due) → Mon 2025-01-20 (today). Calendar
        // diff = 7. Hari libur = [0, 6] (Sun + Sat). The span includes
        // exactly one Sat (1-18) and one Sun (1-19), so billable = 5.
        let due = NaiveDate::from_ymd_opt(2025, 1, 13).unwrap();
        let today = NaiveDate::from_ymd_opt(2025, 1, 20).unwrap();
        assert_eq!(billable_late_days(due, today, &[0, 6]), 5);
    }

    // -----------------------------------------------------------------------
    // FEAT-17: peminjaman_perpanjang_inner
    // -----------------------------------------------------------------------

    fn set_setting(conn: &Connection, key: &str, value: &str) {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .expect("set setting");
    }

    #[test]
    fn perpanjang_extends_jatuh_tempo_and_increments_counter() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _item_id) = seed_pinjaman(
            &conn, "PJ-FEAT17-1", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        set_setting(&conn, "transaksi.lama_pinjam_hari", "7");

        let result = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput {
                peminjaman_id: pmj_id,
                days: None,
            },
            None,
        )
        .expect("perpanjang");

        assert_eq!(result.kali_perpanjangan, 1);
        assert_eq!(result.tanggal_jatuh_tempo_lama, "2026-05-08");
        assert_eq!(result.tanggal_jatuh_tempo_baru, "2026-05-15");
        assert_eq!(result.header.kali_perpanjangan, 1);
        assert_eq!(result.header.tanggal_jatuh_tempo, "2026-05-15");
        assert!(result.header.tanggal_perpanjangan_terakhir.is_some());
    }

    #[test]
    fn perpanjang_uses_explicit_days_when_provided() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-2", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );

        let result = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput {
                peminjaman_id: pmj_id,
                days: Some(14),
            },
            None,
        )
        .expect("perpanjang");
        assert_eq!(result.tanggal_jatuh_tempo_baru, "2026-05-22");
    }

    #[test]
    fn perpanjang_blocks_when_max_reached() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-3", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        set_setting(&conn, "peminjaman.max_perpanjangan", "2");

        peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect("first");
        peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect("second");
        let err = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect_err("third should fail");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("maksimum 2×")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn perpanjang_blocks_when_setting_is_zero() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-4", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        set_setting(&conn, "peminjaman.max_perpanjangan", "0");
        let err = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect_err("should reject");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("dinonaktifkan")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn perpanjang_blocks_when_outstanding_denda_and_setting_on() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-5", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        // pretend the row already has total_denda = 5000 and total_bayar = 0.
        conn.execute(
            "UPDATE peminjaman SET total_denda = 5000 WHERE id = ?1",
            params![pmj_id],
        )
        .unwrap();
        set_setting(&conn, "peminjaman.block_perpanjangan_jika_denda", "true");

        let err = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect_err("should reject");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("Lunasi denda")),
            other => panic!("unexpected: {other:?}"),
        }

        // After paying off, perpanjang works.
        conn.execute(
            "UPDATE peminjaman SET total_bayar = 5000 WHERE id = ?1",
            params![pmj_id],
        )
        .unwrap();
        peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect("now succeeds");
    }

    #[test]
    fn perpanjang_blocks_when_status_dikembalikan() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-6", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        conn.execute(
            "UPDATE peminjaman SET status = 'dikembalikan' WHERE id = ?1",
            params![pmj_id],
        )
        .unwrap();
        let err = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect_err("should reject");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("dikembalikan")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn perpanjang_blocks_when_buku_has_active_reservasi() {
        let mut conn = setup_db();
        let borrower = seed_anggota(&conn, "A001", "Andi", None);
        let other = seed_anggota(&conn, "A002", "Budi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-7", borrower, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        // Create reservasi from another anggota.
        crate::commands::reservasi::reservasi_create_inner(
            &mut conn,
            &crate::commands::reservasi::ReservasiCreateInput {
                anggota_id: other,
                buku_id: bid,
                catatan: None,
            },
            None,
        )
        .expect("create reservasi");

        let err = peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect_err("should reject");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("dipesan oleh Budi")),
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn perpanjang_writes_audit_log_with_metadata() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A001", "Andi", None);
        let bid = seed_buku(&conn, "B001", "Pemrograman");
        let (pmj_id, _) = seed_pinjaman(
            &conn, "PJ-FEAT17-8", aid, bid, "2026-05-01", "2026-05-08", "dipinjam",
        );
        peminjaman_perpanjang_inner(
            &mut conn,
            &PeminjamanPerpanjangInput { peminjaman_id: pmj_id, days: Some(7) },
            None,
        )
        .expect("perpanjang");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM audit_log \
                 WHERE entitas = 'peminjaman' AND aksi = 'perpanjang_peminjaman'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
