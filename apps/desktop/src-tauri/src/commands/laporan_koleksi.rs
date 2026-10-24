//! Laporan koleksi (Fase 2) — komposisi per DDC/dimensi, rasio, sebaran.

use serde::Serialize;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KoleksiDdcRow {
    /// "000".."900", plus "belum" (tak ber-DDC) / "lain" (non-numerik).
    pub kode: String,
    pub deskripsi: Option<String>,
    pub judul: i64,
    pub eksemplar: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KoleksiDimensiRow {
    pub label: String,
    pub judul: i64,
    pub eksemplar: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RasioKoleksi {
    pub total_judul: i64,
    pub total_eksemplar: i64,
    pub siswa_aktif: i64,
    pub guru: i64,
    pub tendik: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SebaranEksemplarRow {
    /// "0" | "1" | "2-3" | "4-5" | "6+"
    pub bucket: String,
    pub judul: i64,
}

/// Komposisi koleksi per kelas utama DDC (000–900) + bucket khusus, menurut
/// jumlah judul & eksemplar. Deskripsi diambil dari master `ddc` bila ada.
#[tauri::command]
pub fn laporan_koleksi_ddc(state: State<'_, AppState>) -> AppResult<Vec<KoleksiDdcRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT t.kode, d.deskripsi, t.judul, t.eksemplar
             FROM (
                 SELECT CASE
                          WHEN kode_ddc IS NULL OR TRIM(kode_ddc) = '' THEN 'belum'
                          WHEN substr(TRIM(kode_ddc), 1, 1) GLOB '[0-9]'
                              THEN substr(TRIM(kode_ddc), 1, 1) || '00'
                          ELSE 'lain'
                        END AS kode,
                        COUNT(*) AS judul,
                        COALESCE(SUM(jumlah_eksemplar), 0) AS eksemplar
                 FROM buku
                 GROUP BY kode
             ) t
             LEFT JOIN ddc d ON d.kode = t.kode
             ORDER BY t.kode",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(KoleksiDdcRow {
                kode: r.get(0)?,
                deskripsi: r.get(1)?,
                judul: r.get(2)?,
                eksemplar: r.get(3)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Komposisi koleksi menurut satu dimensi: kategori | bahasa | sumber | material.
#[tauri::command]
pub fn laporan_koleksi_dimensi(
    state: State<'_, AppState>,
    dimensi: String,
) -> AppResult<Vec<KoleksiDimensiRow>> {
    let col = match dimensi.as_str() {
        "kategori" => "kategori",
        "bahasa" => "bahasa",
        "sumber" => "sumber",
        "material" => "jenis_material",
        _ => return Err(AppError::Validation(format!("dimensi tidak dikenal: {dimensi}"))),
    };
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    // `col` is validated against a fixed allow-list above → safe to interpolate.
    let sql = format!(
        "SELECT COALESCE(NULLIF(TRIM({col}), ''), '(kosong)') AS label,
                COUNT(*) AS judul,
                COALESCE(SUM(jumlah_eksemplar), 0) AS eksemplar
         FROM buku
         GROUP BY label
         ORDER BY judul DESC, label"
    );
    let mut stmt = conn.prepare(&sql).map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(KoleksiDimensiRow {
                label: r.get(0)?,
                judul: r.get(1)?,
                eksemplar: r.get(2)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Rasio koleksi terhadap warga: judul/eksemplar vs siswa aktif, guru, tendik.
#[tauri::command]
pub fn laporan_rasio_koleksi(state: State<'_, AppState>) -> AppResult<RasioKoleksi> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.query_row(
        "SELECT
            (SELECT COUNT(*) FROM buku) AS total_judul,
            (SELECT COALESCE(SUM(jumlah_eksemplar), 0) FROM buku) AS total_eksemplar,
            (SELECT COUNT(*) FROM anggota
              WHERE aktif = 1 AND (tipe IS NULL OR tipe = '' OR tipe = 'siswa')) AS siswa_aktif,
            (SELECT COUNT(*) FROM anggota WHERE tipe = 'guru') AS guru,
            (SELECT COUNT(*) FROM anggota WHERE tipe = 'tendik') AS tendik",
        [],
        |r| {
            Ok(RasioKoleksi {
                total_judul: r.get(0)?,
                total_eksemplar: r.get(1)?,
                siswa_aktif: r.get(2)?,
                guru: r.get(3)?,
                tendik: r.get(4)?,
            })
        },
    )
    .map_err(AppError::from)
}

/// Sebaran judul menurut jumlah eksemplar fisik (bucket 0 / 1 / 2-3 / 4-5 / 6+).
#[tauri::command]
pub fn laporan_sebaran_eksemplar(
    state: State<'_, AppState>,
) -> AppResult<Vec<SebaranEksemplarRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT bucket, COUNT(*)
             FROM (
                 SELECT CASE
                          WHEN cnt = 0 THEN '0'
                          WHEN cnt = 1 THEN '1'
                          WHEN cnt <= 3 THEN '2-3'
                          WHEN cnt <= 5 THEN '4-5'
                          ELSE '6+'
                        END AS bucket
                 FROM (
                     SELECT (SELECT COUNT(*) FROM eksemplar e WHERE e.buku_id = b.id) AS cnt
                     FROM buku b
                 )
             )
             GROUP BY bucket",
        )
        .map_err(AppError::from)?;
    let raw = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;

    const ORDER: [&str; 5] = ["0", "1", "2-3", "4-5", "6+"];
    let mut rows: Vec<SebaranEksemplarRow> = Vec::new();
    for label in ORDER {
        if let Some((_, judul)) = raw.iter().find(|(b, _)| b == label) {
            rows.push(SebaranEksemplarRow {
                bucket: label.to_string(),
                judul: *judul,
            });
        }
    }
    Ok(rows)
}
