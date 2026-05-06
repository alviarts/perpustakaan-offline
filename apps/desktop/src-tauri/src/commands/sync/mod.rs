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

fn require_settings(state: &State<'_, AppState>) -> AppResult<(ServiceAccount, String)> {
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

async fn build_client(sa: &ServiceAccount) -> AppResult<SheetsClient> {
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
    // eksemplar refers to buku via kode_buku FK lookup; peminjaman
    // refers to anggota via kode_anggota FK lookup. Pulling in this
    // order ensures the FK targets exist before dependent rows arrive.
    pull_anggota(&state, &client, &sheets_id, &mut results).await?;
    pull_buku(&state, &client, &sheets_id, &mut results).await?;
    pull_eksemplar(&state, &client, &sheets_id, &mut results).await?;
    pull_peminjaman(&state, &client, &sheets_id, &mut results).await?;
    Ok(results)
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

    // Skip header row (first row). Validate it has the expected first column.
    let mut iter = raw.into_iter();
    let header = iter.next().unwrap_or_default();
    if header.first().map(|s| s.as_str()) != Some("kode_anggota") {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Anggota tidak dikenal: kolom-1='{}' (harus 'kode_anggota')",
            header.first().cloned().unwrap_or_default()
        );
        append_log(&conn, "pull", ANGGOTA_TAB, "error", 0, Some(&msg))?;
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
        let row = AnggotaRow::from_cells(&cells);
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
    if header.first().map(|s| s.as_str()) != Some("kode_buku") {
        let conn = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db mutex poisoned".into()))?;
        let msg = format!(
            "header tab Buku tidak dikenal: kolom-1='{}' (harus 'kode_buku')",
            header.first().cloned().unwrap_or_default()
        );
        append_log(&conn, "pull", BUKU_TAB, "error", 0, Some(&msg))?;
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
        let row = BukuRow::from_cells(&cells);
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
