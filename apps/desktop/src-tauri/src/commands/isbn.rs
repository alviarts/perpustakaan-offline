/// ISBN-related Tauri commands
use tauri::State;
use crate::error::AppError;
use crate::AppState;
use crate::utils::isbn;
use crate::services::isbn_lookup::{self, BookMetadata};
use crate::services::cover_downloader;

/// Validate and normalize ISBN
#[tauri::command]
pub fn validate_isbn(isbn_input: String) -> Result<(String, String), AppError> {
    let (normalized, isbn_type) = isbn::detect_isbn(&isbn_input)
        .ok_or_else(|| AppError::Validation("Invalid ISBN format".to_string()))?;
    
    Ok((normalized, isbn_type.to_string()))
}

/// Convert ISBN-10 to ISBN-13
#[tauri::command]
pub fn convert_isbn10_to_isbn13(isbn10: String) -> Result<String, AppError> {
    isbn::isbn10_to_isbn13(&isbn10)
        .ok_or_else(|| AppError::Validation("Invalid ISBN-10 format".to_string()))
}

/// Convert ISBN-13 to ISBN-10
#[tauri::command]
pub fn convert_isbn13_to_isbn10(isbn13: String) -> Result<String, AppError> {
    isbn::isbn13_to_isbn10(&isbn13)
        .ok_or_else(|| AppError::Validation("Invalid ISBN-13 or not convertible (must start with 978)".to_string()))
}

/// Lookup book metadata by ISBN (cascade: Google Books → Open Library → Gramedia)
#[tauri::command]
pub fn lookup_book_by_isbn(isbn: String) -> Result<BookMetadata, AppError> {
    // Validate and normalize ISBN first
    let (normalized_isbn, _) = isbn::detect_isbn(&isbn)
        .ok_or_else(|| AppError::Validation("Invalid ISBN format".to_string()))?;
    
    // Lookup metadata
    isbn_lookup::lookup_isbn(&normalized_isbn)
}

/// Lookup book and download cover image
#[tauri::command]
pub fn lookup_and_download_cover(
    app: AppHandle,
    isbn: String,
    _state: State<'_, AppState>,
) -> Result<(BookMetadata, Option<String>), AppError> {
    // Validate and normalize ISBN
    let (normalized_isbn, _) = isbn::detect_isbn(&isbn)
        .ok_or_else(|| AppError::Validation("Invalid ISBN format".to_string()))?;
    
    // Lookup metadata
    let metadata = isbn_lookup::lookup_isbn(&normalized_isbn)?;
    
    // Download cover if available
    let cover_path = if let Some(ref cover_url) = metadata.cover_url {
        // Use app_data_dir from AppHandle (consistent with assets_save)
        let app_data_dir = app.path().app_data_dir()
            .map_err(|e| AppError::Internal(format!("Failed to get app data directory: {}", e)))?;
        
        // Save to uploads/buku/ directory (consistent with manual upload)
        let covers_dir = app_data_dir.join("uploads").join("buku");
        
        match cover_downloader::download_cover(cover_url, &normalized_isbn, &covers_dir) {
            Ok(abs_path) => {
                // Convert absolute path to relative path (uploads/buku/ISBN.jpg)
                let filename = abs_path.file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| AppError::Internal("Invalid filename".to_string()))?;
                Some(format!("uploads/buku/{}", filename))
            }
            Err(e) => {
                log::warn!("Failed to download cover for ISBN {}: {}", normalized_isbn, e);
                None
            }
        }
    } else {
        None
    };
    
    Ok((metadata, cover_path))
}

/// Get local cover path if exists
#[tauri::command]
pub fn get_cover_path(isbn: String) -> Result<Option<String>, AppError> {
    let app_data_dir = directories::ProjectDirs::from("id", "alviarts", "perpustakaan")
        .ok_or_else(|| AppError::Internal("Failed to get app data directory".to_string()))?;
    let covers_dir = app_data_dir.data_dir().join("covers");
    
    Ok(cover_downloader::get_cover_path(&isbn, &covers_dir)
        .map(|p| p.to_string_lossy().to_string()))
}

/// Delete cover image
#[tauri::command]
pub fn delete_cover(isbn: String) -> Result<(), AppError> {
    let app_data_dir = directories::ProjectDirs::from("id", "alviarts", "perpustakaan")
        .ok_or_else(|| AppError::Internal("Failed to get app data directory".to_string()))?;
    let covers_dir = app_data_dir.data_dir().join("covers");
    
    cover_downloader::delete_cover(&isbn, &covers_dir)
}
