//! Generic export-write helper. The frontend builds a binary blob (xlsx, csv,
//! pdf, …) and asks the backend to persist it to a user-chosen path that came
//! from a Tauri save dialog. Centralising the write here means we never sprinkle
//! `fs:allow-write-file` permissions across the capability set and we get a
//! single place to enforce path / size validation.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Hard cap so a runaway export can't fill the user's disk. Generous enough for
/// a real xlsx export of every member + book row in a school.
const MAX_EXPORT_BYTES: usize = 64 * 1024 * 1024; // 64 MiB

#[tauri::command]
pub fn export_write_bytes(dest_path: String, bytes: Vec<u8>) -> AppResult<u64> {
    write_bytes_inner(Path::new(&dest_path), &bytes)
}

pub fn write_bytes_inner(dest: &Path, bytes: &[u8]) -> AppResult<u64> {
    if bytes.is_empty() {
        return Err(AppError::Validation("payload kosong".into()));
    }
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err(AppError::Validation(format!(
            "payload terlalu besar ({} bytes, maks {} bytes)",
            bytes.len(),
            MAX_EXPORT_BYTES
        )));
    }
    if !dest.is_absolute() {
        return Err(AppError::Validation(format!(
            "path harus absolut: {}",
            dest.to_string_lossy()
        )));
    }
    let parent: PathBuf = match dest.parent() {
        Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
        _ => {
            return Err(AppError::Validation(
                "path tidak punya direktori parent".into(),
            ))
        }
    };
    if !parent.exists() {
        return Err(AppError::Validation(format!(
            "direktori target tidak ditemukan: {}",
            parent.to_string_lossy()
        )));
    }
    if !parent.is_dir() {
        return Err(AppError::Validation(format!(
            "parent bukan direktori: {}",
            parent.to_string_lossy()
        )));
    }

    fs::write(dest, bytes).map_err(|e| AppError::Internal(format!("gagal menulis file: {e}")))?;
    Ok(bytes.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rejects_empty_payload() {
        let dir = tempdir().unwrap();
        let dst = dir.path().join("empty.xlsx");
        let err = write_bytes_inner(&dst, &[]).unwrap_err();
        assert!(matches!(err, AppError::Validation(_)), "{err:?}");
    }

    #[test]
    fn rejects_oversize_payload() {
        let dir = tempdir().unwrap();
        let dst = dir.path().join("big.xlsx");
        let big = vec![0u8; MAX_EXPORT_BYTES + 1];
        let err = write_bytes_inner(&dst, &big).unwrap_err();
        match err {
            AppError::Validation(msg) => assert!(msg.contains("terlalu besar"), "{msg}"),
            other => panic!("expected Validation, got {other:?}"),
        }
    }

    #[test]
    fn rejects_relative_path() {
        let err = write_bytes_inner(Path::new("foo.xlsx"), b"data").unwrap_err();
        match err {
            AppError::Validation(msg) => assert!(msg.contains("absolut"), "{msg}"),
            other => panic!("expected Validation, got {other:?}"),
        }
    }

    #[test]
    fn rejects_missing_parent() {
        let dir = tempdir().unwrap();
        let bogus = dir.path().join("does-not-exist").join("out.xlsx");
        let err = write_bytes_inner(&bogus, b"data").unwrap_err();
        match err {
            AppError::Validation(msg) => assert!(msg.contains("tidak ditemukan"), "{msg}"),
            other => panic!("expected Validation, got {other:?}"),
        }
    }

    #[test]
    fn writes_bytes_to_disk_byte_for_byte() {
        let dir = tempdir().unwrap();
        let dst = dir.path().join("anggota-2026-05-04.xlsx");
        let payload: Vec<u8> = (0..1024u32).map(|i| (i % 256) as u8).collect();
        let n = write_bytes_inner(&dst, &payload).expect("write ok");
        assert_eq!(n, payload.len() as u64);
        let read_back = fs::read(&dst).expect("read back ok");
        assert_eq!(read_back, payload);
    }

    #[test]
    fn overwrites_existing_file() {
        let dir = tempdir().unwrap();
        let dst = dir.path().join("rewrite.xlsx");
        write_bytes_inner(&dst, b"first").expect("write first");
        write_bytes_inner(&dst, b"second-and-longer").expect("write second");
        let read_back = fs::read(&dst).expect("read back");
        assert_eq!(read_back, b"second-and-longer");
    }
}
