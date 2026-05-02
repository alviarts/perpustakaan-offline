"""Barcode generation (Code 39 sesuai SIM-Perpus asli).

Output: PNG (untuk preview di GUI) atau SVG (untuk PDF label).
"""
from __future__ import annotations

import io
from pathlib import Path

from barcode import Code39
from barcode.writer import ImageWriter, SVGWriter


def generate_png(
    text: str,
    *,
    add_checksum: bool = False,
    module_height: float = 12.0,
    font_size: int = 9,
    write_text: bool = True,
) -> bytes:
    """Generate barcode Code 39 sebagai PNG bytes.

    :param text: data barcode (umumnya kode buku ``B0001-01``).
    """
    writer = ImageWriter()
    options = {
        "module_height": module_height,
        "font_size": font_size,
        "write_text": write_text,
        "quiet_zone": 1.0,
    }
    bc = Code39(text, writer=writer, add_checksum=add_checksum)
    buf = io.BytesIO()
    bc.write(buf, options=options)
    return buf.getvalue()


def generate_svg(
    text: str,
    *,
    add_checksum: bool = False,
    write_text: bool = True,
) -> bytes:
    writer = SVGWriter()
    bc = Code39(text, writer=writer, add_checksum=add_checksum)
    buf = io.BytesIO()
    bc.write(buf, options={"write_text": write_text})
    return buf.getvalue()


def save_png(text: str, path: Path | str, **kwargs) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(generate_png(text, **kwargs))
    return path
