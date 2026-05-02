"""Test widget visual baru di v0.5.0: ``icon_button``, ``EmptyState``,
``Tooltip``, plus loader ``illustrations``.

Memerlukan _tkinter + customtkinter + virtual display (``DISPLAY=:77`` di
CI). Skip seluruh modul kalau salah satu tidak tersedia.
"""
from __future__ import annotations

import contextlib
import os

import pytest

pytest.importorskip("_tkinter")
pytest.importorskip("customtkinter")

if not os.environ.get("DISPLAY"):
    pytest.skip("butuh DISPLAY (Xvfb) untuk widget tests", allow_module_level=True)


@pytest.fixture()
def root():
    import customtkinter as ctk

    r = ctk.CTk()
    try:
        yield r
    finally:
        with contextlib.suppress(Exception):
            r.destroy()


# ---------------- icon_button ----------------
def test_icon_button_with_lucide(root):
    import customtkinter as ctk

    from perpustakaan.gui.widgets import icon_button

    btn = icon_button(root, text="Tambah", lucide="plus", command=lambda: None)
    assert isinstance(btn, ctk.CTkButton)
    # Image harus ter-set kalau icon tersedia.
    assert btn.cget("image") is not None
    assert btn.cget("text") == "Tambah"


def test_icon_button_unknown_lucide_falls_back_to_text_only(root):
    from perpustakaan.gui.widgets import icon_button

    btn = icon_button(root, text="Klik", lucide="does-not-exist-xyz")
    # Tetap ter-bikin tanpa crash, tanpa image.
    assert btn.cget("text") == "Klik"


def test_icon_button_passthrough_kwargs(root):
    from perpustakaan.gui.widgets import icon_button

    btn = icon_button(
        root,
        text="X",
        lucide="x",
        fg_color="#ef4444",
        hover_color="#dc2626",
    )
    # CTkButton.cget untuk warna mengembalikan tuple/str — cukup verify
    # tidak ada exception saat passthrough.
    assert btn is not None


# ---------------- EmptyState ----------------
def test_empty_state_renders_title_and_description(root):
    from perpustakaan.gui.widgets import EmptyState

    es = EmptyState(
        root,
        title="Belum ada data",
        description="Tambahkan dengan tombol +.",
        icon="inbox",
    )
    assert es is not None
    # Children harus ada label title + desc + (mungkin) icon.
    children = es.winfo_children()
    assert len(children) >= 2


def test_empty_state_with_action_button(root):
    from perpustakaan.gui.widgets import EmptyState

    clicked = {"flag": False}

    def _on_click() -> None:
        clicked["flag"] = True

    es = EmptyState(
        root,
        title="Belum ada anggota",
        action_label="Tambah",
        action_command=_on_click,
    )
    # Cari tombol action di children.
    import customtkinter as ctk

    btns = [c for c in es.winfo_children() if isinstance(c, ctk.CTkButton)]
    assert len(btns) == 1


# ---------------- Tooltip ----------------
def test_tooltip_attaches_without_error(root):
    import customtkinter as ctk

    from perpustakaan.gui.widgets import Tooltip

    btn = ctk.CTkButton(root, text="hover me")
    btn.pack()
    tip = Tooltip(btn, text="Helper text")
    assert tip is not None


# ---------------- illustrations ----------------
def test_load_illustration_missing_returns_none():
    from perpustakaan.gui.illustrations import load_illustration

    img = load_illustration("does-not-exist-xyz", size=(200, 150))
    assert img is None


def test_available_illustrations_returns_list():
    from perpustakaan.gui.illustrations import available_illustrations

    names = available_illustrations()
    assert isinstance(names, list)
