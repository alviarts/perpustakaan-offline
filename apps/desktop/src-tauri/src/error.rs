use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("bcrypt error: {0}")]
    Bcrypt(#[from] bcrypt::BcryptError),
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("inactive account")]
    InactiveAccount,
    #[error("not authenticated")]
    NotAuthenticated,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("validation: {0}")]
    Validation(String),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<tauri::Error> for AppError {
    fn from(value: tauri::Error) -> Self {
        AppError::Internal(value.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // Pair each variant with the user-facing message *without* the
        // `validation: ` / `not found: ` prefix that the `Display` impl
        // injects. The frontend's `formatTauriError` shows `message`
        // verbatim, so leaking that prefix duplicates information already
        // expressed by `code` and produced toasts like
        // "validation: melebihi maksimal 2 buku per anggota" (BUG-10 in
        // the v1.0.7 batch).
        let (code, msg): (&str, String) = match self {
            AppError::InvalidCredentials => ("invalid_credentials", "Kredensial tidak valid".into()),
            AppError::InactiveAccount => ("inactive", "Akun tidak aktif".into()),
            AppError::NotAuthenticated => ("not_authenticated", "Belum login".into()),
            AppError::NotFound(m) => ("not_found", m.clone()),
            AppError::Validation(m) => ("validation", m.clone()),
            AppError::Internal(m) => ("internal", m.clone()),
            AppError::Db(e) => ("internal", e.to_string()),
            AppError::Io(e) => ("internal", e.to_string()),
            AppError::Bcrypt(e) => ("internal", e.to_string()),
        };
        let mut state = serializer.serialize_struct("AppError", 2)?;
        use serde::ser::SerializeStruct;
        state.serialize_field("code", code)?;
        state.serialize_field("message", &msg)?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
