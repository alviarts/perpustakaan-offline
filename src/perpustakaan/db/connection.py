"""Manajemen koneksi SQLite + helper transaksi."""
from __future__ import annotations

import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from perpustakaan.config import DB_PATH, SCHEMA_PATH, ensure_runtime_dirs


def _row_factory(cursor: sqlite3.Cursor, row: tuple) -> dict:
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


class Database:
    """Wrapper tipis di atas ``sqlite3.Connection``.

    - Thread-safe via :class:`threading.local` (1 connection per thread).
    - Row factory default = ``dict`` (lebih nyaman dari Tuple).
    - Foreign keys + WAL aktif sejak schema.
    """

    def __init__(self, db_path: Path | str | None = None) -> None:
        self._path = Path(db_path) if db_path else DB_PATH
        self._local = threading.local()

    @property
    def path(self) -> Path:
        return self._path

    def connect(self) -> sqlite3.Connection:
        conn: sqlite3.Connection | None = getattr(self._local, "conn", None)
        if conn is None:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(
                str(self._path),
                detect_types=sqlite3.PARSE_DECLTYPES,
                check_same_thread=False,
                isolation_level=None,  # autocommit; transaksi manual via BEGIN
            )
            conn.row_factory = _row_factory
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            self._local.conn = conn
        return conn

    def close(self) -> None:
        conn: sqlite3.Connection | None = getattr(self._local, "conn", None)
        if conn is not None:
            conn.close()
            self._local.conn = None

    # ------------------------------------------------------------------
    # Helper queries
    # ------------------------------------------------------------------
    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        return self.connect().execute(sql, params)

    def executemany(self, sql: str, seq: list[tuple] | list[dict]) -> sqlite3.Cursor:
        return self.connect().executemany(sql, seq)

    def query_all(self, sql: str, params: tuple | dict = ()) -> list[dict]:
        cur = self.execute(sql, params)
        return list(cur.fetchall())

    def query_one(self, sql: str, params: tuple | dict = ()) -> dict | None:
        cur = self.execute(sql, params)
        return cur.fetchone()

    def scalar(self, sql: str, params: tuple | dict = ()) -> object:
        row = self.query_one(sql, params)
        if row is None:
            return None
        return next(iter(row.values()))


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------
_db: Database | None = None
_db_lock = threading.Lock()


def get_db() -> Database:
    global _db
    if _db is None:
        with _db_lock:
            if _db is None:
                _db = Database()
    return _db


def init_db(db_path: Path | str | None = None, *, force: bool = False) -> Database:
    """Buat tabel + seed minimum kalau belum ada.

    :param db_path: override default DB path (untuk tests).
    :param force: jika True, jalankan ulang schema walau sudah ada.
    """
    ensure_runtime_dirs()
    global _db
    if db_path is not None or _db is None:
        _db = Database(db_path)
    db = _db

    # Cek apakah schema_version sudah ada
    if not force:
        try:
            row = db.query_one(
                "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
            )
            if row is not None and int(row["version"]) >= 1:
                return db
        except sqlite3.OperationalError:
            pass  # tabel belum ada, lanjut buat

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    db.connect().executescript(sql)
    return db


# ---------------------------------------------------------------------------
# Context manager transaksi
# ---------------------------------------------------------------------------
@contextmanager
def transaction(db: Database | None = None) -> Iterator[sqlite3.Connection]:
    """Context manager transaksi dengan rollback on exception."""
    db = db or get_db()
    conn = db.connect()
    conn.execute("BEGIN")
    try:
        yield conn
    except Exception:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")
