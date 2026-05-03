//! Anggota (member) CRUD — sesi 04.
//!
//! Reuses tabel `anggota` v1 schema (lihat `db/schema.sql`). Tidak ada
//! perubahan kolom kecuali penambahan `agama TEXT` (lihat `db::run_migrations`).

use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Anggota record lengkap untuk dikirim ke frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anggota {
    pub id: i64,
    pub kode_anggota: String,
    pub nama: String,
    pub jenis_kelamin: Option<String>,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub no_telp: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub foto_path: Option<String>,
    pub agama: Option<String>,
    pub tanggal_daftar: String,
    pub aktif: bool,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnggotaPayload {
    pub kode_anggota: String,
    pub nama: String,
    pub jenis_kelamin: Option<String>,
    pub kelas: Option<String>,
    pub jurusan: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub no_telp: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub foto_path: Option<String>,
    pub agama: Option<String>,
    pub catatan: Option<String>,
    #[serde(default = "default_aktif")]
    pub aktif: bool,
}

fn default_aktif() -> bool {
    true
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ListParams {
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub kelas: Option<String>,
    #[serde(default)]
    pub jurusan: Option<String>,
    #[serde(default)]
    pub aktif_only: Option<bool>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
    #[serde(default)]
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ListResult {
    pub items: Vec<Anggota>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

const ALLOWED_SORT: &[&str] = &[
    "nama",
    "kode_anggota",
    "kelas",
    "jurusan",
    "tanggal_daftar",
    "created_at",
    "updated_at",
];

fn map_row(row: &Row<'_>) -> rusqlite::Result<Anggota> {
    Ok(Anggota {
        id: row.get("id")?,
        kode_anggota: row.get("kode_anggota")?,
        nama: row.get("nama")?,
        jenis_kelamin: row.get("jenis_kelamin")?,
        kelas: row.get("kelas")?,
        jurusan: row.get("jurusan")?,
        tempat_lahir: row.get("tempat_lahir")?,
        tanggal_lahir: row.get("tanggal_lahir")?,
        no_telp: row.get("no_telp")?,
        email: row.get("email")?,
        alamat: row.get("alamat")?,
        foto_path: row.get("foto_path")?,
        agama: row.get("agama")?,
        tanggal_daftar: row.get("tanggal_daftar")?,
        aktif: row.get::<_, i64>("aktif")? != 0,
        catatan: row.get("catatan")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn validate_payload(payload: &AnggotaPayload) -> AppResult<()> {
    if payload.kode_anggota.trim().is_empty() {
        return Err(AppError::Validation("kode_anggota kosong".into()));
    }
    if payload.nama.trim().is_empty() {
        return Err(AppError::Validation("nama kosong".into()));
    }
    if let Some(jk) = &payload.jenis_kelamin {
        if !jk.is_empty() && jk != "L" && jk != "P" {
            return Err(AppError::Validation("jenis_kelamin harus L atau P".into()));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn anggota_list(state: State<'_, AppState>, params: ListParams) -> AppResult<ListResult> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let mut where_clauses: Vec<String> = Vec::new();
    let mut sql_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(q) = params.query.as_ref().filter(|q| !q.trim().is_empty()) {
        let pat = format!("%{}%", q.trim());
        where_clauses.push(
            "(nama LIKE ?1 OR kode_anggota LIKE ?1 OR kelas LIKE ?1 OR jurusan LIKE ?1)".into(),
        );
        sql_params.push(Box::new(pat));
    }
    if let Some(k) = params.kelas.as_ref().filter(|s| !s.is_empty()) {
        where_clauses.push(format!("kelas = ?{}", sql_params.len() + 1));
        sql_params.push(Box::new(k.clone()));
    }
    if let Some(j) = params.jurusan.as_ref().filter(|s| !s.is_empty()) {
        where_clauses.push(format!("jurusan = ?{}", sql_params.len() + 1));
        sql_params.push(Box::new(j.clone()));
    }
    if params.aktif_only.unwrap_or(false) {
        where_clauses.push("aktif = 1".into());
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    let sort_by = params
        .sort_by
        .as_deref()
        .filter(|s| ALLOWED_SORT.contains(s))
        .unwrap_or("nama");
    let sort_dir = match params.sort_dir.as_deref() {
        Some("desc" | "DESC") => "DESC",
        _ => "ASC",
    };

    let limit = params.limit.unwrap_or(25).min(500);
    let offset = params.offset.unwrap_or(0);

    let count_sql = format!("SELECT COUNT(*) FROM anggota{where_sql}");
    let count_param_refs: Vec<&dyn rusqlite::ToSql> =
        sql_params.iter().map(|b| b.as_ref()).collect();
    let total: u32 = conn.query_row(&count_sql, count_param_refs.as_slice(), |row| {
        row.get::<_, i64>(0)
    })? as u32;

    let list_sql = format!(
        "SELECT id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, \
         agama, tanggal_daftar, aktif, catatan, created_at, updated_at \
         FROM anggota{where_sql} \
         ORDER BY {sort_by} {sort_dir} \
         LIMIT {limit} OFFSET {offset}"
    );
    let mut stmt = conn.prepare(&list_sql)?;
    let list_param_refs: Vec<&dyn rusqlite::ToSql> =
        sql_params.iter().map(|b| b.as_ref()).collect();
    let items: Vec<Anggota> = stmt
        .query_map(list_param_refs.as_slice(), map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(ListResult {
        items,
        total,
        limit,
        offset,
    })
}

#[tauri::command]
pub fn anggota_get(state: State<'_, AppState>, id: i64) -> AppResult<Anggota> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let result = conn.query_row(
        "SELECT id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, \
         agama, tanggal_daftar, aktif, catatan, created_at, updated_at \
         FROM anggota WHERE id = ?1",
        params![id],
        map_row,
    );
    match result {
        Ok(a) => Ok(a),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(AppError::NotFound),
        Err(e) => Err(AppError::Db(e)),
    }
}

#[tauri::command]
pub fn anggota_create(
    state: State<'_, AppState>,
    payload: AnggotaPayload,
) -> AppResult<Anggota> {
    validate_payload(&payload)?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota WHERE kode_anggota = ?1",
            params![payload.kode_anggota],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if exists > 0 {
        return Err(AppError::Conflict(format!(
            "kode_anggota '{}' sudah dipakai",
            payload.kode_anggota
        )));
    }

    conn.execute(
        "INSERT INTO anggota (kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, agama, \
         aktif, catatan) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            payload.kode_anggota,
            payload.nama,
            payload.jenis_kelamin,
            payload.kelas,
            payload.jurusan,
            payload.tempat_lahir,
            payload.tanggal_lahir,
            payload.no_telp,
            payload.email,
            payload.alamat,
            payload.foto_path,
            payload.agama,
            if payload.aktif { 1 } else { 0 },
            payload.catatan,
        ],
    )?;
    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, \
         agama, tanggal_daftar, aktif, catatan, created_at, updated_at \
         FROM anggota WHERE id = ?1",
        params![id],
        map_row,
    )
    .map_err(AppError::Db)
}

#[tauri::command]
pub fn anggota_update(
    state: State<'_, AppState>,
    id: i64,
    payload: AnggotaPayload,
) -> AppResult<Anggota> {
    validate_payload(&payload)?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if existing == 0 {
        return Err(AppError::NotFound);
    }

    let dup: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM anggota WHERE kode_anggota = ?1 AND id != ?2",
            params![payload.kode_anggota, id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if dup > 0 {
        return Err(AppError::Conflict(format!(
            "kode_anggota '{}' sudah dipakai",
            payload.kode_anggota
        )));
    }

    conn.execute(
        "UPDATE anggota SET kode_anggota = ?1, nama = ?2, jenis_kelamin = ?3, \
         kelas = ?4, jurusan = ?5, tempat_lahir = ?6, tanggal_lahir = ?7, \
         no_telp = ?8, email = ?9, alamat = ?10, foto_path = ?11, agama = ?12, \
         aktif = ?13, catatan = ?14, updated_at = datetime('now') \
         WHERE id = ?15",
        params![
            payload.kode_anggota,
            payload.nama,
            payload.jenis_kelamin,
            payload.kelas,
            payload.jurusan,
            payload.tempat_lahir,
            payload.tanggal_lahir,
            payload.no_telp,
            payload.email,
            payload.alamat,
            payload.foto_path,
            payload.agama,
            if payload.aktif { 1 } else { 0 },
            payload.catatan,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, \
         agama, tanggal_daftar, aktif, catatan, created_at, updated_at \
         FROM anggota WHERE id = ?1",
        params![id],
        map_row,
    )
    .map_err(AppError::Db)
}

#[tauri::command]
pub fn anggota_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let affected = conn.execute("DELETE FROM anggota WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Search ringan untuk autocomplete (revisi #20). Limit kecil, ordering by
/// best-match approximation (LIKE prefix > LIKE substring).
#[tauri::command]
pub fn anggota_search(state: State<'_, AppState>, query: String) -> AppResult<Vec<Anggota>> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let pat = format!("%{q}%");
    let prefix = format!("{q}%");
    let mut stmt = conn.prepare(
        "SELECT id, kode_anggota, nama, jenis_kelamin, kelas, jurusan, \
         tempat_lahir, tanggal_lahir, no_telp, email, alamat, foto_path, \
         agama, tanggal_daftar, aktif, catatan, created_at, updated_at \
         FROM anggota \
         WHERE aktif = 1 AND (nama LIKE ?1 OR kode_anggota LIKE ?1) \
         ORDER BY \
           CASE WHEN nama LIKE ?2 THEN 0 \
                WHEN kode_anggota LIKE ?2 THEN 1 \
                ELSE 2 END, \
           nama \
         LIMIT 10",
    )?;
    let items: Vec<Anggota> = stmt
        .query_map(params![pat, prefix], map_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(items)
}

#[derive(Debug, Clone, Serialize)]
pub struct DistinctValues {
    pub kelas: Vec<String>,
    pub jurusan: Vec<String>,
    pub agama: Vec<String>,
}

/// Ambil nilai distinct untuk filter dropdown. Sesi 5 akan ganti dengan tabel
/// master CRUD; sesi 4 cukup pakai distinct dari kolom existing.
#[tauri::command]
pub fn anggota_distinct_values(state: State<'_, AppState>) -> AppResult<DistinctValues> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let collect_distinct = |column: &str| -> AppResult<Vec<String>> {
        let sql = format!(
            "SELECT DISTINCT {column} FROM anggota \
             WHERE {column} IS NOT NULL AND {column} != '' \
             ORDER BY {column} ASC"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    };

    Ok(DistinctValues {
        kelas: collect_distinct("kelas")?,
        jurusan: collect_distinct("jurusan")?,
        agama: collect_distinct("agama")?,
    })
}
