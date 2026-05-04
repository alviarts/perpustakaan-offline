"""Test untuk PR-V4a v0.6.0: helper microinteraction baru di animations.py.

Test fokus pada **pure function** yang bisa di-verify tanpa display Tk:

* ``lerp_color`` \u2014 interpolasi RGB
* ``_hex_to_rgb`` / ``_rgb_to_hex`` round-trip
* Easing curves bound check (``_ease_out_cubic`` / ``_ease_in_out_cubic``)
* ``_resolve_color_for_mode`` mode picker

Animation runtime (with after()/widget) di-cover oleh smoke test Xvfb.
"""
from __future__ import annotations

import pytest

from perpustakaan.gui import animations as anim


# ---------------------------------------------------------------------------
# lerp_color
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("c_from", "c_to", "t", "expected"),
    [
        ("#000000", "#ffffff", 0.0, "#000000"),
        ("#000000", "#ffffff", 1.0, "#ffffff"),
        ("#000000", "#ffffff", 0.5, "#7f7f7f"),
        ("#ff0000", "#0000ff", 0.5, "#7f007f"),
        # Clamp bawah & atas
        ("#000000", "#ffffff", -0.5, "#000000"),
        ("#000000", "#ffffff", 1.5, "#ffffff"),
        # Short-form hex
        ("#fff", "#000", 0.0, "#ffffff"),
        ("#f00", "#00f", 1.0, "#0000ff"),
    ],
)
def test_lerp_color(c_from: str, c_to: str, t: float, expected: str) -> None:
    assert anim.lerp_color(c_from, c_to, t).lower() == expected.lower()


def test_lerp_color_monotonic() -> None:
    """Lerp dari hitam ke putih harus monotonik increasing per channel."""
    prev = -1
    for i in range(11):
        t = i / 10.0
        result = anim.lerp_color("#000000", "#ffffff", t)
        r = int(result[1:3], 16)
        assert r >= prev, f"Channel R harus monotonik increasing pada t={t}"
        prev = r


# ---------------------------------------------------------------------------
# _hex_to_rgb / _rgb_to_hex
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("hex_str", "rgb"),
    [
        ("#000000", (0, 0, 0)),
        ("#ffffff", (255, 255, 255)),
        ("#4f46e5", (79, 70, 229)),  # indigo-600
        ("#FFF", (255, 255, 255)),
        ("4F46E5", (79, 70, 229)),  # without '#'
    ],
)
def test_hex_to_rgb(hex_str: str, rgb: tuple[int, int, int]) -> None:
    assert anim._hex_to_rgb(hex_str) == rgb


def test_rgb_to_hex_round_trip() -> None:
    for hex_str in ("#4f46e5", "#22c55e", "#dc2626", "#000000", "#ffffff"):
        rgb = anim._hex_to_rgb(hex_str)
        assert anim._rgb_to_hex(rgb).lower() == hex_str.lower()


def test_rgb_to_hex_clamps_out_of_range() -> None:
    # Negative & > 255 harus di-clamp ke [0, 255]
    assert anim._rgb_to_hex((-50, 300, 128)).lower() == "#00ff80"


# ---------------------------------------------------------------------------
# Easing curves
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("t", [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0])
def test_ease_out_cubic_in_range(t: float) -> None:
    """Output ease-out cubic harus berada di range [0, 1]."""
    result = anim._ease_out_cubic(t)
    assert 0.0 <= result <= 1.0


def test_ease_out_cubic_endpoints() -> None:
    assert anim._ease_out_cubic(0.0) == pytest.approx(0.0)
    assert anim._ease_out_cubic(1.0) == pytest.approx(1.0)


@pytest.mark.parametrize("t", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_ease_in_out_cubic_in_range(t: float) -> None:
    result = anim._ease_in_out_cubic(t)
    assert 0.0 <= result <= 1.0


def test_ease_in_out_cubic_symmetric() -> None:
    """Ease-in-out harus simetris: f(t) + f(1-t) == 1 (atau sangat dekat)."""
    for t in (0.1, 0.25, 0.4):
        assert anim._ease_in_out_cubic(t) + anim._ease_in_out_cubic(1 - t) == pytest.approx(1.0, abs=1e-9)


def test_ease_funcs_registry() -> None:
    """Registry _EASE_FUNCS minimal punya 3 curve yang dipakai."""
    assert "out_cubic" in anim._EASE_FUNCS
    assert "in_out_cubic" in anim._EASE_FUNCS
    assert "linear" in anim._EASE_FUNCS
    assert anim._EASE_FUNCS["linear"](0.5) == 0.5


# ---------------------------------------------------------------------------
# _resolve_color_for_mode
# ---------------------------------------------------------------------------
def test_resolve_color_for_mode_string() -> None:
    """String tunggal di-return apa adanya untuk semua mode."""
    assert anim._resolve_color_for_mode("#4f46e5", "light") == "#4f46e5"
    assert anim._resolve_color_for_mode("#4f46e5", "dark") == "#4f46e5"


def test_resolve_color_for_mode_tuple() -> None:
    color = ("#4f46e5", "#6366f1")  # (light, dark)
    assert anim._resolve_color_for_mode(color, "light") == "#4f46e5"
    assert anim._resolve_color_for_mode(color, "dark") == "#6366f1"
    # Mode lain (system, dll) fallback ke light
    assert anim._resolve_color_for_mode(color, "system") == "#4f46e5"


# ---------------------------------------------------------------------------
# API surface check
# ---------------------------------------------------------------------------
def test_animations_module_exports_new_helpers() -> None:
    """PR-V4a menambah 5 helper publik baru \u2014 verifikasi tersedia."""
    assert callable(anim.lerp_color)
    assert callable(anim.animate_color)
    assert callable(anim.slide_to_y)
    assert callable(anim.apply_dialog_appear)
    assert callable(anim.attach_press_feedback)
    assert callable(anim.attach_hover_lift)
    # Existing helpers tetap ada.
    assert callable(anim.fade_in_toplevel)
    assert callable(anim.slide_in_x)
    assert callable(anim.fade_out_widget)
    assert callable(anim.pulse_color)
