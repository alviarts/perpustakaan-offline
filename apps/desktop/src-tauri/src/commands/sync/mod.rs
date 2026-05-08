//! FEAT-26 Google Sheets bidirectional sync (PR G v1.0.8).
//!
//! Public surface: the `tauri::command` functions registered in `lib.rs`.
//! Internal modules: [`auth`] (Service Account JWT → access token),
//! [`client`] (Sheets v4 REST wrapper), [`mapper`] (per-table row encoders),
//! [`state`] (`sync_state`/`sync_log` queries).
//!
//! Scope of this PR (G1 in the BUGS.md sub-PR split):
//! * Service Account auth + access-token caching
//! * Push for `anggota` (replace-all-rows, content-hash short-circuit)
//! * Pull for `anggota` (last-write-wins on `updated_at`)
//! * Test-connection probe
//! * `sync_status` for the Sinkronisasi page
//!
//! Out of scope, deferred to G2/G3:
//! * Push/pull for `buku`, `eksemplar`, `peminjaman`, `peminjaman_item`,
//!   `wishlist_buku`, `reservasi_buku`. The mapper trait is structured so
//!   each table is one new mapper file + 4 lines in the dispatch.
//! * Tombstones (`_deleted: TRUE` column) for soft-delete propagation.
//! * Auto-scheduler tokio task. The infrastructure in
//!   `commands::backup_runner` is a fine reference, but the user told us
//!   manual buttons + interval-from-Pengaturan was enough for MVP.
//! * Rich conflict resolver UI. We log conflicts (`status='ok'` with a
//!   "skipped: local newer" message) but don't surface a side-by-side
//!   resolver yet.

pub mod auth;
pub mod client;
pub mod mapper;
pub mod state;

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

use auth::{fetch_access_token, AccessToken, ServiceAccount, DEFAULT_SCOPE};
use client::SheetsClient;
use mapper::{
    read_all_anggota, read_all_buku, read_all_eksemplar, read_all_peminjaman,
    upsert_anggota, upsert_buku, upsert_eksemplar, upsert_peminjaman, AnggotaRow, BukuRow,
    EksemplarRow, PeminjamanRow, ANGGOTA_HEADER, ANGGOTA_TAB, BUKU_HEADER, BUKU_TAB,
    EKSEMPLAR_HEADER, EKSEMPLAR_TAB, PEMINJAMAN_HEADER, PEMINJAMAN_TAB,
};
use state::{append_log, list_log, list_states, rows_hash, upsert_state, SyncStateRow};

const KEY_SA_JSON: &str = "sync.service_account_json";
const KEY_SHEETS_ID: &str = "sync.spreadsheet_id";
const KEY_ENABLED: &str = "sync.enabled";

/// In-memory access-token cache, keyed by Service Account email. Never
/// persisted to disk — the SA JSON itself is what gets stored, and the
/// token is cheap to re-mint (one JWT sign + one HTTPS call).
///
/// Held in a tokio `Mutex` because we touch it from async contexts.
static TOKEN_CACHE: Mutex<Option<CachedToken>> = Mutex::new(None);

#[derive(Debug, Clone)]
struct CachedToken {
    sa_email: String,
    token: AccessToken,
}

fn read_setting(conn: &rusqlite::Connection, key: &str) -> AppResult<Option<String>> {
    match conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, Option<String>>(0),
    ) {
        Ok(value) => Ok(value),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Db(e)),
    }
}

pub(crate) fn require_settings(state: &State<'_, AppState>) -> AppResult<(ServiceAccount, String)> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let sa_raw = read_setting(&conn, KEY_SA_JSON)?.unwrap_or_default();
    let sheets_id = read_setting(&conn, KEY_SHEETS_ID)?.unwrap_or_default();
    drop(conn);
    if sa_raw.trim().is_empty() {
        return Err(AppError::Validation(
            "Service Account JSON belum diisi di Pengaturan → Sinkronisasi".into(),
        ));
    }
    if sheets_id.trim().is_empty() {
        return Err(AppError::Validation(
            "Spreadsheet ID belum diisi di Pengaturan → Sinkronisasi".into(),
        ));
    }
    let sa = ServiceAccount::from_json(&sa_raw)?;
    Ok((sa, sheets_id))
}

pub(crate) async fn build_client(sa: &ServiceAccount) -> AppResult<SheetsClient> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    {
        let cache = TOKEN_CACHE
            .lock()
            .map_err(|_| AppError::Internal("token cache poisoned".into()))?;
        if let Some(cached) = cache.as_ref() {
            if cached.sa_email == sa.client_email && cached.token.is_fresh(now) {
                return Ok(SheetsClient {
                    http: reqwest::Client::new(),
                    access_token: cached.token.token.clone(),
                });
            }
        }
    }
    let http = reqwest::Client::new();
    let token = fetch_access_token(&http, sa, DEFAULT_SCOPE).await?;
    {
        let mut cache = TOKEN_CACHE
            .lock()
            .map_err(|_| AppError::Internal("token cache poisoned".into()))?;
        *cache = Some(CachedToken {
            sa_email: sa.client_email.clone(),
            token: token.clone(),
        });
    }
    Ok(SheetsClient {
        http,
        access_token: token.token,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestConnectionResult {
    pub ok: bool,
    pub spreadsheet_title: String,
    pub tabs: Vec<String>,
    pub service_account_email: String,
}

/// Validate the saved Service Account JSON + spreadsheet ID by fetching
/// the spreadsheet metadata. Returns sheet title + tab names so the UI can
/// confirm which workbook the admin connected.
#[tauri::command]
pub async fn sync_test_connection(
    state: State<'_, AppState>,
) -> AppResult<TestConnectionResult> {
    let (sa, sheets_id) = require_settings(&state)?;
    let client = build_client(&sa).await?;
    let meta = client.get_spreadsheet(&sheets_id).await?;
    let tabs = meta
        .sheets
        .iter()
        .map(|s| s.properties.title.clone())
        .collect::<Vec<_>>();
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    append_log(
        &conn,
        "test",
        "*",
        "ok",
        0,
        Some(&format!(
            "test ok: {} ({} tabs)",
            meta.properties.title,
            tabs.len()
        )),
    )?;
    drop(conn);
    Ok(TestConnectionResult {
        ok: true,
        spreadsheet_title: meta.properties.title,
        tabs,
        service_account_email: sa.client_email,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRunResult {
    pub direction: String,
    pub rows_changed: i64,
    pub status: String,
    pub message: String,
}

/// Full sync: PULL first (get wishlist/reservasi from mobile), then PUSH all local data.
/// This ensures data written by mobile app (wishlist, reservasi) is imported
/// before the desktop pushes its snapshot.
#[tauri::command]
pub async fn sync_full_now(state: State<'_, AppState>) -> AppResult<Vec<SyncRunResult>> {
    let (sa, sheets_id) = require_settings(&state)?;
    let client = build_client(&sa).await?;
    let mut results: Vec<SyncRunResult> = Vec::new();

    // STEP 1: Pull data from mobile (wishlist, reservasi, kunjungan)
    pull_wishlist_from_sheets(&state, &client, &sheets_id, &mut results).await?;
    pull_reservasi_from_sheets(&state, &client, &sheets_id, &mut results).await?;
    pull_kunjungan_from_sheets(&state, &client, &sheets_id, &mut results).await?;

    // STEP 2: Push all local data to Sheets
    push_anggota(&state, &client, &sheets_id, &mut results).await?;
    push_buku(&state, &client, &sheets_id, &mut results).await?;
    push_eksemplar(&state, &client, &sheets_id, &mut results).await?;
    push_peminjaman(&state, &client, &sheets_id, &mut results).await?;
    push_generic_table(&state, &client, &sheets_id, &mut results, "wishlist",
        &["kode_anggota", "judul", "pengarang", "isbn", "alasan", "status", "catatan_admin", "kode_buku_linked", "upvote_count", "created_at", "updated_at"],
        "SELECT COALESCE(a.kode_anggota,''), w.judul, COALESCE(w.pengarang,''), COALESCE(w.isbn,''), \
         COALESCE(w.alasan,''), w.status, COALESCE(w.catatan_admin,''), COALESCE(b.kode_buku,''), \
         CAST(w.upvote_count AS TEXT), w.created_at, w.updated_at \
         FROM wishlist_buku w \
         LEFT JOIN anggota a ON a.id = w.anggota_id \
         LEFT JOIN buku b ON b.id = w.buku_id \
         ORDER BY w.id ASC"
    ).await?;
    push_generic_table(&state, &client, &sheets_id, &mut results, "reservasi",
        &["kode_anggota", "kode_buku", "urutan", "status", "slot_rak", "tanggal_request", "tanggal_siap_diambil", "expired_at", "catatan", "created_at", "updated_at"],
        "SELECT COALESCE(a.kode_anggota,''), COALESCE(b.kode_buku,''), CAST(r.urutan AS TEXT), \
         r.status, COALESCE(r.slot_rak,''), r.tanggal_request, COALESCE(r.tanggal_siap_diambil,''), \
         COALESCE(r.expired_at,''), COALESCE(r.catatan,''), r.created_at, r.updated_at \
         FROM reservasi_buku r \
         LEFT JOIN anggota a ON a.id = r.anggota_id \
         LEFT JOIN buku b ON b.id = r.buku_id \
         ORDER BY r.id ASC"
    ).await?;

    Ok(results)
}

/// Push the local `anggota` table to the configured spreadsheet, replacing
/// the entire `anggota` tab with our snapshot. If the local data hasn't
/// changed since the last successful push we short-circuit and log a
/// `noop`.
#[tauri::command]
pub async fn sync_push_now(state: State<'_, AppState>) -> AppResult<Vec<SyncRunResult>> {
    let (sa, sheets_id) = require_settings(&state)?;
    let client = build_client(&sa).await?;
    let mut results: Vec<SyncRunResult> = Vec::new();
    push_anggota(&state, &client, &sheets_id, &mut results).await?;
    push_buku(&state, &client, &sheets_id, &mut results).await?;
    push_eksemplar(&state, &client, &sheets_id, &mut results).await?;
    push_peminjaman(&state, &client, &sheets_id, &mut results).await?;
    push_generic_table(&state, &client, &sheets_id, &mut results, "wishlist",
        &["kode_anggota", "judul", "pengarang", "isbn", "alasan", "status", "catatan_admin", "kode_buku_linked", "upvote_count", "created_at", "updated_at"],
        "SELECT COALESCE(a.kode_anggota,''), w.judul, COALESCE(w.pengarang,''), COALESCE(w.isbn,''), \
         COALESCE(w.alasan,''), w.status, COALESCE(w.catatan_admin,''), COALESCE(b.kode_buku,''), \
         CAST(w.upvote_count AS TEXT), w.created_at, w.updated_at \
         FROM wishlist_buku w \
         LEFT JOIN anggota a ON a.id = w.anggota_id \
         LEFT JOIN buku b ON b.id = w.buku_id \
         ORDER BY w.id ASC"
    ).await?;
    push_generic_table(&state, &client, &sheets_id, &mut results, "reservasi",
        &["kode_anggota", "kode_buku", "urutan", "status", "slot_rak", "tanggal_request", "tanggal_siap_diambil", "expired_at", "catatan", "created_at", "updated_at"],
        "SELECT COALESCE(a.kode_anggota,''), COALESCE(b.kode_buku,''), CAST(r.urutan AS TEXT), \
         r.status, COALESCE(r.slot_rak,''), r.tanggal_request, COALESCE(r.tanggal_siap_diambil,''), \
         COALESCE(r.expired_at,''), COALESCE(r.catatan,''), r.created_at, r.updated_at \
         FROM reservasi_buku r \
         LEFT JOIN anggota a ON a.id = r.anggota_id \
         LEFT JOIN buku b ON b.id = r.buku_id \
         ORDER BY r.id ASC"
    ).await?;
    Ok(results)
}

async fn push_anggota(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let (rows, prev_hash) = {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let rows = read_all_anggota(&conn)?;
        let prev_hash = state::get_state(&conn, ANGGOTA_TAB)?
            .and_then(|s| s.last_push_hash);
        (rows, prev_hash)
    };

    let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len() + 1);
    sheet_rows.push(ANGGOTA_HEADER.iter().map(|s| s.to_string()).collect());
    for r in &rows {
        sheet_rows.push(r.to_cells());
    }
    let new_hash = rows_hash(&sheet_rows);

    if prev_hash.as_deref() == Some(new_hash.as_str()) {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(
            &conn,
            "push",
            ANGGOTA_TAB,
            "noop",
            0,
            Some("local belum berubah sejak push terakhir"),
        )?;
        results.push(SyncRunResult {
            direction: "push".into(),
            rows_changed: 0,
            status: "noop".into(),
            message: "local belum berubah sejak push terakhir".into(),
        });
        return Ok(());
    }

    let push_result =
        do_push_anggota(client, sheets_id, &sheet_rows, rows.len() as i64).await;

    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    match push_result {
        Ok(rows_changed) => {
            let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let prev = state::get_state(&conn, ANGGOTA_TAB)?.unwrap_or(SyncStateRow {
                table_name: ANGGOTA_TAB.into(),
                last_push_at: None,
                last_pull_at: None,
                last_push_hash: None,
                last_pull_hash: None,
                rows_pushed: 0,
                rows_pulled: 0,
                updated_at: String::new(),
            });
            upsert_state(
                &conn,
                &SyncStateRow {
                    last_push_at: Some(now_iso.clone()),
                    last_push_hash: Some(new_hash),
                    rows_pushed: rows_changed,
                    ..prev
                },
            )?;
            append_log(
                &conn,
                "push",
                ANGGOTA_TAB,
                "ok",
                rows_changed,
                Some(&format!("pushed {rows_changed} anggota")),
            )?;
            results.push(SyncRunResult {
                direction: "push".into(),
                rows_changed,
                status: "ok".into(),
                message: format!("pushed {rows_changed} anggota"),
            });
            Ok(())
        }
        Err(e) => {
            let msg = format!("{e:?}");
            append_log(&conn, "push", ANGGOTA_TAB, "error", 0, Some(&msg))?;
            Err(e)
        }
    }
}

async fn do_push_anggota(
    client: &SheetsClient,
    sheets_id: &str,
    sheet_rows: &[Vec<String>],
    row_count: i64,
) -> AppResult<i64> {
    client.ensure_tab(sheets_id, ANGGOTA_TAB).await?;
    let range = format!("{ANGGOTA_TAB}!A1:Z");
    client.clear_values(sheets_id, &range).await?;
    if !sheet_rows.is_empty() {
        let write_range = format!("{ANGGOTA_TAB}!A1");
        client
            .update_values(sheets_id, &write_range, sheet_rows)
            .await?;
    }
    Ok(row_count)
}

/// Pull the `anggota` tab from the configured spreadsheet and apply rows
/// where the incoming `updated_at` is strictly greater than the local copy.
#[tauri::command]
pub async fn sync_pull_now(state: State<'_, AppState>) -> AppResult<Vec<SyncRunResult>> {
    let (sa, sheets_id) = require_settings(&state)?;
    let client = build_client(&sa).await?;
    let mut results: Vec<SyncRunResult> = Vec::new();
    // Topological order — anggota → buku → eksemplar → peminjaman.
    pull_anggota(&state, &client, &sheets_id, &mut results).await?;
    pull_buku(&state, &client, &sheets_id, &mut results).await?;
    pull_eksemplar(&state, &client, &sheets_id, &mut results).await?;
    pull_peminjaman(&state, &client, &sheets_id, &mut results).await?;
    // Pull wishlist + reservasi written by mobile app
    pull_wishlist_from_sheets(&state, &client, &sheets_id, &mut results).await?;
    pull_reservasi_from_sheets(&state, &client, &sheets_id, &mut results).await?;
    Ok(results)
}

/// Generic push: read rows from a SQL query and write to a Sheets tab.
/// Used for wishlist, reservasi, and other tables that don't need
/// content-hash short-circuiting.
async fn push_generic_table(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
    tab_name: &str,
    headers: &[&str],
    sql: &str,
) -> AppResult<()> {
    let rows = {
        let conn = state.db.lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let mut stmt = conn.prepare(sql)?;
        let col_count = headers.len();
        let mapped = stmt.query_map([], |row| {
            let mut cells = Vec::with_capacity(col_count);
            for i in 0..col_count {
                cells.push(row.get::<_, String>(i).unwrap_or_default());
            }
            Ok(cells)
        })?;
        mapped.collect::<rusqlite::Result<Vec<_>>>()?
    };

    let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len() + 1);
    sheet_rows.push(headers.iter().map(|s| s.to_string()).collect());
    sheet_rows.extend(rows.iter().cloned());

    client.ensure_tab(sheets_id, tab_name).await?;
    let range = format!("{tab_name}!A1:Z");
    let _ = client.clear_values(sheets_id, &range).await;
    if !sheet_rows.is_empty() {
        let write_range = format!("{tab_name}!A1");
        client.update_values(sheets_id, &write_range, &sheet_rows).await?;
    }

    let count = rows.len() as i64;
    let conn = state.db.lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    append_log(&conn, "push", tab_name, "ok", count, Some(&format!("pushed {count} {tab_name}")))?;
    results.push(SyncRunResult {
        direction: "push".into(), rows_changed: count,
        status: "ok".into(), message: format!("pushed {count} {tab_name}"),
    });
    Ok(())
}

/// Pull wishlist entries written by the mobile app from the "wishlist" Sheets tab.
/// Resolves kode_anggota → anggota_id and inserts new rows into wishlist_buku.
async fn pull_wishlist_from_sheets(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = "wishlist!A1:Z";
    let raw = match client.get_values(sheets_id, range).await {
        Ok(rows) => rows,
        Err(_) => {
            results.push(SyncRunResult {
                direction: "pull".into(), rows_changed: 0,
                status: "skipped".into(), message: "tab wishlist belum ada".into(),
            });
            return Ok(());
        }
    };
    if raw.len() <= 1 {
        results.push(SyncRunResult {
            direction: "pull".into(), rows_changed: 0,
            status: "noop".into(), message: "wishlist kosong".into(),
        });
        return Ok(());
    }

    let conn = state.db.lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut inserted = 0i64;

    // Skip header (row 0), process data rows
    for row in raw.iter().skip(1) {
        let pick = |i: usize| row.get(i).cloned().unwrap_or_default();
        let kode_anggota = pick(0);
        let judul = pick(1);
        let pengarang = pick(2);
        let isbn = pick(3);
        let alasan = pick(4);
        let status = pick(5);
        let created_at = pick(9);

        if kode_anggota.is_empty() || judul.is_empty() {
            continue;
        }

        // Resolve kode_anggota → anggota_id
        let anggota_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM anggota WHERE kode_anggota = ?1",
                rusqlite::params![kode_anggota],
                |r| r.get(0),
            )
            .ok();

        let Some(aid) = anggota_id else { continue };

        // Check if already exists (by anggota_id + judul)
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM wishlist_buku WHERE anggota_id = ?1 AND judul = ?2",
                rusqlite::params![aid, judul],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            conn.execute(
                "INSERT INTO wishlist_buku (anggota_id, judul, pengarang, isbn, alasan, status, upvote_count, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)",
                rusqlite::params![aid, judul, pengarang, isbn, alasan,
                    if status.is_empty() { "pending" } else { &status }, created_at],
            )?;
            inserted += 1;
        }
    }

    let conn2 = &conn;
    append_log(conn2, "pull", "wishlist", "ok", inserted, Some(&format!("pulled {inserted} wishlist")))?;
    results.push(SyncRunResult {
        direction: "pull".into(), rows_changed: inserted,
        status: "ok".into(), message: format!("pulled {inserted} wishlist baru"),
    });
    Ok(())
}

/// Pull reservasi entries written by the mobile app from the "reservasi" Sheets tab.
async fn pull_reservasi_from_sheets(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = "reservasi!A1:Z";
    let raw = match client.get_values(sheets_id, range).await {
        Ok(rows) => rows,
        Err(_) => {
            results.push(SyncRunResult {
                direction: "pull".into(), rows_changed: 0,
                status: "skipped".into(), message: "tab reservasi belum ada".into(),
            });
            return Ok(());
        }
    };
    if raw.len() <= 1 {
        results.push(SyncRunResult {
            direction: "pull".into(), rows_changed: 0,
            status: "noop".into(), message: "reservasi kosong".into(),
        });
        return Ok(());
    }

    let conn = state.db.lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut inserted = 0i64;

    for row in raw.iter().skip(1) {
        let pick = |i: usize| row.get(i).cloned().unwrap_or_default();
        let kode_anggota = pick(0);
        let kode_buku = pick(1);
        let status = pick(3);
        let tanggal_request = pick(5);
        let catatan = pick(8);
        let created_at = pick(9);

        if kode_anggota.is_empty() || kode_buku.is_empty() {
            continue;
        }

        // Resolve FKs
        let anggota_id: Option<i64> = conn
            .query_row("SELECT id FROM anggota WHERE kode_anggota = ?1",
                rusqlite::params![kode_anggota], |r| r.get(0)).ok();
        let buku_id: Option<i64> = conn
            .query_row("SELECT id FROM buku WHERE kode_buku = ?1",
                rusqlite::params![kode_buku], |r| r.get(0)).ok();

        let (Some(aid), Some(bid)) = (anggota_id, buku_id) else { continue };

        // Check if already exists
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM reservasi_buku WHERE anggota_id = ?1 AND buku_id = ?2 AND tanggal_request = ?3",
                rusqlite::params![aid, bid, tanggal_request],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            // Get next urutan
            let urutan: i64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(urutan), 0) + 1 FROM reservasi_buku WHERE buku_id = ?1 AND status = 'menunggu'",
                    rusqlite::params![bid], |r| r.get(0),
                )
                .unwrap_or(1);

            conn.execute(
                "INSERT INTO reservasi_buku (anggota_id, buku_id, urutan, status, tanggal_request, catatan, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                rusqlite::params![aid, bid, urutan,
                    if status.is_empty() { "menunggu" } else { &status },
                    tanggal_request, catatan, created_at],
            )?;
            inserted += 1;
        }
    }

    append_log(&conn, "pull", "reservasi", "ok", inserted, Some(&format!("pulled {inserted} reservasi")))?;
    results.push(SyncRunResult {
        direction: "pull".into(), rows_changed: inserted,
        status: "ok".into(), message: format!("pulled {inserted} reservasi baru"),
    });
    Ok(())
}

/// Pull kunjungan (attendance) entries written by mobile app scan KTA.
async fn pull_kunjungan_from_sheets(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = "kunjungan!A1:Z";
    let raw = match client.get_values(sheets_id, range).await {
        Ok(rows) => rows,
        Err(_) => {
            results.push(SyncRunResult {
                direction: "pull".into(), rows_changed: 0,
                status: "skipped".into(), message: "tab kunjungan belum ada".into(),
            });
            return Ok(());
        }
    };
    if raw.len() <= 1 {
        results.push(SyncRunResult {
            direction: "pull".into(), rows_changed: 0,
            status: "noop".into(), message: "kunjungan kosong".into(),
        });
        return Ok(());
    }

    let conn = state.db.lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let mut inserted = 0i64;

    for row in raw.iter().skip(1) {
        let pick = |i: usize| row.get(i).cloned().unwrap_or_default();
        let kode_anggota = pick(0);
        let tanggal = pick(1);
        let jam = pick(2);
        let keperluan = pick(3);
        let sumber = pick(4);
        let created_at = pick(9);

        if kode_anggota.is_empty() || tanggal.is_empty() {
            continue;
        }

        // Only pull mobile-originated entries (sumber = scan_kta or scan_kta_mobile)
        if !sumber.contains("scan_kta") {
            continue;
        }

        // Resolve kode_anggota → anggota_id
        let anggota_id: Option<i64> = conn
            .query_row("SELECT id FROM anggota WHERE kode_anggota = ?1",
                rusqlite::params![kode_anggota], |r| r.get(0)).ok();

        let Some(aid) = anggota_id else { continue };

        // Check if already exists (by anggota_id + tanggal + jam)
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM kunjungan WHERE anggota_id = ?1 AND tanggal = ?2 AND jam = ?3",
                rusqlite::params![aid, tanggal, jam],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            conn.execute(
                "INSERT INTO kunjungan (anggota_id, tanggal, jam, keperluan, sumber, jumlah_orang, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
                rusqlite::params![aid, tanggal, jam, keperluan, sumber, created_at],
            )?;
            inserted += 1;
        }
    }

    append_log(&conn, "pull", "kunjungan", "ok", inserted, Some(&format!("pulled {inserted} kunjungan")))?;
    results.push(SyncRunResult {
        direction: "pull".into(), rows_changed: inserted,
        status: "ok".into(), message: format!("pulled {inserted} kunjungan baru dari HP"),
    });
    Ok(())
}

async fn pull_anggota(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = format!("{ANGGOTA_TAB}!A1:Z");
    let raw = match client.get_values(sheets_id, &range).await {
        Ok(rows) => rows,
        Err(e) => {
            let conn = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            append_log(&conn, "pull", ANGGOTA_TAB, "error", 0, Some(&format!("{e:?}")))?;
            return Err(e);
        }
    };

    if raw.is_empty() {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(
            &conn,
            "pull",
            ANGGOTA_TAB,
            "skipped",
            0,
            Some("tab Anggota di Sheets kosong / belum ada"),
        )?;
        results.push(SyncRunResult {
            direction: "pull".into(),
            rows_changed: 0,
            status: "skipped".into(),
            message: "tab Anggota di Sheets kosong / belum ada".into(),
        });
        return Ok(());
    }

    // Skip header row (first row). Validate it has a recognized first column.
    let mut iter = raw.into_iter();
    let header = iter.next().unwrap_or_default();
    let first_col = header.first().map(|s| s.as_str()).unwrap_or("");
    // Accept both old format (kode_anggota first) and new format (id first)
    if first_col != "kode_anggota" && first_col != "id" {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Anggota tidak dikenal: kolom-1='{}' (harus 'id' atau 'kode_anggota')",
            first_col
        );
        append_log(&conn, "pull", ANGGOTA_TAB, "error", 0, Some(&msg))?;
        return Err(AppError::Validation(msg));
    }

    // If first column is "id", data rows have id at index 0 — use from_cells
    // which already handles the new format. If first column is "kode_anggota"
    // (old format), we need to prepend a dummy "0" id.
    let has_id_col = first_col == "id";

    let mut applied: i64 = 0;
    let mut skipped: i64 = 0;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    for cells in iter {
        if cells.iter().all(|c| c.is_empty()) {
            continue;
        }
        let adjusted = if has_id_col {
            cells
        } else {
            // Old format without id — prepend "0" so from_cells indices align
            let mut v = vec!["0".to_string()];
            v.extend(cells);
            v
        };
        let row = AnggotaRow::from_cells(&adjusted);
        match upsert_anggota(&conn, &row) {
            Ok(true) => applied += 1,
            Ok(false) => skipped += 1,
            Err(e) => {
                append_log(
                    &conn,
                    "pull",
                    ANGGOTA_TAB,
                    "error",
                    applied,
                    Some(&format!("row {}: {e:?}", row.kode_anggota)),
                )?;
            }
        }
    }
    let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let prev = state::get_state(&conn, ANGGOTA_TAB)?.unwrap_or(SyncStateRow {
        table_name: ANGGOTA_TAB.into(),
        last_push_at: None,
        last_pull_at: None,
        last_push_hash: None,
        last_pull_hash: None,
        rows_pushed: 0,
        rows_pulled: 0,
        updated_at: String::new(),
    });
    upsert_state(
        &conn,
        &SyncStateRow {
            last_pull_at: Some(now_iso.clone()),
            rows_pulled: applied,
            ..prev
        },
    )?;
    let msg = format!(
        "pulled {applied} anggota (skip-newer-local: {skipped})"
    );
    append_log(&conn, "pull", ANGGOTA_TAB, "ok", applied, Some(&msg))?;
    results.push(SyncRunResult {
        direction: "pull".into(),
        rows_changed: applied,
        status: "ok".into(),
        message: msg,
    });
    Ok(())
}

// ============================================================================
// Generic per-table push/pull helpers (v1.0.9 — extends past `anggota`).
//
// Each push fn:
//   1. Read all rows from local DB.
//   2. Hash content; short-circuit with `noop` if hash matches last_push_hash.
//   3. Replace the entire tab in Sheets with header + rows.
//   4. Update sync_state + append log row.
//
// Each pull fn:
//   1. Read all rows from the configured tab (header + body).
//   2. Validate header column 1 == primary-key name.
//   3. For each body row, call upsert_<table> (last-write-wins).
//   4. Update sync_state + append log row.
// ============================================================================

async fn push_table_replace(
    client: &SheetsClient,
    sheets_id: &str,
    tab: &str,
    sheet_rows: &[Vec<String>],
    row_count: i64,
) -> AppResult<i64> {
    client.ensure_tab(sheets_id, tab).await?;
    let range = format!("{tab}!A1:Z");
    client.clear_values(sheets_id, &range).await?;
    if !sheet_rows.is_empty() {
        let write_range = format!("{tab}!A1");
        client
            .update_values(sheets_id, &write_range, sheet_rows)
            .await?;
    }
    Ok(row_count)
}

async fn push_buku(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let (rows, prev_hash) = {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let rows = read_all_buku(&conn)?;
        let prev_hash = state::get_state(&conn, BUKU_TAB)?.and_then(|s| s.last_push_hash);
        (rows, prev_hash)
    };

    let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len() + 1);
    sheet_rows.push(BUKU_HEADER.iter().map(|s| s.to_string()).collect());
    for r in &rows {
        sheet_rows.push(r.to_cells());
    }
    let new_hash = rows_hash(&sheet_rows);

    if prev_hash.as_deref() == Some(new_hash.as_str()) {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "push", BUKU_TAB, "noop", 0, Some("local belum berubah sejak push terakhir"))?;
        results.push(SyncRunResult {
            direction: "push".into(),
            rows_changed: 0,
            status: "noop".into(),
            message: "local belum berubah sejak push terakhir".into(),
        });
        return Ok(());
    }

    let push_result =
        push_table_replace(client, sheets_id, BUKU_TAB, &sheet_rows, rows.len() as i64).await;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    match push_result {
        Ok(rows_changed) => {
            let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let prev = state::get_state(&conn, BUKU_TAB)?.unwrap_or(SyncStateRow {
                table_name: BUKU_TAB.into(),
                last_push_at: None,
                last_pull_at: None,
                last_push_hash: None,
                last_pull_hash: None,
                rows_pushed: 0,
                rows_pulled: 0,
                updated_at: String::new(),
            });
            upsert_state(
                &conn,
                &SyncStateRow {
                    last_push_at: Some(now_iso.clone()),
                    last_push_hash: Some(new_hash),
                    rows_pushed: rows_changed,
                    ..prev
                },
            )?;
            let msg = format!("pushed {rows_changed} buku");
            append_log(&conn, "push", BUKU_TAB, "ok", rows_changed, Some(&msg))?;
            results.push(SyncRunResult {
                direction: "push".into(),
                rows_changed,
                status: "ok".into(),
                message: msg,
            });
            Ok(())
        }
        Err(e) => {
            append_log(&conn, "push", BUKU_TAB, "error", 0, Some(&format!("{e:?}")))?;
            Err(e)
        }
    }
}

async fn push_eksemplar(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let (rows, prev_hash) = {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let rows = read_all_eksemplar(&conn)?;
        let prev_hash = state::get_state(&conn, EKSEMPLAR_TAB)?.and_then(|s| s.last_push_hash);
        (rows, prev_hash)
    };

    let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len() + 1);
    sheet_rows.push(EKSEMPLAR_HEADER.iter().map(|s| s.to_string()).collect());
    for r in &rows {
        sheet_rows.push(r.to_cells());
    }
    let new_hash = rows_hash(&sheet_rows);

    if prev_hash.as_deref() == Some(new_hash.as_str()) {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "push", EKSEMPLAR_TAB, "noop", 0, Some("local belum berubah sejak push terakhir"))?;
        results.push(SyncRunResult {
            direction: "push".into(),
            rows_changed: 0,
            status: "noop".into(),
            message: "local belum berubah sejak push terakhir".into(),
        });
        return Ok(());
    }

    let push_result =
        push_table_replace(client, sheets_id, EKSEMPLAR_TAB, &sheet_rows, rows.len() as i64).await;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    match push_result {
        Ok(rows_changed) => {
            let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let prev = state::get_state(&conn, EKSEMPLAR_TAB)?.unwrap_or(SyncStateRow {
                table_name: EKSEMPLAR_TAB.into(),
                last_push_at: None,
                last_pull_at: None,
                last_push_hash: None,
                last_pull_hash: None,
                rows_pushed: 0,
                rows_pulled: 0,
                updated_at: String::new(),
            });
            upsert_state(
                &conn,
                &SyncStateRow {
                    last_push_at: Some(now_iso.clone()),
                    last_push_hash: Some(new_hash),
                    rows_pushed: rows_changed,
                    ..prev
                },
            )?;
            let msg = format!("pushed {rows_changed} eksemplar");
            append_log(&conn, "push", EKSEMPLAR_TAB, "ok", rows_changed, Some(&msg))?;
            results.push(SyncRunResult {
                direction: "push".into(),
                rows_changed,
                status: "ok".into(),
                message: msg,
            });
            Ok(())
        }
        Err(e) => {
            append_log(&conn, "push", EKSEMPLAR_TAB, "error", 0, Some(&format!("{e:?}")))?;
            Err(e)
        }
    }
}

async fn push_peminjaman(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let (rows, prev_hash) = {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let rows = read_all_peminjaman(&conn)?;
        let prev_hash = state::get_state(&conn, PEMINJAMAN_TAB)?.and_then(|s| s.last_push_hash);
        (rows, prev_hash)
    };

    let mut sheet_rows: Vec<Vec<String>> = Vec::with_capacity(rows.len() + 1);
    sheet_rows.push(PEMINJAMAN_HEADER.iter().map(|s| s.to_string()).collect());
    for r in &rows {
        sheet_rows.push(r.to_cells());
    }
    let new_hash = rows_hash(&sheet_rows);

    if prev_hash.as_deref() == Some(new_hash.as_str()) {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "push", PEMINJAMAN_TAB, "noop", 0, Some("local belum berubah sejak push terakhir"))?;
        results.push(SyncRunResult {
            direction: "push".into(),
            rows_changed: 0,
            status: "noop".into(),
            message: "local belum berubah sejak push terakhir".into(),
        });
        return Ok(());
    }

    let push_result = push_table_replace(
        client,
        sheets_id,
        PEMINJAMAN_TAB,
        &sheet_rows,
        rows.len() as i64,
    )
    .await;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    match push_result {
        Ok(rows_changed) => {
            let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let prev = state::get_state(&conn, PEMINJAMAN_TAB)?.unwrap_or(SyncStateRow {
                table_name: PEMINJAMAN_TAB.into(),
                last_push_at: None,
                last_pull_at: None,
                last_push_hash: None,
                last_pull_hash: None,
                rows_pushed: 0,
                rows_pulled: 0,
                updated_at: String::new(),
            });
            upsert_state(
                &conn,
                &SyncStateRow {
                    last_push_at: Some(now_iso.clone()),
                    last_push_hash: Some(new_hash),
                    rows_pushed: rows_changed,
                    ..prev
                },
            )?;
            let msg = format!("pushed {rows_changed} peminjaman");
            append_log(&conn, "push", PEMINJAMAN_TAB, "ok", rows_changed, Some(&msg))?;
            results.push(SyncRunResult {
                direction: "push".into(),
                rows_changed,
                status: "ok".into(),
                message: msg,
            });
            Ok(())
        }
        Err(e) => {
            append_log(&conn, "push", PEMINJAMAN_TAB, "error", 0, Some(&format!("{e:?}")))?;
            Err(e)
        }
    }
}

async fn pull_buku(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = format!("{BUKU_TAB}!A1:Z");
    let raw = match client.get_values(sheets_id, &range).await {
        Ok(rows) => rows,
        Err(e) => {
            let conn = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            append_log(&conn, "pull", BUKU_TAB, "error", 0, Some(&format!("{e:?}")))?;
            return Err(e);
        }
    };

    if raw.is_empty() {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "pull", BUKU_TAB, "skipped", 0, Some("tab Buku di Sheets kosong / belum ada"))?;
        results.push(SyncRunResult {
            direction: "pull".into(),
            rows_changed: 0,
            status: "skipped".into(),
            message: "tab Buku di Sheets kosong / belum ada".into(),
        });
        return Ok(());
    }

    let mut iter = raw.into_iter();
    let header = iter.next().unwrap_or_default();
    let first_buku_col = header.first().map(|s| s.as_str()).unwrap_or("");
    if first_buku_col != "kode_buku" && first_buku_col != "id" {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Buku tidak dikenal: kolom-1='{}' (harus 'id' atau 'kode_buku')",
            first_buku_col
        );
        append_log(&conn, "pull", BUKU_TAB, "error", 0, Some(&msg))?;
        return Err(AppError::Validation(msg));
    }

    // If first column is "id", skip it when parsing (BukuRow doesn't have id field)
    let buku_has_id_col = first_buku_col == "id";

    let mut applied: i64 = 0;
    let mut skipped: i64 = 0;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    for cells in iter {
        if cells.iter().all(|c| c.is_empty()) {
            continue;
        }
        // If Sheets has "id" as first col, skip it for BukuRow parsing
        let adjusted: Vec<String> = if buku_has_id_col && cells.len() > 1 {
            cells[1..].to_vec()
        } else {
            cells
        };
        let row = BukuRow::from_cells(&adjusted);
        match upsert_buku(&conn, &row) {
            Ok(true) => applied += 1,
            Ok(false) => skipped += 1,
            Err(e) => {
                append_log(&conn, "pull", BUKU_TAB, "error", applied, Some(&format!("row {}: {e:?}", row.kode_buku)))?;
            }
        }
    }
    let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let prev = state::get_state(&conn, BUKU_TAB)?.unwrap_or(SyncStateRow {
        table_name: BUKU_TAB.into(),
        last_push_at: None,
        last_pull_at: None,
        last_push_hash: None,
        last_pull_hash: None,
        rows_pushed: 0,
        rows_pulled: 0,
        updated_at: String::new(),
    });
    upsert_state(
        &conn,
        &SyncStateRow {
            last_pull_at: Some(now_iso.clone()),
            rows_pulled: applied,
            ..prev
        },
    )?;
    let msg = format!("pulled {applied} buku (skip-newer-local: {skipped})");
    append_log(&conn, "pull", BUKU_TAB, "ok", applied, Some(&msg))?;
    results.push(SyncRunResult {
        direction: "pull".into(),
        rows_changed: applied,
        status: "ok".into(),
        message: msg,
    });
    Ok(())
}

async fn pull_eksemplar(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = format!("{EKSEMPLAR_TAB}!A1:Z");
    let raw = match client.get_values(sheets_id, &range).await {
        Ok(rows) => rows,
        Err(e) => {
            let conn = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            append_log(&conn, "pull", EKSEMPLAR_TAB, "error", 0, Some(&format!("{e:?}")))?;
            return Err(e);
        }
    };

    if raw.is_empty() {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "pull", EKSEMPLAR_TAB, "skipped", 0, Some("tab Eksemplar di Sheets kosong / belum ada"))?;
        results.push(SyncRunResult {
            direction: "pull".into(),
            rows_changed: 0,
            status: "skipped".into(),
            message: "tab Eksemplar di Sheets kosong / belum ada".into(),
        });
        return Ok(());
    }

    let mut iter = raw.into_iter();
    let header = iter.next().unwrap_or_default();
    if header.first().map(|s| s.as_str()) != Some("kode_eksemplar") {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Eksemplar tidak dikenal: kolom-1='{}' (harus 'kode_eksemplar')",
            header.first().cloned().unwrap_or_default()
        );
        append_log(&conn, "pull", EKSEMPLAR_TAB, "error", 0, Some(&msg))?;
        return Err(AppError::Validation(msg));
    }

    let mut applied: i64 = 0;
    let mut skipped: i64 = 0;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    for cells in iter {
        if cells.iter().all(|c| c.is_empty()) {
            continue;
        }
        let row = EksemplarRow::from_cells(&cells);
        match upsert_eksemplar(&conn, &row) {
            Ok(true) => applied += 1,
            Ok(false) => skipped += 1,
            Err(e) => {
                append_log(&conn, "pull", EKSEMPLAR_TAB, "error", applied, Some(&format!("row {}: {e:?}", row.kode_eksemplar)))?;
            }
        }
    }
    let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let prev = state::get_state(&conn, EKSEMPLAR_TAB)?.unwrap_or(SyncStateRow {
        table_name: EKSEMPLAR_TAB.into(),
        last_push_at: None,
        last_pull_at: None,
        last_push_hash: None,
        last_pull_hash: None,
        rows_pushed: 0,
        rows_pulled: 0,
        updated_at: String::new(),
    });
    upsert_state(
        &conn,
        &SyncStateRow {
            last_pull_at: Some(now_iso.clone()),
            rows_pulled: applied,
            ..prev
        },
    )?;
    let msg = format!("pulled {applied} eksemplar (skip-newer-local: {skipped})");
    append_log(&conn, "pull", EKSEMPLAR_TAB, "ok", applied, Some(&msg))?;
    results.push(SyncRunResult {
        direction: "pull".into(),
        rows_changed: applied,
        status: "ok".into(),
        message: msg,
    });
    Ok(())
}

async fn pull_peminjaman(
    state: &State<'_, AppState>,
    client: &SheetsClient,
    sheets_id: &str,
    results: &mut Vec<SyncRunResult>,
) -> AppResult<()> {
    let range = format!("{PEMINJAMAN_TAB}!A1:Z");
    let raw = match client.get_values(sheets_id, &range).await {
        Ok(rows) => rows,
        Err(e) => {
            let conn = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
            append_log(&conn, "pull", PEMINJAMAN_TAB, "error", 0, Some(&format!("{e:?}")))?;
            return Err(e);
        }
    };

    if raw.is_empty() {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        append_log(&conn, "pull", PEMINJAMAN_TAB, "skipped", 0, Some("tab Peminjaman di Sheets kosong / belum ada"))?;
        results.push(SyncRunResult {
            direction: "pull".into(),
            rows_changed: 0,
            status: "skipped".into(),
            message: "tab Peminjaman di Sheets kosong / belum ada".into(),
        });
        return Ok(());
    }

    let mut iter = raw.into_iter();
    let header = iter.next().unwrap_or_default();
    if header.first().map(|s| s.as_str()) != Some("nomor_pinjam") {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Peminjaman tidak dikenal: kolom-1='{}' (harus 'nomor_pinjam')",
            header.first().cloned().unwrap_or_default()
        );
        append_log(&conn, "pull", PEMINJAMAN_TAB, "error", 0, Some(&msg))?;
        return Err(AppError::Validation(msg));
    }

    let mut applied: i64 = 0;
    let mut skipped: i64 = 0;
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    for cells in iter {
        if cells.iter().all(|c| c.is_empty()) {
            continue;
        }
        let row = PeminjamanRow::from_cells(&cells);
        match upsert_peminjaman(&conn, &row) {
            Ok(true) => applied += 1,
            Ok(false) => skipped += 1,
            Err(e) => {
                append_log(&conn, "pull", PEMINJAMAN_TAB, "error", applied, Some(&format!("row {}: {e:?}", row.nomor_pinjam)))?;
            }
        }
    }
    let now_iso = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let prev = state::get_state(&conn, PEMINJAMAN_TAB)?.unwrap_or(SyncStateRow {
        table_name: PEMINJAMAN_TAB.into(),
        last_push_at: None,
        last_pull_at: None,
        last_push_hash: None,
        last_pull_hash: None,
        rows_pushed: 0,
        rows_pulled: 0,
        updated_at: String::new(),
    });
    upsert_state(
        &conn,
        &SyncStateRow {
            last_pull_at: Some(now_iso.clone()),
            rows_pulled: applied,
            ..prev
        },
    )?;
    let msg = format!("pulled {applied} peminjaman (skip-newer-local: {skipped})");
    append_log(&conn, "pull", PEMINJAMAN_TAB, "ok", applied, Some(&msg))?;
    results.push(SyncRunResult {
        direction: "pull".into(),
        rows_changed: applied,
        status: "ok".into(),
        message: msg,
    });
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub configured: bool,
    pub enabled: bool,
    pub spreadsheet_id: String,
    pub service_account_email: String,
    pub states: Vec<SyncStateRow>,
    pub log: Vec<state::SyncLogEntry>,
}

/// Snapshot of the sync subsystem for the Sinkronisasi page header.
#[tauri::command]
pub fn sync_status(state: State<'_, AppState>) -> AppResult<SyncStatus> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let sa_raw = read_setting(&conn, KEY_SA_JSON)?.unwrap_or_default();
    let sheets_id = read_setting(&conn, KEY_SHEETS_ID)?.unwrap_or_default();
    let enabled = read_setting(&conn, KEY_ENABLED)?
        .map(|v| v == "1")
        .unwrap_or(false);
    let states = list_states(&conn)?;
    let log = list_log(&conn, 25)?;
    let configured = !sa_raw.trim().is_empty() && !sheets_id.trim().is_empty();
    let sa_email = if !sa_raw.trim().is_empty() {
        ServiceAccount::from_json(&sa_raw)
            .map(|sa| sa.client_email)
            .unwrap_or_default()
    } else {
        String::new()
    };
    Ok(SyncStatus {
        configured,
        enabled,
        spreadsheet_id: sheets_id,
        service_account_email: sa_email,
        states,
        log,
    })
}

/// Save (or clear) the Service Account JSON. Pass an empty string to clear.
/// We re-validate before persisting so a malformed paste produces a toast
/// instead of writing garbage to settings.
#[tauri::command]
pub fn sync_save_service_account(
    state: State<'_, AppState>,
    json: String,
) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
    let trimmed = json.trim();
    if trimmed.is_empty() {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, '')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![KEY_SA_JSON],
        )?;
        // Drop cached token if any
        let mut cache = TOKEN_CACHE
            .lock()
            .map_err(|_| AppError::Internal("token cache poisoned".into()))?;
        *cache = None;
        return Ok(());
    }
    let _sa = ServiceAccount::from_json(trimmed)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![KEY_SA_JSON, trimmed],
    )?;
    let mut cache = TOKEN_CACHE
        .lock()
        .map_err(|_| AppError::Internal("token cache poisoned".into()))?;
    *cache = None;
    Ok(())
}

/// Save a mobile QR code PNG to the exports folder.
/// The frontend generates the PNG data URL, strips the base64 prefix,
/// and sends the raw bytes here for disk persistence.
///
/// Returns the same `KtaExportResult`-style struct with filename + paths.
#[tauri::command]
pub fn sync_export_mobile_qr(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
) -> AppResult<MobileQrExportResult> {
    use std::fs;
    use tauri::Manager;

    if bytes.is_empty() {
        return Err(AppError::Validation("QR PNG kosong".into()));
    }

    // Reuse the same exports/ folder as KTA and label-buku
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("gagal resolve app_data_dir: {e}")))?;
    let dir = base.join("exports");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| {
            AppError::Internal(format!("gagal membuat folder exports: {e}"))
        })?;
    }

    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = format!("qr-perpustakaan-{stamp}.png");
    let dest = dir.join(&filename);

    fs::write(&dest, &bytes)
        .map_err(|e| AppError::Internal(format!("gagal menulis QR PNG: {e}")))?;

    Ok(MobileQrExportResult {
        filename,
        abs_path: dest.to_string_lossy().into_owned(),
        dir_abs_path: dir.to_string_lossy().into_owned(),
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileQrExportResult {
    pub filename: String,
    pub abs_path: String,
    pub dir_abs_path: String,
}

/// Generate the JSON payload for the mobile app QR code.
///
/// Returns a JSON string containing:
/// - `v`: format version (1)
/// - `lib`: library display name (from identity settings)
/// - `sid`: spreadsheet ID
/// - `sa`: full Service Account JSON
///
/// The mobile app scans this QR, parses the JSON, and uses it to connect
/// to the same Google Sheets spreadsheet without any manual configuration.
#[tauri::command]
pub fn sync_generate_mobile_qr(state: State<'_, AppState>) -> AppResult<String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;

    // Read spreadsheet ID
    let spreadsheet_id: String = conn
        .query_row(
            "SELECT COALESCE(value, '') FROM settings WHERE key = 'sync.spreadsheet_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();

    if spreadsheet_id.is_empty() {
        return Err(AppError::Validation(
            "ID Spreadsheet belum diisi. Isi dulu di Pengaturan → Sinkronisasi.".into(),
        ));
    }

    // Read SA JSON
    let sa_json: String = conn
        .query_row(
            "SELECT COALESCE(value, '') FROM settings WHERE key = ?1",
            rusqlite::params![KEY_SA_JSON],
            |row| row.get(0),
        )
        .unwrap_or_default();

    if sa_json.is_empty() {
        return Err(AppError::Validation(
            "Service Account JSON belum disimpan. Simpan dulu di Pengaturan → Sinkronisasi.".into(),
        ));
    }

    // Read library name from identity
    let lib_name: String = conn
        .query_row(
            "SELECT COALESCE(value, 'Perpustakaan') FROM settings WHERE key = 'identity.nama'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Perpustakaan".to_string());

    // Build QR payload
    let payload = serde_json::json!({
        "v": 1,
        "lib": lib_name,
        "sid": spreadsheet_id,
        "sa": sa_json
    });

    Ok(payload.to_string())
}
