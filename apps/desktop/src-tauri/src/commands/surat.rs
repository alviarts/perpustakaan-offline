//! Surat keterangan bebas pustaka (FEAT-21).
//!
//! Auto-generates a "library clearance letter" PDF for an anggota who has no
//! active loans and no outstanding denda. Eligibility is checked server-side
//! so the frontend can't accidentally print a surat for an anggota who still
//! owes books or fines.
//!
//! Design notes:
//! - `nomor_surat` is rendered from `surat.format_nomor` (printf-style
//!   template, default `{tahun}/{bulan}/SBP-{nomor:04d}`) plus
//!   `surat.nomor_terakhir` (last-used sequence number). `surat_generate`
//!   atomically `+1`s `nomor_terakhir` inside a transaction so two
//!   concurrent calls can never produce the same nomor.
//! - The PDF itself is rendered on the frontend (jsPDF) so the backend
//!   stays thin and platform-independent. The backend only owns the
//!   eligibility check, the nomor allocation, and the audit log entry.
//! - `surat_log` is purely for history; deletion is intentionally not
//!   exposed via a Tauri command so the audit trail of nomor_surat →
//!   anggota assignments stays intact.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::kas::insert_audit_log;
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Default `surat.format_nomor` placeholder template. Year + month +
/// 4-digit zero-padded sequence is the most common Indonesian school
/// administration convention.
const DEFAULT_FORMAT_NOMOR: &str = "{tahun}/{bulan}/SBP-{nomor:04d}";

/// Default Indonesian template body. Plain text with `\n` paragraph breaks
/// and `{placeholder}` substitution. The frontend's `lib/suratPdf.ts` is the
/// single owner of HTML→PDF rendering; this template is intentionally simple
/// so it round-trips through the Settings textarea editor without escaping.
const DEFAULT_TEMPLATE_HTML: &str = "Yang bertanda tangan di bawah ini, Kepala Perpustakaan {nama_perpustakaan}, dengan ini menerangkan bahwa:\n\nNama         : {nama}\nNo. Anggota  : {kode_anggota}\nKelas        : {kelas}\n\nbenar telah menyelesaikan seluruh kewajiban peminjaman buku di Perpustakaan ini dan tidak memiliki tanggungan apapun.\n\nSurat keterangan bebas pustaka ini dibuat untuk dapat dipergunakan sebagaimana mestinya.\n\nDikeluarkan di : {kota}\nPada tanggal   : {tanggal}";

/// Settings keys touched by this module. Kept as constants so we don't
/// scatter magic strings.
const KEY_TEMPLATE_HTML: &str = "surat.template_html";
const KEY_NOMOR_TERAKHIR: &str = "surat.nomor_terakhir";
const KEY_FORMAT_NOMOR: &str = "surat.format_nomor";
const KEY_KEPSEK_NAMA: &str = "surat.kepala_sekolah_nama";
const KEY_KEPSEK_NIP: &str = "surat.kepala_sekolah_nip";
const KEY_KEPSEK_TTD_PATH: &str = "surat.kepala_sekolah_ttd_path";

/// Idempotently seed the default surat settings rows. Called from
/// `db::apply_additive_migrations` so existing databases get the defaults
/// on first launch after upgrade, but manual edits in Settings persist.
pub(crate) fn seed_default_surat_settings(conn: &Connection) -> AppResult<()> {
    let pairs: [(&str, &str); 6] = [
        (KEY_TEMPLATE_HTML, DEFAULT_TEMPLATE_HTML),
        (KEY_NOMOR_TERAKHIR, "0"),
        (KEY_FORMAT_NOMOR, DEFAULT_FORMAT_NOMOR),
        (KEY_KEPSEK_NAMA, ""),
        (KEY_KEPSEK_NIP, ""),
        (KEY_KEPSEK_TTD_PATH, ""),
    ];
    for (k, v) in pairs {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SuratEligibility {
    pub eligible: bool,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub anggota_aktif: bool,
    pub active_loans: i64,
    /// `total_denda - total_bayar` summed across all loans. Positive means
    /// the anggota still owes money.
    pub outstanding_denda: i64,
    /// Human-readable list of blocking reasons, locale="id". Empty when
    /// `eligible == true`.
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SuratGenerateResult {
    pub log_id: i64,
    pub nomor_surat: String,
    pub tanggal_cetak: String,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub anggota_kelas: Option<String>,
    pub template_html: String,
    pub kepala_sekolah_nama: String,
    pub kepala_sekolah_nip: String,
    pub kepala_sekolah_ttd_path: String,
    /// `nomor_terakhir` after the increment — kept so the frontend can
    /// optimistically update its settings cache.
    pub nomor_terakhir: i64,
    pub format_nomor: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SuratLogRow {
    pub id: i64,
    pub anggota_id: i64,
    pub anggota_nama: String,
    pub anggota_kode: String,
    pub nomor_surat: String,
    pub tanggal_cetak: String,
    pub petugas_id: Option<i64>,
    pub petugas_username: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuratLogQuery {
    pub anggota_id: Option<i64>,
    pub limit: Option<i64>,
}

/// Compute eligibility for `anggota_id` without mutating the DB. Used by
/// the dialog to decide whether to enable the "Cetak" button and, again,
/// inside `surat_generate_inner` to prevent TOCTOU races.
pub(crate) fn compute_eligibility(conn: &Connection, anggota_id: i64) -> AppResult<SuratEligibility> {
    let row: Option<(i64, String, String, i64)> = conn
        .query_row(
            "SELECT id, kode_anggota, nama, aktif FROM anggota WHERE id = ?1",
            params![anggota_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?;
    let (id, kode, nama, aktif_int) =
        row.ok_or_else(|| AppError::NotFound(format!("anggota id {anggota_id}")))?;
    let aktif = aktif_int != 0;

    let active_loans: i64 = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN pi.status = 'dipinjam' THEN 1 ELSE 0 END), 0) \
         FROM peminjaman_item pi \
         JOIN peminjaman p ON p.id = pi.peminjaman_id \
         WHERE p.anggota_id = ?1",
        params![id],
        |r| r.get(0),
    )?;

    let outstanding_denda: i64 = conn.query_row(
        "SELECT COALESCE(SUM(total_denda) - SUM(total_bayar), 0) \
         FROM peminjaman WHERE anggota_id = ?1",
        params![id],
        |r| r.get(0),
    )?;

    let mut reasons: Vec<String> = Vec::new();
    if !aktif {
        reasons.push("Status anggota tidak aktif.".to_string());
    }
    if active_loans > 0 {
        reasons.push(format!(
            "Masih ada {active_loans} buku yang belum dikembalikan."
        ));
    }
    if outstanding_denda > 0 {
        reasons.push(format!(
            "Masih ada tunggakan denda sebesar Rp{outstanding_denda}."
        ));
    }

    let eligible = reasons.is_empty();
    Ok(SuratEligibility {
        eligible,
        anggota_id: id,
        anggota_nama: nama,
        anggota_kode: kode,
        anggota_aktif: aktif,
        active_loans,
        outstanding_denda,
        reasons,
    })
}

fn get_setting(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten())
}

/// Render a `format_nomor` template by substituting `{tahun}`, `{bulan}`,
/// and `{nomor:NNd}` (zero-padded). Unknown placeholders are left as-is so
/// users can introduce custom segments without the backend rejecting them.
fn render_nomor(format_nomor: &str, tahun: i32, bulan: u32, nomor: i64) -> String {
    let mut out = format_nomor.to_string();
    out = out.replace("{tahun}", &format!("{tahun:04}"));
    out = out.replace("{bulan}", &format!("{bulan:02}"));
    // Pad-aware {nomor:NNd}. Falls back to plain `{nomor}` if no width.
    let mut buf = String::with_capacity(out.len());
    let mut rest = out.as_str();
    while let Some(start) = rest.find("{nomor") {
        buf.push_str(&rest[..start]);
        let after = &rest[start..];
        let Some(end_rel) = after.find('}') else {
            buf.push_str(after);
            rest = "";
            break;
        };
        let token = &after[..=end_rel];
        let inner = &token[1..token.len() - 1];
        let pad = inner
            .strip_prefix("nomor:")
            .and_then(|tail| tail.strip_suffix('d'))
            .and_then(|n| n.parse::<usize>().ok())
            .unwrap_or(0);
        let formatted = if pad > 0 {
            format!("{nomor:0pad$}")
        } else {
            nomor.to_string()
        };
        buf.push_str(&formatted);
        rest = &after[end_rel + 1..];
    }
    buf.push_str(rest);
    buf
}

fn parse_today(conn: &Connection) -> AppResult<(String, i32, u32)> {
    let today: String =
        conn.query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))?;
    let parts: Vec<&str> = today.split('-').collect();
    let tahun = parts
        .first()
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);
    let bulan = parts
        .get(1)
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    Ok((today, tahun, bulan))
}

pub(crate) fn surat_generate_inner(
    conn: &mut Connection,
    anggota_id: i64,
    user_id: Option<i64>,
) -> AppResult<SuratGenerateResult> {
    // Re-check eligibility under the same conn so a denda paid five seconds
    // ago is reflected. The dialog also calls `surat_check_eligibility` for
    // the prelim UX, but that's just hint UI — the source of truth is here.
    let eligibility = compute_eligibility(conn, anggota_id)?;
    if !eligibility.eligible {
        return Err(AppError::Validation(format!(
            "anggota tidak memenuhi syarat surat bebas pustaka: {}",
            eligibility.reasons.join(" ")
        )));
    }

    let format_nomor = get_setting(conn, KEY_FORMAT_NOMOR)?
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_FORMAT_NOMOR.to_string());
    let template_html = get_setting(conn, KEY_TEMPLATE_HTML)?
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_TEMPLATE_HTML.to_string());
    let kepala_sekolah_nama = get_setting(conn, KEY_KEPSEK_NAMA)?.unwrap_or_default();
    let kepala_sekolah_nip = get_setting(conn, KEY_KEPSEK_NIP)?.unwrap_or_default();
    let kepala_sekolah_ttd_path = get_setting(conn, KEY_KEPSEK_TTD_PATH)?.unwrap_or_default();

    let kelas: Option<String> = conn
        .query_row(
            "SELECT kelas FROM anggota WHERE id = ?1",
            params![anggota_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten();

    let (today, tahun, bulan) = parse_today(conn)?;

    let tx = conn.transaction()?;

    // Atomic increment of nomor_terakhir.
    let prev: i64 = tx
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = ?1",
            params![KEY_NOMOR_TERAKHIR],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    let nomor_terakhir = prev + 1;
    tx.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY_NOMOR_TERAKHIR, nomor_terakhir.to_string()],
    )?;

    let nomor_surat = render_nomor(&format_nomor, tahun, bulan, nomor_terakhir);

    tx.execute(
        "INSERT INTO surat_log (anggota_id, nomor_surat, tanggal_cetak, petugas_id) \
         VALUES (?1, ?2, ?3, ?4)",
        params![anggota_id, nomor_surat, today, user_id],
    )?;
    let log_id = tx.last_insert_rowid();

    let detail = json!({
        "nomor_surat": nomor_surat,
        "anggota_id": anggota_id,
        "anggota_nama": eligibility.anggota_nama,
        "tanggal_cetak": today,
    });
    insert_audit_log(
        &tx,
        user_id,
        "cetak_surat_bebas_pustaka",
        "surat_log",
        Some(log_id),
        &detail,
    )?;
    tx.commit()?;

    Ok(SuratGenerateResult {
        log_id,
        nomor_surat,
        tanggal_cetak: today,
        anggota_id,
        anggota_nama: eligibility.anggota_nama,
        anggota_kode: eligibility.anggota_kode,
        anggota_kelas: kelas,
        template_html,
        kepala_sekolah_nama,
        kepala_sekolah_nip,
        kepala_sekolah_ttd_path,
        nomor_terakhir,
        format_nomor,
    })
}

pub(crate) fn surat_log_list_inner(
    conn: &Connection,
    query: &SuratLogQuery,
) -> AppResult<Vec<SuratLogRow>> {
    let limit = query.limit.unwrap_or(200).clamp(1, 1000);
    let mut sql = String::from(
        "SELECT s.id, s.anggota_id, a.nama, a.kode_anggota, s.nomor_surat, s.tanggal_cetak, \
                s.petugas_id, u.username \
         FROM surat_log s \
         LEFT JOIN anggota a ON a.id = s.anggota_id \
         LEFT JOIN users u ON u.id = s.petugas_id",
    );
    let mut binds: Vec<i64> = Vec::new();
    if let Some(aid) = query.anggota_id {
        sql.push_str(" WHERE s.anggota_id = ?1");
        binds.push(aid);
    }
    sql.push_str(" ORDER BY s.id DESC LIMIT ");
    sql.push_str(&limit.to_string());

    let mut stmt = conn.prepare(&sql)?;
    let rows = if binds.is_empty() {
        stmt.query_map([], map_log_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    } else {
        stmt.query_map(rusqlite::params_from_iter(binds.iter()), map_log_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    };
    Ok(rows)
}

fn map_log_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<SuratLogRow> {
    Ok(SuratLogRow {
        id: r.get(0)?,
        anggota_id: r.get(1)?,
        anggota_nama: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
        anggota_kode: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
        nomor_surat: r.get(4)?,
        tanggal_cetak: r.get(5)?,
        petugas_id: r.get(6)?,
        petugas_username: r.get(7)?,
    })
}

fn current_user_id(state: &AppState) -> Option<i64> {
    state
        .current_user
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|u| u.id))
}

#[tauri::command]
pub fn surat_check_eligibility(
    state: State<'_, AppState>,
    anggota_id: i64,
) -> AppResult<SuratEligibility> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    compute_eligibility(&conn, anggota_id)
}

#[tauri::command]
pub fn surat_generate(
    state: State<'_, AppState>,
    anggota_id: i64,
) -> AppResult<SuratGenerateResult> {
    let user_id = current_user_id(&state);
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    surat_generate_inner(&mut conn, anggota_id, user_id)
}

#[tauri::command]
pub fn surat_log_list(
    state: State<'_, AppState>,
    query: Option<SuratLogQuery>,
) -> AppResult<Vec<SuratLogRow>> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    surat_log_list_inner(&conn, &query.unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign_keys");
        crate::db::run_migrations(&conn).expect("run migrations");
        conn
    }

    fn seed_anggota(conn: &Connection, kode: &str, nama: &str, aktif: i64) -> i64 {
        conn.execute(
            "INSERT INTO anggota (kode_anggota, nama, kelas, aktif) \
             VALUES (?1, ?2, '10 IPA 1', ?3)",
            params![kode, nama, aktif],
        )
        .expect("seed anggota");
        conn.last_insert_rowid()
    }

    fn seed_buku(conn: &Connection, kode: &str, judul: &str) -> i64 {
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar) VALUES (?1, ?2, 1)",
            params![kode, judul],
        )
        .expect("seed buku");
        conn.last_insert_rowid()
    }

    fn seed_active_loan(conn: &Connection, anggota_id: i64, buku_id: i64) -> i64 {
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status, total_denda, total_bayar) \
             VALUES ('P-001', ?1, date('now'), date('now', '+7 days'), 'dipinjam', 0, 0)",
            params![anggota_id],
        )
        .expect("seed peminjaman header");
        let pid = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO peminjaman_item (peminjaman_id, buku_id, status, denda) \
             VALUES (?1, ?2, 'dipinjam', 0)",
            params![pid, buku_id],
        )
        .expect("seed peminjaman_item");
        pid
    }

    fn seed_paid_loan(conn: &Connection, anggota_id: i64, denda: i64, bayar: i64) {
        conn.execute(
            "INSERT INTO peminjaman (nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status, total_denda, total_bayar) \
             VALUES ('P-002', ?1, date('now'), date('now', '+7 days'), 'dikembalikan', ?2, ?3)",
            params![anggota_id, denda, bayar],
        )
        .expect("seed paid loan");
    }

    #[test]
    fn render_nomor_substitutes_year_month_and_padded_sequence() {
        let s = render_nomor("{tahun}/{bulan}/SBP-{nomor:04d}", 2026, 5, 7);
        assert_eq!(s, "2026/05/SBP-0007");
    }

    #[test]
    fn render_nomor_handles_unpadded_and_unknown_placeholders() {
        let s = render_nomor("SBP/{tahun}/{nomor}-{custom}", 2026, 5, 42);
        assert_eq!(s, "SBP/2026/42-{custom}");
    }

    #[test]
    fn eligibility_passes_for_anggota_with_no_loans_and_no_denda() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini", 1);
        let elig = compute_eligibility(&conn, aid).expect("compute");
        assert!(elig.eligible, "expected eligible: {:?}", elig.reasons);
        assert_eq!(elig.active_loans, 0);
        assert_eq!(elig.outstanding_denda, 0);
        assert!(elig.reasons.is_empty());
    }

    #[test]
    fn eligibility_blocks_when_active_loan_exists() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0001", "Andini", 1);
        let bid = seed_buku(&conn, "B-001", "Belajar Rust");
        seed_active_loan(&conn, aid, bid);
        let elig = compute_eligibility(&conn, aid).expect("compute");
        assert!(!elig.eligible);
        assert_eq!(elig.active_loans, 1);
        assert!(elig
            .reasons
            .iter()
            .any(|r| r.contains("belum dikembalikan")));
    }

    #[test]
    fn eligibility_blocks_when_outstanding_denda() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0002", "Bagas", 1);
        seed_paid_loan(&conn, aid, 5_000, 0);
        let elig = compute_eligibility(&conn, aid).expect("compute");
        assert!(!elig.eligible);
        assert_eq!(elig.outstanding_denda, 5_000);
        assert!(elig.reasons.iter().any(|r| r.contains("denda")));
    }

    #[test]
    fn eligibility_blocks_when_anggota_inactive() {
        let conn = setup_db();
        let aid = seed_anggota(&conn, "A0003", "Citra", 0);
        let elig = compute_eligibility(&conn, aid).expect("compute");
        assert!(!elig.eligible);
        assert!(!elig.anggota_aktif);
        assert!(elig
            .reasons
            .iter()
            .any(|r| r.contains("tidak aktif")));
    }

    #[test]
    fn generate_increments_nomor_and_writes_audit_log() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0004", "Dina", 1);
        let res = surat_generate_inner(&mut conn, aid, None).expect("generate");
        assert_eq!(res.nomor_terakhir, 1);
        assert!(res.nomor_surat.contains("SBP-0001"));
        assert_eq!(res.anggota_kode, "A0004");

        // nomor_terakhir persisted
        let stored: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![KEY_NOMOR_TERAKHIR],
                |r| r.get(0),
            )
            .expect("read nomor_terakhir");
        assert_eq!(stored, "1");

        // surat_log row written
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM surat_log WHERE anggota_id = ?1", params![aid], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 1);

        // audit_log entry
        let aksi: String = conn
            .query_row(
                "SELECT aksi FROM audit_log ORDER BY id DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .expect("read audit");
        assert_eq!(aksi, "cetak_surat_bebas_pustaka");
    }

    #[test]
    fn generate_assigns_sequential_nomor() {
        let mut conn = setup_db();
        let a1 = seed_anggota(&conn, "A0005", "Eko", 1);
        let a2 = seed_anggota(&conn, "A0006", "Fani", 1);
        let r1 = surat_generate_inner(&mut conn, a1, None).expect("generate 1");
        let r2 = surat_generate_inner(&mut conn, a2, None).expect("generate 2");
        assert_eq!(r1.nomor_terakhir, 1);
        assert_eq!(r2.nomor_terakhir, 2);
        assert_ne!(r1.nomor_surat, r2.nomor_surat);
    }

    #[test]
    fn generate_blocks_when_ineligible() {
        let mut conn = setup_db();
        let aid = seed_anggota(&conn, "A0007", "Gilang", 1);
        let bid = seed_buku(&conn, "B-002", "Rust 101");
        seed_active_loan(&conn, aid, bid);
        let err = surat_generate_inner(&mut conn, aid, None).expect_err("should reject");
        assert!(matches!(err, AppError::Validation(_)));

        // No surat_log row, no nomor increment.
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM surat_log", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0);
        let prev: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![KEY_NOMOR_TERAKHIR],
                |r| r.get(0),
            )
            .optional()
            .expect("read nomor")
            .flatten();
        // Default seed leaves it at "0".
        assert_eq!(prev.as_deref(), Some("0"));
    }

    #[test]
    fn log_list_filters_by_anggota_and_orders_desc() {
        let mut conn = setup_db();
        let a1 = seed_anggota(&conn, "A0008", "Hana", 1);
        let a2 = seed_anggota(&conn, "A0009", "Ivan", 1);
        surat_generate_inner(&mut conn, a1, None).expect("g1");
        surat_generate_inner(&mut conn, a2, None).expect("g2");
        surat_generate_inner(&mut conn, a1, None).expect("g3");

        let all = surat_log_list_inner(&conn, &SuratLogQuery::default()).expect("all");
        assert_eq!(all.len(), 3);
        // Desc order by id
        assert!(all[0].id > all[1].id);

        let only_a1 = surat_log_list_inner(
            &conn,
            &SuratLogQuery {
                anggota_id: Some(a1),
                limit: None,
            },
        )
        .expect("filter");
        assert_eq!(only_a1.len(), 2);
        assert!(only_a1.iter().all(|r| r.anggota_id == a1));
    }

    #[test]
    fn default_settings_seeded_after_migrations() {
        let conn = setup_db();
        let format = get_setting(&conn, KEY_FORMAT_NOMOR).expect("read");
        assert_eq!(format.as_deref(), Some(DEFAULT_FORMAT_NOMOR));
        let template = get_setting(&conn, KEY_TEMPLATE_HTML).expect("read");
        assert!(template.unwrap().contains("{nama}"));
    }
}
