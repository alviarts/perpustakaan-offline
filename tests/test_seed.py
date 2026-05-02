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


def test_seed_demo_inserts_anggota_buku_peminjaman(fresh_db):
    from perpustakaan.db.connection import get_db
    from perpustakaan.db.seed import seed_demo

    db = get_db()
    summary = seed_demo()
    assert summary["anggota"] == 5
    assert summary["buku"] == 10
    assert summary["peminjaman"] == 2

    assert int(db.scalar("SELECT COUNT(*) FROM anggota") or 0) == 5
    assert int(db.scalar("SELECT COUNT(*) FROM buku") or 0) == 10
    aktif = int(
        db.scalar(
            "SELECT COUNT(*) FROM peminjaman_item WHERE status = 'dipinjam'"
        )
        or 0
    )
    assert aktif == 3  # 2 buku peminjaman pertama + 1 buku peminjaman kedua


def test_seed_demo_idempotent_when_data_exists(fresh_db):
    from perpustakaan.db.seed import seed_demo

    first = seed_demo()
    assert first["anggota"] == 5
    second = seed_demo()
    # Sudah ada data → semua nol
    assert second == {"anggota": 0, "buku": 0, "peminjaman": 0}
