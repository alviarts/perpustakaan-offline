/// Cover image downloader and storage service
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Read;
use crate::error::AppError;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                  (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/// Some WAF-protected hosts (e.g. JAKLITERA) drop connections that carry a full
/// Chrome UA but accept this bare one.
const UA_SIMPLE: &str = "Mozilla/5.0";

/// Some providers answer HTTP 200 with a tiny placeholder (Open Library and
/// Amazon both return a ~43-byte GIF/JPEG when a cover is missing). Anything
/// below this threshold is treated as "no cover".
const MIN_COVER_BYTES: usize = 2048;

/// Fetch raw image bytes. Retries with a bare User-Agent (some hosts drop
/// connections that carry a full Chrome UA) and uses the platform TLS stack,
/// because rustls rejects servers that close without `close_notify`.
fn fetch_bytes(url: &str) -> Result<Vec<u8>, AppError> {
    let connector = ureq::native_tls::TlsConnector::new()
        .map_err(|e| AppError::Internal(format!("TLS init failed: {e}")))?;
    let agent = ureq::builder()
        .tls_connector(std::sync::Arc::new(connector))
        .timeout(std::time::Duration::from_secs(30))
        .build();

    let mut last = AppError::NotFound("cover fetch failed".to_string());
    for ua in [UA, UA_SIMPLE] {
        match agent
            .get(url)
            .set("User-Agent", ua)
            .set("Accept", "image/avif,image/webp,image/jpeg,image/png,*/*;q=0.8")
            .call()
        {
            Ok(resp) => {
                let mut bytes = Vec::new();
                match resp.into_reader().read_to_end(&mut bytes) {
                    Ok(_) if bytes.len() >= MIN_COVER_BYTES => return Ok(bytes),
                    Ok(_) => {
                        last = AppError::NotFound(format!(
                            "cover placeholder too small ({} bytes)",
                            bytes.len()
                        ))
                    }
                    Err(e) => last = AppError::Internal(format!("read body: {e}")),
                }
            }
            Err(e) => last = AppError::Internal(format!("HTTP error: {e}")),
        }
    }
    Err(last)
}

/// Download cover image from URL and save to local storage.
/// Returns the local file path. Rejects placeholder images.
pub fn download_cover(cover_url: &str, isbn: &str, covers_dir: &Path) -> Result<PathBuf, AppError> {
    // Create covers directory if not exists
    fs::create_dir_all(covers_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create covers directory: {}", e)))?;

    // Skip if already downloaded
    let existing = covers_dir.join(format!("{}.jpg", isbn));
    if existing.exists() {
        return Ok(existing);
    }

    // Download image
    let bytes = fetch_bytes(cover_url)?;

    if bytes.len() < MIN_COVER_BYTES {
        return Err(AppError::NotFound(format!(
            "cover placeholder too small ({} bytes)",
            bytes.len()
        )));
    }

    // Validate image (try to decode)
    let img = image::load_from_memory(&bytes)
        .map_err(|e| AppError::Internal(format!("Invalid image data: {}", e)))?;

    // Reject near-empty images (e.g. 1x1 px placeholders).
    if img.width() < 40 || img.height() < 40 {
        return Err(AppError::NotFound(format!(
            "cover too small ({}x{})",
            img.width(),
            img.height()
        )));
    }

    // Save as JPEG (compressed, smaller file size)
    let output_path = covers_dir.join(format!("{}.jpg", isbn));
    img.save(&output_path)
        .map_err(|e| AppError::Internal(format!("Failed to save cover: {}", e)))?;

    Ok(output_path)
}

/// Try each candidate URL in order and return the first valid cover.
///
/// Providers frequently lack a cover (or answer with a placeholder), so the
/// caller passes several sources — the first one that yields a real image wins.
pub fn download_cover_with_fallbacks(
    isbn: &str,
    candidates: &[String],
    covers_dir: &Path,
) -> Result<PathBuf, AppError> {
    let existing = covers_dir.join(format!("{}.jpg", isbn));
    if existing.exists() {
        return Ok(existing);
    }

    let mut last_err = AppError::NotFound("no cover candidates".to_string());
    for url in candidates {
        let url = url.trim();
        if url.is_empty() {
            continue;
        }
        match download_cover(url, isbn, covers_dir) {
            Ok(path) => return Ok(path),
            Err(e) => {
                log::info!("cover candidate failed ({url}): {e}");
                last_err = e;
            }
        }
    }
    Err(last_err)
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
    fn fallback_errors_without_candidates() {
        let temp_dir = tempdir().unwrap();
        let result = download_cover_with_fallbacks("0000000000", &[], temp_dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn fallback_skips_blank_candidates() {
        let temp_dir = tempdir().unwrap();
        let candidates = vec!["".to_string(), "   ".to_string()];
        let result = download_cover_with_fallbacks("0000000000", &candidates, temp_dir.path());
        assert!(result.is_err());
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

