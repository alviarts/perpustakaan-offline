use rusqlite::{params, params_from_iter, OptionalExtension, ToSql};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Single anggota row, mirrors the SQLite `anggota` table v1.
/// Field naming follows camelCase on the wire to match TypeScript conventions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Anggota {
    pub id: i64,
    pub kode_anggota: String,
    pub nama: String,
    pub jenis_kelamin: Option<String>,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub agama: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub no_telp: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub foto_path: Option<String>,
    pub tanggal_daftar: String,
    pub aktif: bool,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaInput {
    pub kode_anggota: String,
    pub nama: String,
    pub jenis_kelamin: Option<String>,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub agama: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub no_telp: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub foto_path: Option<String>,
    pub tanggal_daftar: Option<String>,
    pub aktif: Option<bool>,
    pub catatan: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaListArgs {
    pub query: Option<String>,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub aktif: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaListResult {
    pub items: Vec<Anggota>,
    pub total: i64,
}

const SORT_FIELDS: &[&str] = &[
    "nama",
    "kode_anggota",
    "kelas",
    "jurusan",
    "tanggal_daftar",
    "created_at",
];

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Anggota> {
    Ok(Anggota {
        id: row.get(0)?,
        kode_anggota: row.get(1)?,
        nama: row.get(2)?,
        jenis_kelamin: row.get(3)?,
        kelas: row.get(4)?,
        jurusan: row.get(5)?,
        agama: row.get(6)?,
        tempat_lahir: row.get(7)?,
        tanggal_lahir: row.get(8)?,
        no_telp: row.get(9)?,
        email: row.get(10)?,
        alamat: row.get(11)?,
        foto_path: row.get(12)?,
        tanggal_daftar: row.get(13)?,
        aktif: row.get::<_, i64>(14)? != 0,
        catatan: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

const SELECT_COLUMNS: &str = "id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, agama, \
    tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, tanggal_daftar, aktif, \
    catatan, created_at, updated_at";

fn validate_input(input: &AnggotaInput) -> AppResult<()> {
    if input.kode_anggota.trim().is_empty() {
        return Err(AppError::Validation("kode_anggota required".into()));
    }
    if input.nama.trim().is_empty() {
        return Err(AppError::Validation("nama required".into()));
    }
    if let Some(ref jk) = input.jenis_kelamin {
        if !jk.is_empty() && jk != "L" && jk != "P" {
            return Err(AppError::Validation("jenis_kelamin must be L or P".into()));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn anggota_list(
    state: State<'_, AppState>,
    args: AnggotaListArgs,
) -> AppResult<AnggotaListResult> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let mut where_parts: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();

    let trimmed_query = args
        .query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{s}%"));
    if let Some(ref q) = trimmed_query {
        let n = params.len() + 1;
        // Use the same positional parameter `?N` for all four LIKE clauses.
        where_parts.push(format!(
            "(nama LIKE ?{n} OR kode_anggota LIKE ?{n} OR kelas LIKE ?{n} OR jurusan LIKE ?{n})"
        ));
        params.push(Box::new(q.clone()));
    }
    if let Some(ref kelas) = args.kelas {
        if !kelas.is_empty() {
            let n = params.len() + 1;
            where_parts.push(format!("kelas = ?{n}"));
            params.push(Box::new(kelas.clone()));
        }
    }
    if let Some(ref jurusan) = args.jurusan {
        if !jurusan.is_empty() {
            let n = params.len() + 1;
            where_parts.push(format!("jurusan = ?{n}"));
            params.push(Box::new(jurusan.clone()));
        }
    }
    if let Some(aktif) = args.aktif {
        let n = params.len() + 1;
        where_parts.push(format!("aktif = ?{n}"));
        params.push(Box::new(if aktif { 1_i64 } else { 0_i64 }));
    }

    let where_clause = if where_parts.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_parts.join(" AND "))
    };

    let sort_by = args
        .sort_by
        .as_deref()
        .filter(|s| SORT_FIELDS.contains(s))
        .unwrap_or("nama");
    let sort_dir = match args.sort_dir.as_deref() {
        Some("desc") | Some("DESC") => "DESC",
        _ => "ASC",
    };

    let limit = args.limit.unwrap_or(50).clamp(1, 500);
    let offset = args.offset.unwrap_or(0).max(0);

    let count_sql = format!("SELECT COUNT(*) FROM anggota{where_clause}");
    let total: i64 = conn
        .query_row(&count_sql, params_from_iter(params.iter().map(|b| b.as_ref())), |row| {
            row.get(0)
        })
        .map_err(AppError::Db)?;

    let list_sql = format!(
        "SELECT {SELECT_COLUMNS} FROM anggota{where_clause} \
         ORDER BY {sort_by} {sort_dir} LIMIT {limit} OFFSET {offset}"
    );
    let mut stmt = conn.prepare(&list_sql)?;
    let rows = stmt
        .query_map(params_from_iter(params.iter().map(|b| b.as_ref())), map_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(AnggotaListResult { items: rows, total })
}

#[tauri::command]
pub fn anggota_get(state: State<'_, AppState>, id: i64) -> AppResult<Anggota> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let sql = format!("SELECT {SELECT_COLUMNS} FROM anggota WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound("anggota".into()),
            other => AppError::Db(other),
        })
}

#[tauri::command]
pub fn anggota_create(
    state: State<'_, AppState>,
    payload: AnggotaInput,
) -> AppResult<Anggota> {
    validate_input(&payload)?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let exists: Option<i64> = conn
        .query_row(
            "SELECT id FROM anggota WHERE kode_anggota = ?1",
            params![payload.kode_anggota.trim()],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_some() {
        return Err(AppError::Validation(format!(
            "kode_anggota '{}' sudah dipakai",
            payload.kode_anggota
        )));
    }

    let aktif_val: i64 = if payload.aktif.unwrap_or(true) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO anggota (
            kode_anggota, nama, jenis_kelamin, kelas, jurusan, agama,
            tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path,
            tanggal_daftar, aktif, catatan
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, date('now')), ?14, ?15)",
        params![
            payload.kode_anggota.trim(),
            payload.nama.trim(),
            payload.jenis_kelamin,
            payload.kelas,
            payload.jurusan,
            payload.agama,
            payload.tempat_lahir,
            payload.tanggal_lahir,
            payload.no_telp,
            payload.email,
            payload.alamat,
            payload.foto_path,
            payload.tanggal_daftar,
            aktif_val,
            payload.catatan,
        ],
    )?;
    let id = conn.last_insert_rowid();
    drop(conn);
    anggota_get(state, id)
}

#[tauri::command]
pub fn anggota_update(
    state: State<'_, AppState>,
    id: i64,
    payload: AnggotaInput,
) -> AppResult<Anggota> {
    validate_input(&payload)?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let exists: Option<i64> = conn
        .query_row(
            "SELECT id FROM anggota WHERE kode_anggota = ?1 AND id <> ?2",
            params![payload.kode_anggota.trim(), id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_some() {
        return Err(AppError::Validation(format!(
            "kode_anggota '{}' sudah dipakai anggota lain",
            payload.kode_anggota
        )));
    }

    let aktif_val: i64 = if payload.aktif.unwrap_or(true) { 1 } else { 0 };
    let affected = conn.execute(
        "UPDATE anggota SET
            kode_anggota = ?1, nama = ?2, jenis_kelamin = ?3, kelas = ?4, jurusan = ?5,
            agama = ?6, tempat_lahir = ?7, tanggal_lahir = ?8, no_telp = ?9, email = ?10,
            alamat = ?11, foto_path = ?12, tanggal_daftar = COALESCE(?13, tanggal_daftar),
            aktif = ?14, catatan = ?15, updated_at = datetime('now')
         WHERE id = ?16",
        params![
            payload.kode_anggota.trim(),
            payload.nama.trim(),
            payload.jenis_kelamin,
            payload.kelas,
            payload.jurusan,
            payload.agama,
            payload.tempat_lahir,
            payload.tanggal_lahir,
            payload.no_telp,
            payload.email,
            payload.alamat,
            payload.foto_path,
            payload.tanggal_daftar,
            aktif_val,
            payload.catatan,
            id,
        ],
    )?;
    if affected == 0 {
        return Err(AppError::NotFound("anggota".into()));
    }
    drop(conn);
    anggota_get(state, id)
}

#[tauri::command]
pub fn anggota_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let in_use: i64 = conn.query_row(
        "SELECT COUNT(*) FROM peminjaman WHERE anggota_id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    if in_use > 0 {
        return Err(AppError::Validation(
            "anggota memiliki riwayat peminjaman, tidak dapat dihapus".into(),
        ));
    }
    let affected = conn.execute("DELETE FROM anggota WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound("anggota".into()));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaImportItem {
    pub kode_anggota: String,
    pub nama: String,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub agama: Option<String>,
    pub jenis_kelamin: Option<String>,
    pub no_telp: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaImportResult {
    pub inserted: i64,
    pub skipped: i64,
    pub errors: Vec<AnggotaImportError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnggotaImportError {
    pub row: i64,
    pub kode_anggota: String,
    pub message: String,
}

#[tauri::command]
pub fn anggota_import(
    state: State<'_, AppState>,
    items: Vec<AnggotaImportItem>,
) -> AppResult<AnggotaImportResult> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let tx = conn.transaction()?;
    let mut result = AnggotaImportResult::default();

    for (idx, item) in items.into_iter().enumerate() {
        let row_no = (idx + 1) as i64;
        if item.kode_anggota.trim().is_empty() || item.nama.trim().is_empty() {
            result.errors.push(AnggotaImportError {
                row: row_no,
                kode_anggota: item.kode_anggota.clone(),
                message: "kode_anggota dan nama wajib diisi".into(),
            });
            result.skipped += 1;
            continue;
        }

        let exists: Option<i64> = tx
            .query_row(
                "SELECT id FROM anggota WHERE kode_anggota = ?1",
                params![item.kode_anggota.trim()],
                |row| row.get(0),
            )
            .optional()?;
        if exists.is_some() {
            result.errors.push(AnggotaImportError {
                row: row_no,
                kode_anggota: item.kode_anggota.clone(),
                message: "kode_anggota sudah ada".into(),
            });
            result.skipped += 1;
            continue;
        }

        let jk = item
            .jenis_kelamin
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_uppercase)
            .filter(|s| s == "L" || s == "P");

        tx.execute(
            "INSERT INTO anggota (kode_anggota, nama, jenis_kelamin, kelas, jurusan, agama, no_telp, email, aktif)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1)",
            params![
                item.kode_anggota.trim(),
                item.nama.trim(),
                jk,
                item.kelas,
                item.jurusan,
                item.agama,
                item.no_telp,
                item.email,
            ],
        )?;
        result.inserted += 1;
    }

    tx.commit()?;
    Ok(result)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DistinctValues {
    pub values: Vec<String>,
}

#[tauri::command]
pub fn anggota_distinct(
    state: State<'_, AppState>,
    field: String,
) -> AppResult<DistinctValues> {
    if !["kelas", "jurusan", "agama"].contains(&field.as_str()) {
        return Err(AppError::Validation(format!("field '{field}' not allowed")));
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let sql = format!(
        "SELECT DISTINCT {field} FROM anggota WHERE {field} IS NOT NULL AND {field} <> '' ORDER BY {field}"
    );
    let mut stmt = conn.prepare(&sql)?;
    let values = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(DistinctValues { values })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KelasItem {
    pub id: i64,
    pub nama: String,
    pub tingkat: Option<i64>,
    pub urutan: i64,
}

#[tauri::command]
pub fn kelas_list(state: State<'_, AppState>) -> AppResult<Vec<KelasItem>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt =
        conn.prepare("SELECT id, nama, tingkat, urutan FROM kelas ORDER BY urutan ASC, nama ASC")?;
    let items = stmt
        .query_map([], |row| {
            Ok(KelasItem {
                id: row.get(0)?,
                nama: row.get(1)?,
                tingkat: row.get(2)?,
                urutan: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}
