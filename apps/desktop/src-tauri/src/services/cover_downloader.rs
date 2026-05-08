/// Cover image downloader and storage service
use std::path::{Path, PathBuf};
use std::fs;
use crate::error::AppError;

/// Download cover image from URL and save to local storage
/// Returns the local file path
pub fn download_cover(cover_url: &str, isbn: &str, covers_dir: &Path) -> Result<PathBuf, AppError> {
    // Create covers directory if not exists
    fs::create_dir_all(covers_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create covers directory: {}", e)))?;

    // Determine file extension from URL
    let extension = if cover_url.contains(".jpg") || cover_url.contains("jpeg") {
        "jpg"
    } else if cover_url.contains(".png") {
        "png"
    } else if cover_url.contains(".webp") {
        "webp"
    } else {
        "jpg" // default
    };

    let filename = format!("{}.{}", isbn, extension);
    let file_path = covers_dir.join(&filename);

    // Skip if already downloaded
    if file_path.exists() {
        return Ok(file_path);
    }

    // Download image
    let response = ureq::get(cover_url)
        .timeout(std::time::Duration::from_secs(30))
        .call()
        .map_err(|e| AppError::Internal(format!("Failed to download cover: {}", e)))?;

    // Read image bytes
    let mut bytes = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| AppError::Internal(format!("Failed to read cover data: {}", e)))?;

    // Validate image (try to decode)
    let img = image::load_from_memory(&bytes)
        .map_err(|e| AppError::Internal(format!("Invalid image data: {}", e)))?;

    // Save as JPEG (compressed, smaller file size)
    let output_path = covers_dir.join(format!("{}.jpg", isbn));
    img.save(&output_path)
        .map_err(|e| AppError::Internal(format!("Failed to save cover: {}", e)))?;

    Ok(output_path)
}

/// Get cover path if exists, otherwise return None
pub fn get_cover_path(isbn: &str, covers_dir: &Path) -> Option<PathBuf> {
    for ext in &["jpg", "jpeg", "png", "webp"] {
        let path = covers_dir.join(format!("{}.{}", isbn, ext));
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// Delete cover image
pub fn delete_cover(isbn: &str, covers_dir: &Path) -> Result<(), AppError> {
    for ext in &["jpg", "jpeg", "png", "webp"] {
        let path = covers_dir.join(format!("{}.{}", isbn, ext));
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| AppError::Internal(format!("Failed to delete cover: {}", e)))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    #[ignore] // Requires internet connection
    fn test_download_cover() {
        let temp_dir = tempdir().unwrap();
        let covers_dir = temp_dir.path();

        let cover_url = "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg";
        let result = download_cover(cover_url, "9780306406157", covers_dir);

        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.exists());
        assert_eq!(path.extension().unwrap(), "jpg");
    }

    #[test]
    fn test_get_cover_path() {
        let temp_dir = tempdir().unwrap();
        let covers_dir = temp_dir.path();

        // Create dummy cover file
        let cover_path = covers_dir.join("9780306406157.jpg");
        fs::write(&cover_path, b"fake image data").unwrap();

        let result = get_cover_path("9780306406157", covers_dir);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), cover_path);
    }

    #[test]
    fn test_delete_cover() {
        let temp_dir = tempdir().unwrap();
        let covers_dir = temp_dir.path();

        // Create dummy cover file
        let cover_path = covers_dir.join("9780306406157.jpg");
        fs::write(&cover_path, b"fake image data").unwrap();

        let result = delete_cover("9780306406157", covers_dir);
        assert!(result.is_ok());
        assert!(!cover_path.exists());
    }
}

