"""Repository untuk entitas Anggota (siswa)."""
from __future__ import annotations

from typing import Any

from perpustakaan.db.connection import Database, get_db, transaction

FIELDS = (
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
    "foto_path",
    "tanggal_daftar",
    "aktif",
    "catatan",
)


def next_kode(prefix: str = "A", db: Database | None = None) -> str:
    """Hasilkan kode anggota berikutnya berdasarkan kode terbesar yang ada.

    Format default: A0001, A0002, ...
    """
    db = db or get_db()
    row = db.query_one(
        "SELECT kode_anggota FROM anggota "
        "WHERE kode_anggota LIKE ? "
        "ORDER BY LENGTH(kode_anggota) DESC, kode_anggota DESC LIMIT 1",
        (f"{prefix}%",),
    )
    if row is None:
        return f"{prefix}0001"
    last = row["kode_anggota"][len(prefix):]
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
    kelas: str = "",
    aktif: bool | None = None,
    limit: int = 0,
    offset: int = 0,
    order_by: str = "kode_anggota",
) -> list[dict]:
    db = db or get_db()
    where = []
    params: list[Any] = []
    if search:
        where.append("(nama LIKE ? OR kode_anggota LIKE ? OR no_telp LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like])
    if kelas:
        where.append("kelas = ?")
        params.append(kelas)
    if aktif is not None:
        where.append("aktif = ?")
        params.append(1 if aktif else 0)

    sql = "SELECT * FROM anggota"
    if where:
        sql += " WHERE " + " AND ".join(where)

    safe_order = order_by if order_by in {
        "kode_anggota", "nama", "kelas", "tanggal_daftar"
    } else "kode_anggota"
    sql += f" ORDER BY {safe_order} ASC"

    if limit:
        sql += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    return db.query_all(sql, tuple(params))


def get(id_: int, db: Database | None = None) -> dict | None:
    db = db or get_db()
    return db.query_one("SELECT * FROM anggota WHERE id = ?", (id_,))


def get_by_kode(kode: str, db: Database | None = None) -> dict | None:
    db = db or get_db()
    return db.query_one("SELECT * FROM anggota WHERE kode_anggota = ?", (kode,))


def create(data: dict, db: Database | None = None) -> int:
    db = db or get_db()
    payload = {k: data.get(k) for k in FIELDS if data.get(k) not in (None, "")}
    if not payload.get("kode_anggota"):
        payload["kode_anggota"] = next_kode(db=db)
    if not payload.get("nama"):
        raise ValueError("nama wajib diisi")
    cols = ", ".join(payload.keys())
    placeholders = ", ".join(["?"] * len(payload))
    with transaction(db):
        cur = db.execute(
            f"INSERT INTO anggota ({cols}) VALUES ({placeholders})",
            tuple(payload.values()),
        )
    return int(cur.lastrowid or 0)


def update(id_: int, data: dict, db: Database | None = None) -> None:
    db = db or get_db()
    payload = {k: data[k] for k in FIELDS if k in data}
    if not payload:
        return
    set_clause = ", ".join([f"{k} = ?" for k in payload])
    with transaction(db):
        db.execute(
            f"UPDATE anggota SET {set_clause} WHERE id = ?",
            (*payload.values(), id_),
        )


def delete(id_: int, db: Database | None = None) -> None:
    db = db or get_db()
    # Cek apakah masih ada peminjaman aktif
    aktif = int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman "
            "WHERE anggota_id = ? AND status IN ('dipinjam','sebagian','terlambat')",
            (id_,),
        )
        or 0
    )
    if aktif > 0:
        raise ValueError("Anggota masih memiliki peminjaman aktif")
    with transaction(db):
        db.execute("DELETE FROM anggota WHERE id = ?", (id_,))


def count(db: Database | None = None, *, aktif: bool | None = None) -> int:
    db = db or get_db()
    if aktif is None:
        return int(db.scalar("SELECT COUNT(*) FROM anggota") or 0)
    return int(
        db.scalar("SELECT COUNT(*) FROM anggota WHERE aktif = ?", (1 if aktif else 0,))
        or 0
    )


def list_distinct_kelas(db: Database | None = None) -> list[str]:
    """Daftar kelas unik yang ada di tabel anggota, sorted."""
    db = db or get_db()
    rows = db.query_all(
        "SELECT DISTINCT kelas FROM anggota WHERE kelas IS NOT NULL AND kelas != '' ORDER BY kelas"
    )
    return [r["kelas"] for r in rows]


def naik_kelas(mapping: dict[str, str], db: Database | None = None) -> int:
    """Update batch kelas anggota.

    :param mapping: dict ``{kelas_lama: kelas_baru}``.
    :returns: jumlah anggota yang ter-update.
    """
    db = db or get_db()
    total = 0
    with transaction(db):
        for lama, baru in mapping.items():
            n = int(
                db.scalar(
                    "SELECT COUNT(*) FROM anggota WHERE kelas = ?", (lama,)
                )
                or 0
            )
            db.execute(
                "UPDATE anggota SET kelas = ? WHERE kelas = ?", (baru, lama)
            )
            total += n
    return total
