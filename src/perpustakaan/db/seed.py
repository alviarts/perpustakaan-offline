"""Seed default data: admin user, default settings, DDC reference, kelas dasar."""
from __future__ import annotations

import re
from pathlib import Path

from perpustakaan.config import (
    ASSETS_DIR,
    DEFAULT_ADMIN_FULLNAME,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SETTINGS,
)
from perpustakaan.db.connection import Database, get_db, transaction

# Regex untuk parsing baris DDC: kode (digits, opsional .digit), tab/spasi, deskripsi.
_DDC_LINE = re.compile(r"^(\d{3}(?:\.\d+)?)[\t ]+(.+?)\s*$")


def parse_ddc(text: str) -> list[tuple[str, str, str | None, int]]:
    """Parse file ``DDC-KODE BUKU.txt`` -> list (kode, deskripsi, parent, depth)."""
    out: list[tuple[str, str, str | None, int]] = []
    seen: set[str] = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _DDC_LINE.match(line)
        if not m:
            continue
        kode = m.group(1)
        deskripsi = m.group(2).strip()
        if kode in seen:
            continue
        seen.add(kode)
        # Hitung depth: 000=0, 010=1, 011=2, 011.1=3, 011.12=4
        if "." in kode:
            base, frac = kode.split(".", 1)
            depth = 2 + len(frac)
            parent = base if depth == 3 else f"{base}.{frac[:-1]}"
        else:
            if kode.endswith("00"):
                depth = 0
                parent = None
            elif kode.endswith("0"):
                depth = 1
                parent = kode[:-1] + "00"
            else:
                depth = 2
                parent = kode[:-1] + "0"
        out.append((kode, deskripsi, parent, depth))
    return out


def seed_settings(db: Database | None = None) -> None:
    db = db or get_db()
    with transaction(db):
        for k, v in DEFAULT_SETTINGS.items():
            db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (k, v),
            )


def seed_admin(db: Database | None = None) -> None:
    """Buat admin default jika belum ada user satupun."""
    db = db or get_db()
    from perpustakaan.services.auth import hash_password

    count = int(db.scalar("SELECT COUNT(*) FROM users") or 0)
    if count > 0:
        return
    pw_hash = hash_password(DEFAULT_ADMIN_PASSWORD)
    with transaction(db):
        db.execute(
            "INSERT INTO users (username, password_hash, full_name, role) "
            "VALUES (?, ?, ?, 'admin')",
            (DEFAULT_ADMIN_USERNAME, pw_hash, DEFAULT_ADMIN_FULLNAME),
        )


def seed_ddc(
    db: Database | None = None, source: Path | str | None = None
) -> int:
    """Isi tabel ``ddc`` dari file teks. Skip kalau sudah terisi."""
    db = db or get_db()
    count = int(db.scalar("SELECT COUNT(*) FROM ddc") or 0)
    if count > 0:
        return count

    src = Path(source) if source else (ASSETS_DIR / "ddc-source.txt")
    if not src.exists():
        return 0
    rows = parse_ddc(src.read_text(encoding="utf-8", errors="replace"))
    if not rows:
        return 0
    with transaction(db):
        db.executemany(
            "INSERT OR IGNORE INTO ddc (kode, deskripsi, parent, depth) VALUES (?, ?, ?, ?)",
            rows,
        )
    return len(rows)


def seed_kelas(db: Database | None = None) -> None:
    """Seed kelas SMP/MTs/SMA/MA/SMK default. Idempotent."""
    db = db or get_db()
    presets: list[tuple[str, int, int]] = [
        # SMP/MTs
        ("VII A", 7, 71), ("VII B", 7, 72), ("VII C", 7, 73),
        ("VIII A", 8, 81), ("VIII B", 8, 82), ("VIII C", 8, 83),
        ("IX A", 9, 91), ("IX B", 9, 92), ("IX C", 9, 93),
        # SMA/MA
        ("X IPA 1", 10, 101), ("X IPS 1", 10, 102),
        ("XI IPA 1", 11, 111), ("XI IPS 1", 11, 112),
        ("XII IPA 1", 12, 121), ("XII IPS 1", 12, 122),
    ]
    with transaction(db):
        for nama, tingkat, urutan in presets:
            db.execute(
                "INSERT OR IGNORE INTO kelas (nama, tingkat, urutan) VALUES (?, ?, ?)",
                (nama, tingkat, urutan),
            )


def seed_all(db: Database | None = None) -> None:
    seed_settings(db)
    seed_admin(db)
    seed_ddc(db)
    seed_kelas(db)
