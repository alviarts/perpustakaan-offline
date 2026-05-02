-- ============================================================================
-- Perpustakaan Offline (SIM-Perpus reborn) -- SQLite schema v0.1.0
--
-- Konvensi:
--   * tanggal/waktu disimpan sebagai TEXT ISO-8601 (YYYY-MM-DD / YYYY-MM-DD HH:MM:SS)
--   * uang dalam INTEGER (rupiah, tanpa desimal)
--   * setiap tabel utama menyimpan created_at / updated_at untuk sync
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ----------------------------------------------------------------------------
-- Meta / migrasi
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Setting (key/value)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- Pengguna aplikasi (login)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    full_name     TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'admin',  -- admin | pustakawan
    aktif         INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- DDC reference (Dewey Decimal Classification)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ddc (
    kode       TEXT PRIMARY KEY,
    deskripsi  TEXT NOT NULL,
    parent     TEXT,
    -- depth: 0 = ratusan (000), 1 = puluhan (010), 2 = satuan (011), 3+ = subkelas
    depth      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ddc_parent ON ddc(parent);

-- ----------------------------------------------------------------------------
-- Kelas (untuk anggota = siswa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kelas (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    tingkat INTEGER,            -- 7,8,9 / 10,11,12
    urutan  INTEGER NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- Penerbit (master)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penerbit (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nama  TEXT NOT NULL UNIQUE,
    kota  TEXT
);

-- ----------------------------------------------------------------------------
-- Anggota (siswa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anggota (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_anggota    TEXT    NOT NULL UNIQUE,
    nama            TEXT    NOT NULL,
    jenis_kelamin   TEXT,                        -- L | P
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
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anggota_nama  ON anggota(nama);
CREATE INDEX IF NOT EXISTS idx_anggota_kelas ON anggota(kelas);
CREATE INDEX IF NOT EXISTS idx_anggota_aktif ON anggota(aktif);

-- ----------------------------------------------------------------------------
-- Buku
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buku (
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
    sumber            TEXT,                         -- BOS, hibah, dll
    harga             INTEGER NOT NULL DEFAULT 0,
    cover_path        TEXT,
    bahasa            TEXT,
    deskripsi         TEXT,
    rak               TEXT,
    tanggal_input     TEXT NOT NULL DEFAULT (date('now')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (kode_ddc) REFERENCES ddc(kode) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_buku_judul     ON buku(judul);
CREATE INDEX IF NOT EXISTS idx_buku_pengarang ON buku(pengarang);
CREATE INDEX IF NOT EXISTS idx_buku_penerbit  ON buku(penerbit);
CREATE INDEX IF NOT EXISTS idx_buku_kode_ddc  ON buku(kode_ddc);
CREATE INDEX IF NOT EXISTS idx_buku_isbn      ON buku(isbn);

-- ----------------------------------------------------------------------------
-- Eksemplar (per-copy tracking, untuk barcode unik per buku fisik)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eksemplar (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    buku_id       INTEGER NOT NULL,
    kode_eksemplar TEXT   NOT NULL UNIQUE,           -- ex: B0001-01, B0001-02
    status        TEXT    NOT NULL DEFAULT 'tersedia', -- tersedia | dipinjam | hilang | rusak
    catatan       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (buku_id) REFERENCES buku(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eksemplar_buku   ON eksemplar(buku_id);
CREATE INDEX IF NOT EXISTS idx_eksemplar_status ON eksemplar(status);

-- ----------------------------------------------------------------------------
-- Peminjaman (header)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peminjaman (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nomor_pinjam        TEXT    NOT NULL UNIQUE,
    anggota_id          INTEGER NOT NULL,
    tanggal_pinjam      TEXT    NOT NULL DEFAULT (date('now')),
    tanggal_jatuh_tempo TEXT    NOT NULL,
    tanggal_kembali     TEXT,
    -- status: dipinjam | dikembalikan | sebagian | terlambat | hilang
    status              TEXT    NOT NULL DEFAULT 'dipinjam',
    total_denda         INTEGER NOT NULL DEFAULT 0,
    total_bayar         INTEGER NOT NULL DEFAULT 0,
    petugas_id          INTEGER,
    catatan             TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE RESTRICT,
    FOREIGN KEY (petugas_id) REFERENCES users(id)   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_peminjaman_anggota ON peminjaman(anggota_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_status  ON peminjaman(status);
CREATE INDEX IF NOT EXISTS idx_peminjaman_tgl     ON peminjaman(tanggal_pinjam);

-- ----------------------------------------------------------------------------
-- Peminjaman item (detail per buku)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peminjaman_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    peminjaman_id   INTEGER NOT NULL,
    buku_id         INTEGER NOT NULL,
    eksemplar_id    INTEGER,
    -- status: dipinjam | dikembalikan | hilang
    status          TEXT    NOT NULL DEFAULT 'dipinjam',
    tanggal_kembali TEXT,
    denda           INTEGER NOT NULL DEFAULT 0,
    catatan         TEXT,
    FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
    FOREIGN KEY (buku_id)       REFERENCES buku(id)       ON DELETE RESTRICT,
    FOREIGN KEY (eksemplar_id)  REFERENCES eksemplar(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_peminjaman_item_pmj  ON peminjaman_item(peminjaman_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_item_buku ON peminjaman_item(buku_id);
CREATE INDEX IF NOT EXISTS idx_peminjaman_item_status ON peminjaman_item(status);

-- ----------------------------------------------------------------------------
-- Kunjungan
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kunjungan (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    anggota_id  INTEGER,                           -- NULL untuk Kunjungan Kelas / massal
    tanggal     TEXT NOT NULL DEFAULT (date('now')),
    jam         TEXT NOT NULL DEFAULT (time('now')),
    keperluan   TEXT,
    sumber      TEXT NOT NULL DEFAULT 'manual',    -- manual | peminjaman | pengembalian | kelas
    -- jika sumber = kelas, jumlah_orang menampung jumlah pengunjung
    jumlah_orang INTEGER NOT NULL DEFAULT 1,
    kelas       TEXT,
    petugas_id  INTEGER,
    catatan     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (anggota_id) REFERENCES anggota(id) ON DELETE SET NULL,
    FOREIGN KEY (petugas_id) REFERENCES users(id)   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_tgl     ON kunjungan(tanggal);
CREATE INDEX IF NOT EXISTS idx_kunjungan_anggota ON kunjungan(anggota_id);

-- ----------------------------------------------------------------------------
-- Kas (cashbook)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal         TEXT    NOT NULL DEFAULT (date('now')),
    keterangan      TEXT    NOT NULL,
    jenis           TEXT    NOT NULL,           -- masuk | keluar
    nominal         INTEGER NOT NULL,
    sumber          TEXT    NOT NULL DEFAULT 'manual', -- manual | denda | hilang | modal
    referensi_id   INTEGER,
    referensi_tipe TEXT,                         -- peminjaman_id, dll
    petugas_id     INTEGER,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kas_tgl     ON kas(tanggal);
CREATE INDEX IF NOT EXISTS idx_kas_jenis   ON kas(jenis);

-- ----------------------------------------------------------------------------
-- Permissions (RBAC v0.4.3) — katalog permission keys yang dikenal aplikasi.
-- Diisi otomatis oleh seed_permissions() berdasarkan registry Python.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    key         TEXT PRIMARY KEY,           -- ex: anggota.tambah, buku.hapus
    label       TEXT NOT NULL,              -- label ringkas (Bahasa Indonesia default)
    description TEXT,
    area        TEXT NOT NULL,              -- anggota | buku | kunjungan | peminjaman | pengembalian | laporan | setting | audit_log
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_permissions_area ON permissions(area);

-- ----------------------------------------------------------------------------
-- User permissions (RBAC v0.4.3) — grant tabel many-to-many user × permission.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id        INTEGER NOT NULL,
    permission_key TEXT    NOT NULL,
    granted_by     INTEGER,                  -- user_id yg memberikan grant (NULL = sistem/seed)
    granted_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, permission_key),
    FOREIGN KEY (user_id)        REFERENCES users(id)         ON DELETE CASCADE,
    FOREIGN KEY (permission_key) REFERENCES permissions(key)  ON DELETE CASCADE,
    FOREIGN KEY (granted_by)     REFERENCES users(id)         ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_key  ON user_permissions(permission_key);

-- ----------------------------------------------------------------------------
-- Audit log (siapa-melakukan-apa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    aksi        TEXT NOT NULL,                  -- create | update | delete | login | logout
    entitas     TEXT NOT NULL,                  -- nama tabel
    entitas_id  INTEGER,
    detail      TEXT,                           -- JSON optional
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entitas ON audit_log(entitas, entitas_id);

-- ----------------------------------------------------------------------------
-- View: peminjaman_aktif (header dengan jumlah item belum dikembalikan)
-- ----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_peminjaman_aktif AS
SELECT
    p.id,
    p.nomor_pinjam,
    p.anggota_id,
    a.kode_anggota,
    a.nama AS nama_anggota,
    p.tanggal_pinjam,
    p.tanggal_jatuh_tempo,
    p.status,
    COUNT(pi.id) AS jumlah_buku,
    SUM(CASE WHEN pi.status = 'dipinjam' THEN 1 ELSE 0 END) AS jumlah_belum_kembali
FROM peminjaman p
JOIN anggota a ON a.id = p.anggota_id
LEFT JOIN peminjaman_item pi ON pi.peminjaman_id = p.id
WHERE p.status IN ('dipinjam', 'sebagian', 'terlambat')
GROUP BY p.id;

-- ----------------------------------------------------------------------------
-- Triggers untuk updated_at otomatis
-- ----------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_anggota_updated
AFTER UPDATE ON anggota
FOR EACH ROW
BEGIN
    UPDATE anggota SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_buku_updated
AFTER UPDATE ON buku
FOR EACH ROW
BEGIN
    UPDATE buku SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_eksemplar_updated
AFTER UPDATE ON eksemplar
FOR EACH ROW
BEGIN
    UPDATE eksemplar SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_peminjaman_updated
AFTER UPDATE ON peminjaman
FOR EACH ROW
BEGIN
    UPDATE peminjaman SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_users_updated
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_updated
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
    UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
END;

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
