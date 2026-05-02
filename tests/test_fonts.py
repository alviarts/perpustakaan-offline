"""Test font helper module — pure logic, tidak butuh Tk root.

Modul ``perpustakaan.gui.fonts`` mengimpor ``customtkinter`` -> ``_tkinter``,
jadi kalau Python build tanpa tkinter, test ini di-skip.
"""
from __future__ import annotations

import importlib

import pytest

pytest.importorskip("_tkinter")
pytest.importorskip("customtkinter")


@pytest.fixture(autouse=True)
def _reset_font_cache() -> None:
    # Reload modul supaya cache _DETECTED_FAMILY / _DETECTION_DONE bersih
    # tiap test (testnya independen).
    fonts = importlib.import_module("perpustakaan.gui.fonts")
    fonts._DETECTED_FAMILY = None
    fonts._DETECTION_DONE = False
    yield
    fonts._DETECTED_FAMILY = None
    fonts._DETECTION_DONE = False


def test_list_bundled_font_files_returns_inter_otf() -> None:
    from perpustakaan.gui import fonts

    paths = fonts.list_bundled_font_files()
    names = {p.name for p in paths}
    # Minimal harus ada file Regular + Bold yang di-bundle.
    assert any("Inter-Regular" in n for n in names), names
    assert any("Inter-Bold" in n for n in names), names


def test_detect_default_family_no_root_returns_none(monkeypatch) -> None:
    from perpustakaan.gui import fonts

    monkeypatch.setattr(fonts, "_system_families", lambda: set())
    fam = fonts.detect_default_family(force=True)
    # Tk root tidak siap → None, dan TIDAK cache.
    assert fam is None
    assert fonts._DETECTION_DONE is False


def test_detect_default_family_picks_first_match(monkeypatch) -> None:
    from perpustakaan.gui import fonts

    fake = {"Times New Roman", "Inter", "Segoe UI", "Arial"}
    monkeypatch.setattr(fonts, "_system_families", lambda: fake)
    fam = fonts.detect_default_family(force=True)
    # "Inter" lebih prioritas daripada "Segoe UI" / "Arial".
    assert fam == "Inter"
    assert fonts._DETECTION_DONE is True


def test_detect_default_family_returns_none_when_no_modern(monkeypatch) -> None:
    from perpustakaan.gui import fonts

    fake = {"Times New Roman", "Courier New"}
    monkeypatch.setattr(fonts, "_system_families", lambda: fake)
    fam = fonts.detect_default_family(force=True)
    assert fam is None
    assert fonts._DETECTION_DONE is True


def test_detect_default_family_cached(monkeypatch) -> None:
    from perpustakaan.gui import fonts

    monkeypatch.setattr(fonts, "_system_families", lambda: {"Inter"})
    fam1 = fonts.detect_default_family()
    # Ganti family list — tapi karena cache, hasil tetap "Inter".
    monkeypatch.setattr(fonts, "_system_families", lambda: {"Arial"})
    fam2 = fonts.detect_default_family()
    assert fam1 == fam2 == "Inter"


def test_fallback_priority_includes_inter() -> None:
    from perpustakaan.gui import fonts

    # Inter harus di paling depan supaya kalau sudah di-install, langsung dipakai.
    assert fonts._FALLBACK_FAMILIES[0] == "Inter"
