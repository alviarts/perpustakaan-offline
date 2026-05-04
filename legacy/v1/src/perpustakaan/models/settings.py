"""Helper akses tabel ``settings`` (key/value)."""
from __future__ import annotations

from perpustakaan.db.connection import Database, get_db, transaction


def get_value(key: str, default: str | None = None, db: Database | None = None) -> str | None:
    db = db or get_db()
    row = db.query_one("SELECT value FROM settings WHERE key = ?", (key,))
    if row is None:
        return default
    return row["value"]


def get_int(key: str, default: int = 0, db: Database | None = None) -> int:
    val = get_value(key, str(default), db=db)
    if val is None or val == "":
        return default
    try:
        return int(val)
    except ValueError:
        return default


def set_value(key: str, value: str, db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def set_many(items: dict[str, str], db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        for k, v in items.items():
            db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, v),
            )


def all_as_dict(db: Database | None = None) -> dict[str, str]:
    db = db or get_db()
    rows = db.query_all("SELECT key, value FROM settings")
    return {r["key"]: r["value"] or "" for r in rows}
