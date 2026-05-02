"""Main window: shell dengan sidebar navigasi + content area."""
from __future__ import annotations

import contextlib

import customtkinter as ctk

from perpustakaan.config import APP_DISPLAY_NAME, APP_VERSION
from perpustakaan.gui import widgets
from perpustakaan.gui.views.anggota_view import AnggotaView
from perpustakaan.gui.views.buku_view import BukuView
from perpustakaan.gui.views.dashboard_view import DashboardView
from perpustakaan.gui.views.kunjungan_view import KunjunganView
from perpustakaan.gui.views.laporan_view import LaporanView
from perpustakaan.gui.views.peminjaman_view import PeminjamanView
from perpustakaan.gui.views.pengembalian_view import PengembalianView
from perpustakaan.gui.views.settings_view import SettingsView
from perpustakaan.i18n import t
from perpustakaan.models import settings as settings_repo
from perpustakaan.services.auth import SessionUser
from perpustakaan.services.backup_scheduler import get_scheduler

_THEME_KEYS = ("system", "light", "dark")


class MainWindow(ctk.CTk):
    def __init__(self, user: SessionUser) -> None:
        super().__init__()
        widgets.configure_theme()
        self.user = user
        self.logout_requested = False

        self.title(APP_DISPLAY_NAME)
        self.geometry("1280x780")
        self.minsize(1100, 680)

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Sidebar
        self.sidebar = ctk.CTkFrame(self, width=240, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsw")
        self.sidebar.grid_propagate(False)

        # Content area
        self.content = ctk.CTkFrame(self, fg_color=("#f3f4f6", "#111827"))
        self.content.grid(row=0, column=1, sticky="nsew")
        self.content.grid_columnconfigure(0, weight=1)
        self.content.grid_rowconfigure(0, weight=1)

        self.views: dict[str, ctk.CTkFrame] = {}
        self._buttons: dict[str, ctk.CTkButton] = {}
        self._build_sidebar()
        self._build_views()
        self._build_theme_toggle()
        self.show("dashboard")

        # Hubungkan callback scheduler -> toast (marshal ke main thread).
        with contextlib.suppress(Exception):
            get_scheduler().set_callback(self._on_scheduled_backup)

        # Auto-launch tutorial di first-run (kalau user belum pernah selesai).
        with contextlib.suppress(Exception):
            self.after(800, self._maybe_autostart_tour)

    # ------------------------------------------------------------------
    # Theme toggle (selalu visible di pojok kanan-atas, terlepas dari menu)
    # ------------------------------------------------------------------
    def _build_theme_toggle(self) -> None:
        cur_theme = (settings_repo.get_value("ui.theme") or "system").lower()
        if cur_theme not in _THEME_KEYS:
            cur_theme = "system"
        labels = [t(f"theme.{k}") for k in _THEME_KEYS]
        self._theme_var = ctk.StringVar(value=t(f"theme.{cur_theme}"))
        self._theme_btn = ctk.CTkSegmentedButton(
            self.content,
            values=labels,
            variable=self._theme_var,
            command=self._on_theme_changed,
            font=ctk.CTkFont(size=12, weight="bold"),
        )
        # Anchor ke pojok kanan-atas content area.
        self._theme_btn.place(relx=1.0, rely=0.0, x=-16, y=12, anchor="ne")
        # Re-raise tiap kali user berpindah view supaya tetap di atas.
        self._theme_btn.lift()

    def _label_to_theme_key(self, label: str) -> str:
        for k in _THEME_KEYS:
            if t(f"theme.{k}") == label:
                return k
        return "system"

    def _on_theme_changed(self, label: str) -> None:
        key = self._label_to_theme_key(label)
        color = settings_repo.get_value("ui.color_theme", "blue") or "blue"
        with contextlib.suppress(Exception):
            widgets.configure_theme(key, color)
        with contextlib.suppress(Exception):
            settings_repo.set_value("ui.theme", key)
        with contextlib.suppress(Exception):
            widgets.show_toast(self, t("theme.applied"), kind="success", duration_ms=2000)

    # ------------------------------------------------------------------
    # Tour
    # ------------------------------------------------------------------
    def _maybe_autostart_tour(self) -> None:
        completed = (settings_repo.get_value("tutorial.completed") or "").strip()
        if completed != "1":
            self.start_tour()

    def start_tour(self) -> None:
        from perpustakaan.gui.tour import TourManager, build_default_steps

        steps = build_default_steps(self)
        TourManager(self, steps).start()

    def _on_scheduled_backup(self, result: dict) -> None:
        """Dipanggil dari worker thread saat backup terjadwal selesai."""
        def _show() -> None:
            with contextlib.suppress(Exception):
                if result.get("status") == "success":
                    name = ""
                    path = result.get("path", "")
                    if path:
                        from pathlib import Path

                        name = Path(path).name
                    msg = (
                        t("backup.toast.success", name=name)
                        if name
                        else t("backup.toast.success_noname")
                    )
                    widgets.show_toast(self, msg, kind="success", duration_ms=4500)
                else:
                    widgets.show_toast(
                        self,
                        t("backup.toast.failed", error=result.get("error", "")),
                        kind="error",
                        duration_ms=6000,
                    )
        with contextlib.suppress(Exception):
            self.after(0, _show)

    # ------------------------------------------------------------------
    # Sidebar
    # ------------------------------------------------------------------
    def _build_sidebar(self) -> None:
        ctk.CTkLabel(
            self.sidebar,
            text=APP_DISPLAY_NAME,
            font=ctk.CTkFont(size=16, weight="bold"),
        ).pack(pady=(20, 0), padx=20, anchor="w")
        ctk.CTkLabel(
            self.sidebar,
            text=f"v{APP_VERSION}",
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(pady=(0, 12), padx=20, anchor="w")

        ctk.CTkLabel(
            self.sidebar, text=f"👤  {self.user.full_name}",
            font=ctk.CTkFont(size=11, weight="bold"),
        ).pack(padx=20, anchor="w")
        ctk.CTkLabel(
            self.sidebar, text=f"{self.user.role}",
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(padx=20, anchor="w", pady=(0, 16))

        sections: list[tuple[str, list[tuple[str, str, str]]]] = [
            ("", [("dashboard", t("menu.dashboard"), "📊")]),
            (
                t("menu.master"),
                [
                    ("anggota", t("menu.master.anggota"), "👥"),
                    ("buku", t("menu.master.buku"), "📚"),
                ],
            ),
            (
                t("menu.transaksi"),
                [
                    ("kunjungan", t("menu.transaksi.kunjungan"), "🚪"),
                    ("peminjaman", t("menu.transaksi.peminjaman"), "📤"),
                    ("pengembalian", t("menu.transaksi.pengembalian"), "📥"),
                ],
            ),
            ("", [("laporan", t("menu.laporan"), "📈")]),
            ("", [("setting", t("menu.setting"), "⚙️")]),
        ]
        for section_label, items in sections:
            if section_label:
                ctk.CTkLabel(
                    self.sidebar,
                    text=section_label.upper(),
                    font=ctk.CTkFont(size=10, weight="bold"),
                    text_color=("#9ca3af", "#6b7280"),
                ).pack(padx=20, pady=(12, 4), anchor="w")
            for key, label, icon in items:
                btn = ctk.CTkButton(
                    self.sidebar,
                    text=f"  {icon}   {label}",
                    anchor="w",
                    height=36,
                    corner_radius=8,
                    fg_color="transparent",
                    text_color=("#1f2937", "#e5e7eb"),
                    hover_color=("#e5e7eb", "#1f2937"),
                    command=lambda k=key: self.show(k),
                )
                btn.pack(fill="x", padx=10, pady=2)
                self._buttons[key] = btn

        # Logout di bawah
        ctk.CTkButton(
            self.sidebar,
            text=f"  ↩   {t('menu.logout')}",
            anchor="w",
            height=36,
            corner_radius=8,
            fg_color="transparent",
            text_color="#ef4444",
            hover_color=("#fee2e2", "#7f1d1d"),
            command=self._do_logout,
        ).pack(fill="x", padx=10, pady=(20, 16), side="bottom")

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------
    def _build_views(self) -> None:
        view_factories = {
            "dashboard": DashboardView,
            "anggota": AnggotaView,
            "buku": BukuView,
            "kunjungan": KunjunganView,
            "peminjaman": PeminjamanView,
            "pengembalian": PengembalianView,
            "laporan": LaporanView,
            "setting": SettingsView,
        }
        for key, cls in view_factories.items():
            view = cls(self.content, app=self)
            view.grid(row=0, column=0, sticky="nsew")
            self.views[key] = view

    def show(self, key: str) -> None:
        view = self.views.get(key)
        if view is None:
            return
        view.tkraise()
        if hasattr(view, "on_show"):
            with contextlib.suppress(Exception):
                view.on_show()
        for k, btn in self._buttons.items():
            if k == key:
                btn.configure(fg_color=("#dbeafe", "#1e3a8a"))
            else:
                btn.configure(fg_color="transparent")
        # Pastikan theme toggle tetap di atas setelah view di-raise.
        with contextlib.suppress(Exception):
            self._theme_btn.lift()

    # ------------------------------------------------------------------
    def _do_logout(self) -> None:
        if widgets.confirm(self, t("toast.confirm_logout")):
            self.logout_requested = True
            self.destroy()

    def destroy(self) -> None:
        # Lepas callback supaya scheduler tidak panggil widget yang sudah hancur.
        with contextlib.suppress(Exception):
            get_scheduler().set_callback(None)
        super().destroy()
