"""Test untuk gui/effects.py (PR-V4a v0.6.0).

Test memastikan generator drop shadow + gradient bekerja dengan benar
tanpa harus jalankan UI Tk. Kita verify hasil PIL via pixel sampling
+ ukuran image, lalu test cache hit via lru_cache.cache_info().
"""
from __future__ import annotations

import pytest

from perpustakaan.gui import effects


def _has_tk() -> bool:
    """Cek tkinter + customtkinter kedua-duanya available.

    CI env minimal (tanpa customtkinter di pip install) tidak boleh fail \u2014
    test ini di-skip otomatis. Smoke test Xvfb tetap cover full UI.
    """
    try:
        import tkinter  # noqa: F401
        import customtkinter  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


_REQUIRES_TK = pytest.mark.skipif(
    not _has_tk(), reason="customtkinter / Tk tidak tersedia di env",
)


@pytest.fixture(autouse=True)
def _clear_cache_each_test() -> None:
    """Reset PIL render cache supaya cache hit/miss test deterministik."""
    effects.clear_cache()
    yield
    effects.clear_cache()


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
def test_hex_to_rgb_basic() -> None:
    assert effects._hex_to_rgb("#000000") == (0, 0, 0)
    assert effects._hex_to_rgb("#ffffff") == (255, 255, 255)
    assert effects._hex_to_rgb("#4f46e5") == (79, 70, 229)


def test_hex_to_rgb_short_form() -> None:
    assert effects._hex_to_rgb("#fff") == (255, 255, 255)
    assert effects._hex_to_rgb("#f00") == (255, 0, 0)


def test_resolve_color_string() -> None:
    assert effects._resolve_color("#4f46e5") == "#4f46e5"


# ---------------------------------------------------------------------------
# Drop shadow
# ---------------------------------------------------------------------------
@_REQUIRES_TK
def test_drop_shadow_returns_ctk_image() -> None:
    """make_drop_shadow harus return CTkImage yang bisa dipakai sebagai `image=`."""
    import customtkinter as ctk

    img = effects.make_drop_shadow(width=200, height=120)
    assert isinstance(img, ctk.CTkImage)


def test_drop_shadow_dimensions_include_blur_padding() -> None:
    """Output PIL-nya harus mengandung blur padding di kedua sisi + offset_y."""
    pil = effects._make_drop_shadow_pil(
        100, 50, 16, 6, 18, 28, 14, (15, 23, 42),
    )
    pad = 18 * 2
    assert pil.width == 100 + pad
    assert pil.height == 50 + pad + 6


def test_drop_shadow_alpha_inside_shadow_region() -> None:
    """Pixel di tengah shadow harus punya alpha > 0; di luar shadow ~ 0."""
    pil = effects._make_drop_shadow_pil(
        100, 50, 16, 6, 18, 80, 14, (15, 23, 42),
    )
    # Di tengah shape (offset blur+w/2, blur+h/2)
    cx = 18 + 50
    cy = 18 + 25 + 6
    _r, _g, _b, a_center = pil.getpixel((cx, cy))
    assert a_center > 30, "Center shadow harus punya alpha > 30"

    # Di pojok kiri-atas (jauh dari shape) — alpha harus rendah
    _r2, _g2, _b2, a_corner = pil.getpixel((0, 0))
    assert a_corner < 10, f"Corner alpha harus rendah, got {a_corner}"


@_REQUIRES_TK
def test_drop_shadow_cache_hit() -> None:
    """Panggilan 2x dengan parameter sama harus hit lru_cache."""
    info0 = effects._make_drop_shadow_pil.cache_info()
    effects.make_drop_shadow(width=200, height=120)
    effects.make_drop_shadow(width=200, height=120)
    info1 = effects._make_drop_shadow_pil.cache_info()
    assert info1.hits >= info0.hits + 1


# ---------------------------------------------------------------------------
# Linear gradient
# ---------------------------------------------------------------------------
@_REQUIRES_TK
def test_linear_gradient_returns_ctk_image() -> None:
    import customtkinter as ctk

    img = effects.make_linear_gradient(
        width=100, height=50,
        color_from="#000000", color_to="#ffffff",
        angle_deg=90,
    )
    assert isinstance(img, ctk.CTkImage)


def test_linear_gradient_horizontal_left_to_right() -> None:
    """Angle 90: kiri = hitam, kanan = putih."""
    pil = effects._make_linear_gradient_pil(
        100, 10, (0, 0, 0), (255, 255, 255), 90,
    )
    left = pil.getpixel((0, 5))
    right = pil.getpixel((99, 5))
    assert left[0] < 30, f"Kiri harus dekat hitam, got {left}"
    assert right[0] > 220, f"Kanan harus dekat putih, got {right}"


def test_linear_gradient_vertical_top_to_bottom() -> None:
    """Angle 0: atas = hitam, bawah = putih."""
    pil = effects._make_linear_gradient_pil(
        10, 100, (0, 0, 0), (255, 255, 255), 0,
    )
    top = pil.getpixel((5, 0))
    bottom = pil.getpixel((5, 99))
    assert top[0] < 30
    assert bottom[0] > 220


def test_linear_gradient_size_matches() -> None:
    pil = effects._make_linear_gradient_pil(
        80, 40, (0, 0, 0), (255, 255, 255), 0,
    )
    assert pil.size == (80, 40)


# ---------------------------------------------------------------------------
# Radial gradient
# ---------------------------------------------------------------------------
@_REQUIRES_TK
def test_radial_gradient_returns_ctk_image() -> None:
    import customtkinter as ctk

    img = effects.make_radial_gradient(
        width=100, height=100,
        color_center="#ffffff", color_outer="#000000",
        center_x_pct=50, center_y_pct=50, radius_pct=50,
    )
    assert isinstance(img, ctk.CTkImage)


def test_radial_gradient_center_is_brighter() -> None:
    """Center harus lebih dekat ke color_center."""
    pil = effects._make_radial_gradient_pil(
        100, 100, (255, 255, 255), (0, 0, 0), 50, 50, 80,
    )
    center = pil.getpixel((50, 50))
    edge = pil.getpixel((0, 0))
    # Center harus lebih putih (R lebih tinggi) daripada corner
    assert center[0] > edge[0]


def test_radial_gradient_extreme_zero_radius_falls_back() -> None:
    """Radius 0 \u2192 langsung outer color (no division by zero)."""
    pil = effects._make_radial_gradient_pil(
        50, 50, (255, 0, 0), (0, 255, 0), 50, 50, 0,
    )
    # Hanya outer color
    assert pil.getpixel((10, 10))[1] == 255


# ---------------------------------------------------------------------------
# Public API exposure
# ---------------------------------------------------------------------------
def test_public_api_exposed() -> None:
    assert callable(effects.make_drop_shadow)
    assert callable(effects.make_linear_gradient)
    assert callable(effects.make_radial_gradient)
    assert callable(effects.clear_cache)
    assert "make_drop_shadow" in effects.__all__
    assert "make_linear_gradient" in effects.__all__
    assert "make_radial_gradient" in effects.__all__
