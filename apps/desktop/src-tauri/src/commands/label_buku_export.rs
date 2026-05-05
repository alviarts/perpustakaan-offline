//! Persists Cetak Label & Barcode output as PDF under
//! `<app_data>/exports/labels/` and exposes a cross-platform helper for
//! opening that folder in the OS file manager. Mirrors `kta_export.rs`
//! exactly so the two flows behave identically; the only differences
//! are the destination subfolder and the filename prefix. Frontend
//! builds the PDF bytes itself (jsPDF) and hands the blob in as
//! `bytes: Vec<u8>`.

use std::fs;
use std::path::PathBuf;

use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Hard cap so a runaway export can't fill the user's disk. Generous enough
/// for batches of every eksemplar in a school library — labels are tiny but
/// some libraries print thousands at a time.
const MAX_PDF_BYTES: usize = 64 * 1024 * 1024; // 64 MiB

/// Same `%PDF-` magic check as `kta_export.rs`.
const PDF_MAGIC: &[u8] = b"%PDF-";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelBukuExportResult {
    pub filename: String,
    pub abs_path: String,
    pub dir_abs_path: String,
}

fn exports_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("gagal resolve app_data_dir: {e}")))?;
    let dir = base.join("exports").join("labels");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| {
            AppError::Internal(format!(
                "gagal membuat folder exports {}: {e}",
                dir.to_string_lossy()
            ))
        })?;
    }
    Ok(dir)
}

fn validate_pdf_bytes(bytes: &[u8]) -> AppResult<()> {
    if bytes.is_empty() {
        return Err(AppError::Validation("payload PDF kosong".into()));
    }
    if bytes.len() > MAX_PDF_BYTES {
        return Err(AppError::Validation(format!(
            "payload terlalu besar ({} bytes, maks {} bytes)",
            bytes.len(),
            MAX_PDF_BYTES
        )));
    }
    if !bytes.starts_with(PDF_MAGIC) {
        return Err(AppError::Validation(
            "payload bukan PDF yang valid (header %PDF- tidak ditemukan)".into(),
        ));
    }
    Ok(())
}

fn generate_filename(now: chrono::DateTime<Local>) -> String {
    let stamp = now.format("%Y%m%d-%H%M%S").to_string();
    format!("label-buku-{stamp}.pdf")
}

#[tauri::command]
pub fn label_buku_export_pdf(app: AppHandle, bytes: Vec<u8>) -> AppResult<LabelBukuExportResult> {
    validate_pdf_bytes(&bytes)?;
    let dir = exports_dir(&app)?;
    let filename = generate_filename(Local::now());
    let dest = dir.join(&filename);
    fs::write(&dest, &bytes)
        .map_err(|e| AppError::Internal(format!("gagal menulis PDF: {e}")))?;

    Ok(LabelBukuExportResult {
        filename,
        abs_path: dest.to_string_lossy().into_owned(),
        dir_abs_path: dir.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn label_buku_open_exports_folder(app: AppHandle) -> AppResult<String> {
    let dir = exports_dir(&app)?;
    opener::open(&dir).map_err(|e| {
        AppError::Internal(format!(
            "gagal membuka folder {}: {e}",
            dir.to_string_lossy()
        ))
    })?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_payload() {
        let err = validate_pdf_bytes(&[]).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)), "{err:?}");
    }

    #[test]
    fn rejects_oversize_payload() {
        let big = vec![b'%'; MAX_PDF_BYTES + 1];
        let err = validate_pdf_bytes(&big).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)), "{err:?}");
    }

    #[test]
    fn rejects_payload_without_pdf_magic() {
        let bogus = b"<html>not a pdf</html>".to_vec();
        let err = validate_pdf_bytes(&bogus).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)), "{err:?}");
    }

    #[test]
    fn accepts_minimal_pdf_header() {
        validate_pdf_bytes(b"%PDF-1.7\nminimal").unwrap();
    }

    #[test]
    fn filename_pattern_is_label_date_time() {
        let fixed = chrono::DateTime::<chrono::Utc>::from_timestamp(1_700_000_000, 0)
            .expect("timestamp")
            .with_timezone(&Local);
        let name = generate_filename(fixed);
        assert!(name.starts_with("label-buku-"), "{name}");
        assert!(name.ends_with(".pdf"), "{name}");
        let stem = &name["label-buku-".len()..name.len() - ".pdf".len()];
        // 8 (date) + 1 (dash) + 6 (time) = 15
        assert_eq!(stem.len(), 15, "{stem}");
    }
}
