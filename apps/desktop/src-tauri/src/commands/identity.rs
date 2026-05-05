use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Identitas perpustakaan (revisi #11). Disimpan di tabel `settings` v1
/// dengan keys `lib.nama`, `lib.alamat`, dst — di-port langsung tanpa migrasi.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LibraryIdentity {
    pub nama: String,
    pub alamat: String,
    pub kepala: String,
    pub npsn: String,
    pub tahun_ajaran: String,
    pub logo_path: String,
    pub kontak: String,
    /// Path file TTD kepala sekolah (FEAT-03). Disimpan dengan key
    /// `lib.ttd_kepsek_path` — diisi via FilePickerInput di Settings →
    /// Identitas dan dipakai oleh KTA renderer ketika template punya
    /// field `ttdKepsek`.
    #[serde(default)]
    pub ttd_kepsek_path: String,
    /// Nama kepala sekolah (FEAT-03). Berbeda dengan `kepala` (kepala
    /// perpustakaan). Disimpan dengan key `lib.kepala_sekolah` dan
    /// dipakai oleh field `namaKepsek` di template KTA.
    #[serde(default)]
    pub kepala_sekolah: String,
}

const KEY_NAMA: &str = "lib.nama";
const KEY_ALAMAT: &str = "lib.alamat";
const KEY_KEPALA: &str = "lib.kepala";
const KEY_NPSN: &str = "lib.npsn";
const KEY_TAHUN: &str = "lib.tahun_ajaran";
const KEY_LOGO: &str = "lib.logo_path";
const KEY_KONTAK: &str = "lib.kontak";
const KEY_TTD_KEPSEK: &str = "lib.ttd_kepsek_path";
const KEY_KEPALA_SEKOLAH: &str = "lib.kepala_sekolah";

const DEFAULT_NAMA: &str = "Perpustakaan Sekolah";
const DEFAULT_TAHUN: &str = "2024/2025";

fn read_setting(conn: &rusqlite::Connection, key: &str, default: &str) -> AppResult<String> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, Option<String>>(0),
    );
    match result {
        Ok(Some(value)) => Ok(value),
        Ok(None) => Ok(default.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(default.to_string()),
        Err(e) => Err(AppError::Db(e)),
    }
}

fn write_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn identity_get(state: State<'_, AppState>) -> AppResult<LibraryIdentity> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    Ok(LibraryIdentity {
        nama: read_setting(&conn, KEY_NAMA, DEFAULT_NAMA)?,
        alamat: read_setting(&conn, KEY_ALAMAT, "-")?,
        kepala: read_setting(&conn, KEY_KEPALA, "-")?,
        npsn: read_setting(&conn, KEY_NPSN, "-")?,
        tahun_ajaran: read_setting(&conn, KEY_TAHUN, DEFAULT_TAHUN)?,
        logo_path: read_setting(&conn, KEY_LOGO, "")?,
        kontak: read_setting(&conn, KEY_KONTAK, "-")?,
        ttd_kepsek_path: read_setting(&conn, KEY_TTD_KEPSEK, "")?,
        kepala_sekolah: read_setting(&conn, KEY_KEPALA_SEKOLAH, "")?,
    })
}

#[tauri::command]
pub fn identity_save(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    payload: LibraryIdentity,
) -> AppResult<LibraryIdentity> {
    {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        write_setting(&conn, KEY_NAMA, &payload.nama)?;
        write_setting(&conn, KEY_ALAMAT, &payload.alamat)?;
        write_setting(&conn, KEY_KEPALA, &payload.kepala)?;
        write_setting(&conn, KEY_NPSN, &payload.npsn)?;
        write_setting(&conn, KEY_TAHUN, &payload.tahun_ajaran)?;
        write_setting(&conn, KEY_LOGO, &payload.logo_path)?;
        write_setting(&conn, KEY_KONTAK, &payload.kontak)?;
        write_setting(&conn, KEY_TTD_KEPSEK, &payload.ttd_kepsek_path)?;
        write_setting(&conn, KEY_KEPALA_SEKOLAH, &payload.kepala_sekolah)?;
    }
    let _ = app.emit("identity:changed", &payload);
    Ok(payload)
}
