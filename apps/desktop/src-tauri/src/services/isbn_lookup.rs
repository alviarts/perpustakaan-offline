/// ISBN book lookup service with cascade fallback:
/// 1. Google Books API
/// 2. Open Library API
/// 3. Gramedia scraping (for Indonesian books)
use serde::{Deserialize, Serialize};
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
    pub source: String, // "google_books", "open_library", "gramedia"
}

/// Lookup book metadata by ISBN with cascade fallback
pub fn lookup_isbn(isbn: &str) -> Result<BookMetadata, AppError> {
    // Try Google Books first
    if let Ok(metadata) = lookup_google_books(isbn) {
        return Ok(metadata);
    }

    // Fallback to Open Library
    if let Ok(metadata) = lookup_open_library(isbn) {
        return Ok(metadata);
    }

    // Fallback to Gramedia scraping
    if let Ok(metadata) = lookup_gramedia(isbn) {
        return Ok(metadata);
    }

    Err(AppError::NotFound(format!("Book not found for ISBN: {}", isbn)))
}

/// Google Books API lookup
fn lookup_google_books(isbn: &str) -> Result<BookMetadata, AppError> {
    let url = format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{}", isbn);
    
    let response: serde_json::Value = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(|e| AppError::Internal(format!("Google Books API error: {}", e)))?
        .into_json()
        .map_err(|e| AppError::Internal(format!("Failed to parse Google Books response: {}", e)))?;

    let items = response["items"]
        .as_array()
        .ok_or_else(|| AppError::NotFound("No results from Google Books".to_string()))?;

    if items.is_empty() {
        return Err(AppError::NotFound("No results from Google Books".to_string()));
    }

    let volume_info = &items[0]["volumeInfo"];

    let authors = volume_info["authors"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let categories = volume_info["categories"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let cover_url = volume_info["imageLinks"]["thumbnail"]
        .as_str()
        .or_else(|| volume_info["imageLinks"]["smallThumbnail"].as_str())
        .map(|url| url.replace("http://", "https://")) // Force HTTPS
        .map(|url| url.replace("&edge=curl", "")); // Remove curl effect

    Ok(BookMetadata {
        isbn: isbn.to_string(),
        title: volume_info["title"]
            .as_str()
            .unwrap_or("Unknown Title")
            .to_string(),
        authors,
        publisher: volume_info["publisher"].as_str().map(String::from),
        published_date: volume_info["publishedDate"].as_str().map(String::from),
        description: volume_info["description"].as_str().map(String::from),
        page_count: volume_info["pageCount"].as_i64().map(|n| n as i32),
        categories,
        language: volume_info["language"].as_str().map(String::from),
        cover_url,
        source: "google_books".to_string(),
    })
}

/// Open Library API lookup
fn lookup_open_library(isbn: &str) -> Result<BookMetadata, AppError> {
    let url = format!("https://openlibrary.org/api/books?bibkeys=ISBN:{}&format=json&jscmd=data", isbn);
    
    let response: serde_json::Value = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(|e| AppError::Internal(format!("Open Library API error: {}", e)))?
        .into_json()
        .map_err(|e| AppError::Internal(format!("Failed to parse Open Library response: {}", e)))?;

    let book_key = format!("ISBN:{}", isbn);
    let book_data = response[&book_key]
        .as_object()
        .ok_or_else(|| AppError::NotFound("No results from Open Library".to_string()))?;

    let authors = book_data["authors"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let publishers = book_data["publishers"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|v| v["name"].as_str())
        .map(String::from);

    let categories = book_data["subjects"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    // Open Library cover URL
    let cover_url = book_data["cover"]
        .get("large")
        .or_else(|| book_data["cover"].get("medium"))
        .or_else(|| book_data["cover"].get("small"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| Some(format!("https://covers.openlibrary.org/b/isbn/{}-L.jpg", isbn)));

    Ok(BookMetadata {
        isbn: isbn.to_string(),
        title: book_data["title"]
            .as_str()
            .unwrap_or("Unknown Title")
            .to_string(),
        authors,
        publisher: publishers,
        published_date: book_data["publish_date"].as_str().map(String::from),
        description: book_data["notes"].as_str().map(String::from),
        page_count: book_data["number_of_pages"].as_i64().map(|n| n as i32),
        categories,
        language: None,
        cover_url,
        source: "open_library".to_string(),
    })
}

/// Gramedia scraping (for Indonesian books)
fn lookup_gramedia(isbn: &str) -> Result<BookMetadata, AppError> {
    use scraper::{Html, Selector};

    let url = format!("https://www.gramedia.com/search?q={}", isbn);
    
    let html = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| AppError::Internal(format!("Gramedia scraping error: {}", e)))?
        .into_string()
        .map_err(|e| AppError::Internal(format!("Failed to read Gramedia response: {}", e)))?;

    let document = Html::parse_document(&html);

    // Selectors (may need adjustment if Gramedia changes their HTML)
    let product_selector = Selector::parse(".product-item").unwrap();
    let title_selector = Selector::parse(".product-item-name, .product-name").unwrap();
    let author_selector = Selector::parse(".product-item-author, .author").unwrap();
    let image_selector = Selector::parse("img.product-image-photo").unwrap();

    let product = document
        .select(&product_selector)
        .next()
        .ok_or_else(|| AppError::NotFound("No results from Gramedia".to_string()))?;

    let title = product
        .select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| "Unknown Title".to_string());

    let author = product
        .select(&author_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| "Unknown Author".to_string());

    let cover_url = product
        .select(&image_selector)
        .next()
        .and_then(|el| el.value().attr("src"))
        .map(String::from);

    Ok(BookMetadata {
        isbn: isbn.to_string(),
        title,
        authors: vec![author],
        publisher: Some("Gramedia".to_string()),
        published_date: None,
        description: None,
        page_count: None,
        categories: vec![],
        language: Some("id".to_string()),
        cover_url,
        source: "gramedia".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires internet connection
    fn test_lookup_google_books() {
        let result = lookup_google_books("9780306406157");
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.source, "google_books");
        assert!(!metadata.title.is_empty());
    }

    #[test]
    #[ignore] // Requires internet connection
    fn test_lookup_open_library() {
        let result = lookup_open_library("9780306406157");
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.source, "open_library");
        assert!(!metadata.title.is_empty());
    }

    #[test]
    #[ignore] // Requires internet connection
    fn test_lookup_cascade() {
        let result = lookup_isbn("9780306406157");
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert!(!metadata.title.is_empty());
    }
}

