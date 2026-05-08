/// Test ISBN lookup with real ISBNs
use perpustakaan_desktop_lib::services::isbn_lookup;

fn main() {
    println!("=== Testing ISBN Lookup ===\n");

    // Test 1: International book (Google Books should work)
    println!("Test 1: International ISBN - 9780306406157");
    match isbn_lookup::lookup_isbn("9780306406157") {
        Ok(metadata) => {
            println!("✓ Found: {}", metadata.title);
            println!("  Authors: {:?}", metadata.authors);
            println!("  Publisher: {:?}", metadata.publisher);
            println!("  Year: {:?}", metadata.published_date);
            println!("  Source: {}", metadata.source);
            println!("  Cover: {:?}\n", metadata.cover_url);
        }
        Err(e) => println!("✗ Error: {}\n", e),
    }

    // Test 2: Indonesian book - Laskar Pelangi
    println!("Test 2: Indonesian ISBN - 9786020633176 (Laskar Pelangi)");
    match isbn_lookup::lookup_isbn("9786020633176") {
        Ok(metadata) => {
            println!("✓ Found: {}", metadata.title);
            println!("  Authors: {:?}", metadata.authors);
            println!("  Publisher: {:?}", metadata.publisher);
            println!("  Year: {:?}", metadata.published_date);
            println!("  Source: {}", metadata.source);
            println!("  Cover: {:?}\n", metadata.cover_url);
        }
        Err(e) => println!("✗ Error: {}\n", e),
    }

    // Test 3: Indonesian book - Bumi (Tere Liye)
    println!("Test 3: Indonesian ISBN - 9786024246945 (Bumi - Tere Liye)");
    match isbn_lookup::lookup_isbn("9786024246945") {
        Ok(metadata) => {
            println!("✓ Found: {}", metadata.title);
            println!("  Authors: {:?}", metadata.authors);
            println!("  Publisher: {:?}", metadata.publisher);
            println!("  Year: {:?}", metadata.published_date);
            println!("  Source: {}", metadata.source);
            println!("  Cover: {:?}\n", metadata.cover_url);
        }
        Err(e) => println!("✗ Error: {}\n", e),
    }

    // Test 4: ISBN-10 format
    println!("Test 4: ISBN-10 format - 0306406152");
    match isbn_lookup::lookup_isbn("0306406152") {
        Ok(metadata) => {
            println!("✓ Found: {}", metadata.title);
            println!("  Source: {}", metadata.source);
        }
        Err(e) => println!("✗ Error: {}\n", e),
    }

    println!("=== Tests Complete ===");
}
