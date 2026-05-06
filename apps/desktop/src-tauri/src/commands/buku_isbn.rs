//! FEAT-20 — Bulk import buku via ISBN.
//!
//! Fetches metadata from Open Library first, falls back to Google Books.
//! Both are public read-only APIs that do not require authentication.
//! The batch lookup is rate-limited to ~1 req/sec per upstream guidance.

use std::time::Duration;

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Metadata returned by an ISBN lookup. All fields are optional except `isbn`.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IsbnMetadata {
    pub isbn: String,
    pub judul: Option<String>,
    pub pengarang: Option<String>,
    pub penerbit: Option<String>,
    pub tahun_terbit: Option<i64>,
    pub kategori: Option<String>,
    pub bahasa: Option<String>,
    /// Optional cover image URL, downloadable separately.
    pub cover_url: Option<String>,
    /// Which upstream produced this record. Empty when not found.
    pub source: String,
}

/// Result for a single requested ISBN — either a populated metadata or `None`
/// when both upstreams returned nothing. `error` is set when the lookup itself
/// failed (network error, unparseable response, etc.).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IsbnLookupResult {
    pub isbn: String,
    pub metadata: Option<IsbnMetadata>,
    pub error: Option<String>,
}

/// HTTP client abstraction so tests can avoid real network calls.
pub trait IsbnHttpClient: Send + Sync {
    fn get_json(&self, url: &str) -> Result<serde_json::Value, String>;
}

/// Default ureq-backed client used by the Tauri command.
pub struct UreqClient {
    pub timeout: Duration,
}

impl UreqClient {
    pub fn new() -> Self {
        Self {
            timeout: Duration::from_secs(8),
        }
    }
}

impl Default for UreqClient {
    fn default() -> Self {
        Self::new()
    }
}

impl IsbnHttpClient for UreqClient {
    fn get_json(&self, url: &str) -> Result<serde_json::Value, String> {
        let agent = ureq::AgentBuilder::new()
            .timeout(self.timeout)
            .user_agent(concat!(
                "perpustakaan-offline/",
                env!("CARGO_PKG_VERSION"),
                " (alvi arts)"
            ))
            .build();
        let resp = agent.get(url).call().map_err(|e| e.to_string())?;
        resp.into_json::<serde_json::Value>().map_err(|e| e.to_string())
    }
}

/// Normalize an ISBN-10 or ISBN-13 by stripping spaces and dashes. Returns
/// `None` when the result is not 10 or 13 digits (with optional trailing `X`
/// for ISBN-10 check digit).
pub fn normalize_isbn(raw: &str) -> Option<String> {
    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    if cleaned.len() == 10 {
        let valid = cleaned.chars().enumerate().all(|(i, c)| {
            if i < 9 {
                c.is_ascii_digit()
            } else {
                c.is_ascii_digit() || c == 'X'
            }
        });
        if valid {
            return Some(cleaned);
        }
    } else if cleaned.len() == 13 && cleaned.chars().all(|c| c.is_ascii_digit()) {
        return Some(cleaned);
    }
    None
}

/// Try Open Library first, then Google Books. Returns `Ok(None)` when neither
/// upstream has a record. Returns `Err` when both upstreams errored.
pub fn lookup_one(client: &dyn IsbnHttpClient, isbn: &str) -> Result<Option<IsbnMetadata>, String> {
    let normalized = match normalize_isbn(isbn) {
        Some(v) => v,
        None => return Err(format!("ISBN tidak valid: {isbn}")),
    };

    // 1) Open Library
    let ol_url = format!(
        "https://openlibrary.org/api/books?bibkeys=ISBN:{normalized}&format=json&jscmd=data"
    );
    let ol_err = match client.get_json(&ol_url) {
        Ok(json) => match parse_open_library(&normalized, &json) {
            Some(meta) => return Ok(Some(meta)),
            None => None,
        },
        Err(e) => Some(e),
    };

    // 2) Google Books fallback
    let gb_url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{normalized}");
    let gb_err = match client.get_json(&gb_url) {
        Ok(json) => match parse_google_books(&normalized, &json) {
            Some(meta) => return Ok(Some(meta)),
            None => None,
        },
        Err(e) => Some(e),
    };

    // Both responded but neither had a record → not found.
    if ol_err.is_none() && gb_err.is_none() {
        return Ok(None);
    }
    // Both errored → propagate combined message.
    let mut messages = Vec::new();
    if let Some(e) = ol_err {
        messages.push(format!("OL: {e}"));
    }
    if let Some(e) = gb_err {
        messages.push(format!("GB: {e}"));
    }
    Err(messages.join("; "))
}

fn parse_open_library(isbn: &str, json: &serde_json::Value) -> Option<IsbnMetadata> {
    let key = format!("ISBN:{isbn}");
    let book = json.get(&key)?;
    let judul = book
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let pengarang = book
        .get("authors")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            let names: Vec<String> = arr
                .iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect();
            if names.is_empty() {
                None
            } else {
                Some(names.join(", "))
            }
        });
    let penerbit = book
        .get("publishers")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            let names: Vec<String> = arr
                .iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect();
            if names.is_empty() {
                None
            } else {
                Some(names.join(", "))
            }
        });
    let tahun_terbit = book
        .get("publish_date")
        .and_then(|v| v.as_str())
        .and_then(extract_year);
    let kategori = book
        .get("subjects")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.first()
                .and_then(|s| s.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
        });
    let cover_url = book
        .get("cover")
        .and_then(|c| c.get("medium").or_else(|| c.get("large")).or_else(|| c.get("small")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if judul.is_none() && pengarang.is_none() && penerbit.is_none() {
        return None;
    }
    Some(IsbnMetadata {
        isbn: isbn.to_string(),
        judul,
        pengarang,
        penerbit,
        tahun_terbit,
        kategori,
        bahasa: None,
        cover_url,
        source: "openlibrary".into(),
    })
}

fn parse_google_books(isbn: &str, json: &serde_json::Value) -> Option<IsbnMetadata> {
    let items = json.get("items")?.as_array()?;
    let first = items.first()?;
    let info = first.get("volumeInfo")?;
    let judul = info
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let pengarang = info
        .get("authors")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            let names: Vec<String> = arr
                .iter()
                .filter_map(|a| a.as_str().map(|s| s.to_string()))
                .collect();
            if names.is_empty() {
                None
            } else {
                Some(names.join(", "))
            }
        });
    let penerbit = info
        .get("publisher")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let tahun_terbit = info
        .get("publishedDate")
        .and_then(|v| v.as_str())
        .and_then(extract_year);
    let kategori = info
        .get("categories")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first().and_then(|s| s.as_str()).map(|s| s.to_string()));
    let bahasa = info
        .get("language")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let cover_url = info
        .get("imageLinks")
        .and_then(|c| c.get("thumbnail").or_else(|| c.get("smallThumbnail")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if judul.is_none() && pengarang.is_none() && penerbit.is_none() {
        return None;
    }
    Some(IsbnMetadata {
        isbn: isbn.to_string(),
        judul,
        pengarang,
        penerbit,
        tahun_terbit,
        kategori,
        bahasa,
        cover_url,
        source: "googlebooks".into(),
    })
}

fn extract_year(s: &str) -> Option<i64> {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).take(4).collect();
    if digits.len() < 4 {
        return None;
    }
    digits.parse::<i64>().ok().filter(|y| (1000..=2100).contains(y))
}

/// Tauri command: batch ISBN metadata lookup. Throttles ~1 req/sec to respect
/// Open Library rate limits.
#[tauri::command]
pub fn buku_isbn_lookup_batch(isbns: Vec<String>) -> AppResult<Vec<IsbnLookupResult>> {
    let client = UreqClient::new();
    let mut out = Vec::with_capacity(isbns.len());
    for (idx, isbn) in isbns.iter().enumerate() {
        if idx > 0 {
            // Throttle to be polite to OL.
            std::thread::sleep(Duration::from_millis(1000));
        }
        let result = match lookup_one(&client, isbn) {
            Ok(opt) => IsbnLookupResult {
                isbn: isbn.clone(),
                metadata: opt,
                error: None,
            },
            Err(e) => IsbnLookupResult {
                isbn: isbn.clone(),
                metadata: None,
                error: Some(e),
            },
        };
        out.push(result);
    }
    Ok(out)
}

/// Tauri command: download a cover URL into base64. Returned as `data:image/...;base64,...`
/// The frontend can persist it via the existing buku cover save path or attach it later.
#[tauri::command]
pub fn buku_isbn_fetch_cover(url: String) -> AppResult<String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!(
            "perpustakaan-offline/",
            env!("CARGO_PKG_VERSION"),
        ))
        .build();
    let resp = agent
        .get(&url)
        .call()
        .map_err(|e| AppError::Internal(format!("cover fetch: {e}")))?;
    let mime = resp
        .header("Content-Type")
        .unwrap_or("image/jpeg")
        .to_string();
    let mut buf: Vec<u8> = Vec::with_capacity(64 * 1024);
    use std::io::Read;
    resp.into_reader()
        .take(2 * 1024 * 1024) // 2 MiB cap
        .read_to_end(&mut buf)
        .map_err(|e| AppError::Internal(format!("cover read: {e}")))?;
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{mime};base64,{b64}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    struct MockClient {
        responses: Mutex<HashMap<String, Result<serde_json::Value, String>>>,
    }

    impl MockClient {
        fn new() -> Self {
            Self {
                responses: Mutex::new(HashMap::new()),
            }
        }
        fn with(self, url: &str, value: serde_json::Value) -> Self {
            self.responses.lock().unwrap().insert(url.into(), Ok(value));
            self
        }
        fn with_err(self, url: &str, err: &str) -> Self {
            self.responses
                .lock()
                .unwrap()
                .insert(url.into(), Err(err.into()));
            self
        }
    }

    impl IsbnHttpClient for MockClient {
        fn get_json(&self, url: &str) -> Result<serde_json::Value, String> {
            self.responses
                .lock()
                .unwrap()
                .get(url)
                .cloned()
                .unwrap_or_else(|| Err(format!("no mock for {url}")))
        }
    }

    #[test]
    fn normalize_isbn_strips_dashes_and_spaces() {
        assert_eq!(
            normalize_isbn("978-602-7888-71-2").as_deref(),
            Some("9786027888712")
        );
        assert_eq!(normalize_isbn("0 306 40615 2").as_deref(), Some("0306406152"));
        assert_eq!(normalize_isbn("020161622X").as_deref(), Some("020161622X"));
    }

    #[test]
    fn normalize_isbn_rejects_invalid() {
        assert_eq!(normalize_isbn("123"), None);
        assert_eq!(normalize_isbn("abc"), None);
        assert_eq!(normalize_isbn("978-FOO-BAR"), None);
    }

    #[test]
    fn extract_year_handles_various_formats() {
        assert_eq!(extract_year("1980"), Some(1980));
        assert_eq!(extract_year("1980-04-15"), Some(1980));
        assert_eq!(extract_year("April 1980"), Some(1980));
        assert_eq!(extract_year("April"), None);
        assert_eq!(extract_year("9999"), None);
    }

    #[test]
    fn lookup_one_uses_open_library_when_available() {
        let isbn = "9786027888712";
        let ol_url = format!(
            "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        );
        let ol_payload = serde_json::json!({
            format!("ISBN:{isbn}"): {
                "title": "Bumi Manusia",
                "authors": [{"name": "Pramoedya Ananta Toer"}],
                "publishers": [{"name": "Hasta Mitra"}],
                "publish_date": "1980",
                "subjects": [{"name": "Fiction"}],
                "cover": {"medium": "https://covers.openlibrary.org/b/id/123-M.jpg"}
            }
        });
        let client = MockClient::new().with(&ol_url, ol_payload);
        let result = lookup_one(&client, isbn).unwrap().unwrap();
        assert_eq!(result.judul.as_deref(), Some("Bumi Manusia"));
        assert_eq!(result.pengarang.as_deref(), Some("Pramoedya Ananta Toer"));
        assert_eq!(result.penerbit.as_deref(), Some("Hasta Mitra"));
        assert_eq!(result.tahun_terbit, Some(1980));
        assert_eq!(result.source, "openlibrary");
        assert!(result.cover_url.is_some());
    }

    #[test]
    fn lookup_one_falls_back_to_google_books() {
        let isbn = "9780321125217";
        let ol_url = format!(
            "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        );
        let gb_url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}");
        // OL responds with an empty object → not found.
        let ol_payload = serde_json::json!({});
        // GB returns a hit.
        let gb_payload = serde_json::json!({
            "items": [{
                "volumeInfo": {
                    "title": "Domain-Driven Design",
                    "authors": ["Eric Evans"],
                    "publisher": "Addison-Wesley",
                    "publishedDate": "2003-08-30",
                    "categories": ["Computers"],
                    "language": "en",
                    "imageLinks": {
                        "thumbnail": "https://example.com/cover.jpg"
                    }
                }
            }]
        });
        let client = MockClient::new()
            .with(&ol_url, ol_payload)
            .with(&gb_url, gb_payload);
        let result = lookup_one(&client, isbn).unwrap().unwrap();
        assert_eq!(result.judul.as_deref(), Some("Domain-Driven Design"));
        assert_eq!(result.pengarang.as_deref(), Some("Eric Evans"));
        assert_eq!(result.tahun_terbit, Some(2003));
        assert_eq!(result.source, "googlebooks");
    }

    #[test]
    fn lookup_one_returns_none_when_both_upstreams_empty() {
        let isbn = "9999999999999";
        let ol_url = format!(
            "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        );
        let gb_url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}");
        let client = MockClient::new()
            .with(&ol_url, serde_json::json!({}))
            .with(&gb_url, serde_json::json!({"items": []}));
        let result = lookup_one(&client, isbn).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn lookup_one_returns_err_when_both_upstreams_fail() {
        let isbn = "9786027888712";
        let ol_url = format!(
            "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
        );
        let gb_url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}");
        let client = MockClient::new()
            .with_err(&ol_url, "timeout")
            .with_err(&gb_url, "503");
        let result = lookup_one(&client, isbn);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("OL"));
        assert!(msg.contains("GB"));
    }

    #[test]
    fn lookup_one_rejects_invalid_isbn_without_calling_upstream() {
        let client = MockClient::new();
        let result = lookup_one(&client, "abc-not-an-isbn");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("ISBN tidak valid"));
    }
}
