"""Test design tokens — palette + spacing + radius (visual foundation v0.5).

Cek bahwa semua token memang ada dan bertipe yang diharapkan supaya kalau
ada yang accidentally dihapus, test langsung gagal sebelum app runtime
crash.
"""
from __future__ import annotations


def test_color_palette_complete():
    from perpustakaan.gui.design_tokens import COLOR

    expected_attrs = {
        "bg", "surface", "surface_alt", "surface_hover",
        "border", "border_strong", "divider",
        "text", "text_muted", "text_subtle", "text_inverse",
        "primary", "primary_hover", "primary_subtle", "primary_text",
        "success", "success_subtle", "success_text",
        "warning", "warning_subtle", "warning_text",
        "danger", "danger_subtle", "danger_text",
        "info", "info_subtle", "info_text",
        "icon", "icon_muted",
    }
    for name in expected_attrs:
        val = getattr(COLOR, name)
        assert isinstance(val, tuple), f"{name} bukan tuple"
        assert len(val) == 2, f"{name} bukan (light, dark)"
        for hex_str in val:
            assert isinstance(hex_str, str)
            assert hex_str.startswith("#")
            assert len(hex_str) in (4, 7), f"{name} hex tidak valid: {hex_str}"


def test_spacing_scale_kelipatan_4px():
    from perpustakaan.gui.design_tokens import SPACE

    expected = {"xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24, "xxl": 32}
    for name, value in expected.items():
        actual = getattr(SPACE, name)
        assert actual == value, f"SPACE.{name} = {actual}, expected {value}"
        # Semua kelipatan 4 supaya rhythm konsisten.
        assert actual % 4 == 0


def test_radius_scale():
    from perpustakaan.gui.design_tokens import RADIUS

    assert RADIUS.none == 0
    assert RADIUS.sm < RADIUS.md < RADIUS.lg < RADIUS.xl
    assert RADIUS.pill >= 999  # fully rounded


def test_icon_size_scale():
    from perpustakaan.gui.design_tokens import ICON_SIZE

    # Skala mengikuti pola klasik: 12, 16, 20, 24, 32, 48.
    sizes = [
        ICON_SIZE.xs, ICON_SIZE.sm, ICON_SIZE.md,
        ICON_SIZE.lg, ICON_SIZE.xl, ICON_SIZE.xxl,
    ]
    assert sizes == sorted(sizes), "icon size tidak ascending"
    assert ICON_SIZE.sm >= 16  # minimum readable


def test_z_index_ordering():
    from perpustakaan.gui.design_tokens import Z

    assert Z.base < Z.raised < Z.overlay < Z.modal


def test_color_hex_format_valid():
    """Semua hex code valid hex (3 atau 6 digit)."""
    import re

    from perpustakaan.gui.design_tokens import COLOR

    pattern = re.compile(r"^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$")
    for field in COLOR._fields:
        light, dark = getattr(COLOR, field)
        assert pattern.match(light), f"COLOR.{field} light bukan hex valid: {light}"
        assert pattern.match(dark), f"COLOR.{field} dark bukan hex valid: {dark}"
