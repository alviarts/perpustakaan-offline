"""Loader untuk illustration PNG/SVG (mis. unDraw) di empty state besar.

Bundle illustration:

* Taro PNG (preferred — sudah pre-rendered) di
  ``assets/illustrations/<name>.png`` (transparan, ukuran ~ 480×360 atau lebih
  kecil supaya cepat).
* Sumber rekomen: https://undraw.co (open-source MIT-friendly).

Penggunaan::

    from perpustakaan.gui.illustrations import load_illustration

    img = load_illustration("empty-anggota", size=(320, 240))
    if img is not None:
        ctk.CTkLabel(parent, image=img, text="").pack()

Kalau file tidak ada, fungsi mengembalikan ``None`` (bukan raise) supaya
empty state tetap render dengan icon Lucide kecil sebagai fallback.

Module ini sengaja **belum** kita bundle illustration default — set v0.5.0
foundation hanya menyediakan API. Illustration aktual ditambahkan di patch
berikutnya supaya bisa di-curate lebih hati-hati (style consistency).
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import customtkinter as ctk
from PIL import Image

from perpustakaan.config import ASSETS_DIR

_log = logging.getLogger("perpustakaan.gui.illustrations")

ILLUSTRATION_DIR: Path = ASSETS_DIR / "illustrations"


@lru_cache(maxsize=64)
def _build_illustration(name: str, w: int, h: int) -> ctk.CTkImage | None:
    src = ILLUSTRATION_DIR / f"{name}.png"
    if not src.exists():
        _log.debug("illustration tidak ditemukan: %s", name)
        return None
    try:
        img = Image.open(src).convert("RGBA")
        img.thumbnail((w, h), Image.Resampling.LANCZOS)
        return ctk.CTkImage(light_image=img, dark_image=img, size=img.size)
    except Exception as exc:  # noqa: BLE001
        _log.warning("gagal load illustration %s: %s", name, exc)
        return None


def load_illustration(
    name: str, size: tuple[int, int] = (320, 240)
) -> ctk.CTkImage | None:
    """Load illustration ``assets/illustrations/{name}.png`` ke CTkImage.

    ``size`` adalah max bound — illustration di-thumbnail-kan dgn aspect
    ratio kept. Return ``None`` kalau file tidak ada / gagal di-decode.
    """
    return _build_illustration(name, size[0], size[1])


def available_illustrations() -> list[str]:
    """Daftar illustration yang ter-bundle, untuk debug / dokumentasi."""
    if not ILLUSTRATION_DIR.exists():
        return []
    return sorted(p.stem for p in ILLUSTRATION_DIR.glob("*.png"))
