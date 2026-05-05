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
use tauri::{AppHandle, Manager, State};

use crate::AppState;
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

/// Categories whose source images are member portraits. New uploads in
/// these categories run through [`smart_fit_to_portrait_bytes`] so the
/// stored file is centre-cropped to portrait 3:4, matching the KTA foto
/// slot. Existing files on disk are never touched implicitly — the
/// admin triggers a re-fit batch via [`assets_refit_anggota_photos`]
/// when they want to migrate.
fn is_portrait_category(category: &str) -> bool {
    matches!(category, "anggota" | "user")
}

/// Target aspect ratio for the [`smart_fit_to_portrait_bytes`] crop,
/// expressed as `width / height`. KTA foto slots in every shipped preset
/// use a 3:4 portrait box (e.g. 22mm × 28mm ≈ 0.79, 24mm × 30mm = 0.8,
/// 18mm × 24mm = 0.75) so 0.75 is the lowest common denominator that
/// produces a centre-cropped result usable by every layout.
pub(crate) const PORTRAIT_TARGET_W_OVER_H: f32 = 3.0 / 4.0;

/// How close to the target aspect ratio is "good enough" — within this
/// tolerance we skip the crop entirely so a portrait shot that's
/// already 3:4 isn't decoded → re-encoded for no reason. 0.5% is well
/// inside the human-eye threshold for KTA-sized prints.
const PORTRAIT_ASPECT_TOLERANCE: f32 = 0.005;

/// Pure helper for unit tests: try to decode `bytes`, centre-crop the
/// resulting image to portrait `target_w_over_h`, and re-encode. Returns
/// `Ok(None)` when no rewrite is needed (passthrough format, undecodable
/// fixture, or source already within tolerance of the target ratio).
///
/// The crop is **always centred** — mirrors the CSS `object-position:
/// center` semantics the live preview / Cetak HTML use — and never
/// up-samples (the output dimensions are <= the source dimensions).
/// Alpha-bearing sources (PNG with transparency) re-encode as PNG to
/// preserve transparency; everything else collapses to JPEG for the
/// size win.
pub(crate) fn smart_fit_to_portrait_bytes(
    bytes: &[u8],
    ext: &str,
    target_w_over_h: f32,
    jpeg_quality: u8,
) -> AppResult<Option<(Vec<u8>, &'static str)>> {
    if is_passthrough_ext(ext) {
        return Ok(None);
    }
    if !target_w_over_h.is_finite() || target_w_over_h <= 0.0 {
        return Ok(None);
    }

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
    if w == 0 || h == 0 {
        return Ok(None);
    }

    let src_ratio = w as f32 / h as f32;
    let ratio_delta = (src_ratio - target_w_over_h).abs();
    if ratio_delta <= target_w_over_h * PORTRAIT_ASPECT_TOLERANCE {
        return Ok(None);
    }

    // Compute the centre-crop rectangle. Round half-pixel splits towards
    // the top-left so the same input always produces the same crop.
    let (crop_w, crop_h) = if src_ratio > target_w_over_h {
        // Source is wider than target — crop horizontal sides.
        let new_w = (h as f32 * target_w_over_h).round() as u32;
        (new_w.max(1).min(w), h)
    } else {
        // Source is taller than target — crop top/bottom.
        let new_h = (w as f32 / target_w_over_h).round() as u32;
        (w, new_h.max(1).min(h))
    };
    let crop_x = (w - crop_w) / 2;
    let crop_y = (h - crop_h) / 2;

    let cropped: DynamicImage = img.crop_imm(crop_x, crop_y, crop_w, crop_h);

    let has_alpha = cropped.color().has_alpha();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len() / 2);
    if has_alpha {
        let rgba = cropped.to_rgba8();
        image::write_buffer_with_format(
            &mut Cursor::new(&mut out),
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
            ImageFormat::Png,
        )
        .map_err(|e| AppError::Internal(format!("png encode (smart-fit): {e}")))?;
        Ok(Some((out, "png")))
    } else {
        let rgb = cropped.to_rgb8();
        let mut encoder = JpegEncoder::new_with_quality(&mut out, jpeg_quality);
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| AppError::Internal(format!("jpeg encode (smart-fit): {e}")))?;
        // Touch `format` so the unused-binding lint stays clean even
        // when the source format is already JPEG — callers may want to
        // log it via the returned ext.
        let _ = format;
        Ok(Some((out, "jpg")))
    }
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
    //
    // BUG-19 — portrait-bearing categories (member portraits) ALSO run
    // through `smart_fit_to_portrait_bytes` so the saved file matches the
    // KTA foto slot's 3:4 aspect from day one. Smart-fit runs FIRST so
    // the subsequent compression stage sees the cropped pixels and
    // doesn't waste budget on the soon-to-be-discarded margins.
    let (final_ext, written_bytes): (String, Option<Vec<u8>>) = if let Some(opts) =
        compress_opts_for(category)
    {
        let mut working_bytes = std::fs::read(src)?;
        let mut working_ext: String = ext.clone();
        let mut smart_fit_applied = false;
        if is_portrait_category(category) {
            if let Ok(Some((cropped, new_ext))) = smart_fit_to_portrait_bytes(
                &working_bytes,
                &working_ext,
                PORTRAIT_TARGET_W_OVER_H,
                opts.jpeg_quality,
            ) {
                working_bytes = cropped;
                working_ext = new_ext.to_string();
                smart_fit_applied = true;
            }
        }
        match maybe_compress_bytes(&working_bytes, &working_ext, opts) {
            Ok(Some((compressed, new_ext))) => (new_ext.to_string(), Some(compressed)),
            Ok(None) => {
                // Even when compression has nothing more to do, the
                // smart-fit step may have already produced a fresh byte
                // buffer that must be persisted.
                if smart_fit_applied {
                    (working_ext, Some(working_bytes))
                } else {
                    (ext.clone(), None)
                }
            }
            Err(_) => (ext.clone(), None),
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

/// Result payload for [`assets_refit_anggota_photos`].
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefitResult {
    /// Total number of foto rows considered.
    pub total: u32,
    /// Number of foto rows that were re-fit and written back to disk.
    pub refit: u32,
    /// Number of foto rows that were already within tolerance and skipped.
    pub skipped: u32,
    /// Number of foto rows whose file could not be read or decoded.
    pub failed: u32,
}

/// Pure helper for unit tests: walk a list of `(relative-path, bytes)`
/// portrait fixtures and return how many would be re-fit / skipped /
/// failed by [`smart_fit_to_portrait_bytes`]. The on-disk write is
/// performed by the Tauri command wrapper which feeds the result back
/// through `std::fs::write`. Keeping the decision logic here means the
/// re-fit batch can be unit-tested without touching the database or
/// the filesystem.
pub(crate) fn classify_refit_outcome(
    bytes: &[u8],
    ext: &str,
    target_w_over_h: f32,
    jpeg_quality: u8,
) -> Option<(Vec<u8>, &'static str)> {
    match smart_fit_to_portrait_bytes(bytes, ext, target_w_over_h, jpeg_quality) {
        Ok(Some(out)) => Some(out),
        Ok(None) | Err(_) => None,
    }
}

/// BUG-19 — admin-triggered batch that re-fits every existing anggota
/// foto to portrait 3:4. Existing files are mutated in place when the
/// crop produces a different byte buffer; legacy absolute paths are
/// skipped so we never touch files outside `<app_data>/uploads/...`.
///
/// The DB is untouched: file extensions stay the same on disk because
/// the rewrite reuses the original target file (we'd rather over-write
/// `*.jpg` with JPEG bytes than break every `foto_path` row that
/// references it). Photos that still produce a `Some` rewrite from
/// [`smart_fit_to_portrait_bytes`] but were already re-encoded by a
/// previous run are still safe — the smart-fit returns `None` for
/// already-3:4 sources, so a second run is a no-op.
#[tauri::command]
pub fn assets_refit_anggota_photos(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<RefitResult> {
    let app_data = app_data_dir(&app)?;
    let mut result = RefitResult::default();

    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt = conn.prepare(
        "SELECT foto_path FROM anggota \
         WHERE foto_path IS NOT NULL AND foto_path != ''",
    )?;
    let foto_paths: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .filter_map(|res| res.ok())
        .collect();
    drop(stmt);
    drop(conn);

    let opts = compress_opts_for("anggota").unwrap_or(CompressOpts {
        max_dim: 800,
        jpeg_quality: 85,
    });

    for rel_path in foto_paths {
        result.total = result.total.saturating_add(1);

        // Legacy absolute paths from v1 are out of our jurisdiction —
        // skip rather than risk overwriting something the user might
        // still share with another tool.
        if Path::new(&rel_path).is_absolute() {
            result.skipped = result.skipped.saturating_add(1);
            continue;
        }
        if validate_rel_path(&rel_path).is_err() {
            result.failed = result.failed.saturating_add(1);
            continue;
        }

        let abs = app_data.join(&rel_path);
        let bytes = match std::fs::read(&abs) {
            Ok(b) => b,
            Err(_) => {
                result.failed = result.failed.saturating_add(1);
                continue;
            }
        };
        let ext = abs
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_default();

        match classify_refit_outcome(&bytes, &ext, PORTRAIT_TARGET_W_OVER_H, opts.jpeg_quality) {
            Some((cropped, _new_ext)) => {
                if std::fs::write(&abs, &cropped).is_ok() {
                    result.refit = result.refit.saturating_add(1);
                } else {
                    result.failed = result.failed.saturating_add(1);
                }
            }
            None => {
                result.skipped = result.skipped.saturating_add(1);
            }
        }
    }

    Ok(result)
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

    // -- BUG-19 — smart_fit_to_portrait_bytes -----------------------

    #[test]
    fn smart_fit_crops_landscape_to_3x4_portrait() {
        let bytes = fake_rgb_jpeg(1280, 720, [200, 80, 60]);
        let (out, ext) = smart_fit_to_portrait_bytes(
            &bytes,
            "jpg",
            PORTRAIT_TARGET_W_OVER_H,
            85,
        )
        .expect("ok")
        .expect("must crop a 16:9 source");
        assert_eq!(ext, "jpg", "opaque source stays JPEG");
        let decoded = image::load_from_memory(&out).expect("decoded output");
        // 720h * (3/4) = 540w. Centred crop trims 740px of width.
        assert_eq!(decoded.height(), 720);
        assert_eq!(decoded.width(), 540);
    }

    #[test]
    fn smart_fit_crops_tall_portrait_to_3x4() {
        // 600x1200 (1:2) → centred crop down to 600x800 (3:4).
        let bytes = fake_rgb_jpeg(600, 1200, [50, 120, 200]);
        let (out, ext) = smart_fit_to_portrait_bytes(
            &bytes,
            "jpg",
            PORTRAIT_TARGET_W_OVER_H,
            85,
        )
        .expect("ok")
        .expect("must crop a 1:2 source");
        assert_eq!(ext, "jpg");
        let decoded = image::load_from_memory(&out).expect("decoded");
        assert_eq!(decoded.width(), 600);
        assert_eq!(decoded.height(), 800);
    }

    #[test]
    fn smart_fit_skips_when_source_already_within_tolerance() {
        // 600x800 is exactly 3:4 → smart-fit should be a no-op.
        let bytes = fake_rgb_jpeg(600, 800, [120, 60, 30]);
        let res = smart_fit_to_portrait_bytes(&bytes, "jpg", PORTRAIT_TARGET_W_OVER_H, 85)
            .expect("ok");
        assert!(res.is_none(), "already-3:4 source must pass through verbatim");
    }

    #[test]
    fn smart_fit_keeps_alpha_channel_as_png() {
        // Alpha-bearing 1280x720 → must stay PNG after the crop.
        let bytes = fake_rgba_png(1280, 720);
        let (out, ext) = smart_fit_to_portrait_bytes(
            &bytes,
            "png",
            PORTRAIT_TARGET_W_OVER_H,
            85,
        )
        .expect("ok")
        .expect("must crop landscape");
        assert_eq!(ext, "png");
        let decoded = image::load_from_memory(&out).expect("decoded");
        assert!(decoded.color().has_alpha(), "alpha preserved");
        assert_eq!(decoded.width(), 540);
        assert_eq!(decoded.height(), 720);
    }

    #[test]
    fn smart_fit_passes_through_svg_and_gif_verbatim() {
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
        assert!(
            smart_fit_to_portrait_bytes(svg, "svg", PORTRAIT_TARGET_W_OVER_H, 85)
                .expect("ok")
                .is_none()
        );
        let gif = b"GIF89a";
        assert!(
            smart_fit_to_portrait_bytes(gif, "gif", PORTRAIT_TARGET_W_OVER_H, 85)
                .expect("ok")
                .is_none()
        );
    }

    #[test]
    fn smart_fit_returns_none_on_undecodable_bytes() {
        let bytes = b"definitely-not-a-real-jpeg";
        let res = smart_fit_to_portrait_bytes(bytes, "jpg", PORTRAIT_TARGET_W_OVER_H, 85)
            .expect("ok");
        assert!(res.is_none(), "garbage must fall through to verbatim copy");
    }

    #[test]
    fn smart_fit_rejects_invalid_target_aspect() {
        let bytes = fake_rgb_jpeg(1280, 720, [200, 80, 60]);
        assert!(
            smart_fit_to_portrait_bytes(&bytes, "jpg", 0.0, 85)
                .expect("ok")
                .is_none(),
            "zero aspect must be rejected gracefully",
        );
        assert!(
            smart_fit_to_portrait_bytes(&bytes, "jpg", f32::NAN, 85)
                .expect("ok")
                .is_none(),
            "NaN aspect must be rejected gracefully",
        );
    }

    #[test]
    fn save_inner_smart_fits_anggota_landscape_to_3x4() {
        let app_data = TempDir::new().expect("tempdir");
        let staging = TempDir::new().expect("staging");
        // 1280x720 landscape phone shot.
        let bytes = fake_rgb_jpeg(1280, 720, [200, 80, 60]);
        let src = staging.path().join("phone-landscape.jpg");
        fs::write(&src, &bytes).expect("write src");

        let result =
            save_inner(app_data.path(), "anggota", &src, 1_777_894_097_000).expect("save ok");
        let saved = fs::read(&result.abs_path).expect("read saved");
        let decoded = image::load_from_memory(&saved).expect("saved decodable");
        // After smart-fit (540x720), then `maybe_compress` long-edge cap
        // 800 (already ≤ 800) → final dims should match the smart-fit
        // crop dims exactly.
        assert_eq!(decoded.height(), 720);
        assert_eq!(decoded.width(), 540);
        let ratio = decoded.width() as f32 / decoded.height() as f32;
        assert!(
            (ratio - PORTRAIT_TARGET_W_OVER_H).abs() < 0.005,
            "ratio {ratio} should be ~3:4",
        );
    }

    #[test]
    fn classify_refit_outcome_skips_already_3x4_sources() {
        let bytes = fake_rgb_jpeg(600, 800, [120, 60, 30]);
        let res = classify_refit_outcome(&bytes, "jpg", PORTRAIT_TARGET_W_OVER_H, 85);
        assert!(res.is_none(), "already-3:4 must be skipped");
    }

    #[test]
    fn classify_refit_outcome_returns_cropped_for_landscape() {
        let bytes = fake_rgb_jpeg(1280, 720, [200, 80, 60]);
        let (cropped, ext) =
            classify_refit_outcome(&bytes, "jpg", PORTRAIT_TARGET_W_OVER_H, 85)
                .expect("must rewrite");
        assert_eq!(ext, "jpg");
        let decoded = image::load_from_memory(&cropped).expect("decoded");
        assert_eq!(decoded.width(), 540);
        assert_eq!(decoded.height(), 720);
    }
}
