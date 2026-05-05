//! User profile / biodata commands (v1.0.4 #16).
//!
//! The Header dropdown ships a "Profil" item that opens a dialog where the
//! signed-in operator can edit their display name + portrait + a small
//! biodata block (date/place of birth, contact, address, gender, religion).
//! Username, role, and password remain managed by Settings → Akun.
//!
//! Storage layout:
//!
//! - `users.full_name` is the display name (already exists; we just keep it
//!   in sync with the dialog's "Nama Lengkap" field).
//! - `user_profiles` is a sibling table with `user_id` PK + biodata columns.
//!   It is created on first profile save (UPSERT) so v1.0.x users that never
//!   open the dialog don't pay a row.
//!
//! Every save records an `audit_log` entry (`update / users / <user_id>`)
//! with a JSON detail payload listing the changed fields, mirroring the
//! pattern from `kas` (#11) so admins can see who changed what.

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Operator profile / biodata. Mirrors the row stored in `user_profiles`
/// plus the `full_name` denormalised from `users` so the frontend gets
/// everything it needs in a single round-trip.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserProfile {
    pub user_id: i64,
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub foto_path: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub tempat_lahir: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub jenis_kelamin: Option<String>,
    pub agama: Option<String>,
}

/// Subset of fields the operator can update via the profile dialog. The
/// command applies every field as-given (set or clear); the frontend
/// dialog presents an edit form that posts the entire snapshot.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileInput {
    pub full_name: String,
    pub foto_path: Option<String>,
    pub tanggal_lahir: Option<String>,
    pub tempat_lahir: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub alamat: Option<String>,
    pub jenis_kelamin: Option<String>,
    pub agama: Option<String>,
}

#[tauri::command]
pub fn user_profile_get(
    state: State<'_, AppState>,
    user_id: i64,
) -> AppResult<UserProfile> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    fetch_profile(&conn, user_id)
}

#[tauri::command]
pub fn user_profile_update(
    app: AppHandle,
    state: State<'_, AppState>,
    user_id: i64,
    payload: UserProfileInput,
) -> AppResult<UserProfile> {
    let trimmed_name = payload.full_name.trim();
    if trimmed_name.is_empty() {
        return Err(AppError::Validation("nama lengkap wajib diisi".into()));
    }

    let mut conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let before = fetch_profile(&conn, user_id)?;
    let tx = conn.transaction()?;

    tx.execute(
        "UPDATE users SET full_name = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![trimmed_name, user_id],
    )?;

    tx.execute(
        r#"INSERT INTO user_profiles
                (user_id, foto_path, tanggal_lahir, tempat_lahir, telepon,
                 email, alamat, jenis_kelamin, agama, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET
               foto_path     = excluded.foto_path,
               tanggal_lahir = excluded.tanggal_lahir,
               tempat_lahir  = excluded.tempat_lahir,
               telepon       = excluded.telepon,
               email         = excluded.email,
               alamat        = excluded.alamat,
               jenis_kelamin = excluded.jenis_kelamin,
               agama         = excluded.agama,
               updated_at    = datetime('now')"#,
        rusqlite::params![
            user_id,
            payload.foto_path,
            payload.tanggal_lahir,
            payload.tempat_lahir,
            payload.telepon,
            payload.email,
            payload.alamat,
            payload.jenis_kelamin,
            payload.agama,
        ],
    )?;

    let after = UserProfile {
        user_id: before.user_id,
        username: before.username.clone(),
        full_name: trimmed_name.to_string(),
        role: before.role.clone(),
        foto_path: payload.foto_path.clone(),
        tanggal_lahir: payload.tanggal_lahir.clone(),
        tempat_lahir: payload.tempat_lahir.clone(),
        telepon: payload.telepon.clone(),
        email: payload.email.clone(),
        alamat: payload.alamat.clone(),
        jenis_kelamin: payload.jenis_kelamin.clone(),
        agama: payload.agama.clone(),
    };

    let detail = json!({
        "before": {
            "full_name":     before.full_name,
            "foto_path":     before.foto_path,
            "tanggal_lahir": before.tanggal_lahir,
            "tempat_lahir":  before.tempat_lahir,
            "telepon":       before.telepon,
            "email":         before.email,
            "alamat":        before.alamat,
            "jenis_kelamin": before.jenis_kelamin,
            "agama":         before.agama,
        },
        "after": {
            "full_name":     after.full_name,
            "foto_path":     after.foto_path,
            "tanggal_lahir": after.tanggal_lahir,
            "tempat_lahir":  after.tempat_lahir,
            "telepon":       after.telepon,
            "email":         after.email,
            "alamat":        after.alamat,
            "jenis_kelamin": after.jenis_kelamin,
            "agama":         after.agama,
        },
    });

    tx.execute(
        "INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, detail)
         VALUES (?1, 'update', 'users', ?2, ?3)",
        rusqlite::params![user_id, user_id, detail.to_string()],
    )?;

    tx.commit()?;
    drop(conn);

    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let fresh = fetch_profile(&conn, user_id)?;
    drop(conn);

    // Notify the UI so the header avatar + greeting refresh without a
    // full reload.
    let _ = app.emit("users:profile-changed", &fresh);
    Ok(fresh)
}

fn fetch_profile(conn: &rusqlite::Connection, user_id: i64) -> AppResult<UserProfile> {
    let user = conn.query_row(
        "SELECT username, full_name, role FROM users WHERE id = ?1",
        rusqlite::params![user_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        },
    );
    let (username, full_name, role) = match user {
        Ok(t) => t,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(AppError::NotFound(format!("user {user_id}")));
        }
        Err(e) => return Err(AppError::Db(e)),
    };

    let profile = conn.query_row(
        r#"SELECT foto_path, tanggal_lahir, tempat_lahir, telepon, email,
                  alamat, jenis_kelamin, agama
             FROM user_profiles
            WHERE user_id = ?1"#,
        rusqlite::params![user_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        },
    );
    let (
        foto_path,
        tanggal_lahir,
        tempat_lahir,
        telepon,
        email,
        alamat,
        jenis_kelamin,
        agama,
    ) = match profile {
        Ok(t) => t,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            (None, None, None, None, None, None, None, None)
        }
        Err(e) => return Err(AppError::Db(e)),
    };

    Ok(UserProfile {
        user_id,
        username,
        full_name,
        role,
        foto_path,
        tanggal_lahir,
        tempat_lahir,
        telepon,
        email,
        alamat,
        jenis_kelamin,
        agama,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations;
    use rusqlite::Connection;

    fn fresh_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        // Seed a user we can edit.
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role, aktif)
             VALUES ('alvi', 'x', 'Alvi Awal', 'admin', 1)",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn fetch_profile_returns_defaults_when_no_row_yet() {
        let conn = fresh_db();
        let p = fetch_profile(&conn, 1).unwrap();
        assert_eq!(p.user_id, 1);
        assert_eq!(p.username, "alvi");
        assert_eq!(p.full_name, "Alvi Awal");
        assert_eq!(p.role, "admin");
        assert!(p.foto_path.is_none());
        assert!(p.tanggal_lahir.is_none());
    }

    #[test]
    fn fetch_profile_returns_not_found_for_unknown_user() {
        let conn = fresh_db();
        let err = fetch_profile(&conn, 99).unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn upsert_then_read_round_trips_all_fields() {
        let mut conn = fresh_db();
        let tx = conn.transaction().unwrap();
        tx.execute(
            "UPDATE users SET full_name = 'Alvi Updated' WHERE id = 1",
            [],
        )
        .unwrap();
        tx.execute(
            r#"INSERT INTO user_profiles
                    (user_id, foto_path, tanggal_lahir, tempat_lahir, telepon,
                     email, alamat, jenis_kelamin, agama, updated_at)
               VALUES (1, 'uploads/user/x.jpg', '1995-08-17', 'Jakarta',
                       '0812', 'a@b.id', 'Jl. Merdeka', 'L', 'Islam',
                       datetime('now'))
               ON CONFLICT(user_id) DO NOTHING"#,
            [],
        )
        .unwrap();
        tx.commit().unwrap();
        let p = fetch_profile(&conn, 1).unwrap();
        assert_eq!(p.full_name, "Alvi Updated");
        assert_eq!(p.foto_path.as_deref(), Some("uploads/user/x.jpg"));
        assert_eq!(p.tanggal_lahir.as_deref(), Some("1995-08-17"));
        assert_eq!(p.tempat_lahir.as_deref(), Some("Jakarta"));
        assert_eq!(p.telepon.as_deref(), Some("0812"));
        assert_eq!(p.email.as_deref(), Some("a@b.id"));
        assert_eq!(p.alamat.as_deref(), Some("Jl. Merdeka"));
        assert_eq!(p.jenis_kelamin.as_deref(), Some("L"));
        assert_eq!(p.agama.as_deref(), Some("Islam"));
    }

    #[test]
    fn upsert_updates_existing_row_in_place() {
        let mut conn = fresh_db();
        let tx = conn.transaction().unwrap();
        tx.execute(
            r#"INSERT INTO user_profiles (user_id, foto_path, updated_at)
                 VALUES (1, 'uploads/user/v1.jpg', datetime('now'))"#,
            [],
        )
        .unwrap();
        tx.commit().unwrap();
        let tx = conn.transaction().unwrap();
        tx.execute(
            r#"INSERT INTO user_profiles
                    (user_id, foto_path, updated_at)
               VALUES (1, 'uploads/user/v2.jpg', datetime('now'))
               ON CONFLICT(user_id) DO UPDATE SET
                   foto_path  = excluded.foto_path,
                   updated_at = datetime('now')"#,
            [],
        )
        .unwrap();
        tx.commit().unwrap();
        // Should be exactly one row.
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM user_profiles", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let p = fetch_profile(&conn, 1).unwrap();
        assert_eq!(p.foto_path.as_deref(), Some("uploads/user/v2.jpg"));
    }
}
