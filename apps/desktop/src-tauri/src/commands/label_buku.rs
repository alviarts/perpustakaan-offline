//! Label Buku template CRUD (v1.0.6 #22). Mirrors `kta.rs` so the editor
//! pattern is shared. The schema is identical (id/nama/deskripsi/layout_json/
//! is_default/created_at/updated_at); only the layout's `kind` vocabulary
//! differs (`barcode`, `judul`, `kodeBuku`, `kodeEksemplar`, …).

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelBukuTemplate {
    pub id: i64,
    pub nama: String,
    pub deskripsi: Option<String>,
    pub layout_json: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelBukuTemplateInput {
    pub nama: String,
    pub deskripsi: Option<String>,
    pub layout_json: String,
    pub is_default: Option<bool>,
}

fn map_template(row: &rusqlite::Row<'_>) -> rusqlite::Result<LabelBukuTemplate> {
    Ok(LabelBukuTemplate {
        id: row.get(0)?,
        nama: row.get(1)?,
        deskripsi: row.get(2)?,
        layout_json: row.get(3)?,
        is_default: row.get::<_, i64>(4)? != 0,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn validate_layout(json: &str) -> AppResult<()> {
    let parsed: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| AppError::Validation(format!("layout json: {e}")))?;
    if !parsed.is_object() {
        return Err(AppError::Validation("layout harus object".into()));
    }
    let fields = parsed
        .get("fields")
        .and_then(|f| f.as_array())
        .ok_or_else(|| AppError::Validation("layout.fields harus array".into()))?;
    for f in fields {
        if f.get("kind").and_then(|k| k.as_str()).is_none() {
            return Err(AppError::Validation("setiap field harus punya kind".into()));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn label_buku_template_list(state: State<'_, AppState>) -> AppResult<Vec<LabelBukuTemplate>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, nama, deskripsi, layout_json, is_default, created_at, updated_at
             FROM label_buku_templates
             ORDER BY is_default DESC, nama",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], map_template)
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn label_buku_template_get(
    state: State<'_, AppState>,
    id: i64,
) -> AppResult<LabelBukuTemplate> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    conn.query_row(
        "SELECT id, nama, deskripsi, layout_json, is_default, created_at, updated_at
         FROM label_buku_templates WHERE id = ?1",
        [id],
        map_template,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("template label buku id={id} tidak ditemukan"))
        }
        other => AppError::from(other),
    })
}

#[tauri::command]
pub fn label_buku_template_create(
    state: State<'_, AppState>,
    input: LabelBukuTemplateInput,
) -> AppResult<LabelBukuTemplate> {
    if input.nama.trim().is_empty() {
        return Err(AppError::Validation("nama template wajib diisi".into()));
    }
    validate_layout(&input.layout_json)?;
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.transaction().map_err(AppError::from)?;

    let is_default = input.is_default.unwrap_or(false);
    if is_default {
        tx.execute("UPDATE label_buku_templates SET is_default = 0", [])
            .map_err(AppError::from)?;
    }
    tx.execute(
        "INSERT INTO label_buku_templates (nama, deskripsi, layout_json, is_default)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            input.nama.trim(),
            input.deskripsi,
            input.layout_json,
            is_default as i64
        ],
    )
    .map_err(AppError::from)?;
    let id = tx.last_insert_rowid();
    tx.commit().map_err(AppError::from)?;

    drop(conn);
    label_buku_template_get(state, id)
}

#[tauri::command]
pub fn label_buku_template_update(
    state: State<'_, AppState>,
    id: i64,
    input: LabelBukuTemplateInput,
) -> AppResult<LabelBukuTemplate> {
    if input.nama.trim().is_empty() {
        return Err(AppError::Validation("nama template wajib diisi".into()));
    }
    validate_layout(&input.layout_json)?;
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.transaction().map_err(AppError::from)?;

    let is_default = input.is_default.unwrap_or(false);
    if is_default {
        tx.execute(
            "UPDATE label_buku_templates SET is_default = 0 WHERE id != ?1",
            [id],
        )
        .map_err(AppError::from)?;
    }
    let affected = tx
        .execute(
            "UPDATE label_buku_templates
             SET nama = ?1,
                 deskripsi = ?2,
                 layout_json = ?3,
                 is_default = ?4,
                 updated_at = datetime('now')
             WHERE id = ?5",
            params![
                input.nama.trim(),
                input.deskripsi,
                input.layout_json,
                is_default as i64,
                id
            ],
        )
        .map_err(AppError::from)?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "template id={id} tidak ditemukan"
        )));
    }
    tx.commit().map_err(AppError::from)?;
    drop(conn);
    label_buku_template_get(state, id)
}

#[tauri::command]
pub fn label_buku_template_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let affected = conn
        .execute("DELETE FROM label_buku_templates WHERE id = ?1", [id])
        .map_err(AppError::from)?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "template id={id} tidak ditemukan"
        )));
    }
    Ok(())
}

#[tauri::command]
pub fn label_buku_template_set_default(
    state: State<'_, AppState>,
    id: i64,
) -> AppResult<LabelBukuTemplate> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let tx = conn.transaction().map_err(AppError::from)?;
    tx.execute("UPDATE label_buku_templates SET is_default = 0", [])
        .map_err(AppError::from)?;
    let affected = tx
        .execute(
            "UPDATE label_buku_templates SET is_default = 1, updated_at = datetime('now') WHERE id = ?1",
            [id],
        )
        .map_err(AppError::from)?;
    if affected == 0 {
        return Err(AppError::NotFound(format!(
            "template id={id} tidak ditemukan"
        )));
    }
    tx.commit().map_err(AppError::from)?;
    drop(conn);
    label_buku_template_get(state, id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_layout_rejects_non_object_json() {
        let err = validate_layout("[]").unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn validate_layout_rejects_missing_fields_array() {
        let err = validate_layout(r#"{"foo": 1}"#).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn validate_layout_rejects_field_without_kind() {
        let err = validate_layout(r#"{"fields": [{"id": "x"}]}"#).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn validate_layout_accepts_minimal_valid_payload() {
        validate_layout(r#"{"fields": [{"id":"x","kind":"barcode"}]}"#).unwrap();
    }

    #[test]
    fn validate_layout_accepts_empty_fields_array() {
        validate_layout(r#"{"widthMm":70,"heightMm":35,"fields":[]}"#).unwrap();
    }
}
