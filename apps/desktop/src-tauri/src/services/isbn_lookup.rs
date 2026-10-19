//! ISBN book lookup — parallel multi-source engine (all keyless).
//!
//! Adapted from the `scrape-demo` research (see `docs/ISBN_SCANNER.md`).
//! A single ISBN is queried against ~15 sources concurrently and the
//! candidates are merged by a small quality score that favours authoritative
//! catalogues (Perpusnas, Open Library, Google Books) while filling gaps
//! (author, publisher, description, cover) from the runners-up.
//!
//! Deliberately excluded: Gramedia's catalogue, Shopee, isbnsearch and
//! opac.perpusnas — all are JS SPAs behind Cloudflare/bot walls that plain
//! HTTP cannot read (proven in the research). Tokopedia is only reachable via
//! the `r.jina.ai` reader proxy and is far too slow for an interactive scan.

use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMetadata {
    pub isbn: String,
    pub title: String,
    pub authors: Vec<String>,
    pub publisher: Option<String>,
    pub published_date: Option<String>,
    pub description: Option<String>,
    pub page_count: Option<i32>,
    pub categories: Vec<String>,
    pub language: Option<String>,
    pub cover_url: Option<String>,
    pub source: String,
    /// Marketplace price, when a bookstore source answered (informational).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    /// Canonical page the record was read from, when applicable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
}

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                  (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAILTO: &str = "perpustakaan-nusantara@example.com";

type Source = fn(&str) -> Option<BookMetadata>;

/// Look up book metadata by ISBN. Runs every source in parallel, merges the
/// best-scoring candidate with fields from the rest, and returns it. Only
/// returns `Err(NotFound)` when *no* source produced a usable title.
pub fn lookup_isbn(isbn: &str) -> Result<BookMetadata, AppError> {
    let isbn = clean_isbn(isbn);
    if isbn.is_empty() {
        return Err(AppError::Validation("ISBN kosong".to_string()));
    }

    let sources: &[(&str, Source)] = &[
        ("perpusnas", lookup_perpusnas),
        ("google_books", lookup_google_books),
        ("open_library", lookup_open_library),
        ("onesearch", lookup_onesearch),
        ("crossref", lookup_crossref),
        ("archive_org", lookup_archive_org),
        ("libris", lookup_libris),
        ("k10plus", lookup_k10plus),
        ("ndl", lookup_ndl),
        ("periplus", lookup_periplus),
        ("belbuk", lookup_belbuk),
        ("deepublish", lookup_deepublish),
        ("abebooks", lookup_abebooks),
        ("inventaire", lookup_inventaire),
        ("google_books_html", lookup_google_books_html),
    ];

    let mut results: Vec<BookMetadata> = Vec::new();
    let isbn_ref: &str = isbn.as_str();
    std::thread::scope(|scope| {
        let handles: Vec<_> = sources
            .iter()
            .map(|(_, f)| {
                let f: Source = *f;
                scope.spawn(move || f(isbn_ref))
            })
            .collect();
        for handle in handles {
            if let Ok(Some(meta)) = handle.join() {
                results.push(meta);
            }
        }
    });

    merge(&isbn, results)
}

// ---------------------------------------------------------------------------
// Networking helpers (blocking, keyless)
// ---------------------------------------------------------------------------

fn http_get(url: &str, secs: u64) -> Option<String> {
    let resp = ureq::get(url)
        .set("User-Agent", UA)
        .set("Accept-Language", "id-ID,id;q=0.9,en;q=0.8")
        .set(
            "Accept",
            "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        )
        .timeout(Duration::from_secs(secs))
        .call()
        .ok()?;
    resp.into_string().ok()
}

fn http_json(url: &str, secs: u64) -> Option<Value> {
    let resp = ureq::get(url)
        .set("User-Agent", UA)
        .set("Accept", "application/json")
        .timeout(Duration::from_secs(secs))
        .call()
        .ok()?;
    resp.into_json::<Value>().ok()
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

fn clean_isbn(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_digit() || *c == 'X' || *c == 'x')
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn squeeze(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_tags(s: &str) -> String {
    match Regex::new(r"<[^>]+>") {
        Ok(re) => re.replace_all(s, " ").to_string(),
        Err(_) => s.to_string(),
    }
}

fn unescape_html(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

/// A `serde_json` value that may be a string or an array of strings → first.
fn jfirst(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => non_empty(squeeze(s)),
        Value::Array(items) => items.iter().find_map(|x| x.as_str()).and_then(|s| non_empty(squeeze(s))),
        _ => None,
    }
}

/// `value[key]` as a trimmed, non-empty string.
fn jstr(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).and_then(|s| non_empty(squeeze(s)))
}

fn non_empty(s: String) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

fn doc_title(html: &str) -> Option<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("title").ok()?;
    doc.select(&sel)
        .next()
        .map(|e| squeeze(&unescape_html(&e.text().collect::<String>())))
        .and_then(non_empty)
}

fn meta_content(html: &str, key: &str) -> Option<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("meta").ok()?;
    for el in doc.select(&sel) {
        let v = el.value();
        let hit = v
            .attr("property")
            .map(|p| p.eq_ignore_ascii_case(key))
            .unwrap_or(false)
            || v
                .attr("name")
                .map(|n| n.eq_ignore_ascii_case(key))
                .unwrap_or(false);
        if hit {
            if let Some(content) = v.attr("content") {
                if let Some(c) = non_empty(squeeze(&unescape_html(content))) {
                    return Some(c);
                }
            }
        }
    }
    None
}

fn xml_tag(xml: &str, tag: &str) -> Option<String> {
    let re = Regex::new(&format!(r"(?s)<{tag}[^>]*>(.*?)</{tag}>")).ok()?;
    let raw = re.captures(xml)?.get(1)?.as_str();
    non_empty(squeeze(&unescape_html(&strip_tags(raw))))
}

fn rss_titles(body: &str) -> Vec<String> {
    let Ok(re) = Regex::new(r"(?s)<item>.*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>") else {
        return Vec::new();
    };
    re.captures_iter(body)
        .filter_map(|c| c.get(1))
        .map(|m| squeeze(&unescape_html(m.as_str())))
        .filter(|s| !s.is_empty())
        .collect()
}

// ---------------------------------------------------------------------------
// Metadata scaffolding
// ---------------------------------------------------------------------------

/// Format an integer with Indonesian thousand separators (`1234567` → `1.234.567`).
fn thousands(n: i64) -> String {
    let digits = n.abs().to_string();
    let len = digits.len();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    if n < 0 {
        format!("-{out}")
    } else {
        out
    }
}

fn blank(isbn: &str, source: &str) -> BookMetadata {    BookMetadata {
        isbn: isbn.to_string(),
        title: String::new(),
        authors: Vec::new(),
        publisher: None,
        published_date: None,
        description: None,
        page_count: None,
        categories: Vec::new(),
        language: None,
        cover_url: None,
        source: source.to_string(),
        price: None,
        source_url: None,
    }
}

fn is_usable(m: &BookMetadata) -> bool {
    let t = m.title.trim();
    t.len() > 1 && !t.eq_ignore_ascii_case("unknown title")
}

fn score(m: &BookMetadata) -> i32 {
    let mut s = 0;
    if is_usable(m) {
        s += 10;
    }
    if !m.authors.is_empty() {
        s += 4;
    }
    if m.publisher.is_some() {
        s += 4;
    }
    if m.description.is_some() {
        s += 3;
    }
    if m.published_date.is_some() {
        s += 2;
    }
    if m.cover_url.is_some() {
        s += 2;
    }
    if m.page_count.is_some() {
        s += 1;
    }
    if !m.categories.is_empty() {
        s += 1;
    }
    s + match m.source.as_str() {
        "perpusnas" => 4,
        "open_library" | "google_books" => 3,
        "openalex" | "crossref" | "archive_org" | "libris" | "k10plus" | "ndl" => 2,
        "periplus" | "belbuk" | "deepublish" | "abebooks" | "inventaire" | "google_books_html" => 1,
        _ => 0,
    }
}

fn merge(isbn: &str, mut results: Vec<BookMetadata>) -> Result<BookMetadata, AppError> {
    results.retain(is_usable);
    if results.is_empty() {
        return Err(AppError::NotFound(format!(
            "Buku tidak ditemukan untuk ISBN: {isbn}"
        )));
    }

    results.sort_by_key(|m| std::cmp::Reverse(score(m)));
    let mut best = results.remove(0);

    for r in &results {
        if best.authors.is_empty() {
            best.authors = r.authors.clone();
        }
        if best.publisher.is_none() {
            best.publisher = r.publisher.clone();
        }
        if best.published_date.is_none() {
            best.published_date = r.published_date.clone();
        }
        if best.description.is_none() {
            best.description = r.description.clone();
        }
        if best.cover_url.is_none() {
            best.cover_url = r.cover_url.clone();
        }
        if best.page_count.is_none() {
            best.page_count = r.page_count;
        }
        if best.categories.is_empty() {
            best.categories = r.categories.clone();
        }
        if best.language.is_none() {
            best.language = r.language.clone();
        }
        if best.price.is_none() {
            best.price = r.price.clone();
        }
        if best.source_url.is_none() {
            best.source_url = r.source_url.clone();
        }
    }

    if best.cover_url.is_none() {
        best.cover_url = Some(format!(
            "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
        ));
    }

    Ok(best)
}

// ---------------------------------------------------------------------------
// Sources — authoritative catalogues
// ---------------------------------------------------------------------------

/// Perpusnas — the Indonesian ISBN registry (authoritative for local books).
fn lookup_perpusnas(isbn: &str) -> Option<BookMetadata> {
    let url = format!(
        "https://isbn.perpusnas.go.id/landing_page/serverside_search2?draw=1&start=0&length=6&search={isbn}&filter_by=&jenis_media=&by_penerbit=&by_kota="
    );
    let v = http_json(&url, 12)?;
    let rows = v.get("data")?.as_array()?;
    if rows.is_empty() {
        return None;
    }

    let bare = clean_isbn(isbn);
    let pick = rows
        .iter()
        .find(|r| {
            let code = r.get("code").and_then(|x| x.as_str()).unwrap_or("");
            let row_isbn = r.get("isbn").and_then(|x| x.as_str()).unwrap_or("");
            clean_isbn(code) == bare || clean_isbn(row_isbn) == bare
        })
        .or_else(|| rows.first())?;

    let title = jstr(pick, "title")?;
    let mut m = blank(isbn, "perpusnas");
    m.title = title;
    m.publisher = jstr(pick, "nama_penerbit");
    m.published_date = jstr(pick, "tahun_terbit");
    // `kepeng` packs author + translator/role notes; keep it verbatim.
    if let Some(a) = jstr(pick, "kepeng").or_else(|| jstr(pick, "pengarang")) {
        m.authors = vec![a];
    }
    m.page_count = pick
        .get("jml_hlm")
        .and_then(|x| x.as_str())
        .and_then(|s| s.trim().parse::<i32>().ok());
    if let Some(kind) = jstr(pick, "jenis_pustaka") {
        m.categories = vec![kind];
    }
    m.language = Some("id".to_string());
    Some(m)
}

/// Google Books JSON API. Set `GOOGLE_BOOKS_API_KEY` for a higher daily quota.
fn lookup_google_books(isbn: &str) -> Option<BookMetadata> {
    let url = match std::env::var("GOOGLE_BOOKS_API_KEY").ok() {
        Some(key) => format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}&key={key}"),
        None => format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"),
    };
    let v = http_json(&url, 10)?;
    let item = v.get("items")?.as_array()?.first()?;
    let vi = item.get("volumeInfo")?;

    let mut m = blank(isbn, "google_books");
    m.title = jstr(vi, "title")?;
    m.authors = vi
        .get("authors")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
    m.publisher = jstr(vi, "publisher");
    m.published_date = jstr(vi, "publishedDate");
    m.description = jstr(vi, "description");
    m.page_count = vi.get("pageCount").and_then(Value::as_i64).map(|n| n as i32);
    m.categories = vi
        .get("categories")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
        .unwrap_or_default();
    m.language = jstr(vi, "language");
    m.cover_url = vi
        .get("imageLinks")
        .and_then(|l| jstr(l, "thumbnail").or_else(|| jstr(l, "smallThumbnail")))
        .map(|u| u.replace("http://", "https://").replace("&edge=curl", ""));
    Some(m)
}

/// Open Library — global catalogue, always returns a cover URL guess.
fn lookup_open_library(isbn: &str) -> Option<BookMetadata> {
    let url = format!(
        "https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    );
    let v = http_json(&url, 10)?;
    let book = v.get(format!("ISBN:{isbn}"))?;

    let mut m = blank(isbn, "open_library");
    m.title = jstr(book, "title")?;
    m.authors = book
        .get("authors")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().filter_map(|x| jstr(x, "name")).collect())
        .unwrap_or_default();
    m.publisher = book
        .get("publishers")
        .and_then(|a| a.as_array())
        .and_then(|a| a.first())
        .and_then(|p| jstr(p, "name"));
    m.published_date = jstr(book, "publish_date");
    m.description = jstr(book, "notes");
    m.page_count = book
        .get("number_of_pages")
        .and_then(Value::as_i64)
        .map(|n| n as i32);
    m.categories = book
        .get("subjects")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().filter_map(|x| jstr(x, "name")).collect())
        .unwrap_or_default();
    m.cover_url = book
        .get("cover")
        .and_then(|c| jstr(c, "large").or_else(|| jstr(c, "medium")).or_else(|| jstr(c, "small")))
        .or_else(|| Some(format!("https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg")));
    Some(m)
}

/// Onesearch.id — Indonesian library aggregator (RSS view, easy to parse).
fn lookup_onesearch(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://onesearch.id/Search/Results?lookfor={isbn}&view=rss");
    let body = http_get(&url, 12)?;
    let first = rss_titles(&body).into_iter().next()?;

    let mut m = blank(isbn, "onesearch");
    match first.split_once(" / ") {
        Some((title, author)) => {
            m.title = title.trim().to_string();
            if !author.trim().is_empty() {
                m.authors = vec![author.trim().to_string()];
            }
        }
        None => m.title = first.trim().to_string(),
    }
    if m.title.is_empty() {
        return None;
    }
    m.language = Some("id".to_string());
    Some(m)
}

// ---------------------------------------------------------------------------
// Sources — bibliographic / academic
// ---------------------------------------------------------------------------

fn lookup_crossref(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://api.crossref.org/works?filter=isbn:{isbn}&rows=1&mailto={MAILTO}");
    let v = http_json(&url, 12)?;
    let item = v.get("message")?.get("items")?.as_array()?.first()?;

    let mut m = blank(isbn, "crossref");
    m.title = squeeze(&strip_tags(&item.get("title").and_then(jfirst)?));
    m.authors = item
        .get("author")
        .and_then(|a| a.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| {
                    let given = x.get("given").and_then(|g| g.as_str()).unwrap_or("");
                    let family = x.get("family").and_then(|f| f.as_str()).unwrap_or("");
                    let name = format!("{given} {family}").trim().to_string();
                    if name.is_empty() {
                        None
                    } else {
                        Some(name)
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    m.publisher = jstr(item, "publisher");
    m.published_date = item
        .get("issued")
        .and_then(|i| i.get("date-parts"))
        .and_then(|d| d.get(0))
        .and_then(|y| y.get(0))
        .and_then(Value::as_i64)
        .map(|y| y.to_string());
    Some(m)
}

fn lookup_archive_org(isbn: &str) -> Option<BookMetadata> {
    let url = format!(
        "https://archive.org/advancedsearch.php?q=isbn%3A{isbn}&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=publisher&fl%5B%5D=year&rows=3&output=json"
    );
    let v = http_json(&url, 12)?;
    let doc = v.get("response")?.get("docs")?.as_array()?.first()?;

    let mut m = blank(isbn, "archive_org");
    m.title = doc.get("title").and_then(jfirst)?;
    if let Some(c) = doc.get("creator").and_then(jfirst) {
        m.authors = vec![c];
    }
    m.publisher = doc.get("publisher").and_then(jfirst);
    m.published_date = doc.get("year").and_then(jfirst);
    Some(m)
}

fn lookup_libris(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://libris.kb.se/xsearch?query=isbn:{isbn}&format=json&n=1");
    let v = http_json(&url, 12)?;
    let item = v.get("xsearch")?.get("list")?.as_array()?.first()?;

    let mut m = blank(isbn, "libris");
    m.title = squeeze(&strip_tags(&jstr(item, "title")?));
    if let Some(c) = jstr(item, "creator") {
        m.authors = vec![c];
    }
    m.publisher = jstr(item, "publisher");
    m.published_date = jstr(item, "date");
    Some(m)
}

fn lookup_k10plus(isbn: &str) -> Option<BookMetadata> {
    let url = format!(
        "https://sru.k10plus.de/opac-de-627?version=1.1&operation=searchRetrieve&query=pica.isb%3D{isbn}&maximumRecords=1&recordSchema=dc"
    );
    let body = http_get(&url, 12)?;

    let re = Regex::new(r"numberOfRecords[^>]*>(\d+)").ok()?;
    if re.captures(&body)?.get(1)?.as_str() == "0" {
        return None;
    }

    let mut m = blank(isbn, "k10plus");
    m.title = xml_tag(&body, "dc:title")?;
    if let Some(c) = xml_tag(&body, "dc:creator") {
        m.authors = vec![c];
    }
    m.publisher = xml_tag(&body, "dc:publisher");
    m.published_date = xml_tag(&body, "dc:date");
    Some(m)
}

fn lookup_ndl(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://ndlsearch.ndl.go.jp/api/opensearch?isbn={isbn}");
    let body = http_get(&url, 12)?;
    let title = rss_titles(&body).into_iter().next()?;

    let mut m = blank(isbn, "ndl");
    m.title = title;
    m.language = Some("ja".to_string());
    Some(m)
}

fn lookup_inventaire(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://inventaire.io/api/entities?action=by-uris&uris=isbn:{isbn}");
    let v = http_json(&url, 12)?;
    let entity = v.get("entities")?.as_object()?.values().next()?;

    let mut m = blank(isbn, "inventaire");
    m.title = jstr(entity, "label")?;
    m.source_url = Some(url);
    Some(m)
}

// ---------------------------------------------------------------------------
// Sources — bookstores (Indonesian + second-hand)
// ---------------------------------------------------------------------------

fn lookup_periplus(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://www.periplus.com/p/{isbn}");
    let body = http_get(&url, 14)?;

    let mut m = blank(isbn, "periplus");
    m.title = meta_content(&body, "og:title").or_else(|| doc_title(&body))?;
    if let Some(price) = meta_content(&body, "product:price:amount") {
        if let Ok(amount) = price.parse::<f64>() {
            m.price = Some(format!("Rp {}", thousands(amount.round() as i64)));
        }
    }
    m.source_url = Some(url);
    Some(m)
}

fn lookup_belbuk(isbn: &str) -> Option<BookMetadata> {
    let search = format!("https://www.belbuk.com/hasil_pencarian.php?q={isbn}");
    let body = http_get(&search, 12)?;
    let re = Regex::new(r#"href="(https://www\.belbuk\.com/[^"]*/produk/\d+)""#).ok()?;
    let product_url = re.captures(&body)?.get(1)?.as_str().to_string();

    let page = http_get(&product_url, 12)?;
    // Guard against fuzzy search hits: the ISBN must appear on the page.
    if !clean_isbn(&page).contains(&clean_isbn(isbn)) {
        return None;
    }

    let mut m = blank(isbn, "belbuk");
    m.title = meta_content(&page, "og:title").or_else(|| doc_title(&page))?;
    m.source_url = Some(product_url);
    m.language = Some("id".to_string());
    Some(m)
}

fn lookup_deepublish(isbn: &str) -> Option<BookMetadata> {
    let url = format!(
        "https://deepublishstore.com/wp-json/wc/store/v1/products?search={isbn}&per_page=3"
    );
    let v = http_json(&url, 12)?;
    let product = v.as_array()?.first()?;
    let permalink = jstr(product, "permalink");

    // Woo's `search` is fuzzy — confirm the ISBN on the product page.
    if let Some(link) = permalink.as_deref() {
        let page = http_get(link, 12)?;
        if !clean_isbn(&page).contains(&clean_isbn(isbn)) {
            return None;
        }
    }

    let mut m = blank(isbn, "deepublish");
    m.title = jstr(product, "name")?;
    // Woo Store returns IDR amounts without decimals.
    if let Some(amount) = product
        .get("prices")
        .and_then(|p| p.get("price"))
        .and_then(|x| x.as_str())
    {
        if let Ok(v) = amount.parse::<f64>() {
            m.price = Some(format!("Rp {}", thousands(v.round() as i64)));
        }
    }
    m.source_url = permalink;
    m.language = Some("id".to_string());
    Some(m)
}

fn lookup_abebooks(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://www.abebooks.com/products/isbn/{isbn}");
    let body = http_get(&url, 12)?;
    let title = meta_content(&body, "og:title").or_else(|| doc_title(&body))?;

    // "no result" pages are titled just "<isbn> – AbeBooks".
    if Regex::new(r"(?i)^\s*[\d\-X]+\s*[–-]\s*AbeBooks")
        .ok()?
        .is_match(&title)
    {
        return None;
    }

    let mut m = blank(isbn, "abebooks");
    m.title = title;
    m.source_url = Some(url);
    Some(m)
}

/// Google Books HTML fallback — survives when the JSON API hits its quota.
fn lookup_google_books_html(isbn: &str) -> Option<BookMetadata> {
    let url = format!("https://books.google.com/books?vid=ISBN{isbn}");
    let body = http_get(&url, 10)?;
    let raw = doc_title(&body)?;

    let title = Regex::new(r"(?i)\s*-\s*Google (Buku|Books)\s*$")
        .ok()?
        .replace(&raw, "")
        .trim()
        .to_string();
    if title.is_empty() || title == isbn {
        return None;
    }

    let mut m = blank(isbn, "google_books_html");
    m.title = title;
    Some(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_isbn_strips_noise() {
        assert_eq!(clean_isbn("978-602-063-317-6"), "9786020633176");
        assert_eq!(clean_isbn(" 0306406152 "), "0306406152");
    }

    #[test]
    fn merge_prefers_richer_record_and_fills_gaps() {
        let mut rich = blank("9780000000000", "google_books");
        rich.title = "Rich Title".into();
        rich.authors = vec!["Author".into()];
        rich.publisher = Some("Pub".into());

        let mut thin = blank("9780000000000", "abebooks");
        thin.title = "Thin Title".into();
        thin.description = Some("A description".into());

        let merged = merge("9780000000000", vec![thin, rich]).expect("merged");
        assert_eq!(merged.source, "google_books");
        assert_eq!(merged.title, "Rich Title");
        assert_eq!(merged.description.as_deref(), Some("A description"));
    }

    #[test]
    fn merge_rejects_unusable_only() {
        let mut junk = blank("9780000000000", "abebooks");
        junk.title = "Unknown Title".into();
        assert!(merge("9780000000000", vec![junk]).is_err());
    }

    #[test]
    #[ignore] // Requires internet connection
    fn test_lookup_indonesian_book() {
        let result = lookup_isbn("9786020633176").expect("found");
        assert!(!result.title.is_empty());
        println!(
            "Found: {} by {:?} (source: {})",
            result.title, result.authors, result.source
        );
    }

    #[test]
    #[ignore] // Requires internet connection
    fn test_lookup_cascade() {
        let result = lookup_isbn("9780306406157").expect("found");
        assert!(!result.title.is_empty());
    }
}
