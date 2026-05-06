//! Row mappers for FEAT-26 Sheets sync (PR G v1.0.8).
//!
//! Each mapper translates between a SQLite row and a Google Sheets row
//! (header + cells). The trait is intentionally shape-agnostic so we can
//! plug in `BukuMapper`, `EksemplarMapper`, etc. in follow-up PRs without
//! changing push/pull plumbing.
//!
//! Initial coverage in this PR: `anggota` only. The other tables are
//! deferred to G2 per `.devin/handoff/v1.0.8-bugs-batch/BUGS.md`.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Anggota row in the canonical wire-format used both for Sheets cells and
/// for in-memory diffing. Strings everywhere because Google Sheets cells are
/// stringly typed and we'd rather lose nothing than juggle types here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnggotaRow {
    pub kode_anggota: String,
    pub nama: String,
    pub jenis_kelamin: String,
    pub kelas: String,
    pub jurusan: String,
    pub tempat_lahir: String,
    pub tanggal_lahir: String,
    pub no_telp: String,
    pub email: String,
    pub alamat: String,
    pub agama: String,
    pub aktif: String,
    pub catatan: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Header order for the `Anggota` sheet tab. Putting `kode_anggota` first
/// makes the sheet readable even when zoomed out (operator scans by code).
pub const ANGGOTA_HEADER: &[&str] = &[
    "kode_anggota",
    "nama",
    "jenis_kelamin",
    "kelas",
    "jurusan",
    "tempat_lahir",
    "tanggal_lahir",
    "no_telp",
    "email",
    "alamat",
    "agama",
    "aktif",
    "catatan",
    "created_at",
    "updated_at",
];

pub const ANGGOTA_TAB: &str = "anggota";

impl AnggotaRow {
    /// Encode this row as a Vec<String> matching the [`ANGGOTA_HEADER`]
    /// column order. Used by push.
    pub fn to_cells(&self) -> Vec<String> {
        vec![
            self.kode_anggota.clone(),
            self.nama.clone(),
            self.jenis_kelamin.clone(),
            self.kelas.clone(),
            self.jurusan.clone(),
            self.tempat_lahir.clone(),
            self.tanggal_lahir.clone(),
            self.no_telp.clone(),
            self.email.clone(),
            self.alamat.clone(),
            self.agama.clone(),
            self.aktif.clone(),
            self.catatan.clone(),
            self.created_at.clone(),
            self.updated_at.clone(),
        ]
    }

    /// Decode a Sheets row back into an `AnggotaRow`. Fewer-than-expected
    /// columns are padded with empty strings (Google strips trailing empties).
    pub fn from_cells(cells: &[String]) -> AnggotaRow {
        let pick = |i: usize| cells.get(i).cloned().unwrap_or_default();
        AnggotaRow {
            kode_anggota: pick(0),
            nama: pick(1),
            jenis_kelamin: pick(2),
            kelas: pick(3),
            jurusan: pick(4),
            tempat_lahir: pick(5),
            tanggal_lahir: pick(6),
            no_telp: pick(7),
            email: pick(8),
            alamat: pick(9),
            agama: pick(10),
            aktif: pick(11),
            catatan: pick(12),
            created_at: pick(13),
            updated_at: pick(14),
        }
    }
}

/// Read every row from the local `anggota` table, ordered by `kode_anggota`
/// for stable diffs across pushes.
pub fn read_all_anggota(conn: &Connection) -> AppResult<Vec<AnggotaRow>> {
    let mut stmt = conn.prepare(
        "SELECT kode_anggota,
                nama,
                COALESCE(jenis_kelamin,''),
                COALESCE(kelas,''),
                COALESCE(jurusan,''),
                COALESCE(tempat_lahir,''),
                COALESCE(tanggal_lahir,''),
                COALESCE(no_telp,''),
                COALESCE(email,''),
                COALESCE(alamat,''),
                COALESCE(agama,''),
                CASE aktif WHEN 1 THEN '1' ELSE '0' END,
                COALESCE(catatan,''),
                created_at,
                updated_at
           FROM anggota
          ORDER BY kode_anggota ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(AnggotaRow {
            kode_anggota: row.get(0)?,
            nama: row.get(1)?,
            jenis_kelamin: row.get(2)?,
            kelas: row.get(3)?,
            jurusan: row.get(4)?,
            tempat_lahir: row.get(5)?,
            tanggal_lahir: row.get(6)?,
            no_telp: row.get(7)?,
            email: row.get(8)?,
            alamat: row.get(9)?,
            agama: row.get(10)?,
            aktif: row.get(11)?,
            catatan: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Upsert one anggota row from Sheets into the local DB. Conflict
/// resolution is **last-write-wins by `updated_at`**: we only overwrite a
/// local row if the incoming `updated_at` is strictly greater. Equal
/// timestamps are treated as no-op (admin always wins on tie because the
/// admin row was, by definition, written first to the sheet).
///
/// Returns:
/// * `Ok(true)` if the local DB changed (insert or update applied),
/// * `Ok(false)` if the row was identical or the local copy was newer.
pub fn upsert_anggota(conn: &Connection, incoming: &AnggotaRow) -> AppResult<bool> {
    if incoming.kode_anggota.trim().is_empty() {
        return Err(AppError::Validation(
            "anggota row dari Sheets kekurangan kode_anggota".into(),
        ));
    }
    let existing: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM anggota WHERE kode_anggota = ?1",
            rusqlite::params![&incoming.kode_anggota],
            |row| row.get::<_, String>(0),
        )
        .ok();
    let aktif_int: i64 = if incoming.aktif == "1" || incoming.aktif.eq_ignore_ascii_case("true") {
        1
    } else {
        0
    };
    if let Some(local_ts) = existing {
        if incoming.updated_at <= local_ts {
            return Ok(false);
        }
        conn.execute(
            "UPDATE anggota
                SET nama          = ?1,
                    jenis_kelamin = NULLIF(?2,''),
                    kelas         = NULLIF(?3,''),
                    jurusan       = NULLIF(?4,''),
                    tempat_lahir  = NULLIF(?5,''),
                    tanggal_lahir = NULLIF(?6,''),
                    no_telp       = NULLIF(?7,''),
                    email         = NULLIF(?8,''),
                    alamat        = NULLIF(?9,''),
                    agama         = NULLIF(?10,''),
                    aktif         = ?11,
                    catatan       = NULLIF(?12,''),
                    updated_at    = ?13
              WHERE kode_anggota = ?14",
            rusqlite::params![
                incoming.nama,
                incoming.jenis_kelamin,
                incoming.kelas,
                incoming.jurusan,
                incoming.tempat_lahir,
                incoming.tanggal_lahir,
                incoming.no_telp,
                incoming.email,
                incoming.alamat,
                incoming.agama,
                aktif_int,
                incoming.catatan,
                incoming.updated_at,
                incoming.kode_anggota,
            ],
        )?;
        return Ok(true);
    }
    // Insert new
    conn.execute(
        "INSERT INTO anggota (
            kode_anggota, nama, jenis_kelamin, kelas, jurusan,
            tempat_lahir, tanggal_lahir, no_telp, email, alamat,
            agama, aktif, catatan, created_at, updated_at
         ) VALUES (?1, ?2, NULLIF(?3,''), NULLIF(?4,''), NULLIF(?5,''),
                  NULLIF(?6,''), NULLIF(?7,''), NULLIF(?8,''), NULLIF(?9,''), NULLIF(?10,''),
                  NULLIF(?11,''), ?12, NULLIF(?13,''), COALESCE(NULLIF(?14,''), datetime('now')), COALESCE(NULLIF(?15,''), datetime('now')))",
        rusqlite::params![
            incoming.kode_anggota,
            incoming.nama,
            incoming.jenis_kelamin,
            incoming.kelas,
            incoming.jurusan,
            incoming.tempat_lahir,
            incoming.tanggal_lahir,
            incoming.no_telp,
            incoming.email,
            incoming.alamat,
            incoming.agama,
            aktif_int,
            incoming.catatan,
            incoming.created_at,
            incoming.updated_at,
        ],
    )?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn fixture_row() -> AnggotaRow {
        AnggotaRow {
            kode_anggota: "A0001".into(),
            nama: "Budi Santoso".into(),
            jenis_kelamin: "L".into(),
            kelas: "10A".into(),
            jurusan: "IPA".into(),
            tempat_lahir: "Jakarta".into(),
            tanggal_lahir: "2008-03-15".into(),
            no_telp: "08123456789".into(),
            email: "budi@example.test".into(),
            alamat: "Jl. Mawar 1".into(),
            agama: "Islam".into(),
            aktif: "1".into(),
            catatan: "ketua kelas".into(),
            created_at: "2024-01-15 09:00:00".into(),
            updated_at: "2024-06-01 12:34:56".into(),
        }
    }

    #[test]
    fn header_length_matches_to_cells_arity() {
        let r = fixture_row();
        assert_eq!(ANGGOTA_HEADER.len(), r.to_cells().len());
    }

    #[test]
    fn to_cells_then_from_cells_round_trips() {
        let r = fixture_row();
        let cells = r.to_cells();
        let back = AnggotaRow::from_cells(&cells);
        assert_eq!(r, back);
    }

    #[test]
    fn from_cells_pads_missing_columns_with_empty_strings() {
        let partial = vec!["X0001".to_string(), "Foo".to_string()];
        let row = AnggotaRow::from_cells(&partial);
        assert_eq!(row.kode_anggota, "X0001");
        assert_eq!(row.nama, "Foo");
        assert_eq!(row.kelas, "");
        assert_eq!(row.updated_at, "");
    }

    fn open_conn_with_anggota() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE anggota (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                kode_anggota    TEXT NOT NULL UNIQUE,
                nama            TEXT NOT NULL,
                jenis_kelamin   TEXT,
                kelas           TEXT,
                jurusan         TEXT,
                tempat_lahir    TEXT,
                tanggal_lahir   TEXT,
                no_telp         TEXT,
                email           TEXT,
                alamat          TEXT,
                foto_path       TEXT,
                tanggal_daftar  TEXT NOT NULL DEFAULT (date('now')),
                aktif           INTEGER NOT NULL DEFAULT 1,
                catatan         TEXT,
                agama           TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn read_all_anggota_returns_empty_when_table_empty() {
        let conn = open_conn_with_anggota();
        let rows = read_all_anggota(&conn).unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn read_all_anggota_orders_by_kode() {
        let conn = open_conn_with_anggota();
        for kode in &["A0003", "A0001", "A0002"] {
            conn.execute(
                "INSERT INTO anggota (kode_anggota, nama, aktif, created_at, updated_at)
                 VALUES (?1, ?2, 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00')",
                rusqlite::params![kode, format!("nama-{kode}")],
            )
            .unwrap();
        }
        let rows = read_all_anggota(&conn).unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].kode_anggota, "A0001");
        assert_eq!(rows[1].kode_anggota, "A0002");
        assert_eq!(rows[2].kode_anggota, "A0003");
    }

    #[test]
    fn read_all_anggota_coalesces_nulls_to_empty_strings() {
        let conn = open_conn_with_anggota();
        conn.execute(
            "INSERT INTO anggota (kode_anggota, nama, aktif, created_at, updated_at)
             VALUES ('A0001','Budi',1,'2024-01-01 00:00:00','2024-01-01 00:00:00')",
            [],
        )
        .unwrap();
        let rows = read_all_anggota(&conn).unwrap();
        assert_eq!(rows[0].kelas, "");
        assert_eq!(rows[0].email, "");
        assert_eq!(rows[0].catatan, "");
        assert_eq!(rows[0].aktif, "1");
    }

    #[test]
    fn upsert_anggota_inserts_when_missing() {
        let conn = open_conn_with_anggota();
        let r = fixture_row();
        let changed = upsert_anggota(&conn, &r).unwrap();
        assert!(changed);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM anggota", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let nama: String = conn
            .query_row(
                "SELECT nama FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(nama, "Budi Santoso");
    }

    #[test]
    fn upsert_anggota_updates_when_incoming_newer() {
        let conn = open_conn_with_anggota();
        let mut r = fixture_row();
        upsert_anggota(&conn, &r).unwrap();
        r.nama = "Budi Santoso (renamed)".into();
        r.updated_at = "2025-01-01 00:00:00".into();
        let changed = upsert_anggota(&conn, &r).unwrap();
        assert!(changed);
        let nama: String = conn
            .query_row(
                "SELECT nama FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(nama, "Budi Santoso (renamed)");
    }

    #[test]
    fn upsert_anggota_skips_when_local_is_newer() {
        let conn = open_conn_with_anggota();
        let mut r = fixture_row();
        r.updated_at = "2025-01-01 00:00:00".into();
        upsert_anggota(&conn, &r).unwrap();
        // simulate incoming older timestamp
        r.nama = "stale value".into();
        r.updated_at = "2024-01-01 00:00:00".into();
        let changed = upsert_anggota(&conn, &r).unwrap();
        assert!(!changed);
        let nama: String = conn
            .query_row(
                "SELECT nama FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(nama, "Budi Santoso");
    }

    #[test]
    fn upsert_anggota_skips_when_timestamps_equal() {
        let conn = open_conn_with_anggota();
        let r = fixture_row();
        upsert_anggota(&conn, &r).unwrap();
        // identical timestamp = no-op (admin wins on tie)
        let mut r2 = r.clone();
        r2.nama = "should not apply".into();
        let changed = upsert_anggota(&conn, &r2).unwrap();
        assert!(!changed);
    }

    #[test]
    fn upsert_anggota_rejects_empty_kode() {
        let conn = open_conn_with_anggota();
        let mut r = fixture_row();
        r.kode_anggota.clear();
        let err = upsert_anggota(&conn, &r).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("kode_anggota")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn upsert_anggota_handles_aktif_string_variants() {
        let conn = open_conn_with_anggota();
        let mut r = fixture_row();
        r.aktif = "TRUE".into();
        upsert_anggota(&conn, &r).unwrap();
        let aktif: i64 = conn
            .query_row(
                "SELECT aktif FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(aktif, 1);
    }

    #[test]
    fn upsert_anggota_treats_non_truthy_as_inactive() {
        let conn = open_conn_with_anggota();
        let mut r = fixture_row();
        r.aktif = "0".into();
        upsert_anggota(&conn, &r).unwrap();
        let aktif: i64 = conn
            .query_row(
                "SELECT aktif FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(aktif, 0);
    }
}
