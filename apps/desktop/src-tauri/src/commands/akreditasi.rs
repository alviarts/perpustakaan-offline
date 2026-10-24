use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Subdirectory under app_data_dir for akreditasi evidence files.
const BUKTI_DIR: &str = "uploads/akreditasi";
/// Evidence extensions accepted (documents + images).
const BUKTI_EXTS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "csv", "jpg",
    "jpeg", "png", "webp",
];
const BUKTI_MAX_BYTES: u64 = 25 * 1024 * 1024;

fn app_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))
}

fn slug_stem(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev = false;
    for ch in input.chars() {
        let c = ch.to_ascii_lowercase();
        if c.is_ascii_alphanumeric() {
            out.push(c);
            prev = false;
        } else if !prev && !out.is_empty() {
            out.push('-');
            prev = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.len() > 40 {
        out.truncate(40);
        while out.ends_with('-') {
            out.pop();
        }
    }
    if out.is_empty() {
        "bukti".to_string()
    } else {
        out
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuktiUploadResult {
    pub rel_path: String,
}

/// Copy a picked evidence file (document or image) under
/// `<app_data>/uploads/akreditasi/` and return the relative path to store.
#[tauri::command]
pub fn akreditasi_bukti_upload(
    app: AppHandle,
    src_path: String,
) -> AppResult<BuktiUploadResult> {
    let app_data = app_data_dir(&app)?;
    let src = Path::new(&src_path);
    let metadata = std::fs::metadata(src).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound(format!("source: {}", src.display())),
        _ => AppError::Io(e),
    })?;
    if !metadata.is_file() {
        return Err(AppError::Validation("sumber bukan berkas".into()));
    }
    if metadata.len() > BUKTI_MAX_BYTES {
        return Err(AppError::Validation(format!(
            "berkas terlalu besar (maks {} MB)",
            BUKTI_MAX_BYTES / (1024 * 1024)
        )));
    }
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .ok_or_else(|| AppError::Validation("berkas tanpa ekstensi".into()))?;
    if !BUKTI_EXTS.contains(&ext.as_str()) {
        return Err(AppError::Validation(format!(
            "ekstensi .{ext} tidak didukung"
        )));
    }

    let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("bukti");
    let slug = slug_stem(stem);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let filename = format!("{slug}-{ts}.{ext}");

    let target_dir = app_data.join(BUKTI_DIR);
    std::fs::create_dir_all(&target_dir)?;
    let target = target_dir.join(&filename);
    std::fs::copy(src, &target)?;

    Ok(BuktiUploadResult {
        rel_path: format!("{BUKTI_DIR}/{filename}"),
    })
}

/// Open an evidence file (or its folder on failure) with the OS default app.
#[tauri::command]
pub fn akreditasi_bukti_open(app: AppHandle, rel_path: String) -> AppResult<()> {
    if rel_path.contains("..") {
        return Err(AppError::Validation("rel_path tidak valid".into()));
    }
    let app_data = app_data_dir(&app)?;
    let abs = app_data.join(&rel_path);
    if !abs.exists() {
        return Err(AppError::NotFound(format!("berkas: {}", abs.display())));
    }
    opener::open(&abs).map_err(|e| AppError::Internal(format!("buka berkas: {e}")))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArsipInput {
    pub jenis: String,
    pub jenjang: Option<String>,
    pub periode: Option<String>,
    pub nilai: Option<f64>,
    pub predikat: Option<String>,
    pub konten_json: String,
    pub penandatangan: Option<String>,
    pub jabatan: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArsipRow {
    pub id: i64,
    pub jenis: String,
    pub jenjang: Option<String>,
    pub periode: Option<String>,
    pub nilai: Option<f64>,
    pub predikat: Option<String>,
    pub konten_json: String,
    pub penandatangan: Option<String>,
    pub jabatan: Option<String>,
    pub created_at: String,
}

fn read_arsip(conn: &rusqlite::Connection, id: i64) -> AppResult<ArsipRow> {
    conn.query_row(
        "SELECT id, jenis, jenjang, periode, nilai, predikat, konten_json,
                penandatangan, jabatan, created_at
           FROM laporan_arsip WHERE id = ?1",
        rusqlite::params![id],
        |r| {
            Ok(ArsipRow {
                id: r.get(0)?,
                jenis: r.get(1)?,
                jenjang: r.get(2)?,
                periode: r.get(3)?,
                nilai: r.get(4)?,
                predikat: r.get(5)?,
                konten_json: r.get(6)?,
                penandatangan: r.get(7)?,
                jabatan: r.get(8)?,
                created_at: r.get(9)?,
            })
        },
    )
    .map_err(AppError::from)
}

#[tauri::command]
pub fn akreditasi_arsip_save(state: State<'_, AppState>, input: ArsipInput) -> AppResult<ArsipRow> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO laporan_arsip
             (jenis, jenjang, periode, nilai, predikat, konten_json, penandatangan, jabatan)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            input.jenis,
            input.jenjang,
            input.periode,
            input.nilai,
            input.predikat,
            input.konten_json,
            input.penandatangan,
            input.jabatan,
        ],
    )?;
    let id = conn.last_insert_rowid();
    read_arsip(&conn, id)
}

#[tauri::command]
pub fn akreditasi_arsip_list(state: State<'_, AppState>) -> AppResult<Vec<ArsipRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, jenis, jenjang, periode, nilai, predikat, konten_json,
                    penandatangan, jabatan, created_at
               FROM laporan_arsip ORDER BY created_at DESC, id DESC",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ArsipRow {
                id: r.get(0)?,
                jenis: r.get(1)?,
                jenjang: r.get(2)?,
                periode: r.get(3)?,
                nilai: r.get(4)?,
                predikat: r.get(5)?,
                konten_json: r.get(6)?,
                penandatangan: r.get(7)?,
                jabatan: r.get(8)?,
                created_at: r.get(9)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn akreditasi_arsip_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "DELETE FROM laporan_arsip WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

/// Profil akreditasi perpustakaan (single row, id=1). Menyimpan jenjang/SNP
/// yang berlaku, NPP, SK pendirian, dan bulan awal tahun ajaran. Identitas
/// umum (nama, alamat, NPSN, logo) tetap di tabel `settings` via `identity_*`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AkreditasiProfil {
    pub jenjang: String,
    pub npp: String,
    pub sk_pendirian: String,
    /// 1..=12 — bulan mulai tahun ajaran (default Juli).
    pub tahun_ajaran_awal: i64,
    pub catatan: String,
}

impl Default for AkreditasiProfil {
    fn default() -> Self {
        Self {
            jenjang: "SMP".into(),
            npp: String::new(),
            sk_pendirian: String::new(),
            tahun_ajaran_awal: 7,
            catatan: String::new(),
        }
    }
}

#[tauri::command]
pub fn akreditasi_profil_get(state: State<'_, AppState>) -> AppResult<AkreditasiProfil> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    let result = conn.query_row(
        "SELECT jenjang, npp, sk_pendirian, tahun_ajaran_awal, catatan
           FROM akreditasi_profil WHERE id = 1",
        [],
        |row| {
            Ok(AkreditasiProfil {
                jenjang: row
                    .get::<_, Option<String>>(0)?
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "SMP".into()),
                npp: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                sk_pendirian: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                tahun_ajaran_awal: row.get::<_, Option<i64>>(3)?.unwrap_or(7),
                catatan: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            })
        },
    );

    match result {
        Ok(profil) => Ok(profil),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AkreditasiProfil::default()),
        Err(e) => Err(AppError::Db(e)),
    }
}

#[tauri::command]
pub fn akreditasi_profil_set(
    state: State<'_, AppState>,
    payload: AkreditasiProfil,
) -> AppResult<AkreditasiProfil> {
    if !(1..=12).contains(&payload.tahun_ajaran_awal) {
        return Err(AppError::Validation(
            "Bulan awal tahun ajaran harus 1-12".into(),
        ));
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    conn.execute(
        "INSERT INTO akreditasi_profil
             (id, jenjang, npp, sk_pendirian, tahun_ajaran_awal, catatan, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
             jenjang           = excluded.jenjang,
             npp               = excluded.npp,
             sk_pendirian      = excluded.sk_pendirian,
             tahun_ajaran_awal = excluded.tahun_ajaran_awal,
             catatan           = excluded.catatan,
             updated_at        = datetime('now')",
        rusqlite::params![
            payload.jenjang,
            payload.npp,
            payload.sk_pendirian,
            payload.tahun_ajaran_awal,
            payload.catatan,
        ],
    )?;

    Ok(payload)
}

/// Data akreditasi non-operasional (tenaga, anggaran 3 tahun, sarana). Stored
/// as a JSON blob in `akreditasi_manual` so it can evolve without migrations.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AkreditasiManual {
    pub tenaga_pustakawan: i64,
    pub tenaga_kualifikasi: i64,
    pub jumlah_guru: i64,
    pub jumlah_tendik: i64,
    pub luas_ruang: f64,
    pub jumlah_komputer: i64,
    /// Anggaran sekolah & perpustakaan 3 tahun terakhir (tahun lalu = index 0).
    pub anggaran_sekolah: [i64; 3],
    pub anggaran_perpus: [i64; 3],
    pub catatan: String,
}

#[tauri::command]
pub fn akreditasi_manual_get(state: State<'_, AppState>) -> AppResult<AkreditasiManual> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let result = conn.query_row(
        "SELECT data_json FROM akreditasi_manual WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AkreditasiManual::default()),
        Err(e) => Err(AppError::Db(e)),
    }
}

#[tauri::command]
pub fn akreditasi_manual_set(
    state: State<'_, AppState>,
    payload: AkreditasiManual,
) -> AppResult<AkreditasiManual> {
    let json = serde_json::to_string(&payload)
        .map_err(|e| AppError::Internal(format!("serialize manual: {e}")))?;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO akreditasi_manual (id, data_json, updated_at)
         VALUES (1, ?1, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')",
        rusqlite::params![json],
    )?;
    Ok(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AkreditasiBuktiRow {
    pub kode: String,
    pub ada: bool,
    pub catatan: String,
    pub file_path: String,
}

#[tauri::command]
pub fn akreditasi_bukti_list(state: State<'_, AppState>) -> AppResult<Vec<AkreditasiBuktiRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt = conn
        .prepare("SELECT kode, ada, COALESCE(catatan, ''), COALESCE(file_path, '') FROM akreditasi_bukti")
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AkreditasiBuktiRow {
                kode: r.get(0)?,
                ada: r.get::<_, i64>(1)? != 0,
                catatan: r.get(2)?,
                file_path: r.get(3)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn akreditasi_bukti_set(
    state: State<'_, AppState>,
    kode: String,
    ada: bool,
    catatan: Option<String>,
    file_path: Option<String>,
) -> AppResult<AkreditasiBuktiRow> {
    let catatan = catatan.unwrap_or_default();
    let file_path = file_path.unwrap_or_default();
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO akreditasi_bukti (kode, ada, catatan, file_path, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(kode) DO UPDATE SET
             ada = excluded.ada,
             catatan = excluded.catatan,
             file_path = excluded.file_path,
             updated_at = datetime('now')",
        rusqlite::params![kode, ada as i64, catatan, file_path],
    )?;
    Ok(AkreditasiBuktiRow {
        kode,
        ada,
        catatan,
        file_path,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ButirJawaban {
    pub komponen: i64,
    pub butir: i64,
    /// 'a'|'b'|'c'|'d' or empty when unanswered.
    pub jawaban: String,
    pub catatan: String,
}

#[tauri::command]
pub fn akreditasi_butir_list(
    state: State<'_, AppState>,
    jenjang: String,
) -> AppResult<Vec<ButirJawaban>> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut stmt = conn
        .prepare(
            "SELECT komponen, butir, COALESCE(jawaban, ''), COALESCE(catatan, '')
               FROM akreditasi_butir WHERE jenjang = ?1",
        )
        .map_err(AppError::from)?;
    let rows = stmt
        .query_map(rusqlite::params![jenjang], |r| {
            Ok(ButirJawaban {
                komponen: r.get(0)?,
                butir: r.get(1)?,
                jawaban: r.get(2)?,
                catatan: r.get(3)?,
            })
        })
        .map_err(AppError::from)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(AppError::from)?;
    Ok(rows)
}

#[tauri::command]
pub fn akreditasi_butir_set(
    state: State<'_, AppState>,
    jenjang: String,
    komponen: i64,
    butir: i64,
    jawaban: Option<String>,
    catatan: Option<String>,
) -> AppResult<ButirJawaban> {
    let jawaban = jawaban.unwrap_or_default();
    let catatan = catatan.unwrap_or_default();
    if !jawaban.is_empty() && !matches!(jawaban.as_str(), "a" | "b" | "c" | "d") {
        return Err(AppError::Validation(format!("jawaban tidak valid: {jawaban}")));
    }
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "INSERT INTO akreditasi_butir (jenjang, komponen, butir, jawaban, catatan, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(jenjang, komponen, butir) DO UPDATE SET
             jawaban = excluded.jawaban,
             catatan = excluded.catatan,
             updated_at = datetime('now')",
        rusqlite::params![jenjang, komponen, butir, jawaban, catatan],
    )?;
    Ok(ButirJawaban {
        komponen,
        butir,
        jawaban,
        catatan,
    })
}

#[tauri::command]
pub fn akreditasi_butir_reset(state: State<'_, AppState>, jenjang: String) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    conn.execute(
        "DELETE FROM akreditasi_butir WHERE jenjang = ?1",
        rusqlite::params![jenjang],
    )?;
    Ok(())
}
