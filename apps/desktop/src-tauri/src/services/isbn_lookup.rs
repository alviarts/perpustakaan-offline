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
    // Try Google Books first (most reliable)
    if let Ok(metadata) = lookup_google_books(isbn) {
        return Ok(metadata);
    }

    // Fallback to Open Library (unlimited, good coverage)
    if let Ok(metadata) = lookup_open_library(isbn) {
        return Ok(metadata);
    }

    // Try Indonesian sources for local books
    if let Ok(metadata) = lookup_gramedia(isbn) {
        return Ok(metadata);
    }

    if let Ok(metadata) = lookup_tokopedia(isbn) {
        return Ok(metadata);
    }

    if let Ok(metadata) = lookup_shopee(isbn) {
        return Ok(metadata);
    }

    Err(AppError::NotFound(format!("Book not found for ISBN: {}", isbn)))
}

/// Google Books API lookup
/// Set GOOGLE_BOOKS_API_KEY environment variable for higher rate limit (1000 req/day)
/// Without key: limited to ~100 req/day
fn lookup_google_books(isbn: &str) -> Result<BookMetadata, AppError> {
    let api_key = std::env::var("GOOGLE_BOOKS_API_KEY").ok();
    let url = if let Some(key) = api_key {
        format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{}&key={}", isbn, key)
    } else {
        format!("https://www.googleapis.com/books/v1/volumes?q=isbn:{}", isbn)
    };
    
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
/// Note: Gramedia may use JavaScript rendering, so scraping might not always work
fn lookup_gramedia(isbn: &str) -> Result<BookMetadata, AppError> {
    use scraper::{Html, Selector};

    let url = format!("https://www.gramedia.com/search?q={}", isbn);
    
    let html = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| AppError::Internal(format!("Gramedia scraping error: {}", e)))?
        .into_string()
        .map_err(|e| AppError::Internal(format!("Failed to read Gramedia response: {}", e)))?;

    let document = Html::parse_document(&html);

    // Try multiple selector patterns (Gramedia structure may vary)
    let product_selectors = [
        ".product-item",
        ".product-card",
        "[data-testid='product-card']",
        ".search-result-item",
    ];

    let title_selectors = [
        ".product-item-name",
        ".product-name",
        ".product-title",
        "h3.title",
        "[data-testid='product-title']",
    ];

    let author_selectors = [
        ".product-item-author",
        ".author",
        ".product-author",
        "[data-testid='product-author']",
    ];

    let image_selectors = [
        "img.product-image-photo",
        ".product-image img",
        "[data-testid='product-image']",
        "img[alt*='cover']",
    ];

    // Find product element
    let product = product_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| document.select(&sel).next())
        })
        .ok_or_else(|| AppError::NotFound("No results from Gramedia".to_string()))?;

    // Extract title
    let title = title_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown Title".to_string());

    // Extract author
    let author = author_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown Author".to_string());

    // Extract cover image
    let cover_url = image_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .and_then(|el| el.value().attr("src").or_else(|| el.value().attr("data-src")))
                .map(String::from)
        });

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

/// Tokopedia scraping (for Indonesian books)
/// Note: Tokopedia uses heavy JavaScript rendering, scraping may not work reliably
fn lookup_tokopedia(isbn: &str) -> Result<BookMetadata, AppError> {
    use scraper::{Html, Selector};

    let url = format!("https://www.tokopedia.com/search?q={}", isbn);
    
    let html = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| AppError::Internal(format!("Tokopedia scraping error: {}", e)))?
        .into_string()
        .map_err(|e| AppError::Internal(format!("Failed to read Tokopedia response: {}", e)))?;

    let document = Html::parse_document(&html);

    // Tokopedia selectors (may change frequently)
    let product_selectors = [
        "[data-testid='master-product-card']",
        ".css-1sn1xa2",
        ".product-card",
    ];

    let title_selectors = [
        "[data-testid='spnSRPProdName']",
        ".css-3um8ox",
        ".product-title",
    ];

    let image_selectors = [
        "[data-testid='master-product-card'] img",
        ".css-1c345mg",
    ];

    // Find product element
    let product = product_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| document.select(&sel).next())
        })
        .ok_or_else(|| AppError::NotFound("No results from Tokopedia".to_string()))?;

    // Extract title
    let title = title_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown Title".to_string());

    // Extract cover image
    let cover_url = image_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .and_then(|el| el.value().attr("src").or_else(|| el.value().attr("data-src")))
                .map(String::from)
        });

    // Try to extract author from title (usually format: "Judul - Penulis")
    let (clean_title, author) = if title.contains(" - ") {
        let parts: Vec<&str> = title.splitn(2, " - ").collect();
        (parts[0].to_string(), parts.get(1).map(|s| s.to_string()).unwrap_or_else(|| "Unknown Author".to_string()))
    } else {
        (title.clone(), "Unknown Author".to_string())
    };

    Ok(BookMetadata {
        isbn: isbn.to_string(),
        title: clean_title,
        authors: vec![author],
        publisher: None,
        published_date: None,
        description: None,
        page_count: None,
        categories: vec![],
        language: Some("id".to_string()),
        cover_url,
        source: "tokopedia".to_string(),
    })
}

/// Shopee scraping (for Indonesian books)
/// Note: Shopee uses heavy JavaScript rendering and anti-bot protection
fn lookup_shopee(isbn: &str) -> Result<BookMetadata, AppError> {
    use scraper::{Html, Selector};

    let url = format!("https://shopee.co.id/search?keyword={}", isbn);
    
    let html = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| AppError::Internal(format!("Shopee scraping error: {}", e)))?
        .into_string()
        .map_err(|e| AppError::Internal(format!("Failed to read Shopee response: {}", e)))?;

    let document = Html::parse_document(&html);

    // Shopee selectors (may change frequently, likely won't work due to JS rendering)
    let product_selectors = [
        "[data-sqe='item']",
        ".shopee-search-item-result__item",
        ".col-xs-2-4",
    ];

    let title_selectors = [
        "[data-sqe='name']",
        ".ie3A+n",
        ".product-title",
    ];

    let image_selectors = [
        "[data-sqe='item'] img",
        "._2JyJwZ img",
    ];

    // Find product element
    let product = product_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| document.select(&sel).next())
        })
        .ok_or_else(|| AppError::NotFound("No results from Shopee (likely blocked by anti-bot)".to_string()))?;

    // Extract title
    let title = title_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .map(|el| el.text().collect::<String>().trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown Title".to_string());

    // Extract cover image
    let cover_url = image_selectors
        .iter()
        .find_map(|selector| {
            Selector::parse(selector)
                .ok()
                .and_then(|sel| product.select(&sel).next())
                .and_then(|el| el.value().attr("src").or_else(|| el.value().attr("data-src")))
                .map(String::from)
        });

    Ok(BookMetadata {
        isbn: isbn.to_string(),
        title,
        authors: vec!["Unknown Author".to_string()],
        publisher: None,
        published_date: None,
        description: None,
        page_count: None,
        categories: vec![],
        language: Some("id".to_string()),
        cover_url,
        source: "shopee".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test ISBNs:
    // International: 9780306406157 (English book)
    // Indonesian: 9786020633176 (Laskar Pelangi - Andrea Hirata)
    // Indonesian: 9786024246945 (Bumi - Tere Liye)

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
    fn test_lookup_indonesian_book() {
        // Try Indonesian book ISBN (Laskar Pelangi)
        let result = lookup_isbn("9786020633176");
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert!(!metadata.title.is_empty());
        println!("Found: {} by {:?} (source: {})", metadata.title, metadata.authors, metadata.source);
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

