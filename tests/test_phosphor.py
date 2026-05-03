"""Test untuk gui/phosphor.py (PR-V4c v0.6.2).

Verify Phosphor TTF + ICON_CODEPOINTS mapping bekerja:
- TTF file ter-bundle di assets/fonts/
- License file ada (MIT compliance)
- Codepoint mapping reasonable (>= 50 icons)
- Glyph render menghasilkan RGBA image dengan pixel non-transparan
- Cache hit detection via lru_cache.cache_info() (kalau bisa)

Tests yang butuh customtkinter di-skip otomatis di env minimal CI lint job.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from perpustakaan.gui import phosphor


def _has_ctk() -> bool:
    try:
        import customtkinter  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------------------
# Bundle integrity
# ---------------------------------------------------------------------------
def test_ttf_bundled() -> None:
    assert phosphor.FONT_PATH.exists(), (
        f"Phosphor-Fill.ttf harus ada di {phosphor.FONT_PATH}"
    )
    # OpenType TTF magic: 00 01 00 00 atau "OTTO" / "true"
    head = phosphor.FONT_PATH.read_bytes()[:4]
    assert head in (
        b"\x00\x01\x00\x00",  # TrueType
        b"OTTO",  # OpenType CFF
        b"true",  # legacy Apple
        b"typ1",
    ), f"TTF magic header tidak dikenali: {head!r}"


def test_license_bundled() -> None:
    license_path = phosphor.FONT_PATH.parent / "Phosphor-LICENSE.txt"
    assert license_path.exists(), "Phosphor MIT license harus di-bundle"
    text = license_path.read_text(encoding="utf-8")
    assert "MIT" in text, "License text harus mention MIT"


def test_icon_codepoints_count() -> None:
    """Minimal 50 icon ter-mapping (target 60-70 untuk varied CTA usage)."""
    assert len(phosphor.ICON_CODEPOINTS) >= 50, (
        f"Harus ada >= 50 icon mapping, ada {len(phosphor.ICON_CODEPOINTS)}"
    )


def test_icon_codepoints_all_in_pua() -> None:
    """Phosphor pakai Unicode Private Use Area (E000-F8FF)."""
    for name, cp in phosphor.ICON_CODEPOINTS.items():
        assert 0xE000 <= cp <= 0xF8FF, (
            f"{name!r} codepoint U+{cp:04X} bukan di Private Use Area"
        )


@pytest.mark.parametrize(
    "name",
    ["plus", "trash", "floppy-disk", "printer", "magnifying-glass"],
)
def test_critical_cta_icons_present(name: str) -> None:
    """Icon yang dipakai sebagai primary CTA wajib ada."""
    assert name in phosphor.ICON_CODEPOINTS


def test_available_icons_sorted() -> None:
    icons = phosphor.available_icons()
    assert icons == sorted(icons)
    assert len(icons) == len(phosphor.ICON_CODEPOINTS)


# ---------------------------------------------------------------------------
# Glyph rendering (no Tk needed — pure PIL)
# ---------------------------------------------------------------------------
def test_render_glyph_returns_rgba_image() -> None:
    cp = phosphor.ICON_CODEPOINTS["plus"]
    img = phosphor._render_glyph(cp, 32, "#4f46e5")
    assert isinstance(img, Image.Image)
    assert img.mode == "RGBA"
    assert img.size == (32, 32)


def test_render_glyph_has_visible_pixels() -> None:
    """Glyph rendered pasti punya pixel non-transparan."""
    cp = phosphor.ICON_CODEPOINTS["floppy-disk"]
    img = phosphor._render_glyph(cp, 40, "#4f46e5")
    alpha_channel = img.getchannel("A")
    nonzero = sum(1 for px in alpha_channel.getdata() if px > 0)
    # >5% pixel harus visible (40*40*0.05 = 80)
    assert nonzero > 80, f"Glyph terlalu kosong: {nonzero} pixels visible"


def test_render_glyph_color_applied() -> None:
    """Pixel non-transparan harus pakai warna yang diminta (RGB)."""
    cp = phosphor.ICON_CODEPOINTS["check"]
    img = phosphor._render_glyph(cp, 32, "#ff0000")
    pixels = list(img.getdata())
    # Cari pixel pertama yang fully opaque
    visible = [p for p in pixels if p[3] > 200]
    assert visible, "Harus ada pixel opaque"
    # RGB dari pixel-pixel itu harus dominan merah
    avg_r = sum(p[0] for p in visible) / len(visible)
    avg_g = sum(p[1] for p in visible) / len(visible)
    avg_b = sum(p[2] for p in visible) / len(visible)
    assert avg_r > avg_g + 50, "Channel merah harus dominan"
    assert avg_r > avg_b + 50, "Channel merah harus dominan"


def test_render_glyph_short_hex() -> None:
    """Helper _hex_to_rgb harus support short form #f0f."""
    rgb = phosphor._hex_to_rgb("#f0f")
    assert rgb == (255, 0, 255)


def test_render_glyph_full_hex() -> None:
    rgb = phosphor._hex_to_rgb("#4f46e5")
    assert rgb == (0x4F, 0x46, 0xE5)


# ---------------------------------------------------------------------------
# CTkImage build (skip kalau customtkinter tidak ada)
# ---------------------------------------------------------------------------
@pytest.mark.skipif(not _has_ctk(), reason="customtkinter tidak tersedia")
def test_phosphor_icon_returns_ctkimage() -> None:
    img = phosphor.phosphor_icon("plus", size=20)
    # Lazy import customtkinter di sini supaya test ini di-skip kalau missing
    import customtkinter as ctk

    assert isinstance(img, ctk.CTkImage)


@pytest.mark.skipif(not _has_ctk(), reason="customtkinter tidak tersedia")
def test_phosphor_icon_unknown_name_returns_none() -> None:
    img = phosphor.phosphor_icon("nonexistent-icon-name", size=20)
    assert img is None


@pytest.mark.skipif(not _has_ctk(), reason="customtkinter tidak tersedia")
def test_phosphor_icon_caches() -> None:
    """Call kedua dengan args yang sama harus pakai cache."""
    phosphor._build_image.cache_clear()
    info_before = phosphor._build_image.cache_info()
    assert info_before.hits == 0

    phosphor.phosphor_icon("plus", size=20)
    phosphor.phosphor_icon("plus", size=20)
    phosphor.phosphor_icon("plus", size=20)

    info_after = phosphor._build_image.cache_info()
    assert info_after.hits >= 2


@pytest.mark.skipif(not _has_ctk(), reason="customtkinter tidak tersedia")
def test_phosphor_icon_color_tuple() -> None:
    """color spec tuple (light, dark) harus accepted."""
    img = phosphor.phosphor_icon("trash", size=24, color=("#ff0000", "#aa0000"))
    import customtkinter as ctk

    assert isinstance(img, ctk.CTkImage)


# ---------------------------------------------------------------------------
# Repo asset bundle integrity
# ---------------------------------------------------------------------------
def test_repo_root_assets_fonts_dir() -> None:
    """assets/fonts/ harus ada dan punya minimal Phosphor-Fill.ttf + LICENSE."""
    repo_root = Path(__file__).resolve().parents[1]
    fonts_dir = repo_root / "assets" / "fonts"
    assert fonts_dir.is_dir()
    files = {p.name for p in fonts_dir.iterdir()}
    assert "Phosphor-Fill.ttf" in files
    assert "Phosphor-LICENSE.txt" in files
