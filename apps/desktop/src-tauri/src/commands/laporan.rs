//! Laporan / report aggregate queries (revisi #23).

use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrafikBucket {
    pub bucket: String,
    pub kunjungan: i64,
    pub peminjaman: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopPeminjamRow {
    pub anggota_id: i64,
    pub nama: String,
    pub kode_anggota: String,
    pub kelas: Option<String>,
    pub jumlah_pinjam: i64,
    pub jumlah_buku: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopBukuRow {
    pub buku_id: i64,
    pub kode: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub jumlah: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KasRow {
    pub id: i64,
    pub tanggal: String,
    pub keterangan: String,
    pub jenis: String,
    pub sumber: String,
    pub nominal: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KasSummary {
    pub total_masuk: i64,
    pub total_keluar: i64,
    pub saldo_akhir: i64,
    pub from_denda: i64,
    pub from_manual: i64,
    pub from_hilang: i64,
    pub from_modal: i64,
    pub rows: Vec<KasRow>,
    pub cumulative: Vec<KasCumulative>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KasCumulative {
    pub tanggal: String,
    pub saldo: i64,
}

fn bucket_format(granularity: &str) -> &'static str {
    match granularity {
        "year" => "%Y",
        "month" => "%Y-%m",
        _ => "%Y-%m-%d",
    }
}

#[tauri::command]
pub fn laporan_grafik(
    state: State<'_, AppState>,
    from: String,
    to: String,
    granularity: Option<String>,
) -> AppResult<Vec<GrafikBucket>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let g = granularity.unwrap_or_else(|| "day".to_string());
    let fmt = bucket_format(&g);

    let mut stmt = conn
        .prepare(
            "SELECT b.bucket,
                    COALESCE(SUM(k.kunjungan), 0) AS kunjungan,
                    COALESCE(SUM(p.peminjaman), 0) AS peminjaman
             FROM (
                SELECT strftime(?1, tanggal) AS bucket FROM kunjungan
                WHERE tanggal BETWEEN ?2 AND ?3
                UNION
                SELECT strftime(?1, tanggal_pinjam) AS bucket FROM peminjaman
                WHERE tanggal_pinjam BETWEEN ?2 AND ?3
             ) AS b
             LEFT JOIN (
                SELECT strftime(?1, tanggal) AS bucket,
                       SUM(jumlah_orang) AS kunjungan
                FROM kunjungan
                WHERE tanggal BETWEEN ?2 AND ?3
                GROUP BY bucket
             ) AS k ON k.bucket = b.bucket
             LEFT JOIN (
                SELECT strftime(?1, tanggal_pinjam) AS bucket,
                       COUNT(*) AS peminjaman
                FROM peminjaman
                WHERE tanggal_pinjam BETWEEN ?2 AND ?3
                GROUP BY bucket
             ) AS p ON p.bucket = b.bucket
             GROUP BY b.bucket
             ORDER BY b.bucket",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![fmt, from, to], |r| {
            Ok(GrafikBucket {
                bucket: r.get(0)?,
                kunjungan: r.get(1)?,
                peminjaman: r.get(2)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn laporan_top_peminjam(
    state: State<'_, AppState>,
    from: String,
    to: String,
    limit: Option<i64>,
) -> AppResult<Vec<TopPeminjamRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(10).clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.nama, a.kode_anggota, a.kelas,
                    COUNT(DISTINCT p.id) AS jumlah_pinjam,
                    COALESCE((SELECT COUNT(*) FROM peminjaman_item pi
                              JOIN peminjaman p2 ON p2.id = pi.peminjaman_id
                              WHERE p2.anggota_id = a.id
                                AND p2.tanggal_pinjam BETWEEN ?1 AND ?2), 0)
                        AS jumlah_buku
             FROM peminjaman p
             JOIN anggota a ON a.id = p.anggota_id
             WHERE p.tanggal_pinjam BETWEEN ?1 AND ?2
             GROUP BY a.id
             ORDER BY jumlah_pinjam DESC, a.nama
             LIMIT ?3",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![from, to, limit], |r| {
            Ok(TopPeminjamRow {
                anggota_id: r.get(0)?,
                nama: r.get(1)?,
                kode_anggota: r.get(2)?,
                kelas: r.get(3)?,
                jumlah_pinjam: r.get(4)?,
                jumlah_buku: r.get(5)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn laporan_top_buku(
    state: State<'_, AppState>,
    from: String,
    to: String,
    limit: Option<i64>,
) -> AppResult<Vec<TopBukuRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = limit.unwrap_or(10).clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.kode_buku, b.judul, b.pengarang, COUNT(pi.id) AS jumlah
             FROM peminjaman_item pi
             JOIN peminjaman p ON p.id = pi.peminjaman_id
             JOIN buku b ON b.id = pi.buku_id
             WHERE p.tanggal_pinjam BETWEEN ?1 AND ?2
             GROUP BY b.id
             ORDER BY jumlah DESC, b.judul
             LIMIT ?3",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![from, to, limit], |r| {
            Ok(TopBukuRow {
                buku_id: r.get(0)?,
                kode: r.get(1)?,
                judul: r.get(2)?,
                pengarang: r.get(3)?,
                jumlah: r.get(4)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn laporan_kas(state: State<'_, AppState>, from: String, to: String) -> AppResult<KasSummary> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, tanggal, keterangan, jenis, sumber, nominal
             FROM kas
             WHERE tanggal BETWEEN ?1 AND ?2
             ORDER BY tanggal, id",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(params![from, to], |r| {
            Ok(KasRow {
                id: r.get(0)?,
                tanggal: r.get(1)?,
                keterangan: r.get(2)?,
                jenis: r.get(3)?,
                sumber: r.get(4)?,
                nominal: r.get(5)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;

    let mut total_masuk = 0i64;
    let mut total_keluar = 0i64;
    let mut from_denda = 0i64;
    let mut from_manual = 0i64;
    let mut from_hilang = 0i64;
    let mut from_modal = 0i64;
    let mut cumulative: Vec<KasCumulative> = Vec::new();
    let mut running = 0i64;
    let mut last_date: Option<String> = None;

    for row in &rows {
        let signed = if row.jenis == "masuk" {
            row.nominal
        } else {
            -row.nominal
        };
        running += signed;
        if row.jenis == "masuk" {
            total_masuk += row.nominal;
            match row.sumber.as_str() {
                "denda" => from_denda += row.nominal,
                "hilang" => from_hilang += row.nominal,
                "modal" => from_modal += row.nominal,
                _ => from_manual += row.nominal,
            }
        } else {
            total_keluar += row.nominal;
        }
        match &last_date {
            Some(d) if d == &row.tanggal => {
                if let Some(last) = cumulative.last_mut() {
                    last.saldo = running;
                }
            }
            _ => {
                cumulative.push(KasCumulative {
                    tanggal: row.tanggal.clone(),
                    saldo: running,
                });
                last_date = Some(row.tanggal.clone());
            }
        }
    }

    Ok(KasSummary {
        total_masuk,
        total_keluar,
        saldo_akhir: total_masuk - total_keluar,
        from_denda,
        from_manual,
        from_hilang,
        from_modal,
        rows,
        cumulative,
    })
}
