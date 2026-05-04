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

// ---------------------------------------------------------------------------
// Forgot-password flow (PR-5)
//
// Purely offline: there's no email/SMS server, so the recovery channel is a
// per-user security question whose answer is bcrypt-hashed in the same column
// shape as `password_hash`. The flow is:
//
//   1. `auth_get_security_question(username)` — frontend calls this from the
//      login screen to populate the dialog. Returns `Some(question)` only if
//      the user exists, is active, AND has a question + answer_hash set; in
//      every other case returns `None` so attackers can't tell whether a
//      username exists or whether it has a recovery method.
//   2. `auth_reset_via_security_question(username, answer, new_password)` —
//      verifies the bcrypt hash of `normalize_security_answer(answer)` against
//      `security_answer_hash`. On match, hashes `new_password` (validated
//      ≥ 6 chars, same as the existing reset-password command) and updates the
//      user's `password_hash`. Wrong answer maps to `InvalidCredentials` so it
//      reuses the existing i18n + UI error path.
//   3. `auth_set_security_question(user_id, question, answer)` — sets/updates
//      the question + bcrypt-hashed answer for an existing user. Used by
//      Settings → Akun and from the Login dialog itself for first-time admin
//      setup.
// ---------------------------------------------------------------------------

/// Normalise the user's answer before hashing/comparing. Same trim + casefold
/// rule the v1 Python prototype used (see CHANGELOG v0.5.2): trim leading +
/// trailing whitespace, collapse internal whitespace runs, lowercase ASCII.
/// Tested separately so the contract is explicit.
pub fn normalize_security_answer(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ").to_ascii_lowercase()
}

#[tauri::command]
pub fn auth_get_security_question(
    state: State<'_, AppState>,
    username: String,
) -> AppResult<Option<String>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let row = conn
        .query_row(
            "SELECT security_question, security_answer_hash, aktif
             FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .ok();
    // Always return Ok(None) for "not eligible" so callers cannot probe for
    // valid usernames vs. configured-recovery vs. inactive accounts.
    let Some((question, hash, aktif)) = row else {
        return Ok(None);
    };
    if aktif == 0 {
        return Ok(None);
    }
    match (question, hash) {
        (Some(q), Some(h)) if !q.trim().is_empty() && !h.trim().is_empty() => Ok(Some(q)),
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn auth_reset_via_security_question(
    state: State<'_, AppState>,
    username: String,
    answer: String,
    new_password: String,
) -> AppResult<()> {
    let trimmed_pw = new_password.trim();
    if trimmed_pw.len() < 6 {
        return Err(AppError::Validation("password minimal 6 karakter".into()));
    }
    let normalized_answer = normalize_security_answer(&answer);
    if normalized_answer.is_empty() {
        return Err(AppError::Validation("jawaban tidak boleh kosong".into()));
    }

    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let row = conn
        .query_row(
            "SELECT id, security_answer_hash, aktif
             FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => AppError::InvalidCredentials,
            other => AppError::Db(other),
        })?;
    let (id, hash_opt, aktif) = row;
    if aktif == 0 {
        return Err(AppError::InactiveAccount);
    }
    let stored_hash = hash_opt
        .filter(|s| !s.trim().is_empty())
        .ok_or(AppError::InvalidCredentials)?;
    let ok = bcrypt::verify(&normalized_answer, &stored_hash).unwrap_or(false);
    if !ok {
        return Err(AppError::InvalidCredentials);
    }
    let new_hash = bcrypt::hash(trimmed_pw, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(format!("bcrypt: {e}")))?;
    conn.execute(
        "UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![new_hash, id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn auth_set_security_question(
    state: State<'_, AppState>,
    user_id: i64,
    question: String,
    answer: String,
) -> AppResult<()> {
    let trimmed_q = question.trim();
    if trimmed_q.is_empty() {
        return Err(AppError::Validation("pertanyaan tidak boleh kosong".into()));
    }
    let normalized_answer = normalize_security_answer(&answer);
    if normalized_answer.len() < 2 {
        return Err(AppError::Validation("jawaban minimal 2 karakter".into()));
    }
    let hash = bcrypt::hash(&normalized_answer, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::Internal(format!("bcrypt: {e}")))?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let n = conn.execute(
        "UPDATE users
         SET security_question = ?1, security_answer_hash = ?2,
             updated_at = datetime('now')
         WHERE id = ?3",
        rusqlite::params![trimmed_q, hash, user_id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound(format!("user id={user_id} tidak ditemukan")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_security_answer_trims_and_lowercases() {
        assert_eq!(normalize_security_answer("  Buku   Pertama "), "buku pertama");
        assert_eq!(normalize_security_answer("BUDI"), "budi");
        assert_eq!(normalize_security_answer("\tFoo\nBar"), "foo bar");
    }

    #[test]
    fn normalize_security_answer_preserves_internal_letters_and_digits() {
        assert_eq!(normalize_security_answer("MyDog123"), "mydog123");
        // Whitespace inside the string is collapsed but non-space chars are
        // preserved verbatim.
        assert_eq!(normalize_security_answer("café au lait"), "café au lait");
    }

    #[test]
    fn normalize_security_answer_returns_empty_for_blank_input() {
        assert_eq!(normalize_security_answer(""), "");
        assert_eq!(normalize_security_answer("    "), "");
    }

    #[test]
    fn bcrypt_round_trip_via_normalised_answer() {
        let normalised = normalize_security_answer("  Pet name HERE ");
        let hash = bcrypt::hash(&normalised, 4).unwrap();
        // Same input, different surface form, must verify thanks to
        // normalisation.
        let probe = normalize_security_answer("pet  NAME  here");
        assert!(bcrypt::verify(&probe, &hash).unwrap());
        // A different answer must NOT verify.
        assert!(!bcrypt::verify("pet name there", &hash).unwrap());
    }
}
