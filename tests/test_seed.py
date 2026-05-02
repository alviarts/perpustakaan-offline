"""Test seed: DDC, settings, admin, kelas."""
from __future__ import annotations


def test_seed_admin_and_settings(fresh_db):
    from perpustakaan.db.connection import get_db

    db = get_db()
    assert db.scalar("SELECT COUNT(*) FROM users") == 1
    assert db.scalar("SELECT username FROM users LIMIT 1") == "admin"
    assert int(db.scalar("SELECT COUNT(*) FROM settings") or 0) > 0


def test_seed_ddc(fresh_db):
    from perpustakaan.db.connection import get_db

    db = get_db()
    n = int(db.scalar("SELECT COUNT(*) FROM ddc") or 0)
    assert n > 1000  # > seribu entri DDC


def test_seed_kelas(fresh_db):
    from perpustakaan.db.connection import get_db

    db = get_db()
    n = int(db.scalar("SELECT COUNT(*) FROM kelas") or 0)
    assert n >= 9  # minimal SMP+SMA preset
