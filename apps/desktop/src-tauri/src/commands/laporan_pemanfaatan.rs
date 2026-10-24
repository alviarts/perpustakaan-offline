//! Laporan pemanfaatan (Fase 2) — matriks bulanan, turnover, idle, weeding.

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Baris long-format `{label, bulan, jumlah}` untuk matriks bulanan.
/// Frontend mem-pivot menjadi tabel (baris = label, kolom = bulan).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulanCountRow {
    pub label: String,
    /// "YYYY-MM"
    pub bulan: String,
    pub jumlah: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnoverCopyRow {
    pub kode_eksemplar: String,
    pub judul: String,
    pub status: String,
    pub jumlah: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuIdleRow {
    pub buku_id: i64,
    pub kode: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub jumlah_eksemplar: i64,
    pub terakhir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EksemplarMasalahRow {
    pub kode_eksemplar: String,
    pub judul: String,
    pub status: String,
}

/// Pemakaian per subjek (kelas utama DDC) x bulan dalam rentang.
#[tauri::command]
pub fn laporan_pinjam_subjek_bulan(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> AppResult<Vec<BulanCountRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT CASE
                      WHEN b.kode_ddc IS NULL OR TRIM(b.kode_ddc) = '' THEN 'belum'
                      WHEN substr(TRIM(b.kode_ddc), 1, 1) GLOB '[0-9]'
                          THEN substr(TRIM(b.kode_ddc), 1, 1) || '00'
                      ELSE 'lain'
                    END AS subjek,
                    strftime('%Y-%m', p.tanggal_pinjam) AS bulan,
                    COUNT(*) AS jumlah
             FROM peminjaman_item pi
             JOIN peminjaman p ON p.id = pi.peminjaman_id
             LEFT JOIN buku b ON b.id = pi.buku_id
             WHERE p.tanggal_pinjam BETWEEN ?1 AND ?2
             GROUP BY subjek, bulan
             ORDER BY subjek, bulan",
        )
        .map_err(AppError::from)?;
    collect_bulan_rows(stmt.query_map(params![from, to], |r| {
        Ok(BulanCountRow {
            label: r.get(0)?,
            bulan: r.get(1)?,
            jumlah: r.get(2)?,
        })
    }))
}

/// Pemakaian per kategori x bulan dalam rentang.
#[tauri::command]
pub fn laporan_pinjam_kategori_bulan(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> AppResult<Vec<BulanCountRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(NULLIF(TRIM(b.kategori), ''), '(kosong)') AS kategori,
                    strftime('%Y-%m', p.tanggal_pinjam) AS bulan,
                    COUNT(*) AS jumlah
             FROM peminjaman_item pi
             JOIN peminjaman p ON p.id = pi.peminjaman_id
             LEFT JOIN buku b ON b.id = pi.buku_id
             WHERE p.tanggal_pinjam BETWEEN ?1 AND ?2
             GROUP BY kategori, bulan
             ORDER BY kategori, bulan",
        )
        .map_err(AppError::from)?;
    collect_bulan_rows(stmt.query_map(params![from, to], |r| {
        Ok(BulanCountRow {
            label: r.get(0)?,
            bulan: r.get(1)?,
            jumlah: r.get(2)?,
        })
    }))
}

/// Kunjungan per kelompok (kelas / non-anggota) x bulan dalam rentang.
#[tauri::command]
pub fn laporan_kunjungan_kelompok_bulan(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> AppResult<Vec<BulanCountRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(
                        NULLIF(TRIM(k.kelas), ''),
                        CASE WHEN k.anggota_id IS NULL THEN '(non-anggota)' ELSE '(tanpa kelas)' END
                    ) AS kelompok,
                    strftime('%Y-%m', k.tanggal) AS bulan,
                    SUM(k.jumlah_orang) AS jumlah
             FROM kunjungan k
             WHERE k.tanggal BETWEEN ?1 AND ?2
             GROUP BY kelompok, bulan
             ORDER BY kelompok, bulan",
        )
        .map_err(AppError::from)?;
    collect_bulan_rows(stmt.query_map(params![from, to], |r| {
        Ok(BulanCountRow {
            label: r.get(0)?,
            bulan: r.get(1)?,
            jumlah: r.get(2)?,
        })
    }))
}

fn collect_bulan_rows<F>(
    mapped: rusqlite::Result<rusqlite::MappedRows<'_, F>>,
) -> AppResult<Vec<BulanCountRow>>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<BulanCountRow>,
{
    mapped
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)
}

/// Turnover per eksemplar: jumlah peminjaman copy tsb dalam rentang.
#[tauri::command]
pub fn laporan_turnover_copy(
    state: State<'_, AppState>,
    from: String,
    to: String,
    limit: Option<i64>,
) -> AppResult<Vec<TurnoverCopyRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(200).clamp(1, 2000);
    let mut stmt = conn
        .prepare(
            "SELECT e.kode_eksemplar, b.judul, e.status,
                    (SELECT COUNT(*) FROM peminjaman_item pi
                     JOIN peminjaman p ON p.id = pi.peminjaman_id
                     WHERE pi.eksemplar_id = e.id
                       AND p.tanggal_pinjam BETWEEN ?1 AND ?2) AS jumlah
             FROM eksemplar e
             JOIN buku b ON b.id = e.buku_id
             ORDER BY jumlah DESC, b.judul, e.kode_eksemplar
             LIMIT ?3",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![from, to, limit], |r| {
            Ok(TurnoverCopyRow {
                kode_eksemplar: r.get(0)?,
                judul: r.get(1)?,
                status: r.get(2)?,
                jumlah: r.get(3)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Buku yang tidak pernah dipinjam dalam rentang (kandidat idle / weeding).
#[tauri::command]
pub fn laporan_buku_idle(
    state: State<'_, AppState>,
    from: String,
    to: String,
    limit: Option<i64>,
) -> AppResult<Vec<BukuIdleRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(300).clamp(1, 5000);
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.kode_buku, b.judul, b.pengarang, b.jumlah_eksemplar,
                    (SELECT MAX(p.tanggal_pinjam) FROM peminjaman_item pi
                     JOIN peminjaman p ON p.id = pi.peminjaman_id
                     WHERE pi.buku_id = b.id) AS terakhir
             FROM buku b
             WHERE NOT EXISTS (
                 SELECT 1 FROM peminjaman_item pi
                 JOIN peminjaman p ON p.id = pi.peminjaman_id
                 WHERE pi.buku_id = b.id AND p.tanggal_pinjam BETWEEN ?1 AND ?2
             )
             ORDER BY terakhir IS NOT NULL, terakhir, b.judul
             LIMIT ?3",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![from, to, limit], |r| {
            Ok(BukuIdleRow {
                buku_id: r.get(0)?,
                kode: r.get(1)?,
                judul: r.get(2)?,
                pengarang: r.get(3)?,
                jumlah_eksemplar: r.get(4)?,
                terakhir: r.get(5)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Eksemplar bermasalah (rusak / hilang) — kandidat penyusutan.
#[tauri::command]
pub fn laporan_eksemplar_bermasalah(
    state: State<'_, AppState>,
) -> AppResult<Vec<EksemplarMasalahRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT e.kode_eksemplar, b.judul, e.status
             FROM eksemplar e
             JOIN buku b ON b.id = e.buku_id
             WHERE e.status IN ('rusak', 'hilang')
             ORDER BY e.status, b.judul",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(EksemplarMasalahRow {
                kode_eksemplar: r.get(0)?,
                judul: r.get(1)?,
                status: r.get(2)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}
