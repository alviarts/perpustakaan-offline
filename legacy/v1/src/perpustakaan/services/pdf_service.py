"""PDF service: cetak Kartu Anggota (KTA), Label & Barcode, Nota/Invoice, Surat Bebas Pustaka.

Semua output disimpan di ``EXPORTS_DIR`` lalu path-nya dikembalikan agar caller bisa
membuka via ``os.startfile`` / viewer default.
"""
from __future__ import annotations

import io
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from perpustakaan.config import EXPORTS_DIR
from perpustakaan.models import settings as settings_repo
from perpustakaan.services import barcode_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _output_path(prefix: str, ext: str = "pdf") -> Path:
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = date.today().strftime("%Y%m%d")
    idx = 1
    while True:
        p = EXPORTS_DIR / f"{prefix}_{ts}_{idx:03d}.{ext}"
        if not p.exists():
            return p
        idx += 1


def _lib_identity() -> dict[str, str]:
    return {
        "nama": settings_repo.get_value("lib.nama") or "Perpustakaan Sekolah",
        "alamat": settings_repo.get_value("lib.alamat") or "-",
        "kepala": settings_repo.get_value("lib.kepala") or "-",
        "npsn": settings_repo.get_value("lib.npsn") or "-",
        "tahun": settings_repo.get_value("lib.tahun_ajaran") or "-",
        "kontak": settings_repo.get_value("lib.kontak") or "-",
        "logo": settings_repo.get_value("lib.logo_path") or "",
    }


# ---------------------------------------------------------------------------
# Kartu Tanda Anggota (KTA)
# ---------------------------------------------------------------------------
def cetak_kta(anggota: dict, output: Path | None = None) -> Path:
    """Cetak Kartu Tanda Anggota — ukuran kartu CR80 (85.6 x 54 mm) di A4 portrait."""
    out = output or _output_path(f"KTA_{anggota['kode_anggota']}")
    lib = _lib_identity()

    c = canvas.Canvas(str(out), pagesize=A4)
    page_w, page_h = A4
    card_w, card_h = 85.6 * mm, 54 * mm
    margin_x = (page_w - card_w) / 2
    y_top = page_h - 30 * mm

    # Frame depan
    c.setStrokeColor(colors.black)
    c.setLineWidth(0.5)
    c.rect(margin_x, y_top - card_h, card_w, card_h)

    # Header
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.rect(margin_x, y_top - 8 * mm, card_w, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(
        margin_x + card_w / 2, y_top - 5.5 * mm, "KARTU TANDA ANGGOTA"
    )
    c.setFont("Helvetica", 7)
    c.drawCentredString(margin_x + card_w / 2, y_top - 7.5 * mm, lib["nama"])

    # Body
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 7)
    text_x = margin_x + 30 * mm
    y = y_top - 13 * mm
    rows = [
        ("Kode", anggota.get("kode_anggota", "")),
        ("Nama", anggota.get("nama", "")),
        ("Kelas", anggota.get("kelas") or "-"),
        ("Jurusan", anggota.get("jurusan") or "-"),
        ("Berlaku", lib["tahun"]),
    ]
    for label, value in rows:
        c.drawString(text_x, y, f"{label}")
        c.drawString(text_x + 14 * mm, y, f": {value}")
        y -= 4.5 * mm

    # Foto placeholder
    foto_path = anggota.get("foto_path")
    photo_box = (margin_x + 3 * mm, y_top - card_h + 8 * mm, 24 * mm, 30 * mm)
    if foto_path and Path(foto_path).exists():
        try:
            c.drawImage(
                foto_path,
                photo_box[0],
                photo_box[1],
                photo_box[2],
                photo_box[3],
                preserveAspectRatio=True,
                anchor="c",
                mask="auto",
            )
        except Exception:
            c.rect(*photo_box)
            c.drawCentredString(
                photo_box[0] + photo_box[2] / 2,
                photo_box[1] + photo_box[3] / 2,
                "FOTO",
            )
    else:
        c.rect(*photo_box)
        c.setFont("Helvetica", 7)
        c.drawCentredString(
            photo_box[0] + photo_box[2] / 2,
            photo_box[1] + photo_box[3] / 2,
            "FOTO",
        )

    # Barcode di bawah
    bc_png = barcode_service.generate_png(
        anggota.get("kode_anggota", "A0000"),
        module_height=8.0,
        font_size=6,
    )
    img_io = io.BytesIO(bc_png)
    from reportlab.lib.utils import ImageReader

    c.drawImage(
        ImageReader(img_io),
        margin_x + card_w / 2 - 18 * mm,
        y_top - card_h + 1.5 * mm,
        width=36 * mm,
        height=8 * mm,
        preserveAspectRatio=True,
        anchor="c",
    )

    c.showPage()
    c.save()
    return out


# ---------------------------------------------------------------------------
# Label & Barcode buku (massal)
# ---------------------------------------------------------------------------
def cetak_label_buku(buku: dict, jumlah: int | None = None, output: Path | None = None) -> Path:
    """Cetak label dan barcode untuk semua eksemplar buku.

    Layout: 3 kolom x N baris di A4 portrait, 1 label per eksemplar (kode-XX).
    """
    from perpustakaan.models import buku as buku_repo

    out = output or _output_path(f"LABEL_{buku['kode_buku']}")
    eksemplars = buku_repo.list_eksemplar(int(buku["id"]))
    if jumlah and jumlah > 0:
        eksemplars = eksemplars[:jumlah]
    if not eksemplars:
        eksemplars = [{"kode_eksemplar": buku["kode_buku"]}]

    c = canvas.Canvas(str(out), pagesize=A4)
    page_w, page_h = A4
    cols = 3
    rows = 8
    label_w = (page_w - 20 * mm) / cols
    label_h = (page_h - 20 * mm) / rows
    margin_x = 10 * mm
    margin_y = 10 * mm

    from reportlab.lib.utils import ImageReader

    for idx, eks in enumerate(eksemplars):
        slot = idx % (cols * rows)
        col = slot % cols
        row = slot // cols
        if slot == 0 and idx > 0:
            c.showPage()
        x = margin_x + col * label_w
        y = page_h - margin_y - (row + 1) * label_h

        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.3)
        c.rect(x, y, label_w, label_h)

        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + label_w / 2, y + label_h - 4 * mm, _lib_identity()["nama"][:40])
        c.setFont("Helvetica", 7)
        c.drawCentredString(x + label_w / 2, y + label_h - 8 * mm, buku.get("judul", "")[:35])
        c.drawCentredString(
            x + label_w / 2, y + label_h - 12 * mm, f"DDC: {buku.get('kode_ddc') or '-'}"
        )
        c.drawCentredString(
            x + label_w / 2, y + label_h - 16 * mm, f"Rak: {buku.get('rak') or '-'}"
        )
        bc_png = barcode_service.generate_png(eks["kode_eksemplar"], module_height=8.0, font_size=6)
        c.drawImage(
            ImageReader(io.BytesIO(bc_png)),
            x + 4 * mm,
            y + 2 * mm,
            width=label_w - 8 * mm,
            height=label_h - 22 * mm,
            preserveAspectRatio=True,
        )
    c.showPage()
    c.save()
    return out


# ---------------------------------------------------------------------------
# Nota / Invoice transaksi
# ---------------------------------------------------------------------------
def cetak_nota(
    judul_nota: str,
    nomor: str,
    tanggal: str,
    anggota: dict,
    items: list[dict],
    *,
    total_denda: int = 0,
    total_bayar: int = 0,
    catatan: str = "",
    output: Path | None = None,
) -> Path:
    out = output or _output_path(f"NOTA_{nomor}")
    lib = _lib_identity()

    c = canvas.Canvas(str(out), pagesize=A4)
    page_w, page_h = A4
    y = page_h - 20 * mm

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(page_w / 2, y, lib["nama"])
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawCentredString(page_w / 2, y, lib["alamat"])
    y -= 4 * mm
    c.drawCentredString(page_w / 2, y, f"NPSN: {lib['npsn']}  •  {lib['kontak']}")
    y -= 8 * mm
    c.line(20 * mm, y, page_w - 20 * mm, y)
    y -= 6 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, judul_nota.upper())
    y -= 8 * mm

    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, y, f"No. Transaksi  : {nomor}")
    c.drawString(120 * mm, y, f"Tanggal : {tanggal}")
    y -= 5 * mm
    c.drawString(20 * mm, y, f"Kode Anggota   : {anggota.get('kode_anggota', '-')}")
    y -= 5 * mm
    c.drawString(20 * mm, y, f"Nama           : {anggota.get('nama', '-')}")
    y -= 5 * mm
    c.drawString(20 * mm, y, f"Kelas          : {anggota.get('kelas') or '-'}")
    y -= 8 * mm

    # Tabel item
    c.setFont("Helvetica-Bold", 9)
    c.drawString(20 * mm, y, "No")
    c.drawString(28 * mm, y, "Kode Buku")
    c.drawString(60 * mm, y, "Judul")
    c.drawString(140 * mm, y, "Status")
    c.drawString(170 * mm, y, "Denda")
    y -= 4 * mm
    c.line(20 * mm, y, page_w - 20 * mm, y)
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    for i, it in enumerate(items, 1):
        c.drawString(20 * mm, y, str(i))
        c.drawString(28 * mm, y, str(it.get("kode_buku", "-")))
        c.drawString(60 * mm, y, str(it.get("judul", "-"))[:40])
        c.drawString(140 * mm, y, str(it.get("status", "-")))
        c.drawRightString(190 * mm, y, f"Rp {int(it.get('denda', 0)):,}".replace(",", "."))
        y -= 5 * mm
        if y < 30 * mm:
            c.showPage()
            y = page_h - 20 * mm

    y -= 3 * mm
    c.line(20 * mm, y, page_w - 20 * mm, y)
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(120 * mm, y, "Total Denda")
    c.drawRightString(190 * mm, y, f"Rp {total_denda:,}".replace(",", "."))
    y -= 5 * mm
    c.drawString(120 * mm, y, "Total Bayar")
    c.drawRightString(190 * mm, y, f"Rp {total_bayar:,}".replace(",", "."))

    if catatan:
        y -= 10 * mm
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(20 * mm, y, f"Catatan: {catatan}")

    # Tanda tangan
    y = 35 * mm
    c.setFont("Helvetica", 9)
    c.drawString(120 * mm, y, "Petugas Perpustakaan")
    c.drawString(120 * mm, 18 * mm, "(______________________)")

    c.showPage()
    c.save()
    return out


# ---------------------------------------------------------------------------
# Surat Keterangan Bebas Pustaka
# ---------------------------------------------------------------------------
def cetak_bebas_pustaka(anggota: dict, *, output: Path | None = None) -> Path:
    out = output or _output_path(f"BEBAS_PUSTAKA_{anggota['kode_anggota']}")
    lib = _lib_identity()

    c = canvas.Canvas(str(out), pagesize=A4)
    page_w, page_h = A4
    y = page_h - 25 * mm

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(page_w / 2, y, lib["nama"])
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawCentredString(page_w / 2, y, lib["alamat"])
    y -= 4 * mm
    c.drawCentredString(page_w / 2, y, f"NPSN: {lib['npsn']}")
    y -= 10 * mm
    c.line(25 * mm, y, page_w - 25 * mm, y)
    c.line(25 * mm, y - 1.5 * mm, page_w - 25 * mm, y - 1.5 * mm)
    y -= 12 * mm

    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(page_w / 2, y, "SURAT KETERANGAN BEBAS PUSTAKA")
    y -= 5 * mm
    c.setFont("Helvetica", 10)
    no_surat = f"{anggota.get('kode_anggota', '')}/SBP/{date.today().strftime('%Y')}"
    c.drawCentredString(page_w / 2, y, f"Nomor: {no_surat}")
    y -= 12 * mm

    c.setFont("Helvetica", 11)
    c.drawString(25 * mm, y, "Yang bertanda tangan di bawah ini menerangkan bahwa:")
    y -= 8 * mm

    rows = [
        ("Nama", anggota.get("nama", "-")),
        ("Kode Anggota", anggota.get("kode_anggota", "-")),
        ("Kelas", anggota.get("kelas") or "-"),
        ("Jurusan", anggota.get("jurusan") or "-"),
    ]
    for label, value in rows:
        c.drawString(35 * mm, y, label)
        c.drawString(75 * mm, y, f": {value}")
        y -= 6 * mm

    y -= 5 * mm
    text = (
        f"Telah menyelesaikan seluruh kewajiban administrasi perpustakaan di "
        f"{lib['nama']} dan dinyatakan BEBAS dari segala tanggungan peminjaman "
        f"buku dan denda."
    )
    # Simple word wrap
    from reportlab.lib.utils import simpleSplit

    for line in simpleSplit(text, "Helvetica", 11, page_w - 50 * mm):
        c.drawString(25 * mm, y, line)
        y -= 5.5 * mm

    y -= 8 * mm
    c.drawString(25 * mm, y, "Surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.")

    # Tanda tangan
    y = 60 * mm
    c.drawRightString(page_w - 30 * mm, y, f"{date.today().strftime('%d %B %Y')}")
    c.drawRightString(page_w - 30 * mm, y - 5 * mm, "Kepala Perpustakaan,")
    c.drawRightString(page_w - 30 * mm, y - 30 * mm, f"({lib['kepala']})")

    c.showPage()
    c.save()
    return out
