"""Repository untuk entitas Buku (+ eksemplar)."""
from __future__ import annotations

from typing import Any

from perpustakaan.db.connection import Database, get_db, transaction

FIELDS = (
    "kode_buku",
    "judul",
    "pengarang",
    "penerbit",
    "tahun_terbit",
    "kode_ddc",
    "kategori",
    "isbn",
    "jumlah_eksemplar",
    "jumlah_tersedia",
    "sumber",
    "harga",
    "cover_path",
    "bahasa",
    "deskripsi",
    "rak",
    "tanggal_input",
)


def next_kode(prefix: str = "B", db: Database | None = None) -> str:
    db = db or get_db()
    row = db.query_one(
        "SELECT kode_buku FROM buku WHERE kode_buku LIKE ? "
        "ORDER BY LENGTH(kode_buku) DESC, kode_buku DESC LIMIT 1",
        (f"{prefix}%",),
    )
    if row is None:
        return f"{prefix}0001"
    last = row["kode_buku"][len(prefix):]
    try:
        n = int(last) + 1
    except ValueError:
        n = 1
    width = max(len(last), 4)
    return f"{prefix}{n:0{width}d}"


def list_all(
    db: Database | None = None,
    *,
    search: str = "",
    kode_ddc: str = "",
    penerbit: str = "",
    limit: int = 0,
    offset: int = 0,
    order_by: str = "kode_buku",
) -> list[dict]:
    db = db or get_db()
    where = []
    params: list[Any] = []
    if search:
        where.append(
            "(judul LIKE ? OR kode_buku LIKE ? OR pengarang LIKE ? OR isbn LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like])
    if kode_ddc:
        where.append("kode_ddc LIKE ?")
        params.append(f"{kode_ddc}%")
    if penerbit:
        where.append("penerbit = ?")
        params.append(penerbit)

    sql = "SELECT * FROM buku"
    if where:
        sql += " WHERE " + " AND ".join(where)
    safe_order = order_by if order_by in {
        "kode_buku", "judul", "pengarang", "penerbit", "tahun_terbit", "kode_ddc"
    } else "kode_buku"
    sql += f" ORDER BY {safe_order} ASC"
    if limit:
        sql += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    return db.query_all(sql, tuple(params))


def get(id_: int, db: Database | None = None) -> dict | None:
    db = db or get_db()
    return db.query_one("SELECT * FROM buku WHERE id = ?", (id_,))


def get_by_kode(kode: str, db: Database | None = None) -> dict | None:
    db = db or get_db()
    return db.query_one("SELECT * FROM buku WHERE kode_buku = ?", (kode,))


def create(data: dict, db: Database | None = None) -> int:
    db = db or get_db()
    payload = {k: data.get(k) for k in FIELDS if data.get(k) not in (None, "")}
    if not payload.get("kode_buku"):
        payload["kode_buku"] = next_kode(db=db)
    if not payload.get("judul"):
        raise ValueError("judul wajib diisi")
    if not payload.get("jumlah_eksemplar"):
        payload["jumlah_eksemplar"] = 1
    if not payload.get("jumlah_tersedia"):
        payload["jumlah_tersedia"] = payload["jumlah_eksemplar"]

    cols = ", ".join(payload.keys())
    placeholders = ", ".join(["?"] * len(payload))
    with transaction(db):
        cur = db.execute(
            f"INSERT INTO buku ({cols}) VALUES ({placeholders})",
            tuple(payload.values()),
        )
        buku_id = int(cur.lastrowid or 0)
        # Buat eksemplar otomatis
        _create_eksemplar(db, buku_id, payload["kode_buku"], int(payload["jumlah_eksemplar"]))
    return buku_id


def _create_eksemplar(db: Database, buku_id: int, kode_buku: str, jumlah: int) -> None:
    for i in range(1, jumlah + 1):
        kode_eks = f"{kode_buku}-{i:02d}"
        db.execute(
            "INSERT OR IGNORE INTO eksemplar (buku_id, kode_eksemplar, status) "
            "VALUES (?, ?, 'tersedia')",
            (buku_id, kode_eks),
        )


def update(id_: int, data: dict, db: Database | None = None) -> None:
    db = db or get_db()
    payload = {k: data[k] for k in FIELDS if k in data}
    if not payload:
        return
    set_clause = ", ".join([f"{k} = ?" for k in payload])
    with transaction(db):
        db.execute(
            f"UPDATE buku SET {set_clause} WHERE id = ?",
            (*payload.values(), id_),
        )
        # Sync eksemplar jika jumlah berubah
        if "jumlah_eksemplar" in payload:
            row = db.query_one("SELECT kode_buku FROM buku WHERE id = ?", (id_,))
            if row is not None:
                kode_buku = row["kode_buku"]
                target = int(payload["jumlah_eksemplar"])
                existing = int(
                    db.scalar(
                        "SELECT COUNT(*) FROM eksemplar WHERE buku_id = ?", (id_,)
                    )
                    or 0
                )
                if target > existing:
                    for i in range(existing + 1, target + 1):
                        db.execute(
                            "INSERT OR IGNORE INTO eksemplar "
                            "(buku_id, kode_eksemplar, status) "
                            "VALUES (?, ?, 'tersedia')",
                            (id_, f"{kode_buku}-{i:02d}"),
                        )


def delete(id_: int, db: Database | None = None) -> None:
    db = db or get_db()
    aktif = int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item "
            "WHERE buku_id = ? AND status = 'dipinjam'",
            (id_,),
        )
        or 0
    )
    if aktif > 0:
        raise ValueError("Buku masih dipinjam, tidak bisa dihapus")
    with transaction(db):
        db.execute("DELETE FROM buku WHERE id = ?", (id_,))


def count(db: Database | None = None) -> int:
    db = db or get_db()
    return int(db.scalar("SELECT COUNT(*) FROM buku") or 0)


def total_eksemplar(db: Database | None = None) -> int:
    db = db or get_db()
    return int(db.scalar("SELECT COALESCE(SUM(jumlah_eksemplar), 0) FROM buku") or 0)


def list_eksemplar(buku_id: int, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT * FROM eksemplar WHERE buku_id = ? ORDER BY kode_eksemplar",
        (buku_id,),
    )


def find_duplicates(db: Database | None = None) -> list[dict]:
    """Cari buku duplikat berdasarkan ISBN atau kombinasi judul + pengarang."""
    db = db or get_db()
    by_isbn = db.query_all(
        "SELECT isbn, COUNT(*) AS jumlah, "
        "GROUP_CONCAT(kode_buku, ', ') AS kode_list, "
        "MIN(judul) AS judul "
        "FROM buku "
        "WHERE isbn IS NOT NULL AND isbn != '' "
        "GROUP BY isbn HAVING COUNT(*) > 1 "
        "ORDER BY jumlah DESC"
    )
    by_title = db.query_all(
        "SELECT judul, pengarang, COUNT(*) AS jumlah, "
        "GROUP_CONCAT(kode_buku, ', ') AS kode_list "
        "FROM buku "
        "WHERE judul IS NOT NULL AND judul != '' "
        "GROUP BY LOWER(judul), LOWER(COALESCE(pengarang, '')) "
        "HAVING COUNT(*) > 1 "
        "ORDER BY jumlah DESC"
    )
    results: list[dict] = []
    for r in by_isbn:
        r["match_type"] = "ISBN"
        results.append(r)
    for r in by_title:
        r["match_type"] = "Judul+Pengarang"
        results.append(r)
    return results


def list_penerbit(db: Database | None = None) -> list[str]:
    db = db or get_db()
    rows = db.query_all(
        "SELECT DISTINCT penerbit FROM buku "
        "WHERE penerbit IS NOT NULL AND TRIM(penerbit) != '' "
        "ORDER BY penerbit"
    )
    return [r["penerbit"] for r in rows]


def transfer_penerbit(db: Database | None = None) -> int:
    """Salin penerbit unik dari tabel buku ke tabel master ``penerbit``.

    :returns: jumlah penerbit baru yang ditambahkan.
    """
    db = db or get_db()
    added = 0
    with transaction(db):
        for nama in list_penerbit(db):
            cur = db.execute(
                "INSERT OR IGNORE INTO penerbit (nama) VALUES (?)", (nama,)
            )
            added += cur.rowcount or 0
    return added
