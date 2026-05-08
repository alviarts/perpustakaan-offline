/// ISBN utilities: validation, normalization, ISBN-10 ↔ ISBN-13 conversion

/// Normalize ISBN: remove hyphens, spaces, and convert to uppercase
pub fn normalize_isbn(isbn: &str) -> String {
    isbn.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// Validate ISBN-10 format
pub fn is_valid_isbn10(isbn: &str) -> bool {
    let normalized = normalize_isbn(isbn);
    if normalized.len() != 10 {
        return false;
    }

    let mut sum = 0;
    for (i, ch) in normalized.chars().enumerate() {
        let digit = if i == 9 && ch == 'X' {
            10
        } else {
            match ch.to_digit(10) {
                Some(d) => d as i32,
                None => return false,
            }
        };
        sum += digit * (10 - i as i32);
    }

    sum % 11 == 0
}

/// Validate ISBN-13 format
pub fn is_valid_isbn13(isbn: &str) -> bool {
    let normalized = normalize_isbn(isbn);
    if normalized.len() != 13 {
        return false;
    }

    let mut sum = 0;
    for (i, ch) in normalized.chars().enumerate() {
        let digit = match ch.to_digit(10) {
            Some(d) => d as i32,
            None => return false,
        };
        let weight = if i % 2 == 0 { 1 } else { 3 };
        sum += digit * weight;
    }

    sum % 10 == 0
}

/// Convert ISBN-10 to ISBN-13 (add 978 prefix and recalculate check digit)
pub fn isbn10_to_isbn13(isbn10: &str) -> Option<String> {
    let normalized = normalize_isbn(isbn10);
    if !is_valid_isbn10(&normalized) {
        return None;
    }

    // Take first 9 digits, add 978 prefix
    let base = format!("978{}", &normalized[..9]);

    // Calculate ISBN-13 check digit
    let mut sum = 0;
    for (i, ch) in base.chars().enumerate() {
        let digit = ch.to_digit(10)? as i32;
        let weight = if i % 2 == 0 { 1 } else { 3 };
        sum += digit * weight;
    }

    let check_digit = (10 - (sum % 10)) % 10;
    Some(format!("{}{}", base, check_digit))
}

/// Convert ISBN-13 to ISBN-10 (only if starts with 978)
pub fn isbn13_to_isbn10(isbn13: &str) -> Option<String> {
    let normalized = normalize_isbn(isbn13);
    if !is_valid_isbn13(&normalized) || !normalized.starts_with("978") {
        return None;
    }

    // Take digits 3-11 (after 978 prefix, before check digit)
    let base = &normalized[3..12];

    // Calculate ISBN-10 check digit
    let mut sum = 0;
    for (i, ch) in base.chars().enumerate() {
        let digit = ch.to_digit(10)? as i32;
        sum += digit * (10 - i as i32);
    }

    let check_digit = (11 - (sum % 11)) % 11;
    let check_char = if check_digit == 10 { 'X' } else { char::from_digit(check_digit as u32, 10)? };

    Some(format!("{}{}", base, check_char))
}

/// Detect ISBN type and return normalized version
pub fn detect_isbn(input: &str) -> Option<(String, &'static str)> {
    let normalized = normalize_isbn(input);

    if is_valid_isbn13(&normalized) {
        Some((normalized, "ISBN-13"))
    } else if is_valid_isbn10(&normalized) {
        Some((normalized, "ISBN-10"))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_isbn() {
        assert_eq!(normalize_isbn("978-0-306-40615-7"), "9780306406157");
        assert_eq!(normalize_isbn("0-306-40615-2"), "0306406152");
        assert_eq!(normalize_isbn("978 0 306 40615 7"), "9780306406157");
    }

    #[test]
    fn test_isbn10_validation() {
        assert!(is_valid_isbn10("0306406152"));
        assert!(is_valid_isbn10("043942089X"));
        assert!(!is_valid_isbn10("0306406153")); // wrong check digit
        assert!(!is_valid_isbn10("123")); // too short
    }

    #[test]
    fn test_isbn13_validation() {
        assert!(is_valid_isbn13("9780306406157"));
        assert!(is_valid_isbn13("9780439420891"));
        assert!(!is_valid_isbn13("9780306406158")); // wrong check digit
        assert!(!is_valid_isbn13("123")); // too short
    }

    #[test]
    fn test_isbn10_to_isbn13() {
        assert_eq!(isbn10_to_isbn13("0306406152"), Some("9780306406157".to_string()));
        assert_eq!(isbn10_to_isbn13("043942089X"), Some("9780439420891".to_string()));
        assert_eq!(isbn10_to_isbn13("invalid"), None);
    }

    #[test]
    fn test_isbn13_to_isbn10() {
        assert_eq!(isbn13_to_isbn10("9780306406157"), Some("0306406152".to_string()));
        assert_eq!(isbn13_to_isbn10("9780439420891"), Some("043942089X".to_string()));
        assert_eq!(isbn13_to_isbn10("9790000000000"), None); // doesn't start with 978
    }

    #[test]
    fn test_detect_isbn() {
        assert_eq!(detect_isbn("978-0-306-40615-7"), Some(("9780306406157".to_string(), "ISBN-13")));
        assert_eq!(detect_isbn("0-306-40615-2"), Some(("0306406152".to_string(), "ISBN-10")));
        assert_eq!(detect_isbn("invalid"), None);
    }
}
