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

// ============================================================================
// Buku — book master rows. v1.0.9 extends sheets sync past `anggota`.
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BukuRow {
    pub kode_buku: String,
    pub judul: String,
    pub pengarang: String,
    pub penerbit: String,
    pub tahun_terbit: String,
    pub kode_ddc: String,
    pub kategori: String,
    pub isbn: String,
    pub jumlah_eksemplar: String,
    pub sumber: String,
    pub harga: String,
    pub bahasa: String,
    pub deskripsi: String,
    pub rak: String,
    pub tanggal_input: String,
    pub created_at: String,
    pub updated_at: String,
}

pub const BUKU_HEADER: &[&str] = &[
    "kode_buku",
    "judul",
    "pengarang",
    "penerbit",
    "tahun_terbit",
    "kode_ddc",
    "kategori",
    "isbn",
    "jumlah_eksemplar",
    "sumber",
    "harga",
    "bahasa",
    "deskripsi",
    "rak",
    "tanggal_input",
    "created_at",
    "updated_at",
];

pub const BUKU_TAB: &str = "buku";

impl BukuRow {
    pub fn to_cells(&self) -> Vec<String> {
        vec![
            self.kode_buku.clone(),
            self.judul.clone(),
            self.pengarang.clone(),
            self.penerbit.clone(),
            self.tahun_terbit.clone(),
            self.kode_ddc.clone(),
            self.kategori.clone(),
            self.isbn.clone(),
            self.jumlah_eksemplar.clone(),
            self.sumber.clone(),
            self.harga.clone(),
            self.bahasa.clone(),
            self.deskripsi.clone(),
            self.rak.clone(),
            self.tanggal_input.clone(),
            self.created_at.clone(),
            self.updated_at.clone(),
        ]
    }

    pub fn from_cells(cells: &[String]) -> BukuRow {
        let pick = |i: usize| cells.get(i).cloned().unwrap_or_default();
        BukuRow {
            kode_buku: pick(0),
            judul: pick(1),
            pengarang: pick(2),
            penerbit: pick(3),
            tahun_terbit: pick(4),
            kode_ddc: pick(5),
            kategori: pick(6),
            isbn: pick(7),
            jumlah_eksemplar: pick(8),
            sumber: pick(9),
            harga: pick(10),
            bahasa: pick(11),
            deskripsi: pick(12),
            rak: pick(13),
            tanggal_input: pick(14),
            created_at: pick(15),
            updated_at: pick(16),
        }
    }
}

pub fn read_all_buku(conn: &Connection) -> AppResult<Vec<BukuRow>> {
    let mut stmt = conn.prepare(
        "SELECT kode_buku,
                judul,
                COALESCE(pengarang,''),
                COALESCE(penerbit,''),
                COALESCE(CAST(tahun_terbit AS TEXT),''),
                COALESCE(kode_ddc,''),
                COALESCE(kategori,''),
                COALESCE(isbn,''),
                CAST(jumlah_eksemplar AS TEXT),
                COALESCE(sumber,''),
                CAST(harga AS TEXT),
                COALESCE(bahasa,''),
                COALESCE(deskripsi,''),
                COALESCE(rak,''),
                tanggal_input,
                created_at,
                updated_at
           FROM buku
          ORDER BY kode_buku ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BukuRow {
            kode_buku: row.get(0)?,
            judul: row.get(1)?,
            pengarang: row.get(2)?,
            penerbit: row.get(3)?,
            tahun_terbit: row.get(4)?,
            kode_ddc: row.get(5)?,
            kategori: row.get(6)?,
            isbn: row.get(7)?,
            jumlah_eksemplar: row.get(8)?,
            sumber: row.get(9)?,
            harga: row.get(10)?,
            bahasa: row.get(11)?,
            deskripsi: row.get(12)?,
            rak: row.get(13)?,
            tanggal_input: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Upsert one buku row from Sheets. Last-write-wins on `updated_at`.
/// `jumlah_tersedia` is intentionally NOT synced — it's derived from
/// eksemplar status and would race with peminjaman pulls.
pub fn upsert_buku(conn: &Connection, incoming: &BukuRow) -> AppResult<bool> {
    if incoming.kode_buku.trim().is_empty() {
        return Err(AppError::Validation(
            "buku row dari Sheets kekurangan kode_buku".into(),
        ));
    }
    let existing: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM buku WHERE kode_buku = ?1",
            rusqlite::params![&incoming.kode_buku],
            |row| row.get::<_, String>(0),
        )
        .ok();
    let tahun: Option<i64> = incoming.tahun_terbit.parse::<i64>().ok();
    let jumlah: i64 = incoming.jumlah_eksemplar.parse::<i64>().unwrap_or(0).max(0);
    let harga: i64 = incoming.harga.parse::<i64>().unwrap_or(0).max(0);
    if let Some(local_ts) = existing {
        if incoming.updated_at <= local_ts {
            return Ok(false);
        }
        conn.execute(
            "UPDATE buku
                SET judul             = ?1,
                    pengarang         = NULLIF(?2,''),
                    penerbit          = NULLIF(?3,''),
                    tahun_terbit      = ?4,
                    kode_ddc          = NULLIF(?5,''),
                    kategori          = NULLIF(?6,''),
                    isbn              = NULLIF(?7,''),
                    jumlah_eksemplar  = ?8,
                    sumber            = NULLIF(?9,''),
                    harga             = ?10,
                    bahasa            = NULLIF(?11,''),
                    deskripsi         = NULLIF(?12,''),
                    rak               = NULLIF(?13,''),
                    tanggal_input     = COALESCE(NULLIF(?14,''), tanggal_input),
                    updated_at        = ?15
              WHERE kode_buku = ?16",
            rusqlite::params![
                incoming.judul,
                incoming.pengarang,
                incoming.penerbit,
                tahun,
                incoming.kode_ddc,
                incoming.kategori,
                incoming.isbn,
                jumlah,
                incoming.sumber,
                harga,
                incoming.bahasa,
                incoming.deskripsi,
                incoming.rak,
                incoming.tanggal_input,
                incoming.updated_at,
                incoming.kode_buku,
            ],
        )?;
        return Ok(true);
    }
    conn.execute(
        "INSERT INTO buku (
            kode_buku, judul, pengarang, penerbit, tahun_terbit,
            kode_ddc, kategori, isbn, jumlah_eksemplar, jumlah_tersedia,
            sumber, harga, bahasa, deskripsi, rak,
            tanggal_input, created_at, updated_at
         ) VALUES (?1, ?2, NULLIF(?3,''), NULLIF(?4,''), ?5,
                  NULLIF(?6,''), NULLIF(?7,''), NULLIF(?8,''), ?9, ?9,
                  NULLIF(?10,''), ?11, NULLIF(?12,''), NULLIF(?13,''), NULLIF(?14,''),
                  COALESCE(NULLIF(?15,''), date('now')),
                  COALESCE(NULLIF(?16,''), datetime('now')),
                  COALESCE(NULLIF(?17,''), datetime('now')))",
        rusqlite::params![
            incoming.kode_buku,
            incoming.judul,
            incoming.pengarang,
            incoming.penerbit,
            tahun,
            incoming.kode_ddc,
            incoming.kategori,
            incoming.isbn,
            jumlah,
            incoming.sumber,
            harga,
            incoming.bahasa,
            incoming.deskripsi,
            incoming.rak,
            incoming.tanggal_input,
            incoming.created_at,
            incoming.updated_at,
        ],
    )?;
    Ok(true)
}

// ============================================================================
// Eksemplar — per-copy rows. Resolves buku_id via kode_buku FK lookup.
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EksemplarRow {
    pub kode_eksemplar: String,
    pub kode_buku: String,
    pub status: String,
    pub catatan: String,
    pub created_at: String,
    pub updated_at: String,
}

pub const EKSEMPLAR_HEADER: &[&str] = &[
    "kode_eksemplar",
    "kode_buku",
    "status",
    "catatan",
    "created_at",
    "updated_at",
];

pub const EKSEMPLAR_TAB: &str = "eksemplar";

impl EksemplarRow {
    pub fn to_cells(&self) -> Vec<String> {
        vec![
            self.kode_eksemplar.clone(),
            self.kode_buku.clone(),
            self.status.clone(),
            self.catatan.clone(),
            self.created_at.clone(),
            self.updated_at.clone(),
        ]
    }

    pub fn from_cells(cells: &[String]) -> EksemplarRow {
        let pick = |i: usize| cells.get(i).cloned().unwrap_or_default();
        EksemplarRow {
            kode_eksemplar: pick(0),
            kode_buku: pick(1),
            status: pick(2),
            catatan: pick(3),
            created_at: pick(4),
            updated_at: pick(5),
        }
    }
}

pub fn read_all_eksemplar(conn: &Connection) -> AppResult<Vec<EksemplarRow>> {
    let mut stmt = conn.prepare(
        "SELECT e.kode_eksemplar,
                b.kode_buku,
                e.status,
                COALESCE(e.catatan,''),
                e.created_at,
                e.updated_at
           FROM eksemplar e
           JOIN buku b ON b.id = e.buku_id
          ORDER BY e.kode_eksemplar ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(EksemplarRow {
            kode_eksemplar: row.get(0)?,
            kode_buku: row.get(1)?,
            status: row.get(2)?,
            catatan: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn upsert_eksemplar(conn: &Connection, incoming: &EksemplarRow) -> AppResult<bool> {
    if incoming.kode_eksemplar.trim().is_empty() {
        return Err(AppError::Validation(
            "eksemplar row dari Sheets kekurangan kode_eksemplar".into(),
        ));
    }
    if incoming.kode_buku.trim().is_empty() {
        return Err(AppError::Validation(
            "eksemplar row dari Sheets kekurangan kode_buku".into(),
        ));
    }
    let buku_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM buku WHERE kode_buku = ?1",
            rusqlite::params![&incoming.kode_buku],
            |row| row.get::<_, i64>(0),
        )
        .ok();
    let buku_id = match buku_id {
        Some(id) => id,
        None => {
            return Err(AppError::Validation(format!(
                "eksemplar '{}' merujuk buku '{}' yang belum ada secara lokal",
                incoming.kode_eksemplar, incoming.kode_buku
            )));
        }
    };
    let existing: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM eksemplar WHERE kode_eksemplar = ?1",
            rusqlite::params![&incoming.kode_eksemplar],
            |row| row.get::<_, String>(0),
        )
        .ok();
    if let Some(local_ts) = existing {
        if incoming.updated_at <= local_ts {
            return Ok(false);
        }
        conn.execute(
            "UPDATE eksemplar
                SET buku_id    = ?1,
                    status     = ?2,
                    catatan    = NULLIF(?3,''),
                    updated_at = ?4
              WHERE kode_eksemplar = ?5",
            rusqlite::params![
                buku_id,
                incoming.status,
                incoming.catatan,
                incoming.updated_at,
                incoming.kode_eksemplar,
            ],
        )?;
        return Ok(true);
    }
    conn.execute(
        "INSERT INTO eksemplar (
            buku_id, kode_eksemplar, status, catatan, created_at, updated_at
         ) VALUES (?1, ?2, ?3, NULLIF(?4,''),
                  COALESCE(NULLIF(?5,''), datetime('now')),
                  COALESCE(NULLIF(?6,''), datetime('now')))",
        rusqlite::params![
            buku_id,
            incoming.kode_eksemplar,
            incoming.status,
            incoming.catatan,
            incoming.created_at,
            incoming.updated_at,
        ],
    )?;
    Ok(true)
}

// ============================================================================
// Peminjaman — header rows. Resolves anggota_id via kode_anggota FK lookup.
// `peminjaman_item` rows are NOT synced in this MVP — multi-item loans
// would need a separate tab; we keep header-only for now.
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeminjamanRow {
    pub nomor_pinjam: String,
    pub kode_anggota: String,
    pub tanggal_pinjam: String,
    pub tanggal_jatuh_tempo: String,
    pub tanggal_kembali: String,
    pub status: String,
    pub total_denda: String,
    pub total_bayar: String,
    pub kali_perpanjangan: String,
    pub catatan: String,
    pub created_at: String,
    pub updated_at: String,
}

pub const PEMINJAMAN_HEADER: &[&str] = &[
    "nomor_pinjam",
    "kode_anggota",
    "tanggal_pinjam",
    "tanggal_jatuh_tempo",
    "tanggal_kembali",
    "status",
    "total_denda",
    "total_bayar",
    "kali_perpanjangan",
    "catatan",
    "created_at",
    "updated_at",
];

pub const PEMINJAMAN_TAB: &str = "peminjaman";

impl PeminjamanRow {
    pub fn to_cells(&self) -> Vec<String> {
        vec![
            self.nomor_pinjam.clone(),
            self.kode_anggota.clone(),
            self.tanggal_pinjam.clone(),
            self.tanggal_jatuh_tempo.clone(),
            self.tanggal_kembali.clone(),
            self.status.clone(),
            self.total_denda.clone(),
            self.total_bayar.clone(),
            self.kali_perpanjangan.clone(),
            self.catatan.clone(),
            self.created_at.clone(),
            self.updated_at.clone(),
        ]
    }

    pub fn from_cells(cells: &[String]) -> PeminjamanRow {
        let pick = |i: usize| cells.get(i).cloned().unwrap_or_default();
        PeminjamanRow {
            nomor_pinjam: pick(0),
            kode_anggota: pick(1),
            tanggal_pinjam: pick(2),
            tanggal_jatuh_tempo: pick(3),
            tanggal_kembali: pick(4),
            status: pick(5),
            total_denda: pick(6),
            total_bayar: pick(7),
            kali_perpanjangan: pick(8),
            catatan: pick(9),
            created_at: pick(10),
            updated_at: pick(11),
        }
    }
}

pub fn read_all_peminjaman(conn: &Connection) -> AppResult<Vec<PeminjamanRow>> {
    let mut stmt = conn.prepare(
        "SELECT p.nomor_pinjam,
                a.kode_anggota,
                p.tanggal_pinjam,
                p.tanggal_jatuh_tempo,
                COALESCE(p.tanggal_kembali,''),
                p.status,
                CAST(p.total_denda AS TEXT),
                CAST(p.total_bayar AS TEXT),
                CAST(p.kali_perpanjangan AS TEXT),
                COALESCE(p.catatan,''),
                p.created_at,
                p.updated_at
           FROM peminjaman p
           JOIN anggota a ON a.id = p.anggota_id
          ORDER BY p.nomor_pinjam ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(PeminjamanRow {
            nomor_pinjam: row.get(0)?,
            kode_anggota: row.get(1)?,
            tanggal_pinjam: row.get(2)?,
            tanggal_jatuh_tempo: row.get(3)?,
            tanggal_kembali: row.get(4)?,
            status: row.get(5)?,
            total_denda: row.get(6)?,
            total_bayar: row.get(7)?,
            kali_perpanjangan: row.get(8)?,
            catatan: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn upsert_peminjaman(conn: &Connection, incoming: &PeminjamanRow) -> AppResult<bool> {
    if incoming.nomor_pinjam.trim().is_empty() {
        return Err(AppError::Validation(
            "peminjaman row dari Sheets kekurangan nomor_pinjam".into(),
        ));
    }
    if incoming.kode_anggota.trim().is_empty() {
        return Err(AppError::Validation(
            "peminjaman row dari Sheets kekurangan kode_anggota".into(),
        ));
    }
    let anggota_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM anggota WHERE kode_anggota = ?1",
            rusqlite::params![&incoming.kode_anggota],
            |row| row.get::<_, i64>(0),
        )
        .ok();
    let anggota_id = match anggota_id {
        Some(id) => id,
        None => {
            return Err(AppError::Validation(format!(
                "peminjaman '{}' merujuk anggota '{}' yang belum ada secara lokal",
                incoming.nomor_pinjam, incoming.kode_anggota
            )));
        }
    };
    let total_denda: i64 = incoming.total_denda.parse::<i64>().unwrap_or(0).max(0);
    let total_bayar: i64 = incoming.total_bayar.parse::<i64>().unwrap_or(0).max(0);
    let kali_perpanjangan: i64 = incoming.kali_perpanjangan.parse::<i64>().unwrap_or(0).max(0);
    let existing: Option<String> = conn
        .query_row(
            "SELECT updated_at FROM peminjaman WHERE nomor_pinjam = ?1",
            rusqlite::params![&incoming.nomor_pinjam],
            |row| row.get::<_, String>(0),
        )
        .ok();
    if let Some(local_ts) = existing {
        if incoming.updated_at <= local_ts {
            return Ok(false);
        }
        conn.execute(
            "UPDATE peminjaman
                SET anggota_id          = ?1,
                    tanggal_pinjam      = ?2,
                    tanggal_jatuh_tempo = ?3,
                    tanggal_kembali     = NULLIF(?4,''),
                    status              = ?5,
                    total_denda         = ?6,
                    total_bayar         = ?7,
                    kali_perpanjangan   = ?8,
                    catatan             = NULLIF(?9,''),
                    updated_at          = ?10
              WHERE nomor_pinjam = ?11",
            rusqlite::params![
                anggota_id,
                incoming.tanggal_pinjam,
                incoming.tanggal_jatuh_tempo,
                incoming.tanggal_kembali,
                incoming.status,
                total_denda,
                total_bayar,
                kali_perpanjangan,
                incoming.catatan,
                incoming.updated_at,
                incoming.nomor_pinjam,
            ],
        )?;
        return Ok(true);
    }
    conn.execute(
        "INSERT INTO peminjaman (
            nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo,
            tanggal_kembali, status, total_denda, total_bayar,
            kali_perpanjangan, catatan, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, NULLIF(?5,''), ?6, ?7, ?8, ?9, NULLIF(?10,''),
                  COALESCE(NULLIF(?11,''), datetime('now')),
                  COALESCE(NULLIF(?12,''), datetime('now')))",
        rusqlite::params![
            incoming.nomor_pinjam,
            anggota_id,
            incoming.tanggal_pinjam,
            incoming.tanggal_jatuh_tempo,
            incoming.tanggal_kembali,
            incoming.status,
            total_denda,
            total_bayar,
            kali_perpanjangan,
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

    // ========================================================================
    // Buku / Eksemplar / Peminjaman roundtrip tests (v1.0.9 sheets sync extend)
    // ========================================================================

    fn open_conn_with_buku_chain() -> Connection {
        let conn = open_conn_with_anggota();
        conn.execute_batch(
            r#"
            CREATE TABLE buku (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                kode_buku         TEXT    NOT NULL UNIQUE,
                judul             TEXT    NOT NULL,
                pengarang         TEXT,
                penerbit          TEXT,
                tahun_terbit      INTEGER,
                kode_ddc          TEXT,
                kategori          TEXT,
                isbn              TEXT,
                jumlah_eksemplar  INTEGER NOT NULL DEFAULT 1,
                jumlah_tersedia   INTEGER NOT NULL DEFAULT 1,
                sumber            TEXT,
                harga             INTEGER NOT NULL DEFAULT 0,
                cover_path        TEXT,
                bahasa            TEXT,
                deskripsi         TEXT,
                rak               TEXT,
                tanggal_input     TEXT NOT NULL DEFAULT (date('now')),
                created_at        TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE eksemplar (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                buku_id       INTEGER NOT NULL,
                kode_eksemplar TEXT   NOT NULL UNIQUE,
                status        TEXT    NOT NULL DEFAULT 'tersedia',
                catatan       TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (buku_id) REFERENCES buku(id) ON DELETE CASCADE
            );
            CREATE TABLE peminjaman (
                id                            INTEGER PRIMARY KEY AUTOINCREMENT,
                nomor_pinjam                  TEXT    NOT NULL UNIQUE,
                anggota_id                    INTEGER NOT NULL,
                tanggal_pinjam                TEXT    NOT NULL DEFAULT (date('now')),
                tanggal_jatuh_tempo           TEXT    NOT NULL,
                tanggal_kembali               TEXT,
                status                        TEXT    NOT NULL DEFAULT 'dipinjam',
                total_denda                   INTEGER NOT NULL DEFAULT 0,
                total_bayar                   INTEGER NOT NULL DEFAULT 0,
                kali_perpanjangan             INTEGER NOT NULL DEFAULT 0,
                tanggal_perpanjangan_terakhir TEXT,
                petugas_id                    INTEGER,
                catatan                       TEXT,
                created_at                    TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at                    TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE RESTRICT
            );
            "#,
        )
        .unwrap();
        conn
    }

    fn buku_fixture() -> BukuRow {
        BukuRow {
            kode_buku: "B0001".into(),
            judul: "Bumi Manusia".into(),
            pengarang: "Pramoedya".into(),
            penerbit: "Hasta Mitra".into(),
            tahun_terbit: "1980".into(),
            kode_ddc: "899.221".into(),
            kategori: "Fiksi".into(),
            isbn: "9789799731234".into(),
            jumlah_eksemplar: "3".into(),
            sumber: "BOS".into(),
            harga: "85000".into(),
            bahasa: "Indonesia".into(),
            deskripsi: "Tetralogi Buru jilid 1".into(),
            rak: "A1".into(),
            tanggal_input: "2024-01-01".into(),
            created_at: "2024-01-01 00:00:00".into(),
            updated_at: "2024-06-01 00:00:00".into(),
        }
    }

    #[test]
    fn buku_to_cells_and_from_cells_roundtrip() {
        let original = buku_fixture();
        let cells = original.to_cells();
        assert_eq!(cells.len(), BUKU_HEADER.len());
        let restored = BukuRow::from_cells(&cells);
        assert_eq!(original, restored);
    }

    #[test]
    fn upsert_buku_inserts_new_row() {
        let conn = open_conn_with_buku_chain();
        let r = buku_fixture();
        let changed = upsert_buku(&conn, &r).unwrap();
        assert!(changed);
        let judul: String = conn
            .query_row(
                "SELECT judul FROM buku WHERE kode_buku='B0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(judul, "Bumi Manusia");
    }

    #[test]
    fn upsert_buku_skips_when_incoming_older() {
        let conn = open_conn_with_buku_chain();
        let r = buku_fixture();
        upsert_buku(&conn, &r).unwrap();
        let mut older = r.clone();
        older.judul = "should not apply".into();
        older.updated_at = "2023-01-01 00:00:00".into();
        let changed = upsert_buku(&conn, &older).unwrap();
        assert!(!changed);
    }

    #[test]
    fn upsert_buku_rejects_empty_kode() {
        let conn = open_conn_with_buku_chain();
        let mut r = buku_fixture();
        r.kode_buku.clear();
        let err = upsert_buku(&conn, &r).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("kode_buku")),
            _ => panic!("expected Validation"),
        }
    }

    fn eksemplar_fixture() -> EksemplarRow {
        EksemplarRow {
            kode_eksemplar: "B0001-01".into(),
            kode_buku: "B0001".into(),
            status: "tersedia".into(),
            catatan: String::new(),
            created_at: "2024-01-01 00:00:00".into(),
            updated_at: "2024-06-01 00:00:00".into(),
        }
    }

    #[test]
    fn eksemplar_to_cells_and_from_cells_roundtrip() {
        let original = eksemplar_fixture();
        let cells = original.to_cells();
        assert_eq!(cells.len(), EKSEMPLAR_HEADER.len());
        let restored = EksemplarRow::from_cells(&cells);
        assert_eq!(original, restored);
    }

    #[test]
    fn upsert_eksemplar_resolves_buku_id_via_kode_buku() {
        let conn = open_conn_with_buku_chain();
        upsert_buku(&conn, &buku_fixture()).unwrap();
        let buku_id_expected: i64 = conn
            .query_row(
                "SELECT id FROM buku WHERE kode_buku='B0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let changed = upsert_eksemplar(&conn, &eksemplar_fixture()).unwrap();
        assert!(changed);
        let buku_id_actual: i64 = conn
            .query_row(
                "SELECT buku_id FROM eksemplar WHERE kode_eksemplar='B0001-01'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(buku_id_actual, buku_id_expected);
    }

    #[test]
    fn upsert_eksemplar_fails_when_buku_missing() {
        let conn = open_conn_with_buku_chain();
        // Don't insert buku first
        let err = upsert_eksemplar(&conn, &eksemplar_fixture()).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("buku")),
            _ => panic!("expected Validation"),
        }
    }

    fn peminjaman_fixture() -> PeminjamanRow {
        PeminjamanRow {
            nomor_pinjam: "PJ-0001".into(),
            kode_anggota: "A0001".into(),
            tanggal_pinjam: "2024-06-01".into(),
            tanggal_jatuh_tempo: "2024-06-08".into(),
            tanggal_kembali: String::new(),
            status: "dipinjam".into(),
            total_denda: "0".into(),
            total_bayar: "0".into(),
            kali_perpanjangan: "0".into(),
            catatan: String::new(),
            created_at: "2024-06-01 00:00:00".into(),
            updated_at: "2024-06-01 00:00:00".into(),
        }
    }

    #[test]
    fn peminjaman_to_cells_and_from_cells_roundtrip() {
        let original = peminjaman_fixture();
        let cells = original.to_cells();
        assert_eq!(cells.len(), PEMINJAMAN_HEADER.len());
        let restored = PeminjamanRow::from_cells(&cells);
        assert_eq!(original, restored);
    }

    #[test]
    fn upsert_peminjaman_resolves_anggota_id_via_kode_anggota() {
        let conn = open_conn_with_buku_chain();
        upsert_anggota(&conn, &fixture_row()).unwrap();
        let anggota_id_expected: i64 = conn
            .query_row(
                "SELECT id FROM anggota WHERE kode_anggota='A0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let changed = upsert_peminjaman(&conn, &peminjaman_fixture()).unwrap();
        assert!(changed);
        let anggota_id_actual: i64 = conn
            .query_row(
                "SELECT anggota_id FROM peminjaman WHERE nomor_pinjam='PJ-0001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(anggota_id_actual, anggota_id_expected);
    }

    #[test]
    fn upsert_peminjaman_fails_when_anggota_missing() {
        let conn = open_conn_with_buku_chain();
        // Don't insert anggota first
        let err = upsert_peminjaman(&conn, &peminjaman_fixture()).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("anggota")),
            _ => panic!("expected Validation"),
        }
    }
}
