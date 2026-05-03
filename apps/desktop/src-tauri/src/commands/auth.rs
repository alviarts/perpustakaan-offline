use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub full_name: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginPayload {
    pub user: SessionUser,
    pub token: Option<String>,
}

#[tauri::command]
pub fn auth_login(
    state: State<'_, AppState>,
    username: String,
    password: String,
    remember_me: bool,
) -> AppResult<LoginPayload> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let row = conn
        .query_row(
            "SELECT id, username, password_hash, full_name, role, aktif
             FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            },
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => AppError::InvalidCredentials,
            other => AppError::Db(other),
        })?;

    let (id, username, hash, full_name, role, aktif) = row;

    if aktif == 0 {
        return Err(AppError::InactiveAccount);
    }
    let ok = bcrypt::verify(&password, &hash).unwrap_or(false);
    if !ok {
        return Err(AppError::InvalidCredentials);
    }

    let user = SessionUser {
        id,
        username,
        full_name,
        role,
    };

    let token = if remember_me {
        Some(generate_token())
    } else {
        None
    };

    drop(conn);

    *state
        .current_user
        .lock()
        .map_err(|_| AppError::Internal("user mutex poisoned".into()))? = Some(user.clone());
    *state
        .remember_token
        .lock()
        .map_err(|_| AppError::Internal("token mutex poisoned".into()))? = token.clone();

    Ok(LoginPayload { user, token })
}

#[tauri::command]
pub fn auth_logout(state: State<'_, AppState>) -> AppResult<()> {
    *state
        .current_user
        .lock()
        .map_err(|_| AppError::Internal("user mutex poisoned".into()))? = None;
    *state
        .remember_token
        .lock()
        .map_err(|_| AppError::Internal("token mutex poisoned".into()))? = None;
    Ok(())
}

#[tauri::command]
pub fn auth_login_with_token(state: State<'_, AppState>) -> AppResult<Option<SessionUser>> {
    let stored_token = state
        .remember_token
        .lock()
        .map_err(|_| AppError::Internal("token mutex poisoned".into()))?
        .clone();
    if stored_token.is_none() {
        return Ok(None);
    }
    let user = state
        .current_user
        .lock()
        .map_err(|_| AppError::Internal("user mutex poisoned".into()))?
        .clone();
    Ok(user)
}

#[tauri::command]
pub fn auth_current_user(state: State<'_, AppState>) -> AppResult<Option<SessionUser>> {
    let user = state
        .current_user
        .lock()
        .map_err(|_| AppError::Internal("user mutex poisoned".into()))?
        .clone();
    Ok(user)
}

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}
