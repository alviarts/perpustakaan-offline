//! Dashboard aggregate queries (revisi #9).

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardKpi {
    pub total_anggota: i64,
    pub total_buku: i64,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopPeminjam {
    pub anggota_id: i64,
    pub nama: String,
    pub kode_anggota: String,
    pub kelas: Option<String>,
    pub jumlah: i64,
}

#[derive(Debug, Serialize)]
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
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;

    let total_anggota: i64 = conn
        .query_row("SELECT COUNT(*) FROM anggota WHERE aktif = 1", [], |r| r.get(0))
        .unwrap_or(0);
    let total_buku: i64 = conn
        .query_row("SELECT COALESCE(SUM(jumlah_eksemplar), 0) FROM buku", [], |r| r.get(0))
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

    Ok(DashboardKpi {
        total_anggota,
        total_buku,
        buku_dipinjam,
        delta_anggota_pct: pct_delta(anggota_now, anggota_prev),
        delta_buku_pct: pct_delta(buku_now, buku_prev),
        delta_pinjam_pct: pct_delta(pinjam_now, pinjam_prev),
    })
}

#[tauri::command]
pub fn dashboard_ddc_distribution(state: State<'_, AppState>) -> AppResult<Vec<DdcSlice>> {
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
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
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
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
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
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
    let conn = state.db.lock().map_err(|e| AppError::Internal(e.to_string()))?;
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
