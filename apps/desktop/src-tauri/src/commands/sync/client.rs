//! Thin Google Sheets v4 REST wrapper for FEAT-26 Sheets sync (PR G v1.0.8).
//!
//! Why we hand-roll instead of pulling `google-sheets4`:
//!
//! * The official crate ships ~30 MB of generated bindings for every Sheets
//!   endpoint, almost all of which we don't touch. Build-time cost is
//!   significant and we'd never use 95 % of it.
//! * The two endpoints we actually need (`values.get`, `values.update`,
//!   `values.clear`, `spreadsheets.get`, `spreadsheets.batchUpdate`) are
//!   simple JSON over HTTPS — about 100 lines of code total.
//!
//! All methods are async (we drive them from Tauri commands which are
//! `async fn`). Error mapping is intentionally lossy: any non-2xx response
//! becomes `AppError::Validation` so the toast in `formatTauriError` shows
//! the raw Google error body to the admin.

use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

/// Public Google Sheets v4 base URL. Override-able via env var so integration
/// tests can point to a fake server (currently we keep all tests pure unit).
const SHEETS_API_BASE: &str = "https://sheets.googleapis.com/v4/spreadsheets";

#[derive(Debug, Deserialize)]
pub struct SpreadsheetMeta {
    #[allow(dead_code)]
    #[serde(rename = "spreadsheetId")]
    pub spreadsheet_id: String,
    pub properties: SpreadsheetProperties,
    pub sheets: Vec<SheetEntry>,
}

#[derive(Debug, Deserialize)]
pub struct SpreadsheetProperties {
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SheetEntry {
    pub properties: SheetEntryProperties,
}

#[derive(Debug, Deserialize)]
pub struct SheetEntryProperties {
    pub title: String,
    #[allow(dead_code)]
    #[serde(rename = "sheetId")]
    pub sheet_id: i64,
}

#[derive(Debug, Clone)]
pub struct SheetsClient {
    pub http: reqwest::Client,
    pub access_token: String,
}

impl SheetsClient {
    /// Fetch top-level spreadsheet metadata (title + list of tabs). Used by
    /// the "Test Connection" button and by push-init to decide whether the
    /// per-table tab already exists.
    pub async fn get_spreadsheet(&self, spreadsheet_id: &str) -> AppResult<SpreadsheetMeta> {
        let url = format!("{SHEETS_API_BASE}/{spreadsheet_id}?fields=spreadsheetId,properties.title,sheets.properties");
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("sheets.get http error: {e}")))?;
        check_status(resp).await?.json().await.map_err(|e| {
            AppError::Internal(format!("sheets.get response not parsable: {e}"))
        })
    }

    /// Fetch all values from a tab as a 2D vector of strings (Google returns
    /// strings even for numeric cells when `valueRenderOption=FORMATTED_VALUE`,
    /// which is what we want — we never lose precision because all our
    /// columns are typed strings/ints/booleans encoded as text already).
    ///
    /// Empty tabs return `Ok(vec![])` rather than an error so the caller can
    /// just iterate.
    pub async fn get_values(
        &self,
        spreadsheet_id: &str,
        range: &str,
    ) -> AppResult<Vec<Vec<String>>> {
        let encoded = urlencode(range);
        let url = format!(
            "{SHEETS_API_BASE}/{spreadsheet_id}/values/{encoded}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING"
        );
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&self.access_token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("values.get http error: {e}")))?;
        let body: Value = check_status(resp).await?.json().await.map_err(|e| {
            AppError::Internal(format!("values.get response not parsable: {e}"))
        })?;
        let rows = body
            .get("values")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        Ok(rows
            .into_iter()
            .map(|row| {
                row.as_array()
                    .map(|cells| {
                        cells
                            .iter()
                            .map(|c| match c {
                                Value::String(s) => s.clone(),
                                Value::Null => String::new(),
                                other => other.to_string(),
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default()
            })
            .collect())
    }

    /// Clear all values in a range. We use this before pushing so the
    /// destination tab is always exactly what we intend (no stale rows).
    pub async fn clear_values(&self, spreadsheet_id: &str, range: &str) -> AppResult<()> {
        let encoded = urlencode(range);
        let url = format!("{SHEETS_API_BASE}/{spreadsheet_id}/values/{encoded}:clear");
        let resp = self
            .http
            .post(&url)
            .bearer_auth(&self.access_token)
            .json(&json!({}))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("values.clear http error: {e}")))?;
        check_status(resp).await?;
        Ok(())
    }

    /// Overwrite a range with the given 2D values, in `RAW` mode so Google
    /// doesn't try to interpret strings as dates/numbers/formulas.
    pub async fn update_values(
        &self,
        spreadsheet_id: &str,
        range: &str,
        values: &[Vec<String>],
    ) -> AppResult<()> {
        let encoded = urlencode(range);
        let url = format!(
            "{SHEETS_API_BASE}/{spreadsheet_id}/values/{encoded}?valueInputOption=RAW"
        );
        let payload = json!({
            "range": range,
            "majorDimension": "ROWS",
            "values": values,
        });
        let resp = self
            .http
            .put(&url)
            .bearer_auth(&self.access_token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("values.update http error: {e}")))?;
        check_status(resp).await?;
        Ok(())
    }

    /// Create a new sheet tab named `tab_name`. Idempotent — if the tab
    /// already exists, returns `Ok(())` and lets the caller continue.
    pub async fn ensure_tab(&self, spreadsheet_id: &str, tab_name: &str) -> AppResult<()> {
        let meta = self.get_spreadsheet(spreadsheet_id).await?;
        if meta.sheets.iter().any(|s| s.properties.title == tab_name) {
            return Ok(());
        }
        let url = format!("{SHEETS_API_BASE}/{spreadsheet_id}:batchUpdate");
        let payload = json!({
            "requests": [{
                "addSheet": {
                    "properties": { "title": tab_name },
                }
            }]
        });
        let resp = self
            .http
            .post(&url)
            .bearer_auth(&self.access_token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("batchUpdate http error: {e}")))?;
        check_status(resp).await?;
        Ok(())
    }
}

/// Check the response status. On 2xx returns the response. On non-2xx maps
/// to `AppError::Validation` with the raw body so the operator can see the
/// Google error reason verbatim (usually "PERMISSION_DENIED: The caller does
/// not have permission" — meaning the SA email isn't shared on the sheet).
async fn check_status(resp: reqwest::Response) -> AppResult<reqwest::Response> {
    if resp.status().is_success() {
        return Ok(resp);
    }
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    let snippet: String = body.chars().take(500).collect();
    Err(AppError::Validation(format!(
        "Google Sheets API ({status}): {snippet}"
    )))
}

/// Minimal URL-percent-encoding for sheet ranges like `Anggota!A1:Z`.
/// `reqwest` doesn't auto-encode the path component; ranges contain `!`
/// which is technically reserved.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'~'
            | b'/' => out.push(*b as char),
            other => out.push_str(&format!("%{other:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencode_passes_through_safe_chars() {
        assert_eq!(urlencode("anggota"), "anggota");
        assert_eq!(urlencode("anggota_v2"), "anggota_v2");
        assert_eq!(urlencode("A1:Z"), "A1%3AZ");
    }

    #[test]
    fn urlencode_encodes_bang_in_range() {
        assert_eq!(urlencode("Anggota!A1:Z"), "Anggota%21A1%3AZ");
    }

    #[test]
    fn urlencode_encodes_spaces() {
        assert_eq!(urlencode("My Sheet!A1"), "My%20Sheet%21A1");
    }
}
