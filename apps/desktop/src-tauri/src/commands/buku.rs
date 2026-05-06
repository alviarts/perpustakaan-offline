use rusqlite::{params, params_from_iter, OptionalExtension, ToSql};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::AppState;

/// Single buku row mirroring the SQLite `buku` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Buku {
    pub id: i64,
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub penerbit: Option<String>,
    pub tahun_terbit: Option<i64>,
    pub kode_ddc: Option<String>,
    pub kategori: Option<String>,
    pub isbn: Option<String>,
    pub jumlah_eksemplar: i64,
    pub jumlah_tersedia: i64,
    pub sumber: Option<String>,
    pub harga: i64,
    pub cover_path: Option<String>,
    pub bahasa: Option<String>,
    pub deskripsi: Option<String>,
    pub rak: Option<String>,
    pub tanggal_input: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Eksemplar {
    pub id: i64,
    pub buku_id: i64,
    pub kode_eksemplar: String,
    pub status: String,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuInput {
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub penerbit: Option<String>,
    pub tahun_terbit: Option<i64>,
    pub kode_ddc: Option<String>,
    pub kategori: Option<String>,
    pub isbn: Option<String>,
    pub jumlah_eksemplar: Option<i64>,
    pub sumber: Option<String>,
    pub harga: Option<i64>,
    pub cover_path: Option<String>,
    pub bahasa: Option<String>,
    pub deskripsi: Option<String>,
    pub rak: Option<String>,
    pub tanggal_input: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuListArgs {
    pub query: Option<String>,
    pub kategori: Option<String>,
    pub bahasa: Option<String>,
    pub kode_ddc: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuListResult {
    pub items: Vec<Buku>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuDetail {
    pub buku: Buku,
    pub eksemplar: Vec<Eksemplar>,
}

const SORT_FIELDS: &[&str] = &[
    "judul",
    "kode_buku",
    "pengarang",
    "kategori",
    "kode_ddc",
    "tahun_terbit",
    "tanggal_input",
    "created_at",
];

fn validate_sort(sort_by: &str, sort_dir: &str) -> AppResult<(String, String)> {
    let by = SORT_FIELDS
        .iter()
        .find(|f| **f == sort_by)
        .ok_or_else(|| AppError::Validation(format!("unsupported sort_by '{sort_by}'")))?;
    let dir = match sort_dir.to_ascii_uppercase().as_str() {
        "ASC" => "ASC",
        "DESC" => "DESC",
        other => {
            return Err(AppError::Validation(format!(
                "unsupported sort_dir '{other}'"
            )))
        }
    };
    Ok(((*by).to_string(), dir.to_string()))
}

fn map_buku_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Buku> {
    Ok(Buku {
        id: row.get("id")?,
        kode_buku: row.get("kode_buku")?,
        judul: row.get("judul")?,
        pengarang: row.get("pengarang")?,
        penerbit: row.get("penerbit")?,
        tahun_terbit: row.get("tahun_terbit")?,
        kode_ddc: row.get("kode_ddc")?,
        kategori: row.get("kategori")?,
        isbn: row.get("isbn")?,
        jumlah_eksemplar: row.get("jumlah_eksemplar")?,
        jumlah_tersedia: row.get("jumlah_tersedia")?,
        sumber: row.get("sumber")?,
        harga: row.get("harga")?,
        cover_path: row.get("cover_path")?,
        bahasa: row.get("bahasa")?,
        deskripsi: row.get("deskripsi")?,
        rak: row.get("rak")?,
        tanggal_input: row.get("tanggal_input")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_eksemplar_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Eksemplar> {
    Ok(Eksemplar {
        id: row.get("id")?,
        buku_id: row.get("buku_id")?,
        kode_eksemplar: row.get("kode_eksemplar")?,
        status: row.get("status")?,
        catatan: row.get("catatan")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub fn buku_list(state: State<'_, AppState>, args: BukuListArgs) -> AppResult<BukuListResult> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let limit = args.limit.unwrap_or(100).clamp(1, 500);
    let offset = args.offset.unwrap_or(0).max(0);
    let (sort_by, sort_dir) = validate_sort(
        args.sort_by.as_deref().unwrap_or("judul"),
        args.sort_dir.as_deref().unwrap_or("ASC"),
    )?;

    let mut filters: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(q) = args
        .query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filters.push(
            "(judul LIKE ?1 OR kode_buku LIKE ?1 OR pengarang LIKE ?1 OR isbn LIKE ?1)".to_string(),
        );
        params.push(Box::new(format!("%{q}%")));
    }
    if let Some(k) = args
        .kategori
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filters.push(format!("kategori = ?{}", params.len() + 1));
        params.push(Box::new(k.to_string()));
    }
    if let Some(b) = args
        .bahasa
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filters.push(format!("bahasa = ?{}", params.len() + 1));
        params.push(Box::new(b.to_string()));
    }
    if let Some(d) = args
        .kode_ddc
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filters.push(format!("kode_ddc LIKE ?{}", params.len() + 1));
        params.push(Box::new(format!("{d}%")));
    }

    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", filters.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM buku{where_clause}");
    let total: i64 = conn.query_row(&count_sql, params_from_iter(params.iter()), |r| r.get(0))?;

    let list_sql = format!(
        "SELECT * FROM buku{where_clause} ORDER BY {sort_by} {sort_dir} LIMIT ?{lim} OFFSET ?{off}",
        lim = params.len() + 1,
        off = params.len() + 2
    );
    let mut stmt = conn.prepare(&list_sql)?;
    let mut all_params: Vec<Box<dyn ToSql>> = params;
    all_params.push(Box::new(limit));
    all_params.push(Box::new(offset));
    let rows = stmt
        .query_map(params_from_iter(all_params.iter()), map_buku_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(BukuListResult { items: rows, total })
}

#[tauri::command]
pub fn buku_get(state: State<'_, AppState>, id: i64) -> AppResult<BukuDetail> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let buku = conn
        .query_row(
            "SELECT * FROM buku WHERE id = ?1",
            params![id],
            map_buku_row,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("buku id={id}")))?;
    let mut stmt =
        conn.prepare("SELECT * FROM eksemplar WHERE buku_id = ?1 ORDER BY kode_eksemplar ASC")?;
    let eksemplar = stmt
        .query_map(params![id], map_eksemplar_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(BukuDetail { buku, eksemplar })
}

fn validate_buku_input(input: &BukuInput) -> AppResult<()> {
    if input.kode_buku.trim().is_empty() {
        return Err(AppError::Validation("kode_buku required".into()));
    }
    if input.judul.trim().is_empty() {
        return Err(AppError::Validation("judul required".into()));
    }
    Ok(())
}

#[tauri::command]
pub fn buku_create(state: State<'_, AppState>, input: BukuInput) -> AppResult<Buku> {
    validate_buku_input(&input)?;
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    buku_create_inner(&mut conn, &input)
}

/// Inserts a new `buku` row together with its `eksemplar` children inside a
/// single transaction.
///
/// Extracted from [`buku_create`] so it can be unit-tested against an
/// in-memory `rusqlite::Connection` without spinning up Tauri. The eksemplar
/// seeding is required because `peminjaman_create` looks up an available
/// eksemplar row for the buku — without rows here the borrow flow is
/// unusable on every fresh install (BUG-001).
fn buku_create_inner(conn: &mut rusqlite::Connection, input: &BukuInput) -> AppResult<Buku> {
    let kode_buku = input.kode_buku.trim();
    let dup: i64 = conn.query_row(
        "SELECT COUNT(*) FROM buku WHERE kode_buku = ?1",
        params![kode_buku],
        |r| r.get(0),
    )?;
    if dup > 0 {
        return Err(AppError::Validation(format!(
            "kode_buku '{kode_buku}' sudah dipakai"
        )));
    }
    let jumlah = input.jumlah_eksemplar.unwrap_or(1).max(0);
    let harga = input.harga.unwrap_or(0).max(0);
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO buku (kode_buku, judul, pengarang, penerbit, tahun_terbit, kode_ddc,
            kategori, isbn, jumlah_eksemplar, jumlah_tersedia, sumber, harga, cover_path,
            bahasa, deskripsi, rak, tanggal_input)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
            COALESCE(?16, date('now')))",
        params![
            kode_buku,
            input.judul.trim(),
            input.pengarang,
            input.penerbit,
            input.tahun_terbit,
            input.kode_ddc,
            input.kategori,
            input.isbn,
            jumlah,
            input.sumber,
            harga,
            input.cover_path,
            input.bahasa,
            input.deskripsi,
            input.rak,
            input.tanggal_input,
        ],
    )?;
    let id = tx.last_insert_rowid();
    for n in 1..=jumlah {
        let kode_eksemplar = format!("{kode_buku}-{n:02}");
        tx.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, ?2, 'tersedia')",
            params![id, kode_eksemplar],
        )?;
    }
    let buku = tx.query_row(
        "SELECT * FROM buku WHERE id = ?1",
        params![id],
        map_buku_row,
    )?;
    tx.commit()?;
    Ok(buku)
}

#[tauri::command]
pub fn buku_update(state: State<'_, AppState>, id: i64, input: BukuInput) -> AppResult<Buku> {
    validate_buku_input(&input)?;
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let dup: i64 = conn.query_row(
        "SELECT COUNT(*) FROM buku WHERE kode_buku = ?1 AND id <> ?2",
        params![input.kode_buku.trim(), id],
        |r| r.get(0),
    )?;
    if dup > 0 {
        return Err(AppError::Validation(format!(
            "kode_buku '{}' sudah dipakai buku lain",
            input.kode_buku
        )));
    }
    let updated = conn.execute(
        "UPDATE buku SET kode_buku = ?1, judul = ?2, pengarang = ?3, penerbit = ?4,
            tahun_terbit = ?5, kode_ddc = ?6, kategori = ?7, isbn = ?8, jumlah_eksemplar = ?9,
            sumber = ?10, harga = ?11, cover_path = ?12, bahasa = ?13, deskripsi = ?14,
            rak = ?15, updated_at = datetime('now')
         WHERE id = ?16",
        params![
            input.kode_buku.trim(),
            input.judul.trim(),
            input.pengarang,
            input.penerbit,
            input.tahun_terbit,
            input.kode_ddc,
            input.kategori,
            input.isbn,
            input.jumlah_eksemplar.unwrap_or(1),
            input.sumber,
            input.harga.unwrap_or(0),
            input.cover_path,
            input.bahasa,
            input.deskripsi,
            input.rak,
            id,
        ],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound(format!("buku id={id}")));
    }
    let buku = conn.query_row(
        "SELECT * FROM buku WHERE id = ?1",
        params![id],
        map_buku_row,
    )?;
    Ok(buku)
}

#[tauri::command]
pub fn buku_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let deleted = conn.execute("DELETE FROM buku WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::NotFound(format!("buku id={id}")));
    }
    Ok(())
}

#[tauri::command]
pub fn eksemplar_create(
    state: State<'_, AppState>,
    buku_id: i64,
    kode: String,
) -> AppResult<Eksemplar> {
    let kode = kode.trim();
    if kode.is_empty() {
        return Err(AppError::Validation("kode_eksemplar required".into()));
    }
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let dup: i64 = conn.query_row(
        "SELECT COUNT(*) FROM eksemplar WHERE kode_eksemplar = ?1",
        params![kode],
        |r| r.get(0),
    )?;
    if dup > 0 {
        return Err(AppError::Validation(format!(
            "kode_eksemplar '{kode}' sudah dipakai"
        )));
    }
    conn.execute(
        "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, ?2, 'tersedia')",
        params![buku_id, kode],
    )?;
    let id = conn.last_insert_rowid();
    let row = conn.query_row(
        "SELECT * FROM eksemplar WHERE id = ?1",
        params![id],
        map_eksemplar_row,
    )?;
    // Sync jumlah counters on the parent buku.
    sync_buku_counts(&conn, buku_id)?;
    Ok(row)
}

#[tauri::command]
pub fn eksemplar_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let buku_id: Option<i64> = conn
        .query_row(
            "SELECT buku_id FROM eksemplar WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    let buku_id = buku_id.ok_or_else(|| AppError::NotFound(format!("eksemplar id={id}")))?;
    conn.execute("DELETE FROM eksemplar WHERE id = ?1", params![id])?;
    sync_buku_counts(&conn, buku_id)?;
    Ok(())
}

fn sync_buku_counts(conn: &rusqlite::Connection, buku_id: i64) -> AppResult<()> {
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?1",
        params![buku_id],
        |r| r.get(0),
    )?;
    let available: i64 = conn.query_row(
        "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?1 AND status = 'tersedia'",
        params![buku_id],
        |r| r.get(0),
    )?;
    if total > 0 {
        conn.execute(
            "UPDATE buku SET jumlah_eksemplar = ?1, jumlah_tersedia = ?2,
                updated_at = datetime('now') WHERE id = ?3",
            params![total, available, buku_id],
        )?;
    }
    Ok(())
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuImportItem {
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: Option<String>,
    pub penerbit: Option<String>,
    pub tahun_terbit: Option<i64>,
    pub kode_ddc: Option<String>,
    pub kategori: Option<String>,
    pub isbn: Option<String>,
    pub jumlah_eksemplar: Option<i64>,
    pub bahasa: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuImportResult {
    pub inserted: i64,
    pub skipped: i64,
    pub errors: Vec<BukuImportError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BukuImportError {
    pub row: usize,
    pub message: String,
}

#[tauri::command]
pub fn buku_import(
    state: State<'_, AppState>,
    items: Vec<BukuImportItem>,
) -> AppResult<BukuImportResult> {
    let mut conn = state
        .db
        .lock()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    buku_import_into_conn(&mut conn, &items)
}

pub fn buku_import_into_conn(
    conn: &mut rusqlite::Connection,
    items: &[BukuImportItem],
) -> AppResult<BukuImportResult> {
    let tx = conn.transaction()?;
    let mut inserted = 0;
    let mut skipped = 0;
    let mut errors: Vec<BukuImportError> = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        if item.kode_buku.trim().is_empty() || item.judul.trim().is_empty() {
            errors.push(BukuImportError {
                row: idx + 1,
                message: "kode_buku and judul are required".into(),
            });
            skipped += 1;
            continue;
        }
        let dup: i64 = tx.query_row(
            "SELECT COUNT(*) FROM buku WHERE kode_buku = ?1",
            params![item.kode_buku.trim()],
            |r| r.get(0),
        )?;
        if dup > 0 {
            errors.push(BukuImportError {
                row: idx + 1,
                message: format!("kode_buku '{}' sudah ada", item.kode_buku),
            });
            skipped += 1;
            continue;
        }
        let jumlah = item.jumlah_eksemplar.unwrap_or(1).max(0);
        let kode_buku = item.kode_buku.trim();
        tx.execute(
            "INSERT INTO buku (kode_buku, judul, pengarang, penerbit, tahun_terbit, kode_ddc,
                kategori, isbn, jumlah_eksemplar, jumlah_tersedia, bahasa)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?10)",
            params![
                kode_buku,
                item.judul.trim(),
                item.pengarang,
                item.penerbit,
                item.tahun_terbit,
                item.kode_ddc,
                item.kategori,
                item.isbn,
                jumlah,
                item.bahasa,
            ],
        )?;
        let buku_id = tx.last_insert_rowid();
        // Seed one eksemplar per copy, mirroring `buku_create_inner` so imported
        // books are immediately printable / borrowable. Without this, downstream
        // flows that iterate `eksemplar` (cetak label, peminjaman) treat the
        // imported buku as having zero copies even though `jumlah_eksemplar`
        // says otherwise.
        for n in 1..=jumlah {
            let kode_eksemplar = format!("{kode_buku}-{n:02}");
            tx.execute(
                "INSERT INTO eksemplar (buku_id, kode_eksemplar, status)
                 VALUES (?1, ?2, 'tersedia')",
                params![buku_id, kode_eksemplar],
            )?;
        }
        inserted += 1;
    }
    tx.commit()?;
    Ok(BukuImportResult {
        inserted,
        skipped,
        errors,
    })
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

    fn make_input(kode: &str, jumlah: Option<i64>) -> BukuInput {
        BukuInput {
            kode_buku: kode.into(),
            judul: format!("Buku {kode}"),
            jumlah_eksemplar: jumlah,
            ..Default::default()
        }
    }

    fn count_eksemplar(conn: &Connection, buku_id: i64) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?1",
            params![buku_id],
            |r| r.get(0),
        )
        .expect("count eksemplar")
    }

    fn list_kode_eksemplar(conn: &Connection, buku_id: i64) -> Vec<String> {
        let mut stmt = conn
            .prepare(
                "SELECT kode_eksemplar FROM eksemplar WHERE buku_id = ?1 \
                 ORDER BY kode_eksemplar ASC",
            )
            .expect("prepare");
        stmt.query_map(params![buku_id], |r| r.get::<_, String>(0))
            .expect("query")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect")
    }

    #[test]
    fn buku_create_seeds_zero_eksemplar_for_catalog_only_entry() {
        let mut conn = setup_db();
        let buku =
            buku_create_inner(&mut conn, &make_input("B0001", Some(0))).expect("create buku");
        assert_eq!(buku.jumlah_eksemplar, 0);
        assert_eq!(count_eksemplar(&conn, buku.id), 0);
    }

    #[test]
    fn buku_create_seeds_one_eksemplar_with_zero_padded_kode() {
        let mut conn = setup_db();
        let buku =
            buku_create_inner(&mut conn, &make_input("B0001", Some(1))).expect("create buku");
        assert_eq!(buku.jumlah_eksemplar, 1);
        assert_eq!(list_kode_eksemplar(&conn, buku.id), vec!["B0001-01"]);
    }

    #[test]
    fn buku_create_seeds_five_sequential_eksemplar() {
        let mut conn = setup_db();
        let buku =
            buku_create_inner(&mut conn, &make_input("B0042", Some(5))).expect("create buku");
        assert_eq!(buku.jumlah_eksemplar, 5);
        assert_eq!(
            list_kode_eksemplar(&conn, buku.id),
            vec![
                "B0042-01".to_string(),
                "B0042-02".to_string(),
                "B0042-03".to_string(),
                "B0042-04".to_string(),
                "B0042-05".to_string(),
            ]
        );
    }

    #[test]
    fn buku_create_seeded_eksemplar_are_all_tersedia() {
        let mut conn = setup_db();
        let buku =
            buku_create_inner(&mut conn, &make_input("B0007", Some(3))).expect("create buku");
        let tersedia: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM eksemplar \
                 WHERE buku_id = ?1 AND status = 'tersedia'",
                params![buku.id],
                |r| r.get(0),
            )
            .expect("count tersedia");
        assert_eq!(tersedia, 3);
    }

    #[test]
    fn buku_create_default_jumlah_eksemplar_is_one() {
        // BUG-001: when frontend omits jumlahEksemplar (undefined → None),
        // the buku still gets one eksemplar so it can be borrowed.
        let mut conn = setup_db();
        let buku = buku_create_inner(&mut conn, &make_input("B0010", None)).expect("create buku");
        assert_eq!(buku.jumlah_eksemplar, 1);
        assert_eq!(count_eksemplar(&conn, buku.id), 1);
    }

    #[test]
    fn buku_create_rejects_duplicate_kode_buku() {
        let mut conn = setup_db();
        buku_create_inner(&mut conn, &make_input("B0001", Some(1))).expect("create first buku");
        let err = buku_create_inner(&mut conn, &make_input("B0001", Some(2)))
            .expect_err("duplicate should fail");
        assert!(matches!(err, AppError::Validation(_)));
        // Failure on the second insert must leave the first buku and its
        // eksemplar intact (no rollback bleed).
        let total_buku: i64 = conn
            .query_row("SELECT COUNT(*) FROM buku", [], |r| r.get(0))
            .unwrap();
        let total_eksemplar: i64 = conn
            .query_row("SELECT COUNT(*) FROM eksemplar", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total_buku, 1);
        assert_eq!(total_eksemplar, 1);
    }

    fn import_item(kode: &str, judul: &str, jumlah: Option<i64>) -> BukuImportItem {
        BukuImportItem {
            kode_buku: kode.into(),
            judul: judul.into(),
            jumlah_eksemplar: jumlah,
            ..Default::default()
        }
    }

    #[test]
    fn buku_import_seeds_eksemplar_per_copy() {
        // Regression for v1.0.8 FEAT-20 ISBN bulk import: imported buku must
        // immediately have eksemplar rows so cetak label / peminjaman work
        // without waiting on a manual eksemplar-add step.
        let mut conn = setup_db();
        let result = buku_import_into_conn(
            &mut conn,
            &[
                import_item("B-IMP-1", "Buku Import 1", Some(3)),
                import_item("B-IMP-2", "Buku Import 2", None), // defaults to 1
            ],
        )
        .expect("import");
        assert_eq!(result.inserted, 2);
        assert_eq!(result.skipped, 0);

        let id1: i64 = conn
            .query_row(
                "SELECT id FROM buku WHERE kode_buku = ?1",
                params!["B-IMP-1"],
                |r| r.get(0),
            )
            .unwrap();
        let id2: i64 = conn
            .query_row(
                "SELECT id FROM buku WHERE kode_buku = ?1",
                params!["B-IMP-2"],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(
            list_kode_eksemplar(&conn, id1),
            vec!["B-IMP-1-01", "B-IMP-1-02", "B-IMP-1-03"]
        );
        assert_eq!(list_kode_eksemplar(&conn, id2), vec!["B-IMP-2-01"]);

        let tersedia: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM eksemplar WHERE status = 'tersedia'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tersedia, 4);
    }

    #[test]
    fn buku_import_handles_zero_jumlah() {
        let mut conn = setup_db();
        let result =
            buku_import_into_conn(&mut conn, &[import_item("B-EMPTY", "Katalog Saja", Some(0))])
                .expect("import");
        assert_eq!(result.inserted, 1);
        let id: i64 = conn
            .query_row(
                "SELECT id FROM buku WHERE kode_buku = ?1",
                params!["B-EMPTY"],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count_eksemplar(&conn, id), 0);
    }
}
