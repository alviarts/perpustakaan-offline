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
    #[error("not found")]
    NotFound,
    #[error("conflict: {0}")]
    Conflict(String),
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
        let code = match self {
            AppError::InvalidCredentials => "invalid_credentials",
            AppError::InactiveAccount => "inactive",
            AppError::NotAuthenticated => "not_authenticated",
            AppError::NotFound => "not_found",
            AppError::Conflict(_) => "conflict",
            AppError::Validation(_) => "validation",
            _ => "internal",
        };
        let msg = self.to_string();
        let mut state = serializer.serialize_struct("AppError", 2)?;
        use serde::ser::SerializeStruct;
        state.serialize_field("code", code)?;
        state.serialize_field("message", &msg)?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
