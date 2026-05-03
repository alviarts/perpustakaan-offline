//! Settings commands (revisi #24).
//!
//! Bulk key/value access (`settings_get_many` / `settings_set_many`),
//! account management (`settings_users_*`), permission matrix
//! (`settings_permissions_*`), and audit-log query
//! (`settings_audit_log_query`) — all back the in-app Settings page.

use std::collections::BTreeMap;

use rusqlite::{params, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

// ---------------------------------------------------------------------------
// Generic key/value
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn settings_get_many(
    state: State<'_, AppState>,
    keys: Vec<String>,
) -> AppResult<BTreeMap<String, String>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut out: BTreeMap<String, String> = BTreeMap::new();
    if keys.is_empty() {
        return Ok(out);
    }
    let placeholders = keys
        .iter()
        .map(|_| "?".to_string())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("SELECT key, value FROM settings WHERE key IN ({placeholders})",);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(keys.iter()), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        ))
    })?;
    for r in rows {
        let (k, v) = r?;
        out.insert(k, v);
    }
    Ok(out)
}

#[tauri::command]
pub fn settings_set_many(
    state: State<'_, AppState>,
    entries: BTreeMap<String, String>,
) -> AppResult<()> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let tx = conn.transaction()?;
    for (k, v) in entries {
        tx.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )?;
    }
    tx.commit()?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRecord {
    pub id: i64,
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub aktif: bool,
    pub last_login_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInput {
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub aktif: bool,
    pub password: Option<String>,
}

fn validate_role(role: &str) -> AppResult<()> {
    if role == "admin" || role == "pustakawan" {
        Ok(())
    } else {
        Err(AppError::Validation(format!("role tidak dikenal: {role}")))
    }
}

#[tauri::command]
pub fn settings_users_list(state: State<'_, AppState>) -> AppResult<Vec<UserRecord>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt = conn.prepare(
        "SELECT id, username, full_name, role, aktif, last_login_at, created_at
         FROM users ORDER BY id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(UserRecord {
            id: row.get(0)?,
            username: row.get(1)?,
            full_name: row.get(2)?,
            role: row.get(3)?,
            aktif: row.get::<_, i64>(4)? != 0,
            last_login_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn settings_users_create(
    state: State<'_, AppState>,
    payload: UserInput,
) -> AppResult<UserRecord> {
    validate_role(&payload.role)?;
    let username = payload.username.trim().to_string();
    if username.is_empty() {
        return Err(AppError::Validation("username wajib diisi".into()));
    }
    let password = payload
        .password
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Validation("password wajib diisi".into()))?;
    let hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(format!("bcrypt: {e}")))?;

    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let id = {
        let mut stmt = conn.prepare(
            "INSERT INTO users (username, password_hash, full_name, role, aktif)
             VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id",
        )?;
        stmt.query_row(
            params![
                &username,
                hash,
                payload.full_name.trim(),
                payload.role,
                if payload.aktif { 1 } else { 0 }
            ],
            |row| row.get::<_, i64>(0),
        )?
    };
    let mut stmt = conn.prepare(
        "SELECT id, username, full_name, role, aktif, last_login_at, created_at
         FROM users WHERE id = ?1",
    )?;
    let rec = stmt.query_row(params![id], |row| {
        Ok(UserRecord {
            id: row.get(0)?,
            username: row.get(1)?,
            full_name: row.get(2)?,
            role: row.get(3)?,
            aktif: row.get::<_, i64>(4)? != 0,
            last_login_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    Ok(rec)
}

#[tauri::command]
pub fn settings_users_update(
    state: State<'_, AppState>,
    id: i64,
    payload: UserInput,
) -> AppResult<UserRecord> {
    validate_role(&payload.role)?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "UPDATE users
         SET username = ?1, full_name = ?2, role = ?3, aktif = ?4,
             updated_at = datetime('now')
         WHERE id = ?5",
        params![
            payload.username.trim(),
            payload.full_name.trim(),
            payload.role,
            if payload.aktif { 1 } else { 0 },
            id
        ],
    )?;
    let mut stmt = conn.prepare(
        "SELECT id, username, full_name, role, aktif, last_login_at, created_at
         FROM users WHERE id = ?1",
    )?;
    let rec = stmt.query_row(params![id], |row| {
        Ok(UserRecord {
            id: row.get(0)?,
            username: row.get(1)?,
            full_name: row.get(2)?,
            role: row.get(3)?,
            aktif: row.get::<_, i64>(4)? != 0,
            last_login_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    Ok(rec)
}

#[tauri::command]
pub fn settings_users_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let n = conn.execute("DELETE FROM users WHERE id = ?1", params![id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("user id={id} tidak ditemukan")));
    }
    Ok(())
}

#[tauri::command]
pub fn settings_users_reset_password(
    state: State<'_, AppState>,
    id: i64,
    new_password: String,
) -> AppResult<()> {
    let trimmed = new_password.trim();
    if trimmed.len() < 6 {
        return Err(AppError::Validation("password minimal 6 karakter".into()));
    }
    let hash = bcrypt::hash(trimmed, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(format!("bcrypt: {e}")))?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let n = conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![hash, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("user id={id} tidak ditemukan")));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

const PERMISSION_AREAS: &[&str] = &[
    "anggota",
    "buku",
    "peminjaman",
    "pengembalian",
    "kunjungan",
    "laporan",
    "settings",
    "audit_log",
];
const PERMISSION_ACTIONS: &[&str] = &["view", "create", "update", "delete"];

const PERMISSIONS_MATRIX_KEY: &str = "rbac.permission_matrix_v1";

pub type RoleActions = BTreeMap<String, bool>;
pub type RoleArea = BTreeMap<String, RoleActions>;
pub type PermissionMatrix = BTreeMap<String, RoleArea>;

fn default_matrix() -> PermissionMatrix {
    let mut out = PermissionMatrix::new();
    for role in ["admin", "pustakawan"].iter() {
        let mut area_map = RoleArea::new();
        for area in PERMISSION_AREAS {
            let mut actions = RoleActions::new();
            for act in PERMISSION_ACTIONS {
                let granted = match (*role, *area, *act) {
                    ("pustakawan", "settings" | "audit_log", "view") => true,
                    ("pustakawan", "settings" | "audit_log", _) => false,
                    _ => true,
                };
                actions.insert((*act).to_string(), granted);
            }
            area_map.insert((*area).to_string(), actions);
        }
        out.insert((*role).to_string(), area_map);
    }
    out
}

#[tauri::command]
pub fn settings_permissions_get(state: State<'_, AppState>) -> AppResult<PermissionMatrix> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![PERMISSIONS_MATRIX_KEY],
            |row| row.get(0),
        )
        .ok();
    if let Some(v) = value {
        if let Ok(parsed) = serde_json::from_str::<PermissionMatrix>(&v) {
            return Ok(parsed);
        }
    }
    Ok(default_matrix())
}

#[tauri::command]
pub fn settings_permissions_save(
    state: State<'_, AppState>,
    matrix: PermissionMatrix,
) -> AppResult<PermissionMatrix> {
    let json = serde_json::to_string(&matrix)
        .map_err(|e| AppError::Internal(format!("serialize matrix: {e}")))?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![PERMISSIONS_MATRIX_KEY, json],
    )?;
    Ok(matrix)
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogQuery {
    pub user: Option<String>,
    pub action: Option<String>,
    pub entity: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: i64,
    pub user_id: Option<i64>,
    pub username: Option<String>,
    pub aksi: String,
    pub entitas: String,
    pub entitas_id: Option<i64>,
    pub detail: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn settings_audit_log_query(
    state: State<'_, AppState>,
    query: AuditLogQuery,
) -> AppResult<Vec<AuditLogEntry>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let limit = query.limit.unwrap_or(200).clamp(1, 1000);
    let mut clauses: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    if let Some(u) = query.user.as_deref().filter(|s| !s.trim().is_empty()) {
        clauses.push("u.username LIKE ?".into());
        binds.push(format!("%{u}%"));
    }
    if let Some(a) = query.action.as_deref().filter(|s| !s.trim().is_empty()) {
        clauses.push("a.aksi = ?".into());
        binds.push(a.to_string());
    }
    if let Some(e) = query.entity.as_deref().filter(|s| !s.trim().is_empty()) {
        clauses.push("a.entitas = ?".into());
        binds.push(e.to_string());
    }
    if let Some(f) = query.from.as_deref().filter(|s| !s.trim().is_empty()) {
        clauses.push("a.created_at >= ?".into());
        binds.push(f.to_string());
    }
    if let Some(t) = query.to.as_deref().filter(|s| !s.trim().is_empty()) {
        clauses.push("a.created_at <= ?".into());
        binds.push(t.to_string());
    }
    let where_sql = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT a.id, a.user_id, u.username, a.aksi, a.entitas, a.entitas_id,
                a.detail, a.created_at
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         {where_sql}
         ORDER BY a.id DESC LIMIT {limit}"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(binds.iter()), |row| {
        Ok(AuditLogEntry {
            id: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            aksi: row.get(3)?,
            entitas: row.get(4)?,
            entitas_id: row.get(5)?,
            detail: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}
