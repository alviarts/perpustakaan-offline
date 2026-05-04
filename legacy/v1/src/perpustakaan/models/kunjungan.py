"""Repository untuk Kunjungan."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db, transaction


def catat(
    *,
    anggota_id: int | None = None,
    keperluan: str = "Membaca",
    sumber: str = "manual",
    jumlah_orang: int = 1,
    kelas: str | None = None,
    petugas_id: int | None = None,
    catatan: str = "",
    db: Database | None = None,
) -> int:
    db = db or get_db()
    with transaction(db):
        cur = db.execute(
            "INSERT INTO kunjungan "
            "(anggota_id, keperluan, sumber, jumlah_orang, kelas, petugas_id, catatan) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (anggota_id, keperluan, sumber, jumlah_orang, kelas, petugas_id, catatan),
        )
    return int(cur.lastrowid or 0)


def list_recent(limit: int = 50, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    return db.query_all(
        "SELECT k.*, a.kode_anggota, a.nama AS nama_anggota "
        "FROM kunjungan k LEFT JOIN anggota a ON a.id = k.anggota_id "
        "ORDER BY k.tanggal DESC, k.jam DESC LIMIT ?",
        (limit,),
    )


def count_today(db: Database | None = None) -> int:
    db = db or get_db()
    return int(
        db.scalar(
            "SELECT COALESCE(SUM(jumlah_orang), 0) FROM kunjungan "
            "WHERE tanggal = date('now')"
        )
        or 0
    )


def stats_per_bulan(tahun: int, db: Database | None = None) -> list[dict]:
    """Total kunjungan per bulan dalam tahun ``tahun`` (1-12)."""
    db = db or get_db()
    rows = db.query_all(
        "SELECT CAST(strftime('%m', tanggal) AS INTEGER) AS bulan, "
        "       COALESCE(SUM(jumlah_orang), 0) AS total "
        "FROM kunjungan WHERE strftime('%Y', tanggal) = ? "
        "GROUP BY bulan ORDER BY bulan",
        (str(tahun),),
    )
    out = {int(r["bulan"]): int(r["total"]) for r in rows}
    return [{"bulan": m, "total": out.get(m, 0)} for m in range(1, 13)]


def stats_harian_bulan(tahun: int, bulan: int, db: Database | None = None) -> list[dict]:
    db = db or get_db()
    rows = db.query_all(
        "SELECT CAST(strftime('%d', tanggal) AS INTEGER) AS hari, "
        "       COALESCE(SUM(jumlah_orang), 0) AS total "
        "FROM kunjungan "
        "WHERE strftime('%Y', tanggal) = ? AND strftime('%m', tanggal) = ? "
        "GROUP BY hari ORDER BY hari",
        (str(tahun), f"{bulan:02d}"),
    )
    return [{"hari": int(r["hari"]), "total": int(r["total"])} for r in rows]


def delete(id_: int, db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute("DELETE FROM kunjungan WHERE id = ?", (id_,))
