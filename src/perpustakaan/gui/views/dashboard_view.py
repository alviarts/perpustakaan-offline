"""Dashboard view: kartu statistik + reminder jatuh tempo."""
from __future__ import annotations

import customtkinter as ctk

from perpustakaan.gui.widgets import StatCard, StyledTreeview, fmt_rupiah
from perpustakaan.i18n import t
from perpustakaan.models import dashboard
from perpustakaan.models import peminjaman as peminjaman_repo


class DashboardView(ctk.CTkFrame):
    def __init__(self, parent, app) -> None:
        super().__init__(parent, fg_color="transparent")
        self.app = app

        # Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=24, pady=(20, 8))
        ctk.CTkLabel(
            header, text=t("menu.dashboard"),
            font=ctk.CTkFont(size=22, weight="bold"),
        ).pack(side="left")
        ctk.CTkButton(
            header, text=t("common.refresh"), width=100, command=self.on_show
        ).pack(side="right")

        # Stat cards (3 baris x 4 kolom = 9 cards)
        self.cards: dict[str, StatCard] = {}
        cards_frame = ctk.CTkFrame(self, fg_color="transparent")
        cards_frame.pack(fill="x", padx=24, pady=8)
        for c in range(4):
            cards_frame.grid_columnconfigure(c, weight=1, uniform="card")

        defs = [
            ("anggota_total", t("dash.total_anggota"), "#3b82f6", "👥"),
            ("buku_total", t("dash.total_buku"), "#8b5cf6", "📚"),
            ("eksemplar_total", t("dash.eksemplar"), "#06b6d4", "📦"),
            ("dipinjam", t("dash.dipinjam"), "#f59e0b", "📤"),
            ("dikembalikan", t("dash.dikembalikan"), "#10b981", "📥"),
            ("terlambat", t("dash.terlambat"), "#ef4444", "⏰"),
            ("hilang", t("dash.hilang"), "#dc2626", "❌"),
            ("kunjungan_hari", t("dash.kunjungan_hari"), "#0ea5e9", "🚪"),
        ]
        for idx, (key, label, color, icon) in enumerate(defs):
            card = StatCard(cards_frame, label, "0", color=color, icon=icon)
            card.grid(row=idx // 4, column=idx % 4, padx=8, pady=8, sticky="nsew")
            self.cards[key] = card

        self.kas_card = StatCard(
            cards_frame, t("dash.kas_saldo"), "Rp 0", color="#16a34a", icon="💰"
        )
        self.kas_card.grid(row=2, column=0, columnspan=4, padx=8, pady=8, sticky="ew")

        # Reminder jatuh tempo
        ctk.CTkLabel(
            self, text="Reminder Jatuh Tempo / Terlambat",
            font=ctk.CTkFont(size=14, weight="bold"),
        ).pack(anchor="w", padx=24, pady=(20, 4))

        self.reminder = StyledTreeview(
            self,
            columns=[
                ("nomor_pinjam", "No. Pinjam", 140),
                ("kode_anggota", "Kode Anggota", 110),
                ("nama", "Nama", 220),
                ("kode_buku", "Kode Buku", 110),
                ("judul", "Judul", 320),
                ("tanggal_jatuh_tempo", "Jatuh Tempo", 110),
                ("sisa_hari", "Sisa Hari", 80),
            ],
            height=10,
        )
        self.reminder.pack(fill="both", expand=True, padx=24, pady=(4, 20))

    def on_show(self) -> None:
        stats = dashboard.stats()
        for key in (
            "anggota_total", "buku_total", "eksemplar_total", "dipinjam",
            "dikembalikan", "terlambat", "hilang", "kunjungan_hari",
        ):
            self.cards[key].set_value(str(stats.get(key, 0)))
        self.kas_card.set_value(fmt_rupiah(stats.get("kas_saldo", 0)))

        self.reminder.set_rows(peminjaman_repo.list_jatuh_tempo_segera(days_ahead=2))
