"""Repository untuk Kas (cashbook)."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db, transaction


def list_all(
    db: Database | None = None,
    *,
    bulan: int | None = None,
    tahun: int | None = None,
    limit: int = 0,
) -> list[dict]:
    db = db or get_db()
    where = []
    params: list = []
    if tahun is not None:
        where.append("strftime('%Y', tanggal) = ?")
        params.append(str(tahun))
    if bulan is not None:
        where.append("strftime('%m', tanggal) = ?")
        params.append(f"{bulan:02d}")
    sql = "SELECT * FROM kas"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY tanggal DESC, id DESC"
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    return db.query_all(sql, tuple(params))


def add(
    *,
    keterangan: str,
    jenis: str,
    nominal: int,
    sumber: str = "manual",
    petugas_id: int | None = None,
    tanggal: str | None = None,
    db: Database | None = None,
) -> int:
    if jenis not in {"masuk", "keluar"}:
        raise ValueError("jenis harus 'masuk' atau 'keluar'")
    if nominal <= 0:
        raise ValueError("nominal harus > 0")
    db = db or get_db()
    sql = (
        "INSERT INTO kas (keterangan, jenis, nominal, sumber, petugas_id"
        + (", tanggal" if tanggal else "")
        + ") VALUES (?, ?, ?, ?, ?"
        + (", ?" if tanggal else "")
        + ")"
    )
    params: tuple = (keterangan, jenis, nominal, sumber, petugas_id)
    if tanggal:
        params = (*params, tanggal)
    with transaction(db):
        cur = db.execute(sql, params)
    return int(cur.lastrowid or 0)


def delete(id_: int, db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM kas WHERE id = ?", (id_,))


def reset_all(db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM kas")


def saldo(db: Database | None = None) -> int:
    db = db or get_db()
    masuk = int(
        db.scalar("SELECT COALESCE(SUM(nominal), 0) FROM kas WHERE jenis = 'masuk'")
        or 0
    )
    keluar = int(
        db.scalar("SELECT COALESCE(SUM(nominal), 0) FROM kas WHERE jenis = 'keluar'")
        or 0
    )
    return masuk - keluar


def ringkasan(db: Database | None = None) -> dict:
    db = db or get_db()
    return {
        "masuk": int(
            db.scalar(
                "SELECT COALESCE(SUM(nominal), 0) FROM kas WHERE jenis = 'masuk'"
            )
            or 0
        ),
        "keluar": int(
            db.scalar(
                "SELECT COALESCE(SUM(nominal), 0) FROM kas WHERE jenis = 'keluar'"
            )
            or 0
        ),
        "saldo": saldo(db),
    }
