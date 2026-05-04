"""Test Lucide icon loader — recolor + cache + fallback.

CTkImage butuh _tkinter (yang kadang tidak tersedia di host runner). Kalau
tidak ada, skip seluruh modul.
"""
from __future__ import annotations

import pytest

pytest.importorskip("_tkinter")
pytest.importorskip("customtkinter")


def test_icon_directory_exists():
    """Asset bundle harus ada — jalankan ``scripts/fetch_lucide_icons.py``
    kalau belum ada."""
    from perpustakaan.gui.icons import ICON_DIR

    assert ICON_DIR.exists(), (
        f"Direktori icon tidak ada: {ICON_DIR}. Jalankan "
        f"`python scripts/fetch_lucide_icons.py` untuk download."
    )
    pngs = list(ICON_DIR.glob("*.png"))
    assert len(pngs) >= 30, f"icon kurang ({len(pngs)} ditemukan, minimal 30)"


def test_available_icons_lists_files():
    from perpustakaan.gui.icons import available_icons

    names = available_icons()
    # Sanity: beberapa icon inti harus ada.
    expected = {"users", "book-open", "plus", "search", "settings"}
    missing = expected - set(names)
    assert not missing, f"icon inti hilang: {missing}"


def test_lucide_icon_returns_ctkimage():
    import customtkinter as ctk

    from perpustakaan.gui.icons import lucide_icon

    img = lucide_icon("users", size=20)
    assert img is not None, "icon users tidak bisa di-load"
    assert isinstance(img, ctk.CTkImage)


def test_lucide_icon_unknown_returns_none():
    from perpustakaan.gui.icons import lucide_icon

    img = lucide_icon("does-not-exist-xyz", size=20)
    assert img is None


def test_lucide_icon_caches_same_call():
    """Dua call dengan param sama harus return instance yang sama (cache)."""
    from perpustakaan.gui.icons import lucide_icon

    a = lucide_icon("plus", size=16, color="#000000")
    b = lucide_icon("plus", size=16, color="#000000")
    assert a is b


def test_lucide_icon_different_size_different_instance():
    from perpustakaan.gui.icons import lucide_icon

    a = lucide_icon("plus", size=16)
    b = lucide_icon("plus", size=24)
    assert a is not b


def test_lucide_icon_color_str_or_tuple():
    """Color spec menerima str maupun tuple ``(light, dark)``."""
    from perpustakaan.gui.icons import lucide_icon

    a = lucide_icon("plus", size=16, color="#ff0000")
    b = lucide_icon("plus", size=16, color=("#ff0000", "#ff0000"))
    assert a is not None
    assert b is not None


def test_hex_to_rgb_handles_short_form():
    from perpustakaan.gui.icons import _hex_to_rgb

    assert _hex_to_rgb("#fff") == (255, 255, 255)
    assert _hex_to_rgb("#000000") == (0, 0, 0)
    assert _hex_to_rgb("#ff5733") == (255, 87, 51)
