//! Asset uploads (foto anggota, cover buku, logo perpustakaan).
//!
//! Closes the "menyusul Devin 5" placeholder: previously, anggota.foto_path /
//! buku.cover_path / identity.logo_path were free-form text inputs. Now the
//! frontend opens a Tauri file dialog, hands the picked source path to
//! [`assets_save`], and the backend copies the file under
//! `<app_data_dir>/uploads/<category>/<filename>` and returns the **relative**
//! path (e.g. `"uploads/anggota/andi-1777894097.jpg"`) which is what gets
//! persisted in SQLite.
//!
//! The frontend later calls [`assets_resolve`] to turn the stored relative
//! path back into an absolute filesystem path so it can be passed to
//! `convertFileSrc` for `<img src=...>` rendering. Path-traversal is
//! rejected up front. Pre-existing **absolute** paths in the DB (legacy
//! v1 data, or anything the user typed before this feature shipped) are
//! passed through unchanged so existing pictures keep rendering.

use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat, ImageReader};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Subdirectory under `app_data_dir` that holds every uploaded asset.
const UPLOADS_DIR: &str = "uploads";

/// Image extensions the upload command will accept. All are lowercase; the
/// caller-provided extension is normalised before this check.
const ALLOWED_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];

/// Maximum allowed source file size, in bytes. 10 MiB is generous for cover
/// art and member photos and well below what WebView2 / asset:/// will
/// happily render.
const MAX_BYTES: u64 = 10 * 1024 * 1024;

/// Maximum length of the slugified filename stem. Keeps filenames short
/// enough to survive Windows MAX_PATH on deeply-nested AppData layouts.
const MAX_STEM_LEN: usize = 40;

/// Per-category compression knobs. `max_dim` is the long-edge cap in pixels
/// after Lanczos3 downscale; `jpeg_quality` is the libjpeg-style 1..=100
/// quality applied when re-encoding an opaque source as JPEG. Originals
/// already smaller than `max_dim` are written verbatim so we never up-sample.
#[derive(Debug, Clone, Copy)]
pub(crate) struct CompressOpts {
    pub(crate) max_dim: u32,
    pub(crate) jpeg_quality: u8,
}

/// Look up the compression budget for a given upload category. Returns
/// `None` for categories that should keep the source bytes untouched.
fn compress_opts_for(category: &str) -> Option<CompressOpts> {
    match category {
        // Member portraits — KTA preview tops out at ~96 px, KTA print at
        // ~250 px, so 800 px on the long edge gives plenty of headroom for
        // future zoom while keeping a typical phone snap under 200 KiB.
        "anggota" => Some(CompressOpts {
            max_dim: 800,
            jpeg_quality: 85,
        }),
        // Book covers can be larger because they show in full-bleed detail
        // pages. 1200 px on the long edge keeps a portrait cover under
        // ~400 KiB at quality 85.
        "buku" => Some(CompressOpts {
            max_dim: 1200,
            jpeg_quality: 85,
        }),
        // School logos render at ~80 px in the sidebar / login. 512 px is
        // plenty; quality bumped to 92 because logos have hard edges where
        // JPEG ringing is more obvious.
        "identitas" => Some(CompressOpts {
            max_dim: 512,
            jpeg_quality: 92,
        }),
        // Operator/admin biodata portraits (v1.0.4 #16). Same envelope as
        // anggota: header avatar tops out around 28 px and the profile
        // dialog preview at ~96 px, so 800 px is plenty even on hi-DPI.
        "user" => Some(CompressOpts {
            max_dim: 800,
            jpeg_quality: 85,
        }),
        _ => None,
    }
}

/// File extensions that should bypass the resize/recompress step entirely.
/// SVG is vector text, GIF can be animated and we don't want to drop frames.
fn is_passthrough_ext(ext: &str) -> bool {
    matches!(ext, "svg" | "gif")
}

/// Pure helper for unit tests: try to decode the bytes at `src` and, if the
/// result is larger than `opts.max_dim` on the long edge, return a resized +
/// re-encoded byte buffer. Returns `Ok(None)` when no rewrite is needed —
/// either because the format is passthrough, the decode failed (corrupt or
/// not-actually-an-image fixture), or the original is already small enough.
///
/// The caller is responsible for the final on-disk write so this stays easy
/// to unit-test without touching the filesystem.
pub(crate) fn maybe_compress_bytes(
    bytes: &[u8],
    ext: &str,
    opts: CompressOpts,
) -> AppResult<Option<(Vec<u8>, &'static str)>> {
    if is_passthrough_ext(ext) {
        return Ok(None);
    }

    // `with_guessed_format` re-sniffs the magic bytes so a mis-named .jpg
    // that's actually PNG still decodes correctly.
    let reader = match ImageReader::new(Cursor::new(bytes)).with_guessed_format() {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    let format = reader.format();
    let img = match reader.decode() {
        Ok(img) => img,
        Err(_) => return Ok(None),
    };

    let (w, h) = (img.width(), img.height());
    let long_edge = w.max(h);
    let needs_resize = long_edge > opts.max_dim;

    let resized: DynamicImage = if needs_resize {
        // Lanczos3 is the standard choice for photographic downscale —
        // matches what Pillow / Sharp / GIMP "Best" does.
        img.resize(opts.max_dim, opts.max_dim, FilterType::Lanczos3)
    } else {
        img
    };

    let has_alpha = resized.color().has_alpha();
    // Keep alpha channels intact (logos, transparent stamps) by re-encoding
    // as PNG. Everything else collapses to JPEG for the size win — except
    // when the source was already a JPEG and didn't need a resize, in which
    // case there's nothing to gain and we leave the bytes alone.
    if !needs_resize && matches!(format, Some(ImageFormat::Jpeg)) && !has_alpha {
        return Ok(None);
    }
    if !needs_resize && matches!(format, Some(ImageFormat::Png)) && has_alpha {
        return Ok(None);
    }

    let mut out: Vec<u8> = Vec::with_capacity(bytes.len() / 2);
    if has_alpha {
        let rgba = resized.to_rgba8();
        image::write_buffer_with_format(
            &mut Cursor::new(&mut out),
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
            ImageFormat::Png,
        )
        .map_err(|e| AppError::Internal(format!("png encode: {e}")))?;
        Ok(Some((out, "png")))
    } else {
        let rgb = resized.to_rgb8();
        let mut encoder = JpegEncoder::new_with_quality(&mut out, opts.jpeg_quality);
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| AppError::Internal(format!("jpeg encode: {e}")))?;
        Ok(Some((out, "jpg")))
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    /// Path stored in DB, relative to `app_data_dir`. Always uses `/`.
    pub rel_path: String,
    /// Absolute path on disk for the saved file. Mainly useful so the
    /// frontend can immediately render a preview without a follow-up
    /// `assets_resolve` round-trip.
    pub abs_path: String,
}

fn app_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))
}

fn validate_category(category: &str) -> AppResult<()> {
    if category.is_empty() || category.len() > 32 {
        return Err(AppError::Validation(format!(
            "invalid category length: {category:?}"
        )));
    }
    if !category
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::Validation(format!(
            "category must be ASCII alphanumeric / dash / underscore: {category:?}"
        )));
    }
    Ok(())
}

fn validate_rel_path(rel_path: &str) -> AppResult<()> {
    if rel_path.contains("..") {
        return Err(AppError::Validation(format!(
            "rel_path must not contain '..': {rel_path:?}"
        )));
    }
    if rel_path.starts_with('/') || rel_path.starts_with('\\') {
        return Err(AppError::Validation(format!(
            "rel_path must not be absolute: {rel_path:?}"
        )));
    }
    // Reject Windows drive-letter prefixes (`C:\foo`).
    let bytes = rel_path.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return Err(AppError::Validation(format!(
            "rel_path must not be a drive path: {rel_path:?}"
        )));
    }
    Ok(())
}

fn slugify_stem(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        let normalised = ch.to_ascii_lowercase();
        if normalised.is_ascii_alphanumeric() {
            out.push(normalised);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.len() > MAX_STEM_LEN {
        out.truncate(MAX_STEM_LEN);
        while out.ends_with('-') {
            out.pop();
        }
    }
    if out.is_empty() {
        "file".to_string()
    } else {
        out
    }
}

fn normalised_extension(src: &Path) -> AppResult<String> {
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .ok_or_else(|| AppError::Validation("source file has no extension".into()))?;
    if !ALLOWED_EXTS.contains(&ext.as_str()) {
        return Err(AppError::Validation(format!(
            "unsupported extension: .{ext} (allowed: {})",
            ALLOWED_EXTS.join(", ")
        )));
    }
    Ok(ext)
}

/// Pure helper for unit tests: copy `src` into
/// `<app_data>/<UPLOADS_DIR>/<category>/<slug>-<ts>.<ext>` and return the
/// relative path stored in DB plus the absolute path on disk.
pub(crate) fn save_inner(
    app_data: &Path,
    category: &str,
    src: &Path,
    timestamp_ms: u128,
) -> AppResult<SaveResult> {
    validate_category(category)?;

    let metadata = std::fs::metadata(src).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound(format!("source: {}", src.display())),
        _ => AppError::Io(e),
    })?;
    if !metadata.is_file() {
        return Err(AppError::Validation(format!(
            "source is not a regular file: {}",
            src.display()
        )));
    }
    if metadata.len() > MAX_BYTES {
        return Err(AppError::Validation(format!(
            "source too large: {} bytes > {} bytes",
            metadata.len(),
            MAX_BYTES
        )));
    }

    let ext = normalised_extension(src)?;
    let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let slug = slugify_stem(stem);

    let target_dir = app_data.join(UPLOADS_DIR).join(category);
    std::fs::create_dir_all(&target_dir)?;

    // Try to resize+recompress for known categories so phone-sized originals
    // don't blow up the SQLite-adjacent uploads/ folder. Anything outside
    // [`compress_opts_for`] (unknown category) or that fails to decode
    // (corrupt / not-really-an-image fixture) falls back to a verbatim copy
    // so we never refuse an upload just because the codec can't handle it.
    let (final_ext, written_bytes): (String, Option<Vec<u8>>) = if let Some(opts) =
        compress_opts_for(category)
    {
        let bytes = std::fs::read(src)?;
        match maybe_compress_bytes(&bytes, &ext, opts) {
            Ok(Some((compressed, new_ext))) => (new_ext.to_string(), Some(compressed)),
            Ok(None) | Err(_) => (ext.clone(), None),
        }
    } else {
        (ext.clone(), None)
    };

    let filename = format!("{slug}-{timestamp_ms}.{final_ext}");
    let target = target_dir.join(&filename);
    if let Some(bytes) = written_bytes {
        std::fs::write(&target, bytes)?;
    } else {
        std::fs::copy(src, &target)?;
    }

    let rel_path = format!("{UPLOADS_DIR}/{category}/{filename}");
    Ok(SaveResult {
        rel_path,
        abs_path: target.to_string_lossy().to_string(),
    })
}

/// Pure helper for unit tests: validate `rel_path` and join with
/// `app_data`. Absolute legacy paths are passed through unchanged.
pub(crate) fn resolve_inner(app_data: &Path, rel_path: &str) -> AppResult<String> {
    if rel_path.is_empty() {
        return Ok(String::new());
    }
    let candidate = Path::new(rel_path);
    if candidate.is_absolute() {
        return Ok(rel_path.to_string());
    }
    validate_rel_path(rel_path)?;
    let joined = app_data.join(rel_path);
    Ok(joined.to_string_lossy().to_string())
}

/// MIME type to use in `data:` URLs for a saved asset, keyed by lowercased
/// extension. Mirrors [`ALLOWED_EXTS`] so every successfully-saved upload
/// has a usable mapping.
fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

/// Pure helper for unit tests: read the asset under `<app_data>/<rel_path>`
/// (or the absolute path verbatim, for legacy v1 entries) and return a
/// `data:<mime>;base64,<payload>` URL ready to feed into an `<img src=…>`.
///
/// This deliberately bypasses Tauri's `asset://` protocol and its scope
/// matcher: on Windows the scope matcher fails to match `\\?\C:\…`-prefixed
/// canonicalised paths against `$APPDATA/uploads/**`-style patterns, which
/// is the root cause of the v1.0.2 "broken-image glyph on Logo / Foto / Cover"
/// regression. Reading the bytes through a Tauri command sidesteps that
/// matcher entirely and produces an inline `data:` URL the WebView will
/// always render.
pub(crate) fn read_data_url_inner(app_data: &Path, rel_path: &str) -> AppResult<String> {
    if rel_path.is_empty() {
        return Err(AppError::Validation("rel_path must not be empty".into()));
    }
    let candidate = Path::new(rel_path);
    let abs = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        validate_rel_path(rel_path)?;
        app_data.join(rel_path)
    };

    let metadata = std::fs::metadata(&abs).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound(format!("asset: {}", abs.display())),
        _ => AppError::Io(e),
    })?;
    if !metadata.is_file() {
        return Err(AppError::Validation(format!(
            "asset is not a regular file: {}",
            abs.display()
        )));
    }
    if metadata.len() > MAX_BYTES {
        return Err(AppError::Validation(format!(
            "asset too large to inline: {} bytes > {} bytes",
            metadata.len(),
            MAX_BYTES
        )));
    }

    let ext = abs
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    let mime = mime_for_ext(&ext);

    let bytes = std::fs::read(&abs)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

/// Pure helper for unit tests: best-effort delete of an upload that lives
/// under `<app_data>/<rel_path>`. Absolute / legacy paths are intentionally
/// left untouched so we never delete files we did not own.
pub(crate) fn delete_inner(app_data: &Path, rel_path: &str) -> AppResult<()> {
    if rel_path.is_empty() {
        return Ok(());
    }
    if Path::new(rel_path).is_absolute() {
        return Ok(());
    }
    validate_rel_path(rel_path)?;
    let abs = app_data.join(rel_path);
    if abs.exists() {
        std::fs::remove_file(&abs)?;
    }
    Ok(())
}

#[tauri::command]
pub fn assets_save(app: AppHandle, category: String, src_path: String) -> AppResult<SaveResult> {
    let app_data = app_data_dir(&app)?;
    std::fs::create_dir_all(&app_data)?;
    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    save_inner(&app_data, &category, Path::new(&src_path), timestamp_ms)
}

#[tauri::command]
pub fn assets_resolve(app: AppHandle, rel_path: String) -> AppResult<String> {
    let app_data = app_data_dir(&app)?;
    resolve_inner(&app_data, &rel_path)
}

#[tauri::command]
pub fn assets_delete(app: AppHandle, rel_path: String) -> AppResult<()> {
    let app_data = app_data_dir(&app)?;
    delete_inner(&app_data, &rel_path)
}

#[tauri::command]
pub fn assets_read_data_url(app: AppHandle, rel_path: String) -> AppResult<String> {
    let app_data = app_data_dir(&app)?;
    read_data_url_inner(&app_data, &rel_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_fixture(dir: &Path, name: &str, bytes: &[u8]) -> PathBuf {
        let path = dir.join(name);
        fs::write(&path, bytes).expect("write fixture");
        path
    }

    #[test]
    fn slugify_handles_punctuation_spaces_and_unicode() {
        assert_eq!(slugify_stem("Andi Setiawan"), "andi-setiawan");
        assert_eq!(slugify_stem("kover_buku.draft"), "kover-buku-draft");
        assert_eq!(slugify_stem("---SCAN  001---"), "scan-001");
        assert_eq!(slugify_stem("__"), "file");
        // Non-ASCII characters get stripped (current naive policy) but
        // never produce empty strings: "foo café" -> "foo-caf".
        assert_eq!(slugify_stem("foo café"), "foo-caf");
    }

    #[test]
    fn validate_category_accepts_simple_names_and_rejects_path_chars() {
        assert!(validate_category("anggota").is_ok());
        assert!(validate_category("buku").is_ok());
        assert!(validate_category("identitas").is_ok());
        assert!(validate_category("kta-template_v2").is_ok());
        assert!(validate_category("").is_err());
        assert!(validate_category("../etc").is_err());
        assert!(validate_category("anggota/foto").is_err());
        assert!(validate_category("a b").is_err());
    }

    #[test]
    fn validate_rel_path_rejects_traversal_and_absolutes() {
        assert!(validate_rel_path("uploads/anggota/x.jpg").is_ok());
        assert!(validate_rel_path("uploads/anggota/../../etc/passwd").is_err());
        assert!(validate_rel_path("/etc/passwd").is_err());
        assert!(validate_rel_path("\\foo").is_err());
        assert!(validate_rel_path("C:\\Windows").is_err());
    }

    #[test]
    fn save_inner_copies_file_and_returns_relative_path() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        let src = write_fixture(staging.path(), "Andi Setiawan.JPG", b"fake-jpeg-bytes");

        let result =
            save_inner(app_data.path(), "anggota", &src, 1_777_894_097_000).expect("save_inner ok");

        assert_eq!(
            result.rel_path, "uploads/anggota/andi-setiawan-1777894097000.jpg",
            "rel_path is slug + timestamp + lowercased extension",
        );
        let abs = Path::new(&result.abs_path);
        assert!(abs.exists(), "file was actually copied to disk");
        assert_eq!(
            fs::read(abs).expect("read copy"),
            b"fake-jpeg-bytes",
            "file contents preserved verbatim",
        );
    }

    #[test]
    fn save_inner_rejects_unsupported_extension() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        let src = write_fixture(staging.path(), "malware.exe", b"MZ");

        let err = save_inner(app_data.path(), "anggota", &src, 0).expect_err("must reject");
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn save_inner_rejects_oversized_file() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        // Write MAX_BYTES + 1 to trip the size guard. Use a 1-byte buffer
        // and seek-set_len so we don't allocate 10 MiB in memory.
        let path = staging.path().join("huge.png");
        let f = fs::File::create(&path).expect("create");
        f.set_len(MAX_BYTES + 1).expect("set_len");

        let err = save_inner(app_data.path(), "anggota", &path, 0).expect_err("must reject");
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn save_inner_rejects_invalid_category() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        let src = write_fixture(staging.path(), "x.png", b"png");

        assert!(matches!(
            save_inner(app_data.path(), "../escape", &src, 0),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn resolve_inner_joins_relative_passes_through_absolute_and_validates() {
        let app_data = TempDir::new().expect("tempdir");

        let rel = resolve_inner(app_data.path(), "uploads/anggota/x.jpg").expect("ok");
        assert!(
            rel.ends_with("uploads/anggota/x.jpg") || rel.ends_with("uploads\\anggota\\x.jpg"),
            "rel_path joined under app_data: got {rel}",
        );

        // Empty input is benign.
        assert_eq!(resolve_inner(app_data.path(), "").expect("ok"), "");

        // Absolute path: pass through unchanged so legacy v1 data still
        // renders.
        let legacy = "/home/user/old-foto.jpg";
        assert_eq!(resolve_inner(app_data.path(), legacy).expect("ok"), legacy);

        // Traversal rejected.
        assert!(matches!(
            resolve_inner(app_data.path(), "uploads/../../etc/passwd"),
            Err(AppError::Validation(_)),
        ));
    }

    #[test]
    fn delete_inner_removes_file_and_ignores_legacy_absolutes() {
        let app_data = TempDir::new().expect("tempdir");
        let target_dir = app_data.path().join("uploads/anggota");
        fs::create_dir_all(&target_dir).expect("mkdir");
        let target = target_dir.join("x.png");
        fs::write(&target, b"png").expect("write");

        delete_inner(app_data.path(), "uploads/anggota/x.png").expect("delete ok");
        assert!(!target.exists(), "file removed");

        // Idempotent: deleting again is fine.
        delete_inner(app_data.path(), "uploads/anggota/x.png").expect("idempotent");

        // Empty input is no-op.
        delete_inner(app_data.path(), "").expect("empty ok");

        // Absolute legacy path: must NOT touch the filesystem. Create a
        // canary file outside app_data and confirm it is still there.
        let outside = TempDir::new().expect("outside");
        let canary = outside.path().join("legacy.jpg");
        fs::write(&canary, b"legacy").expect("write canary");
        delete_inner(app_data.path(), canary.to_str().expect("utf8"))
            .expect("absolute path is no-op, not error");
        assert!(canary.exists(), "absolute legacy paths are never deleted");

        // Traversal rejected.
        assert!(matches!(
            delete_inner(app_data.path(), "uploads/../../etc/passwd"),
            Err(AppError::Validation(_)),
        ));
    }

    #[test]
    fn read_data_url_inner_inlines_png_bytes_with_correct_mime() {
        let app_data = TempDir::new().expect("tempdir");
        let target_dir = app_data.path().join("uploads/identitas");
        fs::create_dir_all(&target_dir).expect("mkdir");
        let payload = b"\x89PNG\r\n\x1a\nfake-tail";
        fs::write(target_dir.join("logo.png"), payload).expect("write");

        let url = read_data_url_inner(app_data.path(), "uploads/identitas/logo.png")
            .expect("read_data_url ok");
        assert!(url.starts_with("data:image/png;base64,"));
        let payload_b64 = base64::engine::general_purpose::STANDARD.encode(payload);
        assert!(url.ends_with(&payload_b64), "url ends with base64 payload");
    }

    #[test]
    fn read_data_url_inner_picks_jpeg_mime_for_jpg_and_jpeg_extensions() {
        let app_data = TempDir::new().expect("tempdir");
        let target_dir = app_data.path().join("uploads/anggota");
        fs::create_dir_all(&target_dir).expect("mkdir");
        fs::write(target_dir.join("foto.jpg"), b"jpg").expect("write jpg");
        fs::write(target_dir.join("foto.jpeg"), b"jpeg").expect("write jpeg");

        let jpg = read_data_url_inner(app_data.path(), "uploads/anggota/foto.jpg").expect("jpg");
        let jpeg = read_data_url_inner(app_data.path(), "uploads/anggota/foto.jpeg").expect("jpeg");
        assert!(jpg.starts_with("data:image/jpeg;base64,"));
        assert!(jpeg.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn read_data_url_inner_passes_through_absolute_legacy_path() {
        let app_data = TempDir::new().expect("tempdir");
        let outside = TempDir::new().expect("outside");
        let legacy = outside.path().join("old.png");
        fs::write(&legacy, b"old-bytes").expect("write");

        let url = read_data_url_inner(app_data.path(), legacy.to_str().expect("utf8"))
            .expect("absolute path resolves");
        assert!(url.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn read_data_url_inner_rejects_traversal_and_missing_files() {
        let app_data = TempDir::new().expect("tempdir");
        assert!(matches!(
            read_data_url_inner(app_data.path(), "uploads/../../etc/passwd"),
            Err(AppError::Validation(_)),
        ));
        assert!(matches!(
            read_data_url_inner(app_data.path(), ""),
            Err(AppError::Validation(_)),
        ));
        assert!(matches!(
            read_data_url_inner(app_data.path(), "uploads/anggota/missing.png"),
            Err(AppError::NotFound(_)),
        ));
    }

    #[test]
    fn read_data_url_inner_rejects_oversized_file() {
        let app_data = TempDir::new().expect("tempdir");
        let target_dir = app_data.path().join("uploads/buku");
        fs::create_dir_all(&target_dir).expect("mkdir");
        let path = target_dir.join("huge.png");
        let f = fs::File::create(&path).expect("create");
        f.set_len(MAX_BYTES + 1).expect("set_len");

        let err = read_data_url_inner(app_data.path(), "uploads/buku/huge.png")
            .expect_err("must reject");
        assert!(matches!(err, AppError::Validation(_)));
    }

    #[test]
    fn read_data_url_inner_uses_octet_stream_for_unknown_extensions() {
        let app_data = TempDir::new().expect("tempdir");
        let target_dir = app_data.path().join("uploads/buku");
        fs::create_dir_all(&target_dir).expect("mkdir");
        fs::write(target_dir.join("note.txt"), b"hello").expect("write");

        let url = read_data_url_inner(app_data.path(), "uploads/buku/note.txt")
            .expect("ok");
        assert!(url.starts_with("data:application/octet-stream;base64,"));
    }

    /// Build a fake JPEG of `width x height` filled with a single colour.
    /// `image::ImageFormat::Jpeg` is selected via `save_buffer_with_format`.
    fn fake_rgb_jpeg(width: u32, height: u32, colour: [u8; 3]) -> Vec<u8> {
        let pixels: Vec<u8> = (0..width * height)
            .flat_map(|_| colour.iter().copied())
            .collect();
        let mut out = Vec::new();
        let mut encoder = JpegEncoder::new_with_quality(&mut out, 90);
        encoder
            .encode(&pixels, width, height, image::ExtendedColorType::Rgb8)
            .expect("encode jpeg fixture");
        out
    }

    /// Build a PNG of `width x height` with an alpha channel. Useful for the
    /// "must keep alpha" test path.
    fn fake_rgba_png(width: u32, height: u32) -> Vec<u8> {
        let pixels: Vec<u8> = (0..width * height)
            .flat_map(|i| {
                let alpha = if i % 2 == 0 { 0 } else { 255 };
                [255, 0, 0, alpha]
            })
            .collect();
        let mut out = Vec::new();
        image::write_buffer_with_format(
            &mut Cursor::new(&mut out),
            &pixels,
            width,
            height,
            image::ExtendedColorType::Rgba8,
            ImageFormat::Png,
        )
        .expect("encode png fixture");
        out
    }

    fn anggota_opts() -> CompressOpts {
        compress_opts_for("anggota").expect("anggota opts")
    }

    #[test]
    fn maybe_compress_resizes_oversized_jpeg_to_long_edge_cap() {
        let bytes = fake_rgb_jpeg(2000, 1500, [120, 60, 30]);
        let (out, ext) =
            maybe_compress_bytes(&bytes, "jpg", anggota_opts())
                .expect("ok")
                .expect("rewrites oversize");
        assert_eq!(ext, "jpg", "opaque source stays JPEG");
        let decoded = image::load_from_memory(&out).expect("decoded output");
        assert_eq!(decoded.width().max(decoded.height()), 800);
        assert!(out.len() < bytes.len(), "compressed output is smaller");
    }

    #[test]
    fn maybe_compress_skips_jpeg_within_threshold() {
        let bytes = fake_rgb_jpeg(400, 400, [120, 60, 30]);
        let res = maybe_compress_bytes(&bytes, "jpg", anggota_opts()).expect("ok");
        assert!(res.is_none(), "small JPEG passes through verbatim");
    }

    #[test]
    fn maybe_compress_keeps_alpha_channel_as_png() {
        let bytes = fake_rgba_png(1024, 1024);
        let (out, ext) =
            maybe_compress_bytes(&bytes, "png", anggota_opts())
                .expect("ok")
                .expect("rewrites oversize png");
        assert_eq!(ext, "png", "alpha-bearing source stays PNG");
        let decoded = image::load_from_memory(&out).expect("decoded output");
        assert!(decoded.color().has_alpha(), "alpha preserved");
        assert_eq!(decoded.width().max(decoded.height()), 800);
    }

    #[test]
    fn maybe_compress_passes_through_svg_and_gif_verbatim() {
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
        assert!(
            maybe_compress_bytes(svg, "svg", anggota_opts())
                .expect("ok")
                .is_none()
        );
        let gif = b"GIF89a";
        assert!(
            maybe_compress_bytes(gif, "gif", anggota_opts())
                .expect("ok")
                .is_none()
        );
    }

    #[test]
    fn maybe_compress_returns_none_on_undecodable_bytes() {
        let bytes = b"fake-jpeg-bytes";
        let res = maybe_compress_bytes(bytes, "jpg", anggota_opts()).expect("ok");
        assert!(res.is_none(), "garbage falls through to verbatim copy");
    }

    #[test]
    fn save_inner_compresses_oversized_anggota_photo() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        let bytes = fake_rgb_jpeg(2000, 2000, [200, 80, 60]);
        let src = staging.path().join("phone-shot.jpg");
        fs::write(&src, &bytes).expect("write src");

        let result =
            save_inner(app_data.path(), "anggota", &src, 1_777_894_097_000).expect("save ok");
        assert!(result.rel_path.ends_with(".jpg"));
        let saved = fs::read(&result.abs_path).expect("read saved");
        assert!(saved.len() < bytes.len(), "saved file is smaller than source");
        let decoded = image::load_from_memory(&saved).expect("saved is decodable");
        assert_eq!(decoded.width().max(decoded.height()), 800);
    }

    #[test]
    fn save_inner_keeps_alpha_for_identitas_logo() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        let bytes = fake_rgba_png(1024, 1024);
        let src = staging.path().join("logo.png");
        fs::write(&src, &bytes).expect("write src");

        let result = save_inner(app_data.path(), "identitas", &src, 0).expect("save ok");
        assert!(
            result.rel_path.ends_with(".png"),
            "alpha-bearing logo stored as PNG: {}",
            result.rel_path,
        );
        let saved = fs::read(&result.abs_path).expect("read saved");
        let decoded = image::load_from_memory(&saved).expect("saved is decodable");
        assert!(decoded.color().has_alpha());
    }
}
