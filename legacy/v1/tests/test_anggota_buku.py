"""Test CRUD anggota & buku + auto-eksemplar."""
from __future__ import annotations


def test_create_anggota_auto_kode(fresh_db):
    from perpustakaan.models import anggota as anggota_repo

    aid1 = anggota_repo.create({"nama": "Andi", "kelas": "VII A"})
    aid2 = anggota_repo.create({"nama": "Budi", "kelas": "VII A"})
    assert anggota_repo.get(aid1)["kode_anggota"] == "A0001"
    assert anggota_repo.get(aid2)["kode_anggota"] == "A0002"


def test_create_buku_creates_eksemplar(fresh_db):
    from perpustakaan.db.connection import get_db
    from perpustakaan.models import buku as buku_repo

    bid = buku_repo.create(
        {"judul": "Buku A", "jumlah_eksemplar": 3, "kode_ddc": "000"}
    )
    rows = buku_repo.list_eksemplar(bid)
    assert len(rows) == 3
    assert {r["kode_eksemplar"] for r in rows} == {"B0001-01", "B0001-02", "B0001-03"}
    assert get_db().query_one(
        "SELECT jumlah_tersedia FROM buku WHERE id = ?", (bid,)
    )["jumlah_tersedia"] == 3


def test_naik_kelas(fresh_db):
    from perpustakaan.models import anggota as anggota_repo

    anggota_repo.create({"nama": "A", "kelas": "VII A"})
    anggota_repo.create({"nama": "B", "kelas": "VII A"})
    anggota_repo.create({"nama": "C", "kelas": "VIII A"})

    n = anggota_repo.naik_kelas({"VII A": "VIII A"})
    assert n == 2

    rows = anggota_repo.list_all(kelas="VIII A")
    assert len(rows) == 3
