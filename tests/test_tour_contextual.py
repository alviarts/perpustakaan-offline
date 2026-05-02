"""Test contextual per-menu tour API (v0.4.1).

Test fokus pada bagian non-GUI: flag completion, reset, dan widget walker.
TourPopup / TourManager butuh Tk display dan dipisah ke tests/test_smoke_gui.py.

Modul ``perpustakaan.gui.tour`` mengimpor ``customtkinter`` -> ``_tkinter``,
jadi kalau Python build tanpa tkinter (contoh CI minimal / pyenv tanpa
``--enable-shared-tkinter``), test ini di-skip.
"""
from __future__ import annotations

import pytest

pytest.importorskip("_tkinter")


class TestTutorialFlagsPerMenu:
    def test_default_all_unset(self, fresh_db):
        from perpustakaan.gui.tour import MENU_KEYS, is_menu_completed

        for menu in MENU_KEYS:
            assert is_menu_completed(menu) is False

    def test_mark_completed(self, fresh_db):
        from perpustakaan.gui.tour import is_menu_completed, mark_menu_completed

        mark_menu_completed("peminjaman")
        assert is_menu_completed("peminjaman") is True
        # Menu lain tidak terpengaruh
        assert is_menu_completed("anggota") is False

    def test_reset_all_clears_flags(self, fresh_db):
        from perpustakaan.gui.tour import (
            MENU_KEYS,
            is_menu_completed,
            mark_menu_completed,
            reset_all_tutorial_flags,
        )

        for menu in MENU_KEYS:
            mark_menu_completed(menu)
        for menu in MENU_KEYS:
            assert is_menu_completed(menu) is True

        reset_all_tutorial_flags()
        for menu in MENU_KEYS:
            assert is_menu_completed(menu) is False

    def test_reset_clears_legacy_flag(self, fresh_db):
        from perpustakaan.gui.tour import reset_all_tutorial_flags
        from perpustakaan.models import settings as settings_repo

        settings_repo.set_value("tutorial.completed", "1")
        assert settings_repo.get_value("tutorial.completed") == "1"
        reset_all_tutorial_flags()
        assert (settings_repo.get_value("tutorial.completed") or "") == ""


class TestTourBuilders:
    """Pastikan setiap builder mengembalikan list TourStep walau view None."""

    def test_builder_returns_list_for_each_menu(self):
        from perpustakaan.gui.tour import MENU_KEYS, build_steps_for

        class _FakeMW:
            views: dict = {}

        mw = _FakeMW()
        for menu in MENU_KEYS:
            steps = build_steps_for(menu, mw)
            assert isinstance(steps, list)
            # Tiap menu minimal punya 1 step (intro/welcome)
            assert len(steps) >= 1, f"menu {menu} returned 0 steps"

    def test_builder_unknown_menu_returns_empty(self):
        from perpustakaan.gui.tour import build_steps_for

        steps = build_steps_for("nonexistent", None)
        assert steps == []

    def test_step_keys_are_unique_per_menu(self):
        from perpustakaan.gui.tour import MENU_KEYS, build_steps_for

        class _FakeMW:
            views: dict = {}

        mw = _FakeMW()
        for menu in MENU_KEYS:
            steps = build_steps_for(menu, mw)
            keys = [s.key for s in steps]
            assert len(keys) == len(set(keys)), f"duplicate step keys in {menu}"

    def test_steps_have_i18n_strings(self):
        """Pastikan tiap step punya entry di kamus i18n.

        Mencegah regression saat refactor (mis. merename key tour.X.title
        tapi lupa update string).
        """
        from perpustakaan.gui.tour import MENU_KEYS, build_steps_for
        from perpustakaan.i18n import _STRINGS  # type: ignore[attr-defined]

        class _FakeMW:
            views: dict = {}

        mw = _FakeMW()
        missing: list[str] = []
        for menu in MENU_KEYS:
            for step in build_steps_for(menu, mw):
                if step.title_key not in _STRINGS:
                    missing.append(step.title_key)
                if step.body_key not in _STRINGS:
                    missing.append(step.body_key)
        assert not missing, f"missing i18n keys: {missing}"


class TestFindButtonByText:
    """``_find_button_by_text`` walker utility (helper di tour.py)."""

    def test_returns_none_for_none_parent(self):
        from perpustakaan.gui.tour import _find_button_by_text

        assert _find_button_by_text(None, "x") is None

    def test_returns_none_when_no_match(self):
        from perpustakaan.gui.tour import _find_button_by_text

        class _FakeWidget:
            def winfo_children(self):
                return []

        assert _find_button_by_text(_FakeWidget(), "nonexistent") is None
