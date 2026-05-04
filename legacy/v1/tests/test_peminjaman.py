"""Test alur peminjaman & pengembalian."""
from __future__ import annotations

import pytest


def _setup_data():
    from perpustakaan.models import anggota as anggota_repo
    from perpustakaan.models import buku as buku_repo

    aid = anggota_repo.create({"nama": "Andi", "kelas": "VII A"})
    bid = buku_repo.create(
        {"judul": "Buku 1", "jumlah_eksemplar": 1, "harga": 50000}
    )
    return aid, bid


def test_pinjam_kembali(fresh_db):
    from perpustakaan.db.connection import get_db
    from perpustakaan.models import peminjaman as pinj_repo

    aid, bid = _setup_data()
    pid = pinj_repo.pinjam(aid, [bid])
    assert pid > 0

    db = get_db()
    assert db.query_one("SELECT jumlah_tersedia FROM buku WHERE id = ?", (bid,))[
        "jumlah_tersedia"
    ] == 0

    aktif = pinj_repo.list_aktif_anggota(aid)
    assert len(aktif) == 1

    res = pinj_repo.kembalikan(int(aktif[0]["item_id"]), bayar=0)
    assert res["status"] == "dikembalikan"
    assert res["denda"] == 0

    assert db.query_one(
        "SELECT jumlah_tersedia FROM buku WHERE id = ?", (bid,)
    )["jumlah_tersedia"] == 1


def test_pinjam_melebihi_maks(fresh_db):
    from perpustakaan.models import buku as buku_repo
    from perpustakaan.models import peminjaman as pinj_repo
    from perpustakaan.models import settings as settings_repo

    aid, _ = _setup_data()
    settings_repo.set_value("transaksi.maks_buku_pinjam", "1")
    bid2 = buku_repo.create({"judul": "Buku 2", "jumlah_eksemplar": 1})

    with pytest.raises(ValueError):
        pinj_repo.pinjam(aid, [_setup_data()[1], bid2])


def test_buku_hilang_charge_kas(fresh_db):
    from perpustakaan.models import kas as kas_repo
    from perpustakaan.models import peminjaman as pinj_repo

    aid, bid = _setup_data()
    pid = pinj_repo.pinjam(aid, [bid])  # noqa: F841
    aktif = pinj_repo.list_aktif_anggota(aid)
    res = pinj_repo.tandai_hilang(int(aktif[0]["item_id"]), bayar=50000)
    assert res["status"] == "hilang"
    assert res["denda"] == 50000
    assert kas_repo.saldo() == 50000
