use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Generic master-data record. `id` is `None` for primary-key-as-string tables
/// like `bahasa` (kode is the PK) and `ddc` (kode is the PK).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterItem {
    pub id: Option<i64>,
    pub kode: Option<String>,
    pub nama: String,
    pub deskripsi: Option<String>,
    pub urutan: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterInput {
    pub kode: Option<String>,
    pub nama: String,
    pub deskripsi: Option<String>,
    pub urutan: Option<i64>,
}

fn allowed_table(name: &str) -> AppResult<&'static str> {
    match name {
        "kategori" => Ok("kategori"),
        "bahasa" => Ok("bahasa"),
        "jurusan" => Ok("jurusan"),
        "agama" => Ok("agama"),
        "kelas" => Ok("kelas"),
        "ddc" => Ok("ddc"),
        other => Err(AppError::Validation(format!(
            "unknown master table '{other}'"
        ))),
    }
}

#[tauri::command]
pub fn master_list(
    state: State<'_, AppState>,
    table: String,
    query: Option<String>,
) -> AppResult<Vec<MasterItem>> {
    let table = allowed_table(&table)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let q = query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{s}%"));

    let (sql, like) = match (table, q.as_deref()) {
        ("bahasa", Some(_)) => (
            "SELECT NULL as id, kode as kode, nama, NULL as deskripsi, NULL as urutan
             FROM bahasa WHERE nama LIKE ?1 OR kode LIKE ?1 ORDER BY nama ASC"
                .to_string(),
            true,
        ),
        ("bahasa", None) => (
            "SELECT NULL as id, kode as kode, nama, NULL as deskripsi, NULL as urutan
             FROM bahasa ORDER BY nama ASC"
                .to_string(),
            false,
        ),
        ("ddc", Some(_)) => (
            "SELECT NULL as id, kode as kode, deskripsi as nama, NULL as deskripsi,
                    depth as urutan
             FROM ddc WHERE kode LIKE ?1 OR deskripsi LIKE ?1
             ORDER BY kode ASC LIMIT 200"
                .to_string(),
            true,
        ),
        ("ddc", None) => (
            "SELECT NULL as id, kode as kode, deskripsi as nama, NULL as deskripsi,
                    depth as urutan
             FROM ddc ORDER BY kode ASC LIMIT 200"
                .to_string(),
            false,
        ),
        ("kategori", Some(_)) => (
            "SELECT id, NULL as kode, nama, deskripsi, urutan FROM kategori
             WHERE nama LIKE ?1 ORDER BY urutan ASC, nama ASC"
                .to_string(),
            true,
        ),
        ("kategori", None) => (
            "SELECT id, NULL as kode, nama, deskripsi, urutan FROM kategori
             ORDER BY urutan ASC, nama ASC"
                .to_string(),
            false,
        ),
        ("kelas", Some(_)) => (
            "SELECT id, NULL as kode, nama, NULL as deskripsi, urutan FROM kelas
             WHERE nama LIKE ?1 ORDER BY urutan ASC, nama ASC"
                .to_string(),
            true,
        ),
        ("kelas", None) => (
            "SELECT id, NULL as kode, nama, NULL as deskripsi, urutan FROM kelas
             ORDER BY urutan ASC, nama ASC"
                .to_string(),
            false,
        ),
        ("jurusan", Some(_)) => (
            "SELECT id, kode, nama, NULL as deskripsi, urutan FROM jurusan
             WHERE nama LIKE ?1 OR kode LIKE ?1 ORDER BY urutan ASC, nama ASC"
                .to_string(),
            true,
        ),
        ("jurusan", None) => (
            "SELECT id, kode, nama, NULL as deskripsi, urutan FROM jurusan
             ORDER BY urutan ASC, nama ASC"
                .to_string(),
            false,
        ),
        ("agama", Some(_)) => (
            "SELECT id, NULL as kode, nama, NULL as deskripsi, urutan FROM agama
             WHERE nama LIKE ?1 ORDER BY urutan ASC, nama ASC"
                .to_string(),
            true,
        ),
        ("agama", None) => (
            "SELECT id, NULL as kode, nama, NULL as deskripsi, urutan FROM agama
             ORDER BY urutan ASC, nama ASC"
                .to_string(),
            false,
        ),
        _ => unreachable!(),
    };

    let mut stmt = conn.prepare(&sql)?;
    let mapper = |row: &rusqlite::Row<'_>| -> rusqlite::Result<MasterItem> {
        Ok(MasterItem {
            id: row.get::<_, Option<i64>>("id")?,
            kode: row.get::<_, Option<String>>("kode")?,
            nama: row.get::<_, String>("nama")?,
            deskripsi: row.get::<_, Option<String>>("deskripsi")?,
            urutan: row.get::<_, Option<i64>>("urutan")?,
        })
    };
    let rows = if like {
        stmt.query_map(params![q.as_deref().unwrap_or("")], mapper)?
            .collect::<Result<Vec<_>, _>>()?
    } else {
        stmt.query_map([], mapper)?.collect::<Result<Vec<_>, _>>()?
    };
    Ok(rows)
}

#[tauri::command]
pub fn master_create(
    state: State<'_, AppState>,
    table: String,
    input: MasterInput,
) -> AppResult<MasterItem> {
    let table = allowed_table(&table)?;
    if input.nama.trim().is_empty() {
        return Err(AppError::Validation("nama required".into()));
    }
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    match table {
        "bahasa" => {
            let kode = input
                .kode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AppError::Validation("kode required for bahasa".into()))?;
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM bahasa WHERE kode = ?1 OR nama = ?2",
                params![kode, input.nama.trim()],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!(
                    "bahasa '{kode}' / '{}' sudah ada",
                    input.nama
                )));
            }
            conn.execute(
                "INSERT INTO bahasa (kode, nama) VALUES (?1, ?2)",
                params![kode, input.nama.trim()],
            )?;
            Ok(MasterItem {
                id: None,
                kode: Some(kode.to_string()),
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: None,
            })
        }
        "ddc" => {
            let kode = input
                .kode
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AppError::Validation("kode required for ddc".into()))?;
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM ddc WHERE kode = ?1",
                params![kode],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!("ddc '{kode}' sudah ada")));
            }
            let depth = input.urutan.unwrap_or(0);
            conn.execute(
                "INSERT INTO ddc (kode, deskripsi, depth) VALUES (?1, ?2, ?3)",
                params![kode, input.nama.trim(), depth],
            )?;
            Ok(MasterItem {
                id: None,
                kode: Some(kode.to_string()),
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: Some(depth),
            })
        }
        "kategori" => {
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM kategori WHERE LOWER(nama) = LOWER(?1)",
                params![input.nama.trim()],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!(
                    "kategori '{}' sudah ada",
                    input.nama
                )));
            }
            conn.execute(
                "INSERT INTO kategori (nama, deskripsi, urutan) VALUES (?1, ?2, ?3)",
                params![
                    input.nama.trim(),
                    input.deskripsi,
                    input.urutan.unwrap_or(0)
                ],
            )?;
            let id = conn.last_insert_rowid();
            Ok(MasterItem {
                id: Some(id),
                kode: None,
                nama: input.nama.trim().to_string(),
                deskripsi: input.deskripsi,
                urutan: input.urutan.or(Some(0)),
            })
        }
        "jurusan" => {
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM jurusan WHERE LOWER(nama) = LOWER(?1)",
                params![input.nama.trim()],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!(
                    "jurusan '{}' sudah ada",
                    input.nama
                )));
            }
            conn.execute(
                "INSERT INTO jurusan (nama, kode, urutan) VALUES (?1, ?2, ?3)",
                params![input.nama.trim(), input.kode, input.urutan.unwrap_or(0)],
            )?;
            let id = conn.last_insert_rowid();
            Ok(MasterItem {
                id: Some(id),
                kode: input.kode,
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: input.urutan.or(Some(0)),
            })
        }
        "kelas" => {
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM kelas WHERE LOWER(nama) = LOWER(?1)",
                params![input.nama.trim()],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!(
                    "kelas '{}' sudah ada",
                    input.nama
                )));
            }
            let tingkat = input
                .nama
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse::<i64>()
                .ok();
            conn.execute(
                "INSERT INTO kelas (nama, tingkat, urutan) VALUES (?1, ?2, ?3)",
                params![input.nama.trim(), tingkat, input.urutan.unwrap_or(0)],
            )?;
            let id = conn.last_insert_rowid();
            Ok(MasterItem {
                id: Some(id),
                kode: None,
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: input.urutan.or(Some(0)),
            })
        }
        "agama" => {
            let dup: i64 = conn.query_row(
                "SELECT COUNT(*) FROM agama WHERE LOWER(nama) = LOWER(?1)",
                params![input.nama.trim()],
                |r| r.get(0),
            )?;
            if dup > 0 {
                return Err(AppError::Validation(format!(
                    "agama '{}' sudah ada",
                    input.nama
                )));
            }
            conn.execute(
                "INSERT INTO agama (nama, urutan) VALUES (?1, ?2)",
                params![input.nama.trim(), input.urutan.unwrap_or(0)],
            )?;
            let id = conn.last_insert_rowid();
            Ok(MasterItem {
                id: Some(id),
                kode: None,
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: input.urutan.or(Some(0)),
            })
        }
        _ => unreachable!(),
    }
}

#[tauri::command]
pub fn master_update(
    state: State<'_, AppState>,
    table: String,
    key: String,
    input: MasterInput,
) -> AppResult<MasterItem> {
    let table = allowed_table(&table)?;
    if input.nama.trim().is_empty() {
        return Err(AppError::Validation("nama required".into()));
    }
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    match table {
        "bahasa" => {
            let updated = conn.execute(
                "UPDATE bahasa SET nama = ?1 WHERE kode = ?2",
                params![input.nama.trim(), key],
            )?;
            if updated == 0 {
                return Err(AppError::NotFound(format!("bahasa '{key}'")));
            }
            Ok(MasterItem {
                id: None,
                kode: Some(key),
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: None,
            })
        }
        "ddc" => {
            let updated = conn.execute(
                "UPDATE ddc SET deskripsi = ?1 WHERE kode = ?2",
                params![input.nama.trim(), key],
            )?;
            if updated == 0 {
                return Err(AppError::NotFound(format!("ddc '{key}'")));
            }
            Ok(MasterItem {
                id: None,
                kode: Some(key),
                nama: input.nama.trim().to_string(),
                deskripsi: None,
                urutan: input.urutan,
            })
        }
        other => {
            let id: i64 = key
                .parse()
                .map_err(|_| AppError::Validation(format!("invalid id for {other}: '{key}'")))?;
            let sql = match other {
                "kategori" => {
                    "UPDATE kategori SET nama = ?1, deskripsi = ?2, urutan = ?3 WHERE id = ?4"
                }
                "jurusan" => "UPDATE jurusan SET nama = ?1, kode = ?2, urutan = ?3 WHERE id = ?4",
                "kelas" => "UPDATE kelas SET nama = ?1, tingkat = ?2, urutan = ?3 WHERE id = ?4",
                "agama" => "UPDATE agama SET nama = ?1, urutan = ?3 WHERE id = ?4",
                _ => unreachable!(),
            };
            let aux: rusqlite::types::Value = match other {
                "kategori" => input
                    .deskripsi
                    .clone()
                    .map(rusqlite::types::Value::Text)
                    .unwrap_or(rusqlite::types::Value::Null),
                "jurusan" => input
                    .kode
                    .clone()
                    .map(rusqlite::types::Value::Text)
                    .unwrap_or(rusqlite::types::Value::Null),
                "kelas" => {
                    let tingkat = input
                        .nama
                        .chars()
                        .take_while(|c| c.is_ascii_digit())
                        .collect::<String>()
                        .parse::<i64>()
                        .ok();
                    tingkat
                        .map(rusqlite::types::Value::Integer)
                        .unwrap_or(rusqlite::types::Value::Null)
                }
                "agama" => rusqlite::types::Value::Null,
                _ => unreachable!(),
            };
            let updated = conn.execute(
                sql,
                params![input.nama.trim(), aux, input.urutan.unwrap_or(0), id],
            )?;
            if updated == 0 {
                return Err(AppError::NotFound(format!("{other} id={id}")));
            }
            Ok(MasterItem {
                id: Some(id),
                kode: input.kode,
                nama: input.nama.trim().to_string(),
                deskripsi: input.deskripsi,
                urutan: input.urutan.or(Some(0)),
            })
        }
    }
}

#[tauri::command]
pub fn master_delete(state: State<'_, AppState>, table: String, key: String) -> AppResult<()> {
    let table = allowed_table(&table)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let deleted = match table {
        "bahasa" => conn.execute("DELETE FROM bahasa WHERE kode = ?1", params![key])?,
        "ddc" => conn.execute("DELETE FROM ddc WHERE kode = ?1", params![key])?,
        other => {
            let id: i64 = key
                .parse()
                .map_err(|_| AppError::Validation(format!("invalid id for {other}: '{key}'")))?;
            conn.execute(&format!("DELETE FROM {other} WHERE id = ?1"), params![id])?
        }
    };
    if deleted == 0 {
        return Err(AppError::NotFound(format!("{table} '{key}'")));
    }
    Ok(())
}
