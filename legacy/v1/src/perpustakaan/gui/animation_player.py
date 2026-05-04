"""Widget ``AnimationPlayer`` (PR-V4b v0.6.1).

Cycle PNG frame sequence dari ``assets/animations/<name>/frame_NN.png``
sebagai animation player ringan tanpa Lottie / cairosvg / FFmpeg.

Pemakaian::

    from perpustakaan.gui.animation_player import AnimationPlayer

    player = AnimationPlayer(parent, name="loader_dots", size=(64, 64), fps=24)
    player.pack()
    player.start()           # auto-loop
    # ...
    player.stop()            # pause
    player.destroy()         # cleanup

Mode play-once (cocok untuk ``success_check`` + callback after done)::

    player = AnimationPlayer(
        parent, name="success_check", size=(96, 96),
        fps=30, loop=False, on_done=lambda: parent.destroy(),
    )
    player.start()

Asset tidak ada \u2192 widget tetap di-create tapi blank; ``start()`` no-op.
"""
from __future__ import annotations

import contextlib
from collections.abc import Callable
from pathlib import Path
from typing import Any

import customtkinter as ctk
from PIL import Image

# ---------------------------------------------------------------------------
# Frame loader \u2014 dengan cache supaya re-mount cheap
# ---------------------------------------------------------------------------
_FRAME_CACHE: dict[tuple[str, tuple[int, int]], list[Any]] = {}


def _animations_root() -> Path:
    """Resolusi ``assets/animations/``.

    Pakai :data:`config.ASSETS_DIR` yang sudah handle PyInstaller _MEIPASS
    + dev mode (repo root).
    """
    from perpustakaan.config import ASSETS_DIR

    return ASSETS_DIR / "animations"


def load_animation_frames(name: str, size: tuple[int, int]) -> list[Any]:
    """Load semua frame PNG di ``assets/animations/<name>/`` sebagai CTkImage.

    Hasil di-cache by (name, size). Return ``[]`` kalau folder tidak ada.
    """
    cache_key = (name, size)
    if cache_key in _FRAME_CACHE:
        return _FRAME_CACHE[cache_key]

    root = _animations_root() / name
    frames: list[Any] = []
    if not root.exists():
        _FRAME_CACHE[cache_key] = frames
        return frames

    for path in sorted(root.glob("frame_*.png")):
        try:
            pil = Image.open(path).convert("RGBA")
            if pil.size != size:
                pil = pil.resize(size, Image.LANCZOS)
            ctk_img = ctk.CTkImage(light_image=pil, dark_image=pil, size=size)
            frames.append(ctk_img)
        except Exception:  # noqa: BLE001 \u2014 frame korup / IO error: skip
            continue

    _FRAME_CACHE[cache_key] = frames
    return frames


def clear_frame_cache() -> None:
    """Clear semua cache frame (untuk test deterministik)."""
    _FRAME_CACHE.clear()


# ---------------------------------------------------------------------------
# AnimationPlayer widget
# ---------------------------------------------------------------------------
class AnimationPlayer(ctk.CTkLabel):
    """CTkLabel yang cycle PNG frames lewat ``after()``.

    :param parent: parent widget
    :param name: nama animasi (sub-folder di assets/animations/)
    :param size: ukuran tampilan (W, H) px
    :param fps: frame per second (default 24)
    :param loop: apakah animasi loop (True) atau play-once (False)
    :param on_done: callback dipanggil saat animasi selesai (loop=False saja)
    """

    def __init__(
        self,
        parent: Any,
        *,
        name: str,
        size: tuple[int, int] = (64, 64),
        fps: int = 24,
        loop: bool = True,
        on_done: Callable[[], None] | None = None,
        **label_kwargs: Any,
    ) -> None:
        self._frames = load_animation_frames(name, size)
        self._fps = max(1, min(60, fps))
        self._delay_ms = max(16, 1000 // self._fps)
        self._loop = loop
        self._on_done = on_done
        self._idx = 0
        self._after_id: str | None = None
        self._running = False

        # Initial frame (kalau ada)
        first_image = self._frames[0] if self._frames else None
        super().__init__(
            parent,
            text="" if first_image else f"[{name}]",
            image=first_image,
            **label_kwargs,
        )
        # Cleanup saat widget destroy
        self.bind("<Destroy>", self._on_destroy, add=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start(self) -> None:
        """Mulai animasi. No-op kalau frame kosong atau sudah running."""
        if self._running or not self._frames:
            return
        self._running = True
        self._idx = 0
        self._tick()

    def stop(self) -> None:
        """Stop animasi. Pause di frame current."""
        self._running = False
        if self._after_id:
            with contextlib.suppress(Exception):
                self.after_cancel(self._after_id)
        self._after_id = None

    def restart(self) -> None:
        """Reset ke frame 0 lalu mulai lagi."""
        self.stop()
        self._idx = 0
        if self._frames:
            with contextlib.suppress(Exception):
                self.configure(image=self._frames[0])
        self.start()

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def frame_count(self) -> int:
        return len(self._frames)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    def _tick(self) -> None:
        if not self._running:
            return
        try:
            if not self.winfo_exists():
                self._running = False
                return
        except Exception:  # noqa: BLE001
            self._running = False
            return

        if not self._frames:
            self._running = False
            return

        with contextlib.suppress(Exception):
            self.configure(image=self._frames[self._idx])

        self._idx += 1
        if self._idx >= len(self._frames):
            if self._loop:
                self._idx = 0
            else:
                # Stay di last frame
                self._idx = len(self._frames) - 1
                self._running = False
                if self._on_done:
                    with contextlib.suppress(Exception):
                        self._on_done()
                return

        with contextlib.suppress(Exception):
            self._after_id = self.after(self._delay_ms, self._tick)

    def _on_destroy(self, _event: Any = None) -> None:
        self.stop()
