use std::path::{Path, PathBuf};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

const SCHEMA_SQL: &str = include_str!("schema.sql");
const DEFAULT_ADMIN_USERNAME: &str = "admin";
const DEFAULT_ADMIN_PASSWORD: &str = "admin123";

pub fn app_data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Production database path. Always returns the real DB file regardless of
/// whether sandbox mode is currently active — used by the sandbox toggle
/// (to seed `demo.db`) and by the audit log writer (so toggle history is
/// preserved across sandbox enables/disables).
pub fn prod_db_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app_data_dir(app)?.join("perpustakaan-v2.db"))
}

/// Sandbox / demo database path (D5-SandboxDemoMode).
pub fn demo_db_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app_data_dir(app)?.join("perpustakaan-v2-demo.db"))
}

/// Path of the persisted sandbox-active flag. The presence of the file
/// (with content `"1"`) means sandbox mode should be re-enabled on next
/// startup. We use a separate plain file rather than the `settings` table
/// so sandbox state is decoupled from whichever DB is currently mounted.
pub fn sandbox_flag_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app_data_dir(app)?.join("sandbox.flag"))
}

/// Read the persisted sandbox flag. Defaults to `false` if the file is
/// missing or unreadable so a clean install always boots into prod mode.
pub fn read_sandbox_flag(app: &AppHandle) -> bool {
    let Ok(path) = sandbox_flag_path(app) else {
        return false;
    };
    matches!(std::fs::read_to_string(&path), Ok(s) if s.trim() == "1")
}

/// Persist the sandbox flag to disk. Writes `"1"` when on, removes the file
/// when off so a fresh install never accidentally inherits sandbox mode
/// from a stale file.
pub fn write_sandbox_flag(app: &AppHandle, on: bool) -> AppResult<()> {
    let path = sandbox_flag_path(app)?;
    if on {
        std::fs::write(&path, "1")?;
    } else if path.exists() {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

/// Resolve the DB path to mount at startup. Picks `demo.db` when the
/// sandbox flag is set, the production DB otherwise. Existing callers
/// (dashboard system-health, manual backup, scheduler) keep working without
/// modification.
pub fn resolve_db_path(app: &AppHandle) -> AppResult<PathBuf> {
    if read_sandbox_flag(app) {
        demo_db_path(app)
    } else {
        prod_db_path(app)
    }
}

pub fn open_connection(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    conn.execute_batch(MASTER_DATA_SQL)?;
    conn.execute_batch(KTA_SQL)?;
    conn.execute_batch(LABEL_BUKU_SQL)?;
    conn.execute_batch(BACKUP_HISTORY_SQL)?;
    conn.execute_batch(SURAT_SQL)?;
    conn.execute_batch(WISHLIST_SQL)?;
    conn.execute_batch(SYNC_SQL)?;
    conn.execute_batch(SANDBOX_AUDIT_SQL)?;
    conn.execute_batch(BUKU_PILIHAN_SQL)?;
    conn.execute_batch(AKREDITASI_SQL)?;
    apply_additive_migrations(conn)?;
    backfill_missing_eksemplar(conn)?;
    seed_master_data(conn)?;
    seed_kta_default_template(conn)?;
    seed_label_buku_default_template(conn)?;
    crate::commands::surat::seed_default_surat_settings(conn)?;
    log::info!("schema migrations applied (idempotent)");
    Ok(())
}

/// Surat keterangan bebas pustaka log (FEAT-21). Each row is one printed
/// surat; deletion is intentionally not exposed via a Tauri command so the
/// audit trail of nomor_surat → anggota assignments is preserved.
const SURAT_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS surat_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id    INTEGER NOT NULL,
    nomor_surat   TEXT    NOT NULL UNIQUE,
    tanggal_cetak TEXT    NOT NULL DEFAULT (date('now')),
    pdf_path      TEXT,
    petugas_id    INTEGER,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
    FOREIGN KEY (petugas_id) REFERENCES users(id)   ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_surat_log_anggota ON surat_log(anggota_id);
CREATE INDEX IF NOT EXISTS idx_surat_log_tanggal ON surat_log(tanggal_cetak);
"#;

/// Wishlist anggota / request pengadaan buku (FEAT-22). Status enum is
/// validated server-side in `commands::wishlist::is_valid_transition`.
const WISHLIST_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS wishlist_buku (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id    INTEGER NOT NULL,
    judul         TEXT    NOT NULL,
    pengarang     TEXT,
    isbn          TEXT,
    alasan        TEXT,
    status        TEXT    NOT NULL DEFAULT 'pending',
    catatan_admin TEXT,
    buku_id       INTEGER,
    upvote_count  INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id)    REFERENCES buku(id)    ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist_buku(status);
CREATE INDEX IF NOT EXISTS idx_wishlist_anggota ON wishlist_buku(anggota_id);
"#;

/// Sync metadata tables for FEAT-26 Google Sheets bidirectional sync (PR G
/// v1.0.8). `sync_state` keeps a per-table cursor (last successful push/pull
/// timestamps + a content-hash sentinel that lets us short-circuit no-op
/// pushes); `sync_log` is an append-only audit trail rendered in the
/// Sinkronisasi page so the admin can see what happened on the last cycle.
const SYNC_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS sync_state (
    table_name      TEXT PRIMARY KEY,
    last_push_at    TEXT,
    last_pull_at    TEXT,
    last_push_hash  TEXT,
    last_pull_hash  TEXT,
    rows_pushed     INTEGER NOT NULL DEFAULT 0,
    rows_pulled     INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts           TEXT NOT NULL DEFAULT (datetime('now')),
    direction    TEXT NOT NULL CHECK (direction IN ('push','pull','test')),
    table_name   TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('ok','error','skipped','noop')),
    rows_changed INTEGER NOT NULL DEFAULT 0,
    message      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_log_ts ON sync_log(ts DESC);
"#;

/// D5-SandboxDemoMode — append-only log of sandbox toggles. Lives in the
/// production DB (never in the demo copy) so toggle history is preserved
/// across `enable_sandbox` overwrites of `demo.db`.
const SANDBOX_AUDIT_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS sandbox_audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT NOT NULL DEFAULT (datetime('now')),
    action    TEXT NOT NULL CHECK (action IN ('enable','disable')),
    user_id   INTEGER,
    note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sandbox_audit_ts ON sandbox_audit_log(ts DESC);
"#;

/// E1-OPACBukuPilihan — admin-pinned "buku pilihan" carousel feed for the
/// OPAC home page. Capped to 5 active pins by the RPC layer; an `expires_at`
/// timestamp lets curated promotions auto-retire (e.g. "tema bulan literasi"
/// rolls off when the month ends). `position` controls render order.
const BUKU_PILIHAN_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS buku_pilihan (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    buku_id     INTEGER NOT NULL UNIQUE,
    position    INTEGER NOT NULL DEFAULT 0,
    pinned_at   TEXT NOT NULL DEFAULT (datetime('now')),
    label       TEXT,
    expires_at  TEXT,
    FOREIGN KEY (buku_id) REFERENCES buku(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_buku_pilihan_position ON buku_pilihan(position ASC);
"#;

/// "Akreditasi" module — library jenjang profile (single row, id=1). Holds the
/// accreditation-specific identity (which jenjang/SNP applies, NPP, SK
/// pendirian, and the school-year start month used by compliance reports).
/// General identity (nama, alamat, NPSN, logo) lives in the `settings` table.
const AKREDITASI_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS akreditasi_profil (
    id                 INTEGER PRIMARY KEY CHECK (id = 1),
    jenjang            TEXT,
    npp                TEXT,
    sk_pendirian       TEXT,
    tahun_ajaran_awal  INTEGER NOT NULL DEFAULT 7,
    catatan            TEXT,
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Data akreditasi non-operasional (tenaga, anggaran, sarana) yang tak ada di
-- tabel inti. Disimpan sebagai JSON blob agar fleksibel lintas jenjang.
CREATE TABLE IF NOT EXISTS akreditasi_manual (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data_json  TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklist bukti fisik (legalitas/POS/laporan). `kode` mengacu ke registry
-- BUKTI_WAJIB di @perpustakaan/shared.
CREATE TABLE IF NOT EXISTS akreditasi_bukti (
    kode       TEXT PRIMARY KEY,
    ada        INTEGER NOT NULL DEFAULT 0,
    catatan    TEXT,
    file_path  TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jawaban butir penilaian per jenjang. `jawaban` = 'a'|'b'|'c'|'d' (NULL =
-- belum dijawab). Skor/predikat dihitung di frontend dari katalog instrumen.
CREATE TABLE IF NOT EXISTS akreditasi_butir (
    jenjang    TEXT    NOT NULL,
    komponen   INTEGER NOT NULL,
    butir      INTEGER NOT NULL,
    jawaban    TEXT,
    catatan    TEXT,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (jenjang, komponen, butir)
);

-- Arsip laporan/buku bukti yang sudah "disahkan" (snapshot immutable):
-- menyimpan hasil lengkap dalam JSON agar tak berubah saat data bertambah.
CREATE TABLE IF NOT EXISTS laporan_arsip (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    jenis         TEXT NOT NULL,
    jenjang       TEXT,
    periode       TEXT,
    nilai         REAL,
    predikat      TEXT,
    konten_json   TEXT NOT NULL,
    penandatangan TEXT,
    jabatan       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

const KTA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS kta_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nama        TEXT    NOT NULL UNIQUE,
    deskripsi   TEXT,
    layout_json TEXT    NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kta_default ON kta_templates(is_default);
"#;

/// Label Buku templates — mirror of `kta_templates` for spine/cover labels
/// (v1.0.6 #22). Schema is identical so we can reuse the editor pattern; the
/// `layout_json` carries Avery-style field arrays with a different `kind`
/// vocabulary (`barcode`, `judul`, `kodeBuku`, `kodeEksemplar`, …).
const LABEL_BUKU_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS label_buku_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nama        TEXT    NOT NULL UNIQUE,
    deskripsi   TEXT,
    layout_json TEXT    NOT NULL,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_label_buku_default ON label_buku_templates(is_default);
"#;

/// FEAT-24 — backup history table (v1.0.8). Records every successful
/// backup (manual + scheduled, lokal + cloud + encrypted) so the operator
/// can browse / verify / restore previous backups from a single list.
///
/// Additive migration: empty on existing v1.0.7 databases, populated as new
/// backups are taken. Restoring an older backup that lacks this table is
/// safe because the next migration run recreates it idempotently.
const BACKUP_HISTORY_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS backup_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path         TEXT    NOT NULL,
    size_bytes   INTEGER NOT NULL DEFAULT 0,
    checksum     TEXT,
    dest_type    TEXT    NOT NULL DEFAULT 'lokal', -- lokal | gdrive | dropbox | rclone
    dest_label   TEXT,
    encrypted    INTEGER NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'sukses', -- sukses | gagal
    error        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_history_dest    ON backup_history(dest_type);
"#;

const MASTER_DATA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS kategori (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    deskripsi TEXT,
    urutan INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bahasa (
    kode TEXT PRIMARY KEY,
    nama TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS jurusan (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    kode  TEXT,
    urutan INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agama (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    urutan INTEGER NOT NULL DEFAULT 0
);
"#;

/// Default seed values for master data tables. Inserted only on first launch
/// (when the table is empty) so manual edits in Settings persist across upgrades.
fn seed_master_data(conn: &Connection) -> AppResult<()> {
    seed_if_empty(conn, "agama", AGAMA_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO agama (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "kategori", KATEGORI_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO kategori (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "kelas", KELAS_SEED, |conn, idx, name| {
        let tingkat = name
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse::<i64>()
            .ok();
        conn.execute(
            "INSERT INTO kelas (nama, tingkat, urutan) VALUES (?1, ?2, ?3)",
            rusqlite::params![name, tingkat, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_if_empty(conn, "jurusan", JURUSAN_SEED, |conn, idx, name| {
        conn.execute(
            "INSERT INTO jurusan (nama, urutan) VALUES (?1, ?2)",
            rusqlite::params![name, idx as i64],
        )
        .map(|_| ())
    })?;
    seed_bahasa_if_empty(conn)?;
    seed_ddc_defaults(conn)?;
    Ok(())
}

const AGAMA_SEED: &[&str] = &["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

const KATEGORI_SEED: &[&str] = &[
    "Fiksi",
    "Non-fiksi",
    "Referensi",
    "Buku Pelajaran",
    "Karya Ilmiah",
    "Majalah",
    "Komik",
    "Biografi",
];

const KELAS_SEED: &[&str] = &[
    "7A", "7B", "7C", "8A", "8B", "8C", "9A", "9B", "9C", "10A", "10B", "10C", "11A", "11B", "11C",
    "12A", "12B", "12C",
];

const JURUSAN_SEED: &[&str] = &["IPA", "IPS", "Bahasa", "TKJ", "RPL", "Multimedia"];

const BAHASA_SEED: &[(&str, &str)] = &[
    ("id", "Indonesia"),
    ("en", "Inggris"),
    ("ar", "Arab"),
    ("jw", "Jawa"),
    ("su", "Sunda"),
    ("zh", "Mandarin"),
    ("ja", "Jepang"),
    ("fr", "Prancis"),
    ("de", "Jerman"),
    ("ms", "Melayu"),
];

fn seed_if_empty<F>(conn: &Connection, table: &str, items: &[&str], mut insert: F) -> AppResult<()>
where
    F: FnMut(&Connection, usize, &str) -> rusqlite::Result<()>,
{
    let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
        row.get(0)
    })?;
    if count > 0 {
        return Ok(());
    }
    for (idx, name) in items.iter().enumerate() {
        insert(conn, idx, name)?;
    }
    log::info!("seeded {} default rows into {table}", items.len());
    Ok(())
}

fn seed_bahasa_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM bahasa", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    for (kode, nama) in BAHASA_SEED {
        conn.execute(
            "INSERT INTO bahasa (kode, nama) VALUES (?1, ?2)",
            rusqlite::params![kode, nama],
        )?;
    }
    log::info!("seeded {} default bahasa rows", BAHASA_SEED.len());
    Ok(())
}

/// Dewey Decimal Classification — 10 main classes (000-900). Indonesian
/// labels match the conventions used by Indonesian school libraries (BUG-004).
const DDC_MAIN_CLASSES: &[(&str, &str)] = &[
    // 000 — Karya Umum
    ("000", "Karya Umum"),
    ("004", "Ilmu Komputer"),
    ("005", "Pemrograman & Program Komputer"),
    ("005.1", "Pemrograman"),
    ("005.133", "Bahasa Pemrograman (Python, Java, C++, dsb.)"),
    ("020", "Ilmu Perpustakaan & Informasi"),
    ("025", "Operasi Perpustakaan"),
    ("028", "Membaca & Literasi"),
    // 100 — Filsafat & Psikologi
    ("100", "Filsafat & Psikologi"),
    ("150", "Psikologi"),
    ("152", "Psikologi Persepsi"),
    ("155", "Psikologi Perkembangan"),
    // 200 — Agama
    ("200", "Agama"),
    ("297", "Agama Islam"),
    ("297.1", "Sumber Ajaran Islam (Al-Qur'an)"),
    ("297.2", "Hadis"),
    ("297.3", "Aqidah & Tauhid"),
    ("297.4", "Fikih"),
    ("297.5", "Akhlak & Tasawuf"),
    ("297.9", "Sejarah Islam"),
    // 300 — Ilmu Sosial
    ("300", "Ilmu Sosial"),
    ("302", "Interaksi Sosial"),
    ("303", "Proses Sosial"),
    ("305", "Kelompok Sosial"),
    ("310", "Statistik"),
    ("320", "Ilmu Politik"),
    ("330", "Ekonomi"),
    ("340", "Hukum"),
    ("370", "Pendidikan"),
    ("398", "Folklor & Cerita Rakyat"),
    // 400 — Bahasa
    ("400", "Bahasa"),
    ("410", "Linguistik"),
    ("420", "Bahasa Inggris"),
    ("425", "Tata Bahasa Inggris"),
    ("428", "Pemakaian Bahasa Inggris"),
    ("499", "Bahasa Nusantara"),
    // 500 — Sains
    ("500", "Sains Murni"),
    ("510", "Matematika"),
    ("520", "Astronomi"),
    ("530", "Fisika"),
    ("540", "Kimia"),
    ("550", "Ilmu Bumi"),
    ("570", "Biologi"),
    ("580", "Tumbuhan"),
    ("590", "Hewan"),
    // 600 — Teknologi
    ("600", "Teknologi & Sains Terapan"),
    ("610", "Kedokteran & Kesehatan"),
    ("620", "Teknik"),
    ("630", "Pertanian"),
    ("640", "Kesejahteraan Rumah Tangga"),
    ("650", "Manajemen"),
    ("658", "Manajemen Umum"),
    ("670", "Manufaktur"),
    ("690", "Konstruksi"),
    // 700 — Seni & Olahraga
    ("700", "Kesenian, Hiburan, Olahraga"),
    ("730", "Seni Patung"),
    ("740", "Menggambar & Seni Dekoratif"),
    ("741", "Menggambar & Seni Gambar"),
    ("741.4", "Ilustrasi & Ilustrator"),
    ("741.5", "Kartun, Karikatur & Komik"),
    ("741.6", "Seni Grafis Komersial (Ilustrasi Buku, Poster, Desain Grafis)"),
    ("750", "Lukisan"),
    ("760", "Seni Cetak & Cetakan"),
    ("770", "Fotografi"),
    ("780", "Musik"),
    ("790", "Olahraga & Rekreasi"),
    ("793", "Permainan Dalam Ruangan"),
    ("796", "Olahraga & Permainan Atletik"),
    // 800 — Sastra
    ("800", "Sastra"),
    ("810", "Sastra Amerika"),
    ("813", "Sastra Indonesia (Fiksi Indonesia)"),
    ("813.5", "Fiksi Indonesia"),
    ("820", "Sastra Inggris"),
    ("823", "Fiksi Inggris"),
    ("830", "Sastra Jerman"),
    ("895", "Sastra Asia"),
    ("899", "Sastra Nusantara"),
    ("899.221", "Sastra Indonesia"),
    // 900 — Sejarah & Geografi
    ("900", "Sejarah & Geografi"),
    ("909", "Sejarah Dunia"),
    ("910", "Geografi & Perjalanan"),
    ("920", "Biografi"),
    ("930", "Sejarah Dunia Kuno"),
    ("950", "Sejarah Asia"),
    ("959", "Sejarah Asia Tenggara"),
    ("959.8", "Sejarah Indonesia"),
    // --- Subdivisi tambahan (kelas lain) ---
    ("001", "Pengetahuan Umum"),
    ("002", "Buku & Penulisan"),
    ("004.6", "Jaringan Komputer"),
    ("004.678", "Internet & Web"),
    ("005.3", "Aplikasi & Perangkat Lunak"),
    ("005.4", "Sistem Operasi"),
    ("005.74", "Basis Data"),
    ("006.3", "Kecerdasan Buatan"),
    ("006.7", "Multimedia"),
    ("010", "Bibliografi"),
    ("030", "Ensiklopedia Umum"),
    ("050", "Majalah & Jurnal Umum"),
    ("060", "Organisasi & Asosiasi"),
    ("070", "Jurnalisme & Media"),
    ("101", "Teori Filsafat"),
    ("110", "Metafisika"),
    ("120", "Epistemologi"),
    ("130", "Fenomena Paranormal & Okultisme"),
    ("140", "Aliran Filsafat"),
    ("153", "Proses Mental & Kecerdasan"),
    ("158", "Psikologi Terapan"),
    ("160", "Logika"),
    ("170", "Etika"),
    ("180", "Filsafat Kuno & Oriental"),
    ("190", "Filsafat Modern Barat"),
    ("210", "Filsafat Agama"),
    ("220", "Alkitab"),
    ("230", "Kekristenan"),
    ("290", "Agama Lain"),
    ("297.6", "Sejarah & Biografi Islam"),
    ("297.7", "Dakwah"),
    ("301", "Sosiologi & Antropologi"),
    ("304", "Faktor Sosial"),
    ("306", "Kebudayaan & Adat"),
    ("350", "Administrasi Publik"),
    ("360", "Masalah & Layanan Sosial"),
    ("380", "Perdagangan & Komunikasi"),
    ("390", "Adat Istiadat & Folklor"),
    ("411", "Sistem Tulisan"),
    ("412", "Etimologi"),
    ("413", "Kamus"),
    ("415", "Tata Bahasa"),
    ("418", "Pemakaian Bahasa"),
    ("430", "Bahasa Jerman"),
    ("440", "Bahasa Prancis"),
    ("490", "Bahasa Lain"),
    ("511", "Matematika Umum"),
    ("512", "Aljabar"),
    ("513", "Aritmetika"),
    ("514", "Topologi"),
    ("515", "Analisis Matematika (Kalkulus)"),
    ("516", "Geometri"),
    ("519", "Matematika Terapan & Probabilitas"),
    ("560", "Paleontologi"),
    ("611", "Anatomi"),
    ("612", "Fisiologi"),
    ("613", "Kesehatan Pribadi"),
    ("614", "Kesehatan Masyarakat"),
    ("615", "Farmakologi & Terapi"),
    ("616", "Penyakit"),
    ("617", "Bedah & Kedokteran Gigi"),
    ("618", "Ginekologi & Obstetri"),
    ("621", "Teknik Mesin & Elektro"),
    ("624", "Teknik Sipil"),
    ("629", "Teknik Kendaraan"),
    ("633", "Tanaman Pangan"),
    ("635", "Hortikultura"),
    ("636", "Peternakan"),
    ("639", "Perikanan & Perburuan"),
    ("641", "Makanan & Minuman"),
    ("646", "Menjahit & Pakaian"),
    ("657", "Akuntansi"),
    ("659", "Periklanan & Humas"),
    ("660", "Teknologi Kimia"),
    ("680", "Produksi untuk Kegunaan Khusus"),
    ("710", "Perencanaan Kota & Lanskap"),
    ("720", "Arsitektur"),
    ("745", "Seni Dekoratif"),
    ("746", "Seni Tekstil & Kerajinan"),
    ("791", "Pertunjukan & Film"),
    ("792", "Teater"),
    ("808", "Retorika & Kumpulan Karya"),
    ("808.8", "Kumpulan Karya Sastra"),
    ("829", "Sastra Inggris Kuno"),
    ("840", "Sastra Prancis"),
    ("890", "Sastra Bahasa Lain"),
    ("901", "Filsafat Sejarah"),
    ("912", "Atlas & Peta"),
    ("929", "Silsilah & Nama"),
    ("940", "Sejarah Eropa"),
    ("951", "Sejarah Tiongkok"),
    ("959.82", "Sejarah Jakarta"),
];

fn ddc_parent(kode: &str) -> Option<String> {
    // Subdivisions after a decimal point hang off their 3-digit base,
    // e.g. 741.4 → 741, 813.5 → 813.
    if let Some((base, _)) = kode.split_once('.') {
        return if base.len() == 3 {
            Some(base.to_string())
        } else {
            None
        };
    }
    // 3-digit classes hang off their main class, e.g. 741 → 700.
    if kode.len() == 3 {
        let parent = kode[..1].to_string() + "00";
        if parent != kode {
            return Some(parent);
        }
    }
    None
}

fn ddc_depth(kode: &str) -> i64 {
    if kode.contains('.') {
        2
    } else if ddc_parent(kode).is_some() {
        1
    } else {
        0
    }
}

/// Idempotent, additive DDC seeding. Unlike a "seed once when empty" approach
/// this inserts any missing rows, so existing installations also gain the
/// newer subdivisions (e.g. 741.4–741.6 for illustration/comics/design).
fn seed_ddc_defaults(conn: &Connection) -> AppResult<()> {
    let mut inserted = 0usize;
    for (kode, deskripsi) in DDC_MAIN_CLASSES {
        inserted += conn.execute(
            "INSERT OR IGNORE INTO ddc (kode, deskripsi, parent, depth) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![kode, deskripsi, ddc_parent(kode), ddc_depth(kode)],
        )?;
    }
    if inserted > 0 {
        log::info!("seeded {inserted} default DDC rows");
    }
    Ok(())
}

/// Idempotent additive column migrations. Each entry adds a column to a table
/// only if it doesn't already exist, so old v1 databases keep working while
/// new v2 features (e.g. `anggota.agama` for session 4) get the columns they
/// need.
fn apply_additive_migrations(conn: &Connection) -> AppResult<()> {
    add_column_if_missing(conn, "anggota", "agama", "TEXT")?;
    // Forgot-password flow (PR-5): security question + bcrypt-hashed answer.
    // Nullable on existing rows so older v2 DBs upgrade in place; users that
    // never set a question simply cannot use the offline reset flow until an
    // admin fills it in via Settings → Akun.
    add_column_if_missing(conn, "users", "security_question", "TEXT")?;
    add_column_if_missing(conn, "users", "security_answer_hash", "TEXT")?;
    // FEAT-17: peminjaman extension counter and last-extension date. Default
    // 0 / NULL so v1.0.7-or-earlier rows behave as "never extended".
    add_column_if_missing(
        conn,
        "peminjaman",
        "kali_perpanjangan",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    add_column_if_missing(conn, "peminjaman", "tanggal_perpanjangan_terakhir", "TEXT")?;
    // Akreditasi module: member type (siswa|guru|tendik) for rasio tenaga/warga
    // sekolah + visitor reports, and material type (buku|serial|multimedia|
    // digital) for per-jenjang collection composition. NULL on existing rows.
    add_column_if_missing(conn, "anggota", "tipe", "TEXT")?;
    add_column_if_missing(conn, "buku", "jenis_material", "TEXT")?;
    // Denda berupa poin (alternatif denda uang). Disimpan per item dan
    // diakumulasi di header agar bisa dilaporkan tanpa menghitung ulang.
    add_column_if_missing(conn, "peminjaman", "total_poin", "INTEGER NOT NULL DEFAULT 0")?;
    add_column_if_missing(conn, "peminjaman_item", "poin", "INTEGER NOT NULL DEFAULT 0")?;
    Ok(())
}

/// Backfill missing `eksemplar` rows for any `buku` whose denormalized
/// `jumlah_eksemplar` exceeds the actual COUNT in `eksemplar`. The v1.0.8
/// FEAT-20 ISBN bulk import path INSERT-ed into `buku` only and never
/// created the per-copy rows that `cetak label` and `peminjaman` iterate
/// over, leaving books that looked importable but rejected with
/// "Buku terpilih tidak punya eksemplar untuk dicetak". This migration runs
/// on every startup so existing v1.0.8 databases self-heal without the user
/// re-importing.
///
/// Numbering follows `buku_create_inner`: `kode_buku` + `-NN` zero-padded to
/// two digits. We INSERT OR IGNORE so kodes already present (e.g. from a
/// prior partial backfill or a manual eksemplar) are kept intact.
fn backfill_missing_eksemplar(conn: &Connection) -> AppResult<()> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.kode_buku, b.jumlah_eksemplar,
                (SELECT COUNT(*) FROM eksemplar e WHERE e.buku_id = b.id) AS actual
           FROM buku b
          WHERE b.jumlah_eksemplar > (SELECT COUNT(*) FROM eksemplar e WHERE e.buku_id = b.id)",
    )?;
    let rows: Vec<(i64, String, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    if rows.is_empty() {
        return Ok(());
    }
    let mut total_inserted: i64 = 0;
    for (buku_id, kode_buku, jumlah, _actual) in &rows {
        for n in 1..=*jumlah {
            let kode_eksemplar = format!("{kode_buku}-{n:02}");
            let inserted = conn.execute(
                "INSERT OR IGNORE INTO eksemplar (buku_id, kode_eksemplar, status)
                 VALUES (?1, ?2, 'tersedia')",
                rusqlite::params![buku_id, kode_eksemplar],
            )?;
            total_inserted += inserted as i64;
        }
    }
    if total_inserted > 0 {
        log::info!(
            "backfilled {total_inserted} missing eksemplar row(s) across {} buku",
            rows.len()
        );
    }
    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    decl: &str,
) -> AppResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let existing: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    if !existing.iter().any(|c| c == column) {
        conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"))?;
        log::info!("added column {table}.{column}");
    }
    Ok(())
}

pub fn seed_default_admin(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let hash = bcrypt::hash(DEFAULT_ADMIN_PASSWORD, bcrypt::DEFAULT_COST)?;
    conn.execute(
        "INSERT INTO users (username, password_hash, full_name, role, aktif)
         VALUES (?1, ?2, ?3, 'admin', 1)",
        rusqlite::params![DEFAULT_ADMIN_USERNAME, hash, "Administrator"],
    )?;
    log::info!("seeded default admin user (username=admin)");
    Ok(())
}

/// Default KTA template seeded on first launch (BUG-005).
///
/// Mirrors `defaultLayout()` in `apps/desktop/src/lib/kta.ts` so the seeded
/// row matches what the frontend's mock store and "Reset ke template default"
/// button produce. ID-1 card (85.6mm × 53.98mm) with header, identitas
/// subtitle, foto, nama, kodeAnggota, kelas, and a QR for `member:<id>`.
const KTA_DEFAULT_TEMPLATE_NAME: &str = "Template Default";
const KTA_DEFAULT_TEMPLATE_DESC: &str = "Layout standar ID-1 dengan foto + QR";
const KTA_DEFAULT_LAYOUT_JSON: &str = r##"{
  "widthMm": 85.6,
  "heightMm": 53.98,
  "background": "#ffffff",
  "fields": [
    {"id":"header","kind":"static","text":"KARTU TANDA ANGGOTA","x":4,"y":6,"width":92,"height":8,"fontSize":10,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"identitas","kind":"identitas","x":4,"y":14,"width":92,"height":8,"fontSize":8,"color":"#475569","align":"center"},
    {"id":"foto","kind":"foto","x":4,"y":26,"width":22,"height":28},
    {"id":"nama","kind":"nama","x":30,"y":28,"width":50,"height":10,"fontSize":12,"fontWeight":"bold","color":"#0f172a","align":"left"},
    {"id":"kode","kind":"kodeAnggota","x":30,"y":38,"width":50,"height":6,"fontSize":8,"color":"#334155","align":"left"},
    {"id":"kelas","kind":"kelas","x":30,"y":44,"width":50,"height":6,"fontSize":8,"color":"#475569","align":"left"},
    {"id":"qr","kind":"qr","x":78,"y":28,"width":18,"height":18}
  ]
}"##;

/// Idempotently seed a single default KTA template if `kta_templates` is empty.
/// Without this, a fresh install opens "Cetak KTA → Pilih template" with an
/// empty dropdown and a disabled "Cetak" button (BUG-005).
fn seed_kta_default_template(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM kta_templates", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO kta_templates (nama, deskripsi, layout_json, is_default)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![
            KTA_DEFAULT_TEMPLATE_NAME,
            KTA_DEFAULT_TEMPLATE_DESC,
            KTA_DEFAULT_LAYOUT_JSON,
        ],
    )?;
    log::info!("seeded default kta_templates row (is_default=1)");
    Ok(())
}

/// Default Label Buku template seeded on first launch (v1.0.6 #22). Mirrors
/// `defaultLayout()` in `apps/desktop/src/lib/labelBuku.ts`. 70 × 35 mm
/// (Avery J8160-style) with header, judul, kodeBuku, kodeEksemplar, and a
/// Code-128 barcode of the kodeEksemplar.
const LABEL_BUKU_DEFAULT_TEMPLATE_NAME: &str = "Template Default";
const LABEL_BUKU_DEFAULT_TEMPLATE_DESC: &str = "Layout standar 70 × 35 mm dengan judul + barcode";
const LABEL_BUKU_DEFAULT_LAYOUT_JSON: &str = r##"{
  "widthMm": 70,
  "heightMm": 35,
  "background": "#ffffff",
  "fields": [
    {"id":"identitas","kind":"identitas","x":4,"y":4,"width":92,"height":10,"fontSize":9,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"judul","kind":"judul","x":4,"y":18,"width":92,"height":12,"fontSize":10,"fontWeight":"bold","color":"#0f172a","align":"center"},
    {"id":"kode","kind":"kodeBuku","x":4,"y":34,"width":40,"height":10,"fontSize":11,"fontWeight":"bold","color":"#0f172a","align":"left"},
    {"id":"barcode","kind":"barcode","x":4,"y":50,"width":92,"height":36},
    {"id":"kodeek","kind":"kodeEksemplar","x":4,"y":88,"width":92,"height":10,"fontSize":8,"color":"#475569","align":"center"}
  ]
}"##;

fn seed_label_buku_default_template(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM label_buku_templates", [], |row| {
        row.get(0)
    })?;
    if count > 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO label_buku_templates (nama, deskripsi, layout_json, is_default)
         VALUES (?1, ?2, ?3, 1)",
        rusqlite::params![
            LABEL_BUKU_DEFAULT_TEMPLATE_NAME,
            LABEL_BUKU_DEFAULT_TEMPLATE_DESC,
            LABEL_BUKU_DEFAULT_LAYOUT_JSON,
        ],
    )?;
    log::info!("seeded default label_buku_templates row (is_default=1)");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign_keys");
        run_migrations(&conn).expect("run migrations");
        conn
    }

    #[test]
    fn fresh_install_seeds_one_default_kta_template() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let default_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM kta_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(default_count, 1);
    }

    #[test]
    fn seeded_kta_template_layout_is_valid_json() {
        let conn = fresh_conn();
        let layout: String = conn
            .query_row(
                "SELECT layout_json FROM kta_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&layout).expect("layout_json must be valid JSON");
        assert!(parsed.is_object());
        let fields = parsed
            .get("fields")
            .and_then(|f| f.as_array())
            .expect("layout.fields must be array");
        assert!(
            fields.len() >= 5,
            "default layout must include the core KTA fields"
        );
        for f in fields {
            assert!(
                f.get("kind").and_then(|k| k.as_str()).is_some(),
                "every field must declare a kind"
            );
        }
        // Sanity: the kinds the frontend renderer expects.
        let kinds: std::collections::HashSet<&str> = fields
            .iter()
            .filter_map(|f| f.get("kind").and_then(|k| k.as_str()))
            .collect();
        for required in ["nama", "kodeAnggota", "kelas", "foto", "qr"] {
            assert!(
                kinds.contains(required),
                "default layout must include kind={required}"
            );
        }
    }

    #[test]
    fn kta_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        // Re-running migrations on the same connection must not duplicate the row.
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn kta_seed_skips_when_user_already_has_templates() {
        let conn = fresh_conn();
        // Simulate a v1.0.0 user who already manually added a template via
        // Settings → KTA before upgrading. Seeding must NOT overwrite or
        // duplicate it.
        conn.execute("DELETE FROM kta_templates", []).unwrap();
        conn.execute(
            "INSERT INTO kta_templates (nama, deskripsi, layout_json, is_default)
             VALUES ('Custom', NULL, '{\"fields\":[]}', 0)",
            [],
        )
        .unwrap();
        seed_kta_default_template(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let nama: String = conn
            .query_row("SELECT nama FROM kta_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nama, "Custom");
    }

    #[test]
    fn fresh_install_seeds_default_ddc_rows() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count as usize, DDC_MAIN_CLASSES.len());
        // The ten canonical main classes must all be present.
        for kode in [
            "000", "100", "200", "300", "400", "500", "600", "700", "800", "900",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM ddc WHERE kode = ?1",
                    [kode],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "missing main class {kode}");
        }
    }

    #[test]
    fn ddc_seed_includes_canonical_and_subdivision_rows() {
        let conn = fresh_conn();
        let mut stmt = conn
            .prepare("SELECT kode, deskripsi FROM ddc")
            .unwrap();
        let by_kode: std::collections::HashMap<String, String> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        // Main classes.
        assert_eq!(by_kode.get("000").map(String::as_str), Some("Karya Umum"));
        assert_eq!(by_kode.get("400").map(String::as_str), Some("Bahasa"));
        assert_eq!(by_kode.get("900").map(String::as_str), Some("Sejarah & Geografi"));
        // Subdivisions used by the catalog-code generator.
        assert_eq!(
            by_kode.get("741.4").map(String::as_str),
            Some("Ilustrasi & Ilustrator")
        );
        assert_eq!(
            by_kode.get("813").map(String::as_str),
            Some("Sastra Indonesia (Fiksi Indonesia)")
        );
        assert!(by_kode.contains_key("005.133"));
    }

    #[test]
    fn ddc_seed_main_classes_are_roots_and_subdivisions_have_parents() {
        let conn = fresh_conn();
        // Main classes: depth 0 with no parent.
        let main_wrong: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ddc \
                 WHERE kode IN ('000','100','200','300','400','500','600','700','800','900') \
                   AND (depth != 0 OR parent IS NOT NULL)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(main_wrong, 0);
        // Subdivisions: depth > 0 with a parent.
        let sub_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ddc WHERE depth > 0 AND parent IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(sub_count > 0);
        // 741.4 is a child of 741; 741 is a child of 700.
        let parent_741_4: String = conn
            .query_row("SELECT parent FROM ddc WHERE kode = '741.4'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(parent_741_4, "741");
        let parent_741: String = conn
            .query_row("SELECT parent FROM ddc WHERE kode = '741'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(parent_741, "700");
    }

    #[test]
    fn ddc_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count as usize, DDC_MAIN_CLASSES.len());
    }

    #[test]
    fn fresh_install_seeds_one_default_label_buku_template() {
        let conn = fresh_conn();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        let default_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM label_buku_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(default_count, 1);
    }

    #[test]
    fn seeded_label_buku_template_layout_is_valid_json_with_required_kinds() {
        let conn = fresh_conn();
        let layout: String = conn
            .query_row(
                "SELECT layout_json FROM label_buku_templates WHERE is_default = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(&layout).expect("layout_json must be valid JSON");
        assert!(parsed.is_object());
        let fields = parsed
            .get("fields")
            .and_then(|f| f.as_array())
            .expect("layout.fields must be array");
        let kinds: std::collections::HashSet<&str> = fields
            .iter()
            .filter_map(|f| f.get("kind").and_then(|k| k.as_str()))
            .collect();
        for required in ["judul", "kodeBuku", "kodeEksemplar", "barcode"] {
            assert!(
                kinds.contains(required),
                "default label layout must include kind={required}"
            );
        }
    }

    #[test]
    fn label_buku_seed_is_idempotent_across_runs() {
        let conn = fresh_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn label_buku_seed_skips_when_user_already_has_templates() {
        let conn = fresh_conn();
        conn.execute("DELETE FROM label_buku_templates", [])
            .unwrap();
        conn.execute(
            "INSERT INTO label_buku_templates (nama, deskripsi, layout_json, is_default)
             VALUES ('Custom', NULL, '{\"fields\":[]}', 0)",
            [],
        )
        .unwrap();
        seed_label_buku_default_template(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM label_buku_templates", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);
        let nama: String = conn
            .query_row("SELECT nama FROM label_buku_templates", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nama, "Custom");
    }

    #[test]
    fn ddc_seed_is_additive_and_preserves_user_rows() {
        // A v1.0.0 user may already have manual DDC entries. Seeding must
        // keep their custom row and add the missing defaults (no duplicates).
        let conn = fresh_conn();
        conn.execute("DELETE FROM ddc", []).unwrap();
        conn.execute(
            "INSERT INTO ddc (kode, deskripsi, parent, depth)
             VALUES ('CUSTOM', 'My local class', NULL, 0)",
            [],
        )
        .unwrap();
        seed_ddc_defaults(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count as usize, DDC_MAIN_CLASSES.len() + 1);
        let custom: i64 = conn
            .query_row("SELECT COUNT(*) FROM ddc WHERE kode = 'CUSTOM'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(custom, 1);
    }

    fn count_eksemplar_for(conn: &Connection, buku_id: i64) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?1",
            rusqlite::params![buku_id],
            |r| r.get(0),
        )
        .unwrap()
    }

    fn list_kode(conn: &Connection, buku_id: i64) -> Vec<String> {
        let mut stmt = conn
            .prepare(
                "SELECT kode_eksemplar FROM eksemplar WHERE buku_id = ?1 \
                 ORDER BY kode_eksemplar ASC",
            )
            .unwrap();
        stmt.query_map(rusqlite::params![buku_id], |r| r.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    #[test]
    fn backfill_creates_missing_eksemplar() {
        // Regression for v1.0.8 FEAT-20 ISBN bulk import: imported buku had
        // jumlah_eksemplar > 0 but zero rows in `eksemplar`, breaking cetak
        // label and peminjaman.
        let conn = fresh_conn();
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES ('B-LEGACY', 'Buku Lama', 3, 3)",
            [],
        )
        .unwrap();
        let buku_id = conn.last_insert_rowid();
        assert_eq!(count_eksemplar_for(&conn, buku_id), 0);

        backfill_missing_eksemplar(&conn).unwrap();

        assert_eq!(
            list_kode(&conn, buku_id),
            vec!["B-LEGACY-01", "B-LEGACY-02", "B-LEGACY-03"]
        );
    }

    #[test]
    fn backfill_is_idempotent() {
        let conn = fresh_conn();
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES ('B-RUN', 'Buku Run', 2, 2)",
            [],
        )
        .unwrap();
        let buku_id = conn.last_insert_rowid();

        backfill_missing_eksemplar(&conn).unwrap();
        backfill_missing_eksemplar(&conn).unwrap();
        backfill_missing_eksemplar(&conn).unwrap();

        assert_eq!(count_eksemplar_for(&conn, buku_id), 2);
    }

    #[test]
    fn backfill_skips_books_already_complete() {
        // A buku created via `buku_create_inner` already has all its
        // eksemplar rows; backfill must be a no-op for it.
        let conn = fresh_conn();
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES ('B-OK', 'Buku Ok', 2, 2)",
            [],
        )
        .unwrap();
        let buku_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, 'B-OK-01', 'tersedia')",
            rusqlite::params![buku_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, 'B-OK-02', 'dipinjam')",
            rusqlite::params![buku_id],
        )
        .unwrap();

        backfill_missing_eksemplar(&conn).unwrap();

        // Existing rows are intact (status not reset to 'tersedia').
        let dipinjam: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?1 AND status = 'dipinjam'",
                rusqlite::params![buku_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dipinjam, 1);
        assert_eq!(count_eksemplar_for(&conn, buku_id), 2);
    }

    #[test]
    fn backfill_fills_partial_gaps_without_overwriting() {
        // A buku where the user manually deleted some kodes; backfill must
        // only insert missing ones, keep custom kodes alone.
        let conn = fresh_conn();
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES ('B-MIX', 'Buku Mix', 3, 3)",
            [],
        )
        .unwrap();
        let buku_id = conn.last_insert_rowid();
        // Pre-existing: only kode -02 exists (e.g. -01 deleted, -03 not yet
        // created). Backfill must add -01 and -03 but leave -02 untouched.
        conn.execute(
            "INSERT INTO eksemplar (buku_id, kode_eksemplar, status) VALUES (?1, 'B-MIX-02', 'rusak')",
            rusqlite::params![buku_id],
        )
        .unwrap();

        backfill_missing_eksemplar(&conn).unwrap();

        assert_eq!(
            list_kode(&conn, buku_id),
            vec!["B-MIX-01", "B-MIX-02", "B-MIX-03"]
        );
        let rusak: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM eksemplar WHERE kode_eksemplar = 'B-MIX-02' AND status = 'rusak'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rusak, 1);
    }

    #[test]
    fn run_migrations_runs_backfill_automatically() {
        // End-to-end: open in-memory db, manually create a "v1.0.8 ISBN
        // import" row (buku without eksemplar), then run migrations again
        // and confirm backfill kicked in.
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO buku (kode_buku, judul, jumlah_eksemplar, jumlah_tersedia)
             VALUES ('B-V108', 'Buku v1.0.8 import', 2, 2)",
            [],
        )
        .unwrap();
        let buku_id = conn.last_insert_rowid();
        assert_eq!(count_eksemplar_for(&conn, buku_id), 0);

        // Re-run migrations (mimics next app launch on v1.0.9).
        run_migrations(&conn).unwrap();

        assert_eq!(count_eksemplar_for(&conn, buku_id), 2);
    }
}
