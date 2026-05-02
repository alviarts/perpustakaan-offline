"""Font helper untuk Perpustakaan Offline.

Strategi pemilihan font (zero runtime deps tambahan):
    1. **Windows installer** (Inno Setup) menginstal **Inter** ke user fonts
       directory saat setup. Jadi setelah install via Setup-v0.4.1.exe, font
       Inter langsung tersedia di Tk via ``tkfont.families()``.
    2. **Build .exe portable + Linux binary**: font Inter ada di-bundle di
       ``assets/fonts/``. App **tidak meng-install** secara global (tidak
       butuh admin) — kita cuma deteksi font sistem yang sudah ada dan pilih
       yang paling modern dari priority list.
    3. **Dev / venv**: kalau user develop di Linux dan tidak punya Inter,
       app fallback ke Segoe UI / Cantarell / Ubuntu / Helvetica / system
       default. Tetap modern, tetap konsisten.

Modul ini idempotent + defensive: aman dipanggil sebelum Tk root ada,
tidak crash kalau font assets hilang.
"""
from __future__ import annotations

import logging
from pathlib import Path

import customtkinter as ctk

from perpustakaan.config import ASSETS_DIR

_log = logging.getLogger("perpustakaan.gui.fonts")

# Family Inter setelah ter-detect; None artinya Inter belum tersedia di Tk.
_DETECTED_FAMILY: str | None = None
_DETECTION_DONE: bool = False

# Prioritas: Inter (kalau sudah di-install) → modern Win/Mac → modern Linux →
# legacy fallback → biarkan Tk pakai default.
_FALLBACK_FAMILIES: tuple[str, ...] = (
    "Inter",
    "Inter UI",
    "Inter Display",
    "Segoe UI Variable",
    "Segoe UI",
    "SF Pro Text",
    "Helvetica Neue",
    "Roboto",
    "Cantarell",
    "Ubuntu",
    "Arial",
)


def font_assets_dir() -> Path:
    return ASSETS_DIR / "fonts"


def list_bundled_font_files() -> list[Path]:
    """List file font yang di-bundle (untuk dipakai installer)."""
    d = font_assets_dir()
    if not d.is_dir():
        return []
    return sorted(p for p in d.iterdir() if p.suffix.lower() in {".ttf", ".otf"})


def _system_families() -> set[str]:
    try:
        from tkinter import font as tkfont

        return set(tkfont.families())
    except Exception:  # noqa: BLE001
        return set()


def detect_default_family(force: bool = False) -> str | None:
    """Cari family modern terbaik yang sudah ter-install di Tk.

    Hasilnya di-cache hanya setelah Tk root tersedia dan family terdeteksi
    (atau ``force=True`` dipanggil eksplisit). Sebelum Tk root ada,
    ``_system_families()`` mengembalikan set kosong; kita TIDAK cache null
    supaya panggilan berikutnya (setelah root siap) bisa men-detect lagi.
    """
    global _DETECTED_FAMILY, _DETECTION_DONE
    if _DETECTION_DONE and not force:
        return _DETECTED_FAMILY
    fams = _system_families()
    if not fams:
        # Tk root belum siap. Jangan cache, retry nanti.
        return None
    chosen: str | None = None
    for fam in _FALLBACK_FAMILIES:
        if fam in fams:
            chosen = fam
            break
    _DETECTED_FAMILY = chosen
    _DETECTION_DONE = True
    if chosen:
        _log.info("Font UI: %s", chosen)
    else:
        _log.info("Font UI: pakai default Tk (tidak ada family modern terdeteksi)")
    return chosen


def default_family() -> str | None:
    """Lazy alias ke ``detect_default_family``."""
    return detect_default_family()


def get_font(
    size: int,
    *,
    weight: str = "normal",
    slant: str = "roman",
) -> ctk.CTkFont:
    """Factory ``ctk.CTkFont`` dengan family modern terbaik."""
    fam = default_family()
    if fam:
        return ctk.CTkFont(family=fam, size=size, weight=weight, slant=slant)
    return ctk.CTkFont(size=size, weight=weight, slant=slant)


def heading_font() -> ctk.CTkFont:
    """Font heading view (judul "Data Anggota", dst.)."""
    return get_font(22, weight="bold")


def section_font() -> ctk.CTkFont:
    """Font subjudul / section heading."""
    return get_font(15, weight="bold")


def body_font() -> ctk.CTkFont:
    return get_font(12)


def small_font() -> ctk.CTkFont:
    return get_font(11)


def stat_value_font() -> ctk.CTkFont:
    """Font angka besar di StatCard Dashboard."""
    return get_font(26, weight="bold")
