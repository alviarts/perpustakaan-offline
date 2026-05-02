"""Helper animasi UI sederhana berbasis ``Tk.after``.

Tk tidak punya engine animasi, tapi pola "step every N ms" cukup untuk
fade in/out dan slide singkat. Setiap fungsi defensif: kalau widget
sudah dihancurkan saat animasi jalan, langsung berhenti tanpa raise.
"""
from __future__ import annotations

import contextlib
from collections.abc import Callable
from typing import Any


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
