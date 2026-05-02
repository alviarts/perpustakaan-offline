"""Generate matplotlib charts untuk Laporan (grafik kunjungan, dsb).

Chart di-render ke buffer PNG yang bisa langsung ditampilkan di Tk via PIL.
"""
from __future__ import annotations

import io
from pathlib import Path

# Pakai backend non-GUI default; widget GUI akan embed via FigureCanvasTkAgg.
import matplotlib

matplotlib.use("Agg")

from matplotlib.figure import Figure

from perpustakaan.models import kunjungan as kunjungan_repo

_BULAN_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]


def figure_kunjungan_tahunan(tahun: int) -> Figure:
    data = kunjungan_repo.stats_per_bulan(tahun)
    totals = [d["total"] for d in data]
    fig = Figure(figsize=(8, 4.5), dpi=100)
    ax = fig.add_subplot(111)
    ax.bar(_BULAN_LABELS, totals, color="#3b82f6")
    for i, v in enumerate(totals):
        if v:
            ax.text(i, v + max(totals) * 0.01, str(v), ha="center", fontsize=8)
    ax.set_title(f"Grafik Kunjungan Perpustakaan Tahun {tahun}")
    ax.set_ylabel("Jumlah Kunjungan")
    ax.set_xlabel("Bulan")
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    return fig


def figure_kunjungan_bulanan(tahun: int, bulan: int) -> Figure:
    data = kunjungan_repo.stats_harian_bulan(tahun, bulan)
    by_day = {d["hari"]: d["total"] for d in data}
    days = list(range(1, 32))
    totals = [by_day.get(d, 0) for d in days]
    fig = Figure(figsize=(9, 4.5), dpi=100)
    ax = fig.add_subplot(111)
    ax.plot(days, totals, marker="o", color="#10b981", linewidth=1.5)
    ax.set_title(f"Grafik Kunjungan {_BULAN_LABELS[bulan - 1]} {tahun}")
    ax.set_ylabel("Jumlah")
    ax.set_xlabel("Tanggal")
    ax.grid(linestyle="--", alpha=0.3)
    fig.tight_layout()
    return fig


def save_figure(fig: Figure, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight", dpi=120)
    return path


def figure_to_png_bytes(fig: Figure) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=120)
    return buf.getvalue()
