"""Helper animasi UI sederhana berbasis ``Tk.after``.

Tk tidak punya engine animasi, tapi pola "step every N ms" cukup untuk
fade in/out dan slide singkat. Setiap fungsi defensif: kalau widget
sudah dihancurkan saat animasi jalan, langsung berhenti tanpa raise.

Di-extend pada PR-V4a v0.6.0 dengan helper microinteraction:

* :func:`lerp_color` / :func:`animate_color` — smooth color transition
* :func:`slide_to_y` — animate place(y=) (untuk sidebar active indicator)
* :func:`apply_dialog_appear` — fade-in + slide kecil dari atas untuk modal
* :func:`attach_press_feedback` — tactile feedback saat tombol di-klik
* :func:`attach_hover_lift` — smooth color cross-fade saat kursor hover/leave
"""
from __future__ import annotations

import contextlib
from collections.abc import Callable
from typing import Any

# Easing curve cache (precomputed step ratios) — re-pakai antar animasi.
# Key: (steps, curve_name) -> tuple of float ratios.
_EASE_CACHE: dict[tuple[int, str], tuple[float, ...]] = {}


def _ease_out_cubic(t: float) -> float:
    """Ease-out kubik: cepat di awal, lembut di akhir."""
    return 1.0 - (1.0 - t) ** 3


def _ease_in_out_cubic(t: float) -> float:
    """Ease-in-out kubik: lembut di awal & akhir."""
    return 4.0 * t * t * t if t < 0.5 else 1.0 - ((-2.0 * t + 2.0) ** 3) / 2.0


_EASE_FUNCS: dict[str, Callable[[float], float]] = {
    "out_cubic": _ease_out_cubic,
    "in_out_cubic": _ease_in_out_cubic,
    "linear": lambda t: t,
}


def _safe_call(widget: Any, func: Callable[..., Any], *args, **kwargs) -> None:
    with contextlib.suppress(Exception):
        if widget.winfo_exists():
            func(*args, **kwargs)


def fade_in_toplevel(
    win: Any,
    *,
    duration_ms: int = 180,
    steps: int = 9,
    end_alpha: float = 1.0,
) -> None:
    """Fade-in CTkToplevel / Tk dengan attribute ``-alpha``.

    Cocok untuk popup, tour overlay. Kalau attribute ``-alpha`` tidak
    didukung (mis. WM Linux tertentu), langsung set ke ``end_alpha``.
    """
    try:
        win.attributes("-alpha", 0.0)
    except Exception:  # noqa: BLE001 - WM tidak support
        return

    interval = max(int(duration_ms / max(steps, 1)), 8)
    delta = end_alpha / max(steps, 1)

    def _step(i: int) -> None:
        if not _widget_alive(win):
            return
        alpha = min(end_alpha, delta * i)
        with contextlib.suppress(Exception):
            win.attributes("-alpha", alpha)
        if i < steps:
            with contextlib.suppress(Exception):
                win.after(interval, _step, i + 1)

    _step(1)


def slide_in_x(
    widget: Any,
    *,
    from_x: int,
    to_x: int,
    y: int,
    duration_ms: int = 220,
    steps: int = 12,
    on_done: Callable[[], None] | None = None,
) -> None:
    """Animasikan ``place(x=...)`` dari ``from_x`` ke ``to_x``.

    Memakai :meth:`place_configure` setiap step. Diasumsikan widget
    sudah pernah dipanggil ``place(...)`` (dengan parameter relatif yang
    tetap, mis. ``relx``).
    """
    interval = max(int(duration_ms / max(steps, 1)), 10)
    diff = to_x - from_x

    def _step(i: int) -> None:
        if not _widget_alive(widget):
            return
        ratio = i / max(steps, 1)
        # Easing out cubic untuk akhiran lembut.
        ease = 1 - (1 - ratio) ** 3
        x = int(from_x + diff * ease)
        with contextlib.suppress(Exception):
            widget.place_configure(x=x, y=y)
        if i < steps:
            with contextlib.suppress(Exception):
                widget.after(interval, _step, i + 1)
        elif on_done is not None:
            with contextlib.suppress(Exception):
                on_done()

    _step(1)


def fade_out_widget(
    widget: Any,
    *,
    duration_ms: int = 220,
    steps: int = 8,
    on_done: Callable[[], None] | None = None,
) -> None:
    """Tk widget biasa tidak punya alpha — kita simulasi dgn bertahap
    mengaburkan border + memendekkan via ``after``. Setelah selesai,
    panggil ``on_done()`` untuk destroy.

    Kalau widget bukan Toplevel, animasi dilewati (langsung ``on_done``).
    """
    is_toplevel = False
    try:
        is_toplevel = widget.winfo_class() in {"Toplevel", "Tk"}
    except Exception:  # noqa: BLE001
        is_toplevel = False

    if not is_toplevel:
        if on_done is not None:
            with contextlib.suppress(Exception):
                on_done()
        return

    interval = max(int(duration_ms / max(steps, 1)), 10)

    def _step(i: int) -> None:
        if not _widget_alive(widget):
            return
        alpha = max(0.0, 1.0 - i / max(steps, 1))
        with contextlib.suppress(Exception):
            widget.attributes("-alpha", alpha)
        if i < steps:
            with contextlib.suppress(Exception):
                widget.after(interval, _step, i + 1)
        elif on_done is not None:
            with contextlib.suppress(Exception):
                on_done()

    _step(1)


def pulse_color(
    widget: Any,
    *,
    base_color: tuple[str, str] | str,
    flash_color: str,
    duration_ms: int = 600,
) -> None:
    """Highlight singkat dengan ``configure(fg_color=...)`` flash → revert."""

    def _revert() -> None:
        if _widget_alive(widget):
            with contextlib.suppress(Exception):
                widget.configure(fg_color=base_color)

    if not _widget_alive(widget):
        return
    with contextlib.suppress(Exception):
        widget.configure(fg_color=flash_color)
        widget.after(duration_ms, _revert)


def _widget_alive(widget: Any) -> bool:
    try:
        return bool(widget.winfo_exists())
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------------------
# Color interpolation (PR-V4a)
# ---------------------------------------------------------------------------
def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = (max(0, min(255, int(v))) for v in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def lerp_color(c_from: str, c_to: str, t: float) -> str:
    """Interpolasi 2 hex color via linear blending RGB.

    ``t`` di range [0, 1]; di-clamp jika di luar range. Pakai untuk
    menganimasikan ``fg_color`` widget secara halus karena Tk tidak
    interpolate warna native.
    """
    t = max(0.0, min(1.0, t))
    r1, g1, b1 = _hex_to_rgb(c_from)
    r2, g2, b2 = _hex_to_rgb(c_to)
    return _rgb_to_hex((
        r1 + (r2 - r1) * t,
        g1 + (g2 - g1) * t,
        b1 + (b2 - b1) * t,
    ))


def _resolve_color_for_mode(
    color: str | tuple[str, str],
    mode: str,
) -> str:
    """Ambil channel light / dark dari color spec CTk."""
    if isinstance(color, tuple):
        return color[0] if mode != "dark" else color[1]
    return color


def animate_color(
    widget: Any,
    *,
    attr: str,
    color_from: str | tuple[str, str],
    color_to: str | tuple[str, str],
    duration_ms: int = 180,
    steps: int = 9,
    curve: str = "out_cubic",
) -> None:
    """Animasikan widget attribute warna (mis. ``fg_color``, ``border_color``).

    Memakai :func:`lerp_color` untuk interpolasi RGB. Mendukung tuple
    ``(light, dark)`` dengan mode aktif diambil via
    ``ctk.get_appearance_mode()``. Setiap step memanggil
    ``widget.configure(**{attr: hex_color})``.
    """
    import customtkinter as ctk

    mode = "dark" if ctk.get_appearance_mode().lower() == "dark" else "light"
    cf = _resolve_color_for_mode(color_from, mode)
    ct = _resolve_color_for_mode(color_to, mode)
    ease = _EASE_FUNCS.get(curve, _ease_out_cubic)
    interval = max(int(duration_ms / max(steps, 1)), 10)

    def _step(i: int) -> None:
        if not _widget_alive(widget):
            return
        ratio = ease(i / max(steps, 1))
        try:
            widget.configure(**{attr: lerp_color(cf, ct, ratio)})
        except Exception:  # noqa: BLE001 — widget mungkin sudah destroy
            return
        if i < steps:
            with contextlib.suppress(Exception):
                widget.after(interval, _step, i + 1)

    _step(1)


# ---------------------------------------------------------------------------
# Position animation (PR-V4a)
# ---------------------------------------------------------------------------
def slide_to_y(
    widget: Any,
    *,
    from_y: int,
    to_y: int,
    x: int = 0,
    duration_ms: int = 200,
    steps: int = 12,
    curve: str = "out_cubic",
    on_done: Callable[[], None] | None = None,
) -> None:
    """Slide widget vertikal via ``place_configure(y=...)``.

    Komplemen :func:`slide_in_x`. Cocok untuk sidebar active indicator
    yang berpindah baris menu.
    """
    ease = _EASE_FUNCS.get(curve, _ease_out_cubic)
    interval = max(int(duration_ms / max(steps, 1)), 10)
    diff = to_y - from_y

    def _step(i: int) -> None:
        if not _widget_alive(widget):
            return
        ratio = ease(i / max(steps, 1))
        y = int(from_y + diff * ratio)
        with contextlib.suppress(Exception):
            widget.place_configure(x=x, y=y)
        if i < steps:
            with contextlib.suppress(Exception):
                widget.after(interval, _step, i + 1)
        elif on_done is not None:
            with contextlib.suppress(Exception):
                on_done()

    _step(1)


# ---------------------------------------------------------------------------
# Modal dialog appear: fade-in + small geometry offset
# ---------------------------------------------------------------------------
def apply_dialog_appear(
    win: Any,
    *,
    fade_duration_ms: int = 180,
    slide_offset_y: int = 12,
) -> None:
    """Smooth appear animation untuk CTkToplevel modal.

    Kombinasi 2 efek halus:

    * **Fade-in alpha** dari 0.0 → 1.0 via :func:`fade_in_toplevel`.
    * **Slide-in dari atas** sebesar ``slide_offset_y`` px dengan
      ease-out cubic. Memakai ``geometry()`` untuk gerakkan window.

    Aman: kalau WM tidak support ``-alpha``, slide tetap jalan; kalau
    geometry parsing gagal, fade tetap jalan; kalau dua-duanya gagal,
    silently no-op (window tampil normal).
    """
    fade_in_toplevel(win, duration_ms=fade_duration_ms, steps=10)

    # Geometry-based slide. Format string: "WIDTHxHEIGHT+X+Y".
    try:
        win.update_idletasks()
        geo = win.geometry()
    except Exception:  # noqa: BLE001
        return

    try:
        size_part, _, x_part = geo.partition("+")
        w_str, _, h_str = size_part.partition("x")
        x_token, _, y_token = x_part.partition("+")
        target_w = int(w_str)
        target_h = int(h_str)
        target_x = int(x_token)
        target_y = int(y_token)
    except Exception:  # noqa: BLE001
        return

    start_y = target_y - slide_offset_y
    with contextlib.suppress(Exception):
        win.geometry(f"{target_w}x{target_h}+{target_x}+{start_y}")

    steps = 10
    interval = max(int(fade_duration_ms / steps), 10)

    def _step(i: int) -> None:
        if not _widget_alive(win):
            return
        ratio = _ease_out_cubic(i / steps)
        y = int(start_y + slide_offset_y * ratio)
        with contextlib.suppress(Exception):
            win.geometry(f"{target_w}x{target_h}+{target_x}+{y}")
        if i < steps:
            with contextlib.suppress(Exception):
                win.after(interval, _step, i + 1)

    _step(1)


# ---------------------------------------------------------------------------
# Button press feedback (tactile)
# ---------------------------------------------------------------------------
def attach_press_feedback(
    btn: Any,
    *,
    duration_ms: int = 120,
) -> None:
    """Tambahkan feedback tactile saat tombol di-klik.

    Tk tidak support widget transform/scale, jadi kita simulasi tactile
    feedback dengan menambah ``border_width`` 1px sebentar (memberi efek
    "tertekan" subtle) — sederhana tapi cukup terasa.

    Aman dipanggil pada CTkButton, CTkFrame, atau widget apa pun yang
    support ``border_width`` config.
    """
    def _on_press(_e: Any = None) -> None:
        if not _widget_alive(btn):
            return
        try:
            original = btn.cget("border_width")
        except Exception:  # noqa: BLE001 — widget tidak support border_width
            return
        with contextlib.suppress(Exception):
            btn.configure(border_width=int(original) + 1)

        def _restore() -> None:
            if _widget_alive(btn):
                with contextlib.suppress(Exception):
                    btn.configure(border_width=original)

        with contextlib.suppress(Exception):
            btn.after(duration_ms, _restore)

    with contextlib.suppress(Exception):
        btn.bind("<Button-1>", _on_press, add="+")


# ---------------------------------------------------------------------------
# Hover lift cross-fade
# ---------------------------------------------------------------------------
def attach_hover_lift(
    widget: Any,
    *,
    base_color: str | tuple[str, str],
    hover_color: str | tuple[str, str],
    base_border: str | tuple[str, str] | None = None,
    hover_border: str | tuple[str, str] | None = None,
    duration_ms: int = 140,
) -> None:
    """Cross-fade ``fg_color`` (dan optional ``border_color``) saat hover.

    Lebih halus dibanding instant ``configure`` karena interpolasi RGB.
    Bind ke ``<Enter>`` dan ``<Leave>`` widget sasaran.
    """
    def _enter(_e: Any = None) -> None:
        if not _widget_alive(widget):
            return
        animate_color(
            widget, attr="fg_color",
            color_from=base_color, color_to=hover_color,
            duration_ms=duration_ms,
        )
        if base_border is not None and hover_border is not None:
            animate_color(
                widget, attr="border_color",
                color_from=base_border, color_to=hover_border,
                duration_ms=duration_ms,
            )

    def _leave(_e: Any = None) -> None:
        if not _widget_alive(widget):
            return
        animate_color(
            widget, attr="fg_color",
            color_from=hover_color, color_to=base_color,
            duration_ms=duration_ms,
        )
        if base_border is not None and hover_border is not None:
            animate_color(
                widget, attr="border_color",
                color_from=hover_border, color_to=base_border,
                duration_ms=duration_ms,
            )

    with contextlib.suppress(Exception):
        widget.bind("<Enter>", _enter, add="+")
        widget.bind("<Leave>", _leave, add="+")
