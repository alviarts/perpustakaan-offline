//! Dashboard aggregate queries (revisi #9).

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardKpi {
    pub total_anggota: i64,
    /// Number of distinct titles in the catalog (`COUNT(*) FROM buku`).
    /// This is the headline KPI; physical-copy count lives in
    /// [`DashboardKpi::total_eksemplar`].
    pub total_buku: i64,
    /// Sum of `jumlah_eksemplar` across all buku, i.e. physical copies.
    /// Rendered as the sub-line on the "Total Buku" KPI card.
    pub total_eksemplar: i64,
    pub buku_dipinjam: i64,
    pub delta_anggota_pct: f64,
    pub delta_buku_pct: f64,
    pub delta_pinjam_pct: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DdcSlice {
    pub kelas: String,
    pub label: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayBucket {
    pub tanggal: String,
    pub jumlah: i64,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TopPeminjam {
    pub anggota_id: i64,
    pub nama: String,
    pub kode_anggota: String,
    pub kelas: Option<String>,
    pub jumlah: i64,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TopBuku {
    pub buku_id: i64,
    pub kode: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub jumlah: i64,
}

fn pct_delta(current: i64, previous: i64) -> f64 {
    if previous == 0 {
        if current > 0 {
            100.0
        } else {
            0.0
        }
    } else {
        ((current - previous) as f64 / previous as f64) * 100.0
    }
}

#[tauri::command]
pub fn dashboard_kpi(state: State<'_, AppState>) -> AppResult<DashboardKpi> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dashboard_kpi_inner(&conn))
}

/// Pure inner helper so the KPI shape can be unit-tested without spinning up
/// a Tauri runtime. Reads only — never mutates the connection.
pub(crate) fn dashboard_kpi_inner(conn: &Connection) -> DashboardKpi {
    let total_anggota: i64 = conn
        .query_row("SELECT COUNT(*) FROM anggota WHERE aktif = 1", [], |r| {
            r.get(0)
        })
        .unwrap_or(0);
    // BUG-008 (Opsi 3): "Total Buku" headline KPI counts distinct titles;
    // physical-copy count lives in `total_eksemplar` and is rendered as the
    // sub-line on the same card.
    let total_buku: i64 = conn
        .query_row("SELECT COUNT(*) FROM buku", [], |r| r.get(0))
        .unwrap_or(0);
    let total_eksemplar: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(jumlah_eksemplar), 0) FROM buku",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let buku_dipinjam: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM peminjaman_item WHERE status = 'dipinjam'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let anggota_now: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota
             WHERE aktif = 1 AND created_at >= date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let anggota_prev: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota
             WHERE aktif = 1
               AND created_at >= date('now', 'start of month', '-1 month', 'localtime')
               AND created_at <  date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Title-based delta: matches the headline `total_buku` semantics so the
    // arrow + percent on the KPI card describe titles added this month vs.
    // last month, not eksemplar churn.
    let buku_now: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM buku
             WHERE created_at >= date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let buku_prev: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM buku
             WHERE created_at >= date('now', 'start of month', '-1 month', 'localtime')
               AND created_at <  date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let pinjam_now: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM peminjaman
             WHERE tanggal_pinjam >= date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let pinjam_prev: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM peminjaman
             WHERE tanggal_pinjam >= date('now', 'start of month', '-1 month', 'localtime')
               AND tanggal_pinjam <  date('now', 'start of month', 'localtime')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    DashboardKpi {
        total_anggota,
        total_buku,
        total_eksemplar,
        buku_dipinjam,
        delta_anggota_pct: pct_delta(anggota_now, anggota_prev),
        delta_buku_pct: pct_delta(buku_now, buku_prev),
        delta_pinjam_pct: pct_delta(pinjam_now, pinjam_prev),
    }
}

#[tauri::command]
pub fn dashboard_ddc_distribution(state: State<'_, AppState>) -> AppResult<Vec<DdcSlice>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    // Group by first digit of kode_ddc (DDC class). NULL/empty -> "?".
    let mut stmt = conn
        .prepare(
            "SELECT
                CASE
                    WHEN kode_ddc IS NULL OR kode_ddc = '' THEN '?'
                    ELSE SUBSTR(kode_ddc, 1, 1)
                END AS kelas,
                COUNT(*) AS jumlah
             FROM buku
             GROUP BY kelas
             ORDER BY kelas",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |row| {
            let kelas: String = row.get(0)?;
            let jumlah: i64 = row.get(1)?;
            Ok((kelas, jumlah))
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;

    let labels: &[(&str, &str)] = &[
        ("0", "Karya Umum"),
        ("1", "Filsafat"),
        ("2", "Agama"),
        ("3", "Ilmu Sosial"),
        ("4", "Bahasa"),
        ("5", "Sains"),
        ("6", "Teknologi"),
        ("7", "Kesenian"),
        ("8", "Sastra"),
        ("9", "Sejarah & Geografi"),
        ("?", "Lainnya"),
    ];

    let result = rows
        .into_iter()
        .map(|(kelas, count)| {
            let label = labels
                .iter()
                .find(|(k, _)| *k == kelas)
                .map(|(_, v)| (*v).to_string())
                .unwrap_or_else(|| kelas.clone());
            DdcSlice {
                kelas,
                label,
                count,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn dashboard_kunjungan_7d(state: State<'_, AppState>) -> AppResult<Vec<DayBucket>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE days(d) AS (
                SELECT date('now', '-6 days', 'localtime')
                UNION ALL
                SELECT date(d, '+1 day') FROM days WHERE d < date('now', 'localtime')
             )
             SELECT days.d AS tanggal,
                    COALESCE(SUM(k.jumlah_orang), 0) AS jumlah
             FROM days
             LEFT JOIN kunjungan k ON k.tanggal = days.d
             GROUP BY days.d
             ORDER BY days.d",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DayBucket {
                tanggal: row.get(0)?,
                jumlah: row.get(1)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn dashboard_top_peminjam(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<TopPeminjam>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(5).clamp(1, 50);
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.nama, a.kode_anggota, a.kelas, COUNT(p.id) AS jumlah
             FROM peminjaman p
             JOIN anggota a ON a.id = p.anggota_id
             GROUP BY a.id
             ORDER BY jumlah DESC, a.nama
             LIMIT ?1",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(TopPeminjam {
                anggota_id: row.get(0)?,
                nama: row.get(1)?,
                kode_anggota: row.get(2)?,
                kelas: row.get(3)?,
                jumlah: row.get(4)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn dashboard_top_buku(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<TopBuku>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(5).clamp(1, 50);
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.kode_buku, b.judul, b.pengarang, COUNT(pi.id) AS jumlah
             FROM peminjaman_item pi
             JOIN buku b ON b.id = pi.buku_id
             GROUP BY b.id
             ORDER BY jumlah DESC, b.judul
             LIMIT ?1",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(TopBuku {
                buku_id: row.get(0)?,
                kode: row.get(1)?,
                judul: row.get(2)?,
                pengarang: row.get(3)?,
                jumlah: row.get(4)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

// ---- FEAT-25: extended analytics ---------------------------------------

/// Time window for the trend chart. Each variant maps to a SQL date filter
/// against `peminjaman.tanggal_pinjam` plus a bucketing strategy:
///
/// - `Days7` / `Days30`: bucket by day (`date(...)`), one row per calendar
///   day in the window (gaps filled with 0 by the recursive CTE caller).
/// - `Months6`: bucket by `strftime('%Y-%m', ...)` over the last 6 calendar
///   months (current month inclusive).
/// - `Year1`: bucket by `strftime('%Y-%m', ...)` over the last 12 calendar
///   months (current month inclusive).
#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TrendWindow {
    #[serde(alias = "days7", alias = "DAYS_7")]
    Days7,
    #[serde(alias = "days30", alias = "DAYS_30")]
    Days30,
    #[serde(alias = "months6", alias = "MONTHS_6")]
    Months6,
    #[serde(alias = "year1", alias = "YEAR_1")]
    Year1,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrendBucket {
    /// Bucket key. For day-level windows this is a `YYYY-MM-DD` calendar date;
    /// for month-level windows it is `YYYY-MM` (no day component).
    pub bucket: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HeatCell {
    /// Day of week, 0 = Sunday … 6 = Saturday (matches SQLite `strftime('%w')`).
    pub dow: u8,
    /// Hour 0..=23 in local time.
    pub hour: u8,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DashboardInsights {
    /// Top borrowed book this calendar month, or `None` if there are no loans.
    pub top_buku_this_month: Option<TopBuku>,
    /// Most active borrower this calendar month, or `None`.
    pub top_peminjam_this_month: Option<TopPeminjam>,
    /// Average number of distinct loan headers per active member, all-time.
    pub avg_loans_per_member: f64,
    /// Average loan duration in days, computed across returned loan items
    /// (`status='dikembalikan'` with both `tanggal_pinjam` and `tanggal_kembali`).
    /// Falls back to 0.0 if no returned loans exist yet.
    pub avg_loan_duration_days: f64,
}

#[tauri::command]
pub fn dashboard_trend(
    state: State<'_, AppState>,
    window: TrendWindow,
) -> AppResult<Vec<TrendBucket>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dashboard_trend_inner(&conn, window))
}

pub(crate) fn dashboard_trend_inner(conn: &Connection, window: TrendWindow) -> Vec<TrendBucket> {
    match window {
        TrendWindow::Days7 | TrendWindow::Days30 => {
            let days = if matches!(window, TrendWindow::Days7) {
                7
            } else {
                30
            };
            // Recursive CTE materialises every day in the window so the
            // line chart shows a continuous X-axis even when no loans
            // happened on a given day.
            let sql = format!(
                "WITH RECURSIVE days(d) AS (
                    SELECT date('now', '-{} days', 'localtime')
                    UNION ALL
                    SELECT date(d, '+1 day') FROM days WHERE d < date('now', 'localtime')
                 )
                 SELECT days.d AS bucket,
                        COUNT(p.id) AS jumlah
                 FROM days
                 LEFT JOIN peminjaman p
                        ON date(p.tanggal_pinjam, 'localtime') = days.d
                 GROUP BY days.d
                 ORDER BY days.d",
                days - 1
            );
            collect_trend_rows(conn, &sql)
        }
        TrendWindow::Months6 | TrendWindow::Year1 => {
            let months = if matches!(window, TrendWindow::Months6) {
                6
            } else {
                12
            };
            let sql = format!(
                "WITH RECURSIVE months(m) AS (
                    SELECT strftime('%Y-%m', date('now', 'start of month', '-{} months', 'localtime'))
                    UNION ALL
                    SELECT strftime('%Y-%m', date(m || '-01', '+1 month'))
                      FROM months WHERE m < strftime('%Y-%m', date('now', 'localtime'))
                 )
                 SELECT months.m AS bucket,
                        COUNT(p.id) AS jumlah
                 FROM months
                 LEFT JOIN peminjaman p
                        ON strftime('%Y-%m', p.tanggal_pinjam, 'localtime') = months.m
                 GROUP BY months.m
                 ORDER BY months.m",
                months - 1
            );
            collect_trend_rows(conn, &sql)
        }
    }
}

fn collect_trend_rows(conn: &Connection, sql: &str) -> Vec<TrendBucket> {
    conn.prepare(sql)
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                Ok(TrendBucket {
                    bucket: row.get(0)?,
                    count: row.get(1)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn dashboard_heatmap(state: State<'_, AppState>) -> AppResult<Vec<HeatCell>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dashboard_heatmap_inner(&conn))
}

/// Aggregates loan creation timestamps by (day-of-week × hour) over the last
/// 6 weeks (rolling window, current day inclusive). Always returns exactly
/// 168 cells; cells with no activity have `count = 0` so the front-end can
/// pick a colour scale without an extra zero-fill step.
pub(crate) fn dashboard_heatmap_inner(conn: &Connection) -> Vec<HeatCell> {
    // 7 × 24 = 168 cells; preallocate with zeroes.
    let mut cells: Vec<HeatCell> = (0..7)
        .flat_map(|d| (0..24).map(move |h| HeatCell { dow: d, hour: h, count: 0 }))
        .collect();

    let aggregated: Vec<(u8, u8, i64)> = conn
        .prepare(
            "SELECT CAST(strftime('%w', tanggal_pinjam, 'localtime') AS INTEGER) AS dow,
                    CAST(strftime('%H', tanggal_pinjam, 'localtime') AS INTEGER) AS hour,
                    COUNT(*) AS jumlah
             FROM peminjaman
             WHERE tanggal_pinjam >= date('now', '-42 days', 'localtime')
             GROUP BY dow, hour",
        )
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                let dow: i64 = row.get(0)?;
                let hour: i64 = row.get(1)?;
                let jumlah: i64 = row.get(2)?;
                Ok((dow as u8, hour as u8, jumlah))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()
        })
        .unwrap_or_default();

    for (dow, hour, count) in aggregated {
        // Defensive bounds check: if SQLite ever returns a value outside
        // 0..=6 / 0..=23 we silently skip it rather than panic.
        if dow > 6 || hour > 23 {
            continue;
        }
        let idx = (dow as usize) * 24 + (hour as usize);
        if let Some(cell) = cells.get_mut(idx) {
            cell.count = count;
        }
    }

    cells
}

#[tauri::command]
pub fn dashboard_insights(state: State<'_, AppState>) -> AppResult<DashboardInsights> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dashboard_insights_inner(&conn))
}

pub(crate) fn dashboard_insights_inner(conn: &Connection) -> DashboardInsights {
    let top_buku = conn
        .prepare(
            "SELECT b.id, b.kode_buku, b.judul, b.pengarang, COUNT(pi.id) AS jumlah
             FROM peminjaman_item pi
             JOIN peminjaman p ON p.id = pi.peminjaman_id
             JOIN buku b ON b.id = pi.buku_id
             WHERE p.tanggal_pinjam >= date('now', 'start of month', 'localtime')
             GROUP BY b.id
             ORDER BY jumlah DESC, b.judul
             LIMIT 1",
        )
        .and_then(|mut stmt| {
            stmt.query_row([], |row| {
                Ok(TopBuku {
                    buku_id: row.get(0)?,
                    kode: row.get(1)?,
                    judul: row.get(2)?,
                    pengarang: row.get(3)?,
                    jumlah: row.get(4)?,
                })
            })
        })
        .ok();

    let top_peminjam = conn
        .prepare(
            "SELECT a.id, a.nama, a.kode_anggota, a.kelas, COUNT(p.id) AS jumlah
             FROM peminjaman p
             JOIN anggota a ON a.id = p.anggota_id
             WHERE p.tanggal_pinjam >= date('now', 'start of month', 'localtime')
             GROUP BY a.id
             ORDER BY jumlah DESC, a.nama
             LIMIT 1",
        )
        .and_then(|mut stmt| {
            stmt.query_row([], |row| {
                Ok(TopPeminjam {
                    anggota_id: row.get(0)?,
                    nama: row.get(1)?,
                    kode_anggota: row.get(2)?,
                    kelas: row.get(3)?,
                    jumlah: row.get(4)?,
                })
            })
        })
        .ok();

    let active_members: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota WHERE aktif = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let total_loans: i64 = conn
        .query_row("SELECT COUNT(*) FROM peminjaman", [], |r| r.get(0))
        .unwrap_or(0);
    let avg_loans_per_member = if active_members > 0 {
        total_loans as f64 / active_members as f64
    } else {
        0.0
    };

    // Average loan duration uses peminjaman_item rows that are returned and
    // have both timestamps set. `julianday(...)` yields a fractional day count
    // including the partial-day component, but we only need day granularity
    // so we round to one decimal in the front-end.
    let avg_loan_duration_days: f64 = conn
        .query_row(
            "SELECT COALESCE(
                AVG(julianday(pi.tanggal_kembali) - julianday(p.tanggal_pinjam)),
                0.0
             )
             FROM peminjaman_item pi
             JOIN peminjaman p ON p.id = pi.peminjaman_id
             WHERE pi.status = 'dikembalikan'
               AND pi.tanggal_kembali IS NOT NULL
               AND p.tanggal_pinjam IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    DashboardInsights {
        top_buku_this_month: top_buku,
        top_peminjam_this_month: top_peminjam,
        avg_loans_per_member,
        avg_loan_duration_days,
    }
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

    fn seed_buku(conn: &Connection, kode: &str, judul: &str, jumlah_eksemplar: i64) -> i64 {
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES (?1, ?2, ?3, ?3)",
            params![kode, judul, jumlah_eksemplar],
        )
        .expect("insert buku");
        conn.last_insert_rowid()
    }

    fn seed_anggota(conn: &Connection, kode: &str, nama: &str) -> i64 {
        conn.execute(
            "INSERT INTO anggota (kode_anggota, nama, aktif) VALUES (?1, ?2, 1)",
            params![kode, nama],
        )
        .expect("insert anggota");
        conn.last_insert_rowid()
    }

    fn seed_dipinjam_item(conn: &Connection, anggota_id: i64, buku_id: i64) {
        // Minimal peminjaman header so the item FK is satisfied; status of the
        // header itself doesn't matter for `buku_dipinjam` (the KPI counts
        // items with status='dipinjam', not headers).
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status)
             VALUES (printf('P%010d', abs(random())), ?1, date('now'), date('now', '+7 days'), 'dipinjam')",
            params![anggota_id],
        )
        .expect("insert peminjaman header");
        let peminjaman_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status) VALUES (?1, ?2, 'dipinjam')",
            params![peminjaman_id, buku_id],
        )
        .expect("insert peminjaman_item");
    }

    #[test]
    fn dashboard_kpi_total_buku_counts_titles_not_eksemplar() {
        // BUG-008 (Opsi 3): with 3 distinct titles and 7 physical copies in
        // total, the headline `total_buku` must report titles (3) and
        // `total_eksemplar` must report copies (7). Pre-fix this test would
        // have failed because `total_buku` summed jumlah_eksemplar.
        let conn = setup_db();
        seed_buku(&conn, "B0001", "Bumi Manusia", 2);
        seed_buku(&conn, "B0002", "Laskar Pelangi", 4);
        seed_buku(&conn, "B0003", "Sapiens", 1);

        let kpi = dashboard_kpi_inner(&conn);
        assert_eq!(kpi.total_buku, 3, "headline KPI must count distinct titles");
        assert_eq!(
            kpi.total_eksemplar, 7,
            "sub-line KPI must sum jumlah_eksemplar"
        );
    }

    #[test]
    fn dashboard_kpi_returns_zeroes_on_fresh_db() {
        // Fresh install with no buku rows yet: both metrics must be 0 and the
        // delta percentages must be finite (the pct_delta helper returns 0 or
        // 100 for the divide-by-zero edge case, never NaN/Inf which would
        // serialize poorly to JSON).
        let conn = setup_db();
        let kpi = dashboard_kpi_inner(&conn);
        assert_eq!(kpi.total_buku, 0);
        assert_eq!(kpi.total_eksemplar, 0);
        assert_eq!(kpi.total_anggota, 0);
        assert_eq!(kpi.buku_dipinjam, 0);
        assert!(kpi.delta_anggota_pct.is_finite());
        assert!(kpi.delta_buku_pct.is_finite());
        assert!(kpi.delta_pinjam_pct.is_finite());
    }

    #[test]
    fn dashboard_kpi_buku_dipinjam_counts_items_not_headers() {
        // 1 title with 5 copies, 1 anggota, 2 of the 5 copies currently on
        // loan -> buku_dipinjam = 2 even though the schema also has 1
        // peminjaman header row.
        let conn = setup_db();
        let buku_id = seed_buku(&conn, "B0010", "Atomic Habits", 5);
        let anggota_id = seed_anggota(&conn, "A0001", "Adelia");
        seed_dipinjam_item(&conn, anggota_id, buku_id);
        seed_dipinjam_item(&conn, anggota_id, buku_id);

        let kpi = dashboard_kpi_inner(&conn);
        assert_eq!(kpi.total_buku, 1);
        assert_eq!(kpi.total_eksemplar, 5);
        assert_eq!(kpi.buku_dipinjam, 2);
    }

    #[test]
    fn dashboard_kpi_total_anggota_excludes_inactive() {
        // `total_anggota` filters `aktif = 1` per spec — make sure inactive
        // members don't leak into the headline.
        let conn = setup_db();
        seed_anggota(&conn, "A0001", "Adelia");
        seed_anggota(&conn, "A0002", "Bagas");
        conn.execute(
            "UPDATE anggota SET aktif = 0 WHERE kode_anggota = 'A0002'",
            [],
        )
        .expect("deactivate anggota");

        let kpi = dashboard_kpi_inner(&conn);
        assert_eq!(kpi.total_anggota, 1);
    }

    // ---- FEAT-25 tests --------------------------------------------------

    fn seed_peminjaman_at(
        conn: &Connection,
        anggota_id: i64,
        buku_id: i64,
        tanggal_pinjam: &str,
    ) -> i64 {
        // tanggal_pinjam can be "now" (resolves via date('now')), a SQLite
        // modifier expression (e.g. "now,-3 days"), or an explicit ISO date.
        // We push it through `date(?2)` so all three forms work.
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status)
             VALUES (printf('P%010d', abs(random())), ?1, date(?2), date(?2, '+7 days'), 'dipinjam')",
            params![anggota_id, tanggal_pinjam],
        )
        .expect("insert peminjaman header");
        let pid = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status) VALUES (?1, ?2, 'dipinjam')",
            params![pid, buku_id],
        )
        .expect("insert peminjaman_item");
        pid
    }

    #[test]
    fn dashboard_trend_days7_returns_seven_buckets_on_empty_db() {
        // Even with zero loans the recursive CTE must yield exactly 7
        // calendar days so the front-end line chart has a stable X-axis
        // out of the box.
        let conn = setup_db();
        let trend = dashboard_trend_inner(&conn, TrendWindow::Days7);
        assert_eq!(trend.len(), 7);
        assert!(trend.iter().all(|b| b.count == 0));
        // Buckets are ordered ascending by date.
        for w in trend.windows(2) {
            assert!(w[0].bucket <= w[1].bucket);
        }
    }

    #[test]
    fn dashboard_trend_days30_returns_thirty_buckets() {
        let conn = setup_db();
        let trend = dashboard_trend_inner(&conn, TrendWindow::Days30);
        assert_eq!(trend.len(), 30);
    }

    #[test]
    fn dashboard_trend_months6_returns_six_buckets_with_yyyymm_keys() {
        let conn = setup_db();
        let trend = dashboard_trend_inner(&conn, TrendWindow::Months6);
        assert_eq!(trend.len(), 6);
        // YYYY-MM (7 chars) — never the day component.
        for b in &trend {
            assert_eq!(b.bucket.len(), 7, "expected YYYY-MM, got {:?}", b.bucket);
            assert!(b.bucket.chars().nth(4) == Some('-'));
        }
    }

    #[test]
    fn dashboard_trend_year1_returns_twelve_buckets() {
        let conn = setup_db();
        let trend = dashboard_trend_inner(&conn, TrendWindow::Year1);
        assert_eq!(trend.len(), 12);
    }

    #[test]
    fn dashboard_trend_days7_counts_today_loans() {
        let conn = setup_db();
        let buku_id = seed_buku(&conn, "B0001", "Bumi Manusia", 1);
        let anggota_id = seed_anggota(&conn, "A0001", "Adelia");
        // 3 loans today → today's bucket should report 3, others 0.
        seed_peminjaman_at(&conn, anggota_id, buku_id, "now");
        seed_peminjaman_at(&conn, anggota_id, buku_id, "now");
        seed_peminjaman_at(&conn, anggota_id, buku_id, "now");
        let trend = dashboard_trend_inner(&conn, TrendWindow::Days7);
        assert_eq!(trend.len(), 7);
        let today_bucket = trend.last().expect("at least one bucket");
        assert_eq!(today_bucket.count, 3);
        // Sum of all other buckets must be 0.
        let other: i64 = trend.iter().take(6).map(|b| b.count).sum();
        assert_eq!(other, 0);
    }

    #[test]
    fn dashboard_heatmap_always_returns_168_cells() {
        // Empty DB still yields a fully-zero 7×24 matrix so the front-end
        // doesn't have to special-case the cold-start path.
        let conn = setup_db();
        let cells = dashboard_heatmap_inner(&conn);
        assert_eq!(cells.len(), 168);
        assert!(cells.iter().all(|c| c.count == 0));
        // First row covers Sunday hours 0..23, last row covers Saturday.
        assert_eq!(cells[0], HeatCell { dow: 0, hour: 0, count: 0 });
        assert_eq!(
            cells[167],
            HeatCell {
                dow: 6,
                hour: 23,
                count: 0,
            }
        );
    }

    #[test]
    fn dashboard_heatmap_aggregates_recent_loans() {
        let conn = setup_db();
        let buku_id = seed_buku(&conn, "B0001", "Bumi Manusia", 1);
        let anggota_id = seed_anggota(&conn, "A0001", "Adelia");
        seed_peminjaman_at(&conn, anggota_id, buku_id, "now");
        seed_peminjaman_at(&conn, anggota_id, buku_id, "now");
        let cells = dashboard_heatmap_inner(&conn);
        assert_eq!(cells.len(), 168);
        // Exactly one (dow, hour) bucket should hold count = 2 — that one
        // corresponds to "now". We don't assert which one because tests
        // run on whatever wall clock the CI runner has.
        let total: i64 = cells.iter().map(|c| c.count).sum();
        assert_eq!(total, 2);
        let nonzero = cells.iter().filter(|c| c.count > 0).count();
        assert_eq!(nonzero, 1);
    }

    #[test]
    fn dashboard_insights_returns_zeroes_on_empty_db() {
        // Cold start: no loans yet. All Option<...> are None and the
        // averages are 0.0 (no NaN/Inf — JSON-friendly).
        let conn = setup_db();
        let insights = dashboard_insights_inner(&conn);
        assert!(insights.top_buku_this_month.is_none());
        assert!(insights.top_peminjam_this_month.is_none());
        assert_eq!(insights.avg_loans_per_member, 0.0);
        assert_eq!(insights.avg_loan_duration_days, 0.0);
    }

    #[test]
    fn dashboard_insights_returns_top_buku_and_peminjam_this_month() {
        let conn = setup_db();
        let bumi = seed_buku(&conn, "B0001", "Bumi Manusia", 5);
        let laskar = seed_buku(&conn, "B0002", "Laskar Pelangi", 5);
        let adelia = seed_anggota(&conn, "A0001", "Adelia");
        let bagas = seed_anggota(&conn, "A0002", "Bagas");
        // Adelia has 3 loans of Bumi this month, Bagas has 1 loan of Laskar
        // — so top buku is Bumi, top peminjam is Adelia.
        seed_peminjaman_at(&conn, adelia, bumi, "now");
        seed_peminjaman_at(&conn, adelia, bumi, "now");
        seed_peminjaman_at(&conn, adelia, bumi, "now");
        seed_peminjaman_at(&conn, bagas, laskar, "now");

        let insights = dashboard_insights_inner(&conn);
        let top_buku = insights.top_buku_this_month.expect("top buku set");
        assert_eq!(top_buku.judul, "Bumi Manusia");
        assert_eq!(top_buku.jumlah, 3);
        let top_peminjam = insights
            .top_peminjam_this_month
            .expect("top peminjam set");
        assert_eq!(top_peminjam.nama, "Adelia");
        assert_eq!(top_peminjam.jumlah, 3);
        // 4 total loans / 2 active members = 2.0
        assert!((insights.avg_loans_per_member - 2.0).abs() < 1e-9);
    }

    #[test]
    fn dashboard_insights_avg_loan_duration_handles_returned_items() {
        let conn = setup_db();
        let buku_id = seed_buku(&conn, "B0001", "Bumi Manusia", 1);
        let anggota_id = seed_anggota(&conn, "A0001", "Adelia");
        let pid = seed_peminjaman_at(&conn, anggota_id, buku_id, "2025-01-01");
        // Mark the item returned 5 days later. dashboard_insights_inner
        // averages julianday(kembali) - julianday(pinjam) → 5.0.
        conn.execute(
            "UPDATE peminjaman_item
             SET status = 'dikembalikan',
                 tanggal_kembali = '2025-01-06'
             WHERE peminjaman_id = ?1",
            params![pid],
        )
        .expect("mark returned");
        let insights = dashboard_insights_inner(&conn);
        assert!(
            (insights.avg_loan_duration_days - 5.0).abs() < 1e-9,
            "expected ≈5.0, got {}",
            insights.avg_loan_duration_days
        );
    }
}
