"""Design tokens — palette warna, spacing, radius, & typography scale.

Tokens ini adalah foundation untuk visual overhaul v0.5.x (PR-V1+):
* Palette dipilih supaya kontras AA accessible (≥4.5 untuk text di atas
  light/dark surface) dan konsisten antara mode terang & gelap
* Spacing pakai skala 4px (xs=4, sm=8, md=12, lg=16, xl=24, xxl=32) — semua
  layout pakai kelipatan ini supaya rhythm visual rapi
* Radius mengikuti pola macOS (8 untuk control kecil, 12 untuk card, 16
  untuk modal)
* Color tuple ``(light, dark)`` cocok dengan API CustomTkinter — pass
  langsung ke ``fg_color=COLOR.surface`` dst.

Cara pakai:
    from perpustakaan.gui.design_tokens import COLOR, SPACE, RADIUS
    btn = ctk.CTkButton(parent, fg_color=COLOR.primary)
    frame.grid(padx=SPACE.md, pady=SPACE.sm)
"""
from __future__ import annotations

from typing import Final, NamedTuple


# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------
class _ColorTokens(NamedTuple):
    # Surfaces (background hierarchy)
    bg: tuple[str, str]              # body / canvas
    surface: tuple[str, str]         # card / panel
    surface_alt: tuple[str, str]     # input / secondary panel
    surface_hover: tuple[str, str]   # hover state

    # Borders & dividers
    border: tuple[str, str]
    border_strong: tuple[str, str]
    divider: tuple[str, str]

    # Text
    text: tuple[str, str]            # primary text
    text_muted: tuple[str, str]      # secondary
    text_subtle: tuple[str, str]     # tertiary / placeholder
    text_inverse: tuple[str, str]    # on-primary / on-accent

    # Brand / primary action (indigo-blue 600/500)
    primary: tuple[str, str]
    primary_hover: tuple[str, str]
    primary_subtle: tuple[str, str]  # tinted bg utk badge / pill
    primary_text: tuple[str, str]    # accent text di subtle bg

    # Semantic
    success: tuple[str, str]
    success_subtle: tuple[str, str]
    success_text: tuple[str, str]
    warning: tuple[str, str]
    warning_subtle: tuple[str, str]
    warning_text: tuple[str, str]
    danger: tuple[str, str]
    danger_subtle: tuple[str, str]
    danger_text: tuple[str, str]
    info: tuple[str, str]
    info_subtle: tuple[str, str]
    info_text: tuple[str, str]

    # Icon foreground default — kontras tinggi tapi tidak full-black
    icon: tuple[str, str]
    icon_muted: tuple[str, str]


COLOR: Final[_ColorTokens] = _ColorTokens(
    # Surfaces — palette netral hangat (gray-50 → gray-950)
    bg=("#f8fafc", "#0b1120"),                # slate-50 / very-dark blue
    surface=("#ffffff", "#111827"),           # white / gray-900
    surface_alt=("#f1f5f9", "#1f2937"),       # slate-100 / gray-800
    surface_hover=("#e2e8f0", "#374151"),     # slate-200 / gray-700

    border=("#e2e8f0", "#1f2937"),            # slate-200 / gray-800
    border_strong=("#cbd5e1", "#475569"),     # slate-300 / slate-600
    divider=("#f1f5f9", "#1f2937"),

    text=("#0f172a", "#f1f5f9"),              # slate-900 / slate-100
    text_muted=("#475569", "#94a3b8"),        # slate-600 / slate-400
    text_subtle=("#94a3b8", "#64748b"),       # slate-400 / slate-500
    text_inverse=("#ffffff", "#0f172a"),

    # Primary: indigo (lebih kalem dari pure blue, sesuai macOS-feel)
    primary=("#4f46e5", "#6366f1"),           # indigo-600 / indigo-500
    primary_hover=("#4338ca", "#4f46e5"),     # indigo-700 / indigo-600
    primary_subtle=("#e0e7ff", "#312e81"),    # indigo-100 / indigo-900
    primary_text=("#3730a3", "#c7d2fe"),      # indigo-800 / indigo-200

    success=("#16a34a", "#22c55e"),
    success_subtle=("#dcfce7", "#14532d"),
    success_text=("#15803d", "#86efac"),

    warning=("#d97706", "#f59e0b"),
    warning_subtle=("#fef3c7", "#78350f"),
    warning_text=("#a16207", "#fcd34d"),

    danger=("#dc2626", "#ef4444"),
    danger_subtle=("#fee2e2", "#7f1d1d"),
    danger_text=("#b91c1c", "#fca5a5"),

    info=("#0ea5e9", "#38bdf8"),
    info_subtle=("#e0f2fe", "#0c4a6e"),
    info_text=("#0369a1", "#7dd3fc"),

    # Icon default — sengaja dipilih kontras tinggi tapi kalem
    icon=("#334155", "#cbd5e1"),
    icon_muted=("#94a3b8", "#64748b"),
)


# ---------------------------------------------------------------------------
# Spacing scale — kelipatan 4px
# ---------------------------------------------------------------------------
class _SpaceTokens(NamedTuple):
    xs: int   # 4
    sm: int   # 8
    md: int   # 12
    lg: int   # 16
    xl: int   # 24
    xxl: int  # 32
    xxxl: int  # 48


SPACE: Final[_SpaceTokens] = _SpaceTokens(
    xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48,
)


# ---------------------------------------------------------------------------
# Border radius — pola Apple HIG
# ---------------------------------------------------------------------------
class _RadiusTokens(NamedTuple):
    none: int   # 0
    sm: int     # 6   — input, badge
    md: int     # 8   — button
    lg: int     # 12  — card, panel
    xl: int     # 16  — modal, sheet
    pill: int   # 999 — fully rounded


RADIUS: Final[_RadiusTokens] = _RadiusTokens(
    none=0, sm=6, md=8, lg=12, xl=16, pill=999,
)


# ---------------------------------------------------------------------------
# Icon sizes — ukuran standard utk Lucide icon di seluruh app
# ---------------------------------------------------------------------------
class _IconSizes(NamedTuple):
    xs: int   # 12 — inline text accent
    sm: int   # 16 — button icon, list row
    md: int   # 20 — toolbar, sidebar
    lg: int   # 24 — section header
    xl: int   # 32 — feature card
    xxl: int  # 48 — empty state hero


ICON_SIZE: Final[_IconSizes] = _IconSizes(
    xs=12, sm=16, md=20, lg=24, xl=32, xxl=48,
)


# ---------------------------------------------------------------------------
# Z-index — bukan Tk feature tapi guideline relatif untuk lift()/lower()
# ---------------------------------------------------------------------------
class _ZIndex(NamedTuple):
    base: int       # 0
    raised: int     # 10  — header buttons
    overlay: int    # 100 — toast, dropdown
    modal: int      # 1000 — dialog


Z: Final[_ZIndex] = _ZIndex(base=0, raised=10, overlay=100, modal=1000)


__all__ = ["COLOR", "SPACE", "RADIUS", "ICON_SIZE", "Z"]
