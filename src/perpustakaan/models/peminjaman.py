"""Repository untuk transaksi Peminjaman & Pengembalian."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from perpustakaan.db.connection import Database, get_db, transaction
from perpustakaan.models.settings import get_int as setting_int


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _today() -> str:
    return date.today().isoformat()


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _next_nomor(db: Database) -> str:
    """Format: PJ-YYYYMMDD-#### (sequence harian)."""
    today = _today().replace("-", "")
    prefix = f"PJ-{today}-"
    row = db.query_one(
        "SELECT nomor_pinjam FROM peminjaman WHERE nomor_pinjam LIKE ? "
        "ORDER BY nomor_pinjam DESC LIMIT 1",
        (f"{prefix}%",),
    )
    if row is None:
        return f"{prefix}0001"
    last = row["nomor_pinjam"][len(prefix):]
    try:
        n = int(last) + 1
    except ValueError:
        n = 1
    return f"{prefix}{n:04d}"


# ---------------------------------------------------------------------------
# Pinjam
# ---------------------------------------------------------------------------
def pinjam(
    anggota_id: int,
    buku_ids: list[int],
    *,
    petugas_id: int | None = None,
    catatan: str = "",
    lama_hari: int | None = None,
    tambah_kunjungan: bool = True,
    db: Database | None = None,
) -> int:
    """Buat peminjaman baru untuk anggota dengan daftar ``buku_ids``.

    Validasi:
        * Anggota harus aktif
        * Tidak melebihi maks. buku per anggota (settings)
        * Setiap buku harus punya eksemplar tersedia
    """
    db = db or get_db()
    if not buku_ids:
        raise ValueError("Tidak ada buku yang dipilih")

    anggota = db.query_one("SELECT * FROM anggota WHERE id = ?", (anggota_id,))
    if anggota is None or not int(anggota["aktif"]):
        raise ValueError("Anggota tidak ditemukan / tidak aktif")

    maks = setting_int("transaksi.maks_buku_pinjam", default=2, db=db)
    aktif = int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item pi "
            "JOIN peminjaman p ON p.id = pi.peminjaman_id "
            "WHERE p.anggota_id = ? AND pi.status = 'dipinjam'",
            (anggota_id,),
        )
        or 0
    )
    if aktif + len(buku_ids) > maks:
        raise ValueError(
            f"Melebihi maksimal {maks} buku per anggota (saat ini sudah {aktif})"
        )

    lama = (
        lama_hari
        if lama_hari is not None
        else setting_int("transaksi.lama_pinjam_hari", default=7, db=db)
    )
    tgl_pinjam = date.today()
    tgl_jt = (tgl_pinjam + timedelta(days=lama)).isoformat()

    with transaction(db):
        nomor = _next_nomor(db)
        cur = db.execute(
            "INSERT INTO peminjaman "
            "(nomor_pinjam, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, "
            " petugas_id, catatan) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (nomor, anggota_id, tgl_pinjam.isoformat(), tgl_jt, petugas_id, catatan),
        )
        peminjaman_id = int(cur.lastrowid or 0)

        for bid in buku_ids:
            # Cari eksemplar tersedia
            eks = db.query_one(
                "SELECT id, kode_eksemplar FROM eksemplar "
                "WHERE buku_id = ? AND status = 'tersedia' LIMIT 1",
                (bid,),
            )
            if eks is None:
                raise ValueError(
                    f"Tidak ada eksemplar tersedia untuk buku id={bid}"
                )
            db.execute(
                "INSERT INTO peminjaman_item (peminjaman_id, buku_id, eksemplar_id) "
                "VALUES (?, ?, ?)",
                (peminjaman_id, bid, eks["id"]),
            )
            db.execute(
                "UPDATE eksemplar SET status = 'dipinjam' WHERE id = ?",
                (eks["id"],),
            )
            db.execute(
                "UPDATE buku SET jumlah_tersedia = jumlah_tersedia - 1 "
                "WHERE id = ? AND jumlah_tersedia > 0",
                (bid,),
            )

        if tambah_kunjungan:
            db.execute(
                "INSERT INTO kunjungan (anggota_id, sumber, keperluan, petugas_id) "
                "VALUES (?, 'peminjaman', 'Peminjaman buku', ?)",
                (anggota_id, petugas_id),
            )
    return peminjaman_id


# ---------------------------------------------------------------------------
# Pengembalian
# ---------------------------------------------------------------------------
def kembalikan(
    peminjaman_item_id: int,
    *,
    bayar: int = 0,
    petugas_id: int | None = None,
    db: Database | None = None,
) -> dict:
    """Kembalikan satu item peminjaman, hitung denda otomatis.

    :returns: dict berisi ``denda``, ``status``, ``hari_terlambat``.
    """
    db = db or get_db()
    item = db.query_one(
        "SELECT pi.*, p.tanggal_jatuh_tempo, p.anggota_id "
        "FROM peminjaman_item pi "
        "JOIN peminjaman p ON p.id = pi.peminjaman_id "
        "WHERE pi.id = ?",
        (peminjaman_item_id,),
    )
    if item is None:
        raise ValueError("Item peminjaman tidak ditemukan")
    if item["status"] != "dipinjam":
        raise ValueError(f"Item sudah berstatus {item['status']!r}")

    jt = datetime.fromisoformat(item["tanggal_jatuh_tempo"]).date()
    today = date.today()
    hari_terlambat = max(0, (today - jt).days)
    denda_hari = setting_int("transaksi.denda_per_hari", default=500, db=db)
    denda = hari_terlambat * denda_hari

    with transaction(db):
        db.execute(
            "UPDATE peminjaman_item SET status = 'dikembalikan', "
            "tanggal_kembali = ?, denda = ? WHERE id = ?",
            (today.isoformat(), denda, peminjaman_item_id),
        )
        if item["eksemplar_id"]:
            db.execute(
                "UPDATE eksemplar SET status = 'tersedia' WHERE id = ?",
                (item["eksemplar_id"],),
            )
        db.execute(
            "UPDATE buku SET jumlah_tersedia = jumlah_tersedia + 1 WHERE id = ?",
            (item["buku_id"],),
        )

        # Update header status
        _refresh_header_status(db, int(item["peminjaman_id"]))

        # Catat kas (denda bayar)
        if bayar > 0:
            db.execute(
                "INSERT INTO kas (keterangan, jenis, nominal, sumber, "
                "referensi_id, referensi_tipe, petugas_id) "
                "VALUES (?, 'masuk', ?, 'denda', ?, 'peminjaman_item', ?)",
                (
                    f"Denda pengembalian item #{peminjaman_item_id}",
                    bayar,
                    peminjaman_item_id,
                    petugas_id,
                ),
            )
            db.execute(
                "UPDATE peminjaman SET total_bayar = total_bayar + ?, "
                "total_denda = total_denda + ? WHERE id = ?",
                (bayar, denda, item["peminjaman_id"]),
            )
        else:
            db.execute(
                "UPDATE peminjaman SET total_denda = total_denda + ? WHERE id = ?",
                (denda, item["peminjaman_id"]),
            )
    return {"denda": denda, "hari_terlambat": hari_terlambat, "status": "dikembalikan"}


# ---------------------------------------------------------------------------
# Buku Hilang
# ---------------------------------------------------------------------------
def tandai_hilang(
    peminjaman_item_id: int,
    *,
    bayar: int = 0,
    petugas_id: int | None = None,
    db: Database | None = None,
) -> dict:
    db = db or get_db()
    item = db.query_one(
        "SELECT pi.*, b.harga FROM peminjaman_item pi "
        "JOIN buku b ON b.id = pi.buku_id WHERE pi.id = ?",
        (peminjaman_item_id,),
    )
    if item is None:
        raise ValueError("Item peminjaman tidak ditemukan")
    if item["status"] not in ("dipinjam", "terlambat"):
        raise ValueError(f"Item sudah berstatus {item['status']!r}")

    persen = setting_int("transaksi.denda_buku_hilang_persen", default=100, db=db)
    denda = int(round(int(item["harga"] or 0) * persen / 100))

    with transaction(db):
        db.execute(
            "UPDATE peminjaman_item SET status = 'hilang', "
            "tanggal_kembali = date('now'), denda = ? WHERE id = ?",
            (denda, peminjaman_item_id),
        )
        if item["eksemplar_id"]:
            db.execute(
                "UPDATE eksemplar SET status = 'hilang' WHERE id = ?",
                (item["eksemplar_id"],),
            )
        db.execute(
            "UPDATE buku SET jumlah_eksemplar = MAX(jumlah_eksemplar - 1, 0) "
            "WHERE id = ?",
            (item["buku_id"],),
        )
        _refresh_header_status(db, int(item["peminjaman_id"]))

        if bayar > 0:
            db.execute(
                "INSERT INTO kas (keterangan, jenis, nominal, sumber, "
                "referensi_id, referensi_tipe, petugas_id) "
                "VALUES (?, 'masuk', ?, 'hilang', ?, 'peminjaman_item', ?)",
                (
                    f"Ganti rugi buku hilang #{peminjaman_item_id}",
                    bayar,
                    peminjaman_item_id,
                    petugas_id,
                ),
            )
    return {"denda": denda, "status": "hilang"}


def _refresh_header_status(db: Database, peminjaman_id: int) -> None:
    rows = db.query_all(
        "SELECT status FROM peminjaman_item WHERE peminjaman_id = ?",
        (peminjaman_id,),
    )
    statuses = {r["status"] for r in rows}
    if statuses == {"dikembalikan"} or statuses == {"hilang"} or statuses == {
        "dikembalikan",
        "hilang",
    }:
        new = "dikembalikan"
    elif "dipinjam" in statuses and (
        "dikembalikan" in statuses or "hilang" in statuses
    ):
        new = "sebagian"
    else:
        new = "dipinjam"
    db.execute(
        "UPDATE peminjaman SET status = ? WHERE id = ?", (new, peminjaman_id)
    )


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------
def list_aktif_anggota(anggota_id: int, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT pi.id AS item_id, pi.buku_id, b.kode_buku, b.judul, "
        "p.nomor_pinjam, p.tanggal_pinjam, p.tanggal_jatuh_tempo, pi.status "
        "FROM peminjaman_item pi "
        "JOIN peminjaman p ON p.id = pi.peminjaman_id "
        "JOIN buku b ON b.id = pi.buku_id "
        "WHERE p.anggota_id = ? AND pi.status = 'dipinjam' "
        "ORDER BY p.tanggal_pinjam DESC",
        (anggota_id,),
    )


def list_aktif(db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all("SELECT * FROM v_peminjaman_aktif ORDER BY tanggal_pinjam DESC")


def get_header(peminjaman_id: int, db: Database | None = None) -> dict | None:
    db = db or get_db()
    return db.query_one("SELECT * FROM peminjaman WHERE id = ?", (peminjaman_id,))


def list_items(peminjaman_id: int, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT pi.*, b.kode_buku, b.judul "
        "FROM peminjaman_item pi JOIN buku b ON b.id = pi.buku_id "
        "WHERE pi.peminjaman_id = ?",
        (peminjaman_id,),
    )


# ---------------------------------------------------------------------------
# Stats untuk dashboard
# ---------------------------------------------------------------------------
def count_dipinjam(db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item WHERE status = 'dipinjam'"
        )
        or 0
    )


def count_dikembalikan(db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item WHERE status = 'dikembalikan'"
        )
        or 0
    )


def count_terlambat(db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item pi "
            "JOIN peminjaman p ON p.id = pi.peminjaman_id "
            "WHERE pi.status = 'dipinjam' AND date(p.tanggal_jatuh_tempo) < date('now')"
        )
        or 0
    )


def count_hilang(db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar("SELECT COUNT(*) FROM peminjaman_item WHERE status = 'hilang'")
        or 0
    )


def list_jatuh_tempo_segera(
    days_ahead: int = 2, db: Database | None = None
) -> list[dict]:
    """Reminder: peminjaman yang jatuh tempo dalam N hari atau sudah terlambat."""
    db = db or get_db()
    return db.query_all(
        "SELECT pi.id AS item_id, p.nomor_pinjam, a.kode_anggota, a.nama, "
        "b.kode_buku, b.judul, p.tanggal_jatuh_tempo, "
        "CAST(julianday(p.tanggal_jatuh_tempo) - julianday(date('now')) AS INTEGER) AS sisa_hari "
        "FROM peminjaman_item pi "
        "JOIN peminjaman p ON p.id = pi.peminjaman_id "
        "JOIN anggota a ON a.id = p.anggota_id "
        "JOIN buku b ON b.id = pi.buku_id "
        "WHERE pi.status = 'dipinjam' "
        "  AND julianday(p.tanggal_jatuh_tempo) - julianday(date('now')) <= ? "
        "ORDER BY p.tanggal_jatuh_tempo ASC",
        (days_ahead,),
    )


def top_peminjam(limit: int = 10, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT a.id, a.kode_anggota, a.nama, a.kelas, COUNT(pi.id) AS jumlah "
        "FROM peminjaman_item pi "
        "JOIN peminjaman p ON p.id = pi.peminjaman_id "
        "JOIN anggota a ON a.id = p.anggota_id "
        "GROUP BY a.id ORDER BY jumlah DESC LIMIT ?",
        (limit,),
    )


def top_buku(limit: int = 10, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT b.id, b.kode_buku, b.judul, b.pengarang, COUNT(pi.id) AS jumlah "
        "FROM peminjaman_item pi JOIN buku b ON b.id = pi.buku_id "
        "GROUP BY b.id ORDER BY jumlah DESC LIMIT ?",
        (limit,),
    )
