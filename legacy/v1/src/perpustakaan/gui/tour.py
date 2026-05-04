"""Guided tour kontekstual per-menu.

Tutorial onboarding di v0.4.1 dirombak dari satu flow linear (10 step
keliling semua menu) menjadi **per-menu contextual tours**:

* First-run: tour singkat ``welcome`` di Dashboard.
* Tiap kali user buka menu (Anggota, Buku, Peminjaman, dsb.) **pertama
  kali**, tour khusus menu tersebut auto-muncul (di-cek lewat flag
  ``tutorial.<menu>.completed``).
* Setelah selesai / di-skip, tombol ``?`` di pojok kanan-atas memungkinkan
  user **replay tour menu yang sedang dibuka** kapan saja.

Tour memakai overlay popup (CTkToplevel borderless) + **spotlight ring**
di sekitar widget target — frame dengan border tebal warna aksen yang
ditempatkan tepat di atas widget tujuan supaya jelas tombol mana yang
sedang dijelaskan.

API utama:
- :func:`start_menu_tour(main_window, menu_key)` — entry point manual.
- :func:`maybe_autostart_menu_tour(main_window, menu_key)` — dipanggil
  oleh :class:`MainWindow.show` saat user pindah menu.
- :func:`reset_all_tutorial_flags()` — clear semua flag untuk replay.
"""
from __future__ import annotations

import contextlib
from collections.abc import Callable
from dataclasses import dataclass
from tkinter import ttk
from typing import Any

import customtkinter as ctk

from perpustakaan.gui.animations import fade_in_toplevel
from perpustakaan.i18n import t
from perpustakaan.models import settings as settings_repo

WidgetResolver = Callable[[], Any]
PreShowHook = Callable[[], None]


@dataclass(frozen=True)
class TourStep:
    """Satu langkah tutorial."""

    key: str
    title_key: str
    body_key: str
    target_resolver: WidgetResolver | None = None
    placement: str = "right"  # right | left | top | bottom | center
    before_show: PreShowHook | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _flag_key(menu_key: str) -> str:
    return f"tutorial.{menu_key}.completed"


def is_menu_completed(menu_key: str) -> bool:
    """True bila flag completed sudah ke-set ``"1"``."""
    val = (settings_repo.get_value(_flag_key(menu_key)) or "").strip()
    return val == "1"


def mark_menu_completed(menu_key: str) -> None:
    with contextlib.suppress(Exception):
        settings_repo.set_value(_flag_key(menu_key), "1")


def reset_all_tutorial_flags() -> None:
    """Clear semua flag ``tutorial.*.completed`` supaya tour auto-muncul lagi."""
    for menu in MENU_KEYS:
        with contextlib.suppress(Exception):
            settings_repo.set_value(_flag_key(menu), "")
    # Backward compat: flag legacy v0.4.0 juga di-clear.
    with contextlib.suppress(Exception):
        settings_repo.set_value("tutorial.completed", "")


def _find_button_by_text(parent: Any, text: str) -> Any:
    """Walk widget tree cari ``CTkButton`` pertama dengan teks tertentu.

    Pencocokan case-sensitive substring sehingga tahan terhadap perbedaan
    spasi/imbuhan minor di label.
    """
    if parent is None:
        return None
    try:
        children = parent.winfo_children()
    except Exception:  # noqa: BLE001
        return None
    for child in children:
        try:
            if isinstance(child, ctk.CTkButton):
                lbl = child.cget("text") or ""
                if text and text in str(lbl):
                    return child
        except Exception:  # noqa: BLE001
            pass
        # Recurse
        found = _find_button_by_text(child, text)
        if found is not None:
            return found
    return None


# ---------------------------------------------------------------------------
# Per-menu tour builders
# ---------------------------------------------------------------------------
MENU_KEYS = (
    "dashboard",
    "anggota",
    "buku",
    "kunjungan",
    "peminjaman",
    "pengembalian",
    "laporan",
    "setting",
)


def _view(main_window: Any, key: str) -> Any:
    return main_window.views.get(key)


def _build_dashboard_steps(mw: Any) -> list[TourStep]:
    return [
        TourStep(
            key="dashboard.welcome",
            title_key="tour.welcome.title",
            body_key="tour.welcome.body",
            placement="center",
        ),
        TourStep(
            key="dashboard.cards",
            title_key="tour.dashboard.cards.title",
            body_key="tour.dashboard.cards.body",
            target_resolver=lambda: getattr(_view(mw, "dashboard"), "cards", {}).get(
                "anggota_total"
            ),
            placement="bottom",
        ),
        TourStep(
            key="dashboard.help",
            title_key="tour.help.title",
            body_key="tour.help.body",
            target_resolver=lambda: getattr(mw, "_help_btn", None),
            placement="bottom",
        ),
    ]


def _build_anggota_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "anggota")

    return [
        TourStep(
            key="anggota.intro",
            title_key="tour.anggota.intro.title",
            body_key="tour.anggota.intro.body",
            placement="center",
        ),
        TourStep(
            key="anggota.add",
            title_key="tour.anggota.add.title",
            body_key="tour.anggota.add.body",
            target_resolver=lambda: getattr(view, "btn_save", None),
            placement="right",
        ),
        TourStep(
            key="anggota.naik_kelas",
            title_key="tour.anggota.naik_kelas.title",
            body_key="tour.anggota.naik_kelas.body",
            target_resolver=lambda: _find_button_by_text(view, t("anggota.naik_kelas")),
            placement="bottom",
        ),
        TourStep(
            key="anggota.cetak_kta",
            title_key="tour.anggota.cetak_kta.title",
            body_key="tour.anggota.cetak_kta.body",
            target_resolver=lambda: _find_button_by_text(view, t("anggota.cetak_kta")),
            placement="bottom",
        ),
        TourStep(
            key="anggota.bebas_pustaka",
            title_key="tour.anggota.bebas_pustaka.title",
            body_key="tour.anggota.bebas_pustaka.body",
            target_resolver=lambda: _find_button_by_text(view, t("anggota.bebas_pustaka")),
            placement="bottom",
        ),
        TourStep(
            key="anggota.import",
            title_key="tour.anggota.import.title",
            body_key="tour.anggota.import.body",
            target_resolver=lambda: _find_button_by_text(view, t("common.import")),
            placement="bottom",
        ),
    ]


def _build_buku_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "buku")

    return [
        TourStep(
            key="buku.intro",
            title_key="tour.buku.intro.title",
            body_key="tour.buku.intro.body",
            placement="center",
        ),
        TourStep(
            key="buku.add",
            title_key="tour.buku.add.title",
            body_key="tour.buku.add.body",
            target_resolver=lambda: getattr(view, "btn_save", None),
            placement="right",
        ),
        TourStep(
            key="buku.cetak_label",
            title_key="tour.buku.cetak_label.title",
            body_key="tour.buku.cetak_label.body",
            target_resolver=lambda: _find_button_by_text(view, t("buku.cetak_label")),
            placement="bottom",
        ),
        TourStep(
            key="buku.transfer_penerbit",
            title_key="tour.buku.transfer_penerbit.title",
            body_key="tour.buku.transfer_penerbit.body",
            target_resolver=lambda: _find_button_by_text(view, t("buku.transfer_penerbit")),
            placement="bottom",
        ),
        TourStep(
            key="buku.import",
            title_key="tour.buku.import.title",
            body_key="tour.buku.import.body",
            target_resolver=lambda: _find_button_by_text(view, t("common.import")),
            placement="bottom",
        ),
    ]


def _build_kunjungan_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "kunjungan")

    return [
        TourStep(
            key="kunjungan.intro",
            title_key="tour.kunjungan.intro.title",
            body_key="tour.kunjungan.intro.body",
            placement="center",
        ),
        TourStep(
            key="kunjungan.search",
            title_key="tour.kunjungan.search.title",
            body_key="tour.kunjungan.search.body",
            target_resolver=lambda: getattr(view, "anggota_search", None),
            placement="right",
        ),
        TourStep(
            key="kunjungan.kelas",
            title_key="tour.kunjungan.kelas.title",
            body_key="tour.kunjungan.kelas.body",
            target_resolver=lambda: getattr(view, "kelas", None),
            placement="right",
        ),
        TourStep(
            key="kunjungan.save",
            title_key="tour.kunjungan.save.title",
            body_key="tour.kunjungan.save.body",
            target_resolver=lambda: _find_button_by_text(view, t("common.save")),
            placement="top",
        ),
    ]


def _build_peminjaman_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "peminjaman")

    return [
        TourStep(
            key="peminjaman.intro",
            title_key="tour.peminjaman.intro.title",
            body_key="tour.peminjaman.intro.body",
            placement="center",
        ),
        TourStep(
            key="peminjaman.anggota",
            title_key="tour.peminjaman.anggota.title",
            body_key="tour.peminjaman.anggota.body",
            target_resolver=lambda: getattr(view, "anggota_search", None),
            placement="right",
        ),
        TourStep(
            key="peminjaman.buku",
            title_key="tour.peminjaman.buku.title",
            body_key="tour.peminjaman.buku.body",
            target_resolver=lambda: getattr(view, "buku_search", None),
            placement="right",
        ),
        TourStep(
            key="peminjaman.add_item",
            title_key="tour.peminjaman.add_item.title",
            body_key="tour.peminjaman.add_item.body",
            target_resolver=lambda: _find_button_by_text(view, t("trx.tambah_item")),
            placement="bottom",
        ),
        TourStep(
            key="peminjaman.kunjungan",
            title_key="tour.peminjaman.kunjungan.title",
            body_key="tour.peminjaman.kunjungan.body",
            target_resolver=lambda: getattr(view, "add_kunjungan", None),
            placement="top",
        ),
        TourStep(
            key="peminjaman.simpan",
            title_key="tour.peminjaman.simpan.title",
            body_key="tour.peminjaman.simpan.body",
            target_resolver=lambda: _find_button_by_text(view, t("common.save")),
            placement="top",
        ),
    ]


def _build_pengembalian_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "pengembalian")

    return [
        TourStep(
            key="pengembalian.intro",
            title_key="tour.pengembalian.intro.title",
            body_key="tour.pengembalian.intro.body",
            placement="center",
        ),
        TourStep(
            key="pengembalian.search",
            title_key="tour.pengembalian.search.title",
            body_key="tour.pengembalian.search.body",
            target_resolver=lambda: getattr(view, "anggota_search", None),
            placement="bottom",
        ),
        TourStep(
            key="pengembalian.list",
            title_key="tour.pengembalian.list.title",
            body_key="tour.pengembalian.list.body",
            target_resolver=lambda: getattr(view, "table", None),
            placement="top",
        ),
        TourStep(
            key="pengembalian.kembali",
            title_key="tour.pengembalian.kembali.title",
            body_key="tour.pengembalian.kembali.body",
            target_resolver=lambda: _find_button_by_text(
                view, t("menu.transaksi.pengembalian")
            ),
            placement="top",
        ),
        TourStep(
            key="pengembalian.hilang",
            title_key="tour.pengembalian.hilang.title",
            body_key="tour.pengembalian.hilang.body",
            target_resolver=lambda: _find_button_by_text(
                view, t("menu.transaksi.buku_hilang")
            ),
            placement="top",
        ),
    ]


def _build_laporan_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "laporan")

    return [
        TourStep(
            key="laporan.intro",
            title_key="tour.laporan.intro.title",
            body_key="tour.laporan.intro.body",
            placement="center",
        ),
        TourStep(
            key="laporan.tabs",
            title_key="tour.laporan.tabs.title",
            body_key="tour.laporan.tabs.body",
            target_resolver=lambda: getattr(view, "tabs", None),
            placement="bottom",
        ),
        TourStep(
            key="laporan.export",
            title_key="tour.laporan.export.title",
            body_key="tour.laporan.export.body",
            target_resolver=lambda: _find_button_by_text(view, "Ekspor Semua Data"),
            placement="right",
        ),
    ]


def _build_setting_steps(mw: Any) -> list[TourStep]:
    view = _view(mw, "setting")
    tabs = getattr(view, "tabs", None)

    def select_tab(name_resolver: Callable[[], str]) -> PreShowHook:
        def _hook() -> None:
            if tabs is None:
                return
            with contextlib.suppress(Exception):
                tabs.set(name_resolver())

        return _hook

    return [
        TourStep(
            key="setting.intro",
            title_key="tour.setting.intro.title",
            body_key="tour.setting.intro.body",
            placement="center",
        ),
        TourStep(
            key="setting.identitas",
            title_key="tour.setting.identitas.title",
            body_key="tour.setting.identitas.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: t("menu.setting.identitas")),
        ),
        TourStep(
            key="setting.transaksi",
            title_key="tour.setting.transaksi.title",
            body_key="tour.setting.transaksi.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: "Transaksi"),
        ),
        TourStep(
            key="setting.akun",
            title_key="tour.setting.akun.title",
            body_key="tour.setting.akun.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: t("menu.setting.akun")),
        ),
        TourStep(
            key="setting.bahasa",
            title_key="tour.setting.bahasa.title",
            body_key="tour.setting.bahasa.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: t("menu.setting.bahasa")),
        ),
        TourStep(
            key="setting.backup",
            title_key="tour.setting.backup.title",
            body_key="tour.setting.backup.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: t("backup.tab.title")),
        ),
        TourStep(
            key="setting.audit",
            title_key="tour.setting.audit.title",
            body_key="tour.setting.audit.body",
            target_resolver=lambda: tabs,
            placement="bottom",
            before_show=select_tab(lambda: "Audit Log"),
        ),
    ]


_BUILDERS: dict[str, Callable[[Any], list[TourStep]]] = {
    "dashboard": _build_dashboard_steps,
    "anggota": _build_anggota_steps,
    "buku": _build_buku_steps,
    "kunjungan": _build_kunjungan_steps,
    "peminjaman": _build_peminjaman_steps,
    "pengembalian": _build_pengembalian_steps,
    "laporan": _build_laporan_steps,
    "setting": _build_setting_steps,
}


def build_steps_for(menu_key: str, main_window: Any) -> list[TourStep]:
    builder = _BUILDERS.get(menu_key)
    if builder is None:
        return []
    try:
        return builder(main_window)
    except Exception:  # noqa: BLE001 - fail-safe untuk view yang belum ready
        return []


# ---------------------------------------------------------------------------
# UI components
# ---------------------------------------------------------------------------
class SpotlightRing(ctk.CTkToplevel):
    """Frame transparan dengan border tebal yang nempel di sekitar widget.

    Tidak meng-grab fokus, tidak menerima input — hanya marker visual.
    """

    _BORDER_COLOR = ("#6366f1", "#a5b4fc")  # indigo

    def __init__(self, master: Any) -> None:
        super().__init__(master)
        with contextlib.suppress(Exception):
            self.overrideredirect(True)
        self.attributes("-topmost", True)
        # Transparan di tengah, hanya border yang terlihat.
        self.configure(fg_color=self._BORDER_COLOR)
        with contextlib.suppress(Exception):
            self.attributes("-alpha", 0.55)

    def attach(self, target: Any, *, padding: int = 6) -> None:
        if target is None:
            self.withdraw()
            return
        try:
            x = target.winfo_rootx() - padding
            y = target.winfo_rooty() - padding
            w = target.winfo_width() + padding * 2
            h = target.winfo_height() + padding * 2
        except Exception:  # noqa: BLE001
            self.withdraw()
            return
        with contextlib.suppress(Exception):
            self.geometry(f"{w}x{h}+{x}+{y}")
        with contextlib.suppress(Exception):
            self.deiconify()


class TourPopup(ctk.CTkToplevel):
    """Popup tooltip kecil untuk satu step tour."""

    _MARGIN = 14
    _MAX_WIDTH = 400

    def __init__(
        self,
        master: ctk.CTk,
        *,
        title: str,
        body: str,
        progress_text: str,
        is_first: bool,
        is_last: bool,
        on_skip: Callable[[], None],
        on_prev: Callable[[], None],
        on_next: Callable[[], None],
    ) -> None:
        super().__init__(master)
        self.title(title)
        with contextlib.suppress(Exception):
            self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.transient(master)
        self.configure(fg_color=("#ffffff", "#1f2937"))

        # Header: bar aksen tipis + judul + counter
        accent = ctk.CTkFrame(self, height=3, corner_radius=2, fg_color="#6366f1")
        accent.pack(fill="x", padx=14, pady=(12, 6))

        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=14, pady=(0, 4))
        ctk.CTkLabel(
            header, text=title,
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w",
        ).pack(side="left", fill="x", expand=True)
        ctk.CTkLabel(
            header, text=progress_text,
            font=ctk.CTkFont(size=10),
            text_color=("#6b7280", "#9ca3af"),
        ).pack(side="right")

        body_label = ctk.CTkLabel(
            self,
            text=body,
            wraplength=self._MAX_WIDTH - 32,
            justify="left",
            anchor="w",
            text_color=("#1f2937", "#e5e7eb"),
        )
        body_label.pack(fill="x", padx=14, pady=(4, 12))

        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.pack(fill="x", padx=14, pady=(0, 12))
        ctk.CTkButton(
            footer, text=t("tour.button.skip"),
            command=on_skip, width=80,
            fg_color="transparent", border_width=1,
        ).pack(side="left")
        next_label = t("tour.button.finish") if is_last else t("tour.button.next")
        ctk.CTkButton(footer, text=next_label, command=on_next, width=110).pack(
            side="right", padx=(4, 0)
        )
        if not is_first:
            ctk.CTkButton(
                footer, text=t("tour.button.prev"),
                command=on_prev, width=110,
                fg_color="transparent", border_width=1,
            ).pack(side="right", padx=(4, 0))

        self.update_idletasks()
        # Fade-in halus.
        fade_in_toplevel(self, duration_ms=180, steps=9, end_alpha=1.0)


class TourManager:
    """Orkestrasi tour untuk satu menu spesifik."""

    def __init__(self, main_window: Any, menu_key: str, steps: list[TourStep]) -> None:
        self.main_window = main_window
        self.menu_key = menu_key
        self.steps = list(steps)
        self._index = 0
        self._popup: TourPopup | None = None
        self._spotlight: SpotlightRing | None = None

    def start(self) -> None:
        if not self.steps:
            return
        self._index = 0
        self._render()

    # ------------------------------------------------------------------
    def _close_popup(self) -> None:
        if self._popup is not None:
            with contextlib.suppress(Exception):
                self._popup.destroy()
            self._popup = None
        if self._spotlight is not None:
            with contextlib.suppress(Exception):
                self._spotlight.destroy()
            self._spotlight = None

    def _next(self) -> None:
        if self._index >= len(self.steps) - 1:
            self._finish()
            return
        self._index += 1
        self._render()

    def _prev(self) -> None:
        if self._index <= 0:
            return
        self._index -= 1
        self._render()

    def _skip(self) -> None:
        self._close_popup()
        mark_menu_completed(self.menu_key)

    def _finish(self) -> None:
        self._close_popup()
        mark_menu_completed(self.menu_key)

    # ------------------------------------------------------------------
    def _render(self) -> None:
        if not (0 <= self._index < len(self.steps)):
            self._finish()
            return
        step = self.steps[self._index]

        if step.before_show is not None:
            with contextlib.suppress(Exception):
                step.before_show()
        with contextlib.suppress(Exception):
            self.main_window.update_idletasks()

        target = None
        if step.target_resolver is not None:
            with contextlib.suppress(Exception):
                target = step.target_resolver()

        self._close_popup()
        self._popup = TourPopup(
            self.main_window,
            title=t(step.title_key),
            body=t(step.body_key),
            progress_text=t(
                "tour.progress",
                current=self._index + 1,
                total=len(self.steps),
            ),
            is_first=(self._index == 0),
            is_last=(self._index == len(self.steps) - 1),
            on_skip=self._skip,
            on_prev=self._prev,
            on_next=self._next,
        )
        # Spotlight ring untuk menyorot widget target.
        if target is not None and step.placement != "center":
            with contextlib.suppress(Exception):
                self._spotlight = SpotlightRing(self.main_window)
                self._spotlight.attach(target)
                # Pastikan popup tetap di atas spotlight.
                self._popup.lift()
        self._position_popup(target, step.placement)

    def _position_popup(self, target: Any, placement: str) -> None:
        if self._popup is None:
            return
        popup = self._popup
        with contextlib.suppress(Exception):
            popup.update_idletasks()
        win = self.main_window
        with contextlib.suppress(Exception):
            win.update_idletasks()

        try:
            popup_w = popup.winfo_reqwidth() or 380
            popup_h = popup.winfo_reqheight() or 160
        except Exception:  # noqa: BLE001
            popup_w, popup_h = 380, 160
        try:
            win_x = win.winfo_rootx()
            win_y = win.winfo_rooty()
            win_w = win.winfo_width()
            win_h = win.winfo_height()
        except Exception:  # noqa: BLE001
            win_x, win_y, win_w, win_h = 100, 100, 1100, 700

        x = win_x + win_w // 2 - popup_w // 2
        y = win_y + win_h // 2 - popup_h // 2

        if target is not None and placement != "center":
            try:
                tx = target.winfo_rootx()
                ty = target.winfo_rooty()
                tw = target.winfo_width()
                th = target.winfo_height()
            except Exception:  # noqa: BLE001
                tx = ty = tw = th = 0
            margin = TourPopup._MARGIN
            if placement == "right":
                x = tx + tw + margin
                y = ty + th // 2 - popup_h // 2
            elif placement == "left":
                x = tx - popup_w - margin
                y = ty + th // 2 - popup_h // 2
            elif placement == "top":
                x = tx + tw // 2 - popup_w // 2
                y = ty - popup_h - margin
            elif placement == "bottom":
                x = tx + tw // 2 - popup_w // 2
                y = ty + th + margin

        # Clamp ke dalam window utama.
        x = max(win_x + 8, min(x, win_x + win_w - popup_w - 8))
        y = max(win_y + 8, min(y, win_y + win_h - popup_h - 8))
        with contextlib.suppress(Exception):
            popup.geometry(f"{popup_w}x{popup_h}+{x}+{y}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def start_menu_tour(main_window: Any, menu_key: str) -> None:
    """Mulai tour untuk menu tertentu (replay-friendly)."""
    steps = build_steps_for(menu_key, main_window)
    if not steps:
        return
    TourManager(main_window, menu_key, steps).start()


def maybe_autostart_menu_tour(main_window: Any, menu_key: str) -> None:
    """Auto-mulai tour untuk menu kalau user belum pernah menyelesaikannya."""
    if menu_key not in _BUILDERS:
        return
    if is_menu_completed(menu_key):
        return
    # Beri Tk waktu menggambar view dulu sebelum render popup.
    with contextlib.suppress(Exception):
        main_window.after(400, lambda: start_menu_tour(main_window, menu_key))


# Backward-compat: old API names still referenced by tests / docs.
def build_default_steps(main_window: Any) -> list[TourStep]:  # pragma: no cover
    """Deprecated: dipertahankan supaya import lama tidak break."""
    return _build_dashboard_steps(main_window)


__all__ = [
    "MENU_KEYS",
    "SpotlightRing",
    "TourManager",
    "TourPopup",
    "TourStep",
    "build_default_steps",
    "build_steps_for",
    "is_menu_completed",
    "mark_menu_completed",
    "maybe_autostart_menu_tour",
    "reset_all_tutorial_flags",
    "start_menu_tour",
]


# Backward-compat shim: ``ttk`` import is currently unused but kept for
# future styling work — silence ruff's F401 by reference.
_ = ttk
