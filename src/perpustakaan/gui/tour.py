"""Guided tour / onboarding tooltip overlay.

Implementasi sederhana dari "product tour" yang sering dipakai aplikasi
modern: rangkaian popup nempel di widget, dengan tombol Skip / Sebelumnya
/ Berikutnya / Selesai.

Pemakaian normal lewat ``MainWindow.start_tour()`` — instans
:class:`TourManager` dibuat dari :func:`build_default_steps`.

Kontrak target widget:
- Setiap step boleh punya ``target_resolver`` yang return widget atau
  ``None``. Kalau ``None`` (mis. step pembuka), popup ditampilkan di
  tengah window — tanpa highlight.
- ``before_show`` opsional dipanggil sebelum popup muncul (mis. untuk
  pindah ke menu yang relevan dulu).
"""
from __future__ import annotations

import contextlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import customtkinter as ctk

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


def build_default_steps(main_window: Any) -> list[TourStep]:
    """Daftar step default — sidebar + theme toggle + closing."""

    def sidebar(key: str) -> WidgetResolver:
        def _resolver() -> Any:
            return main_window._buttons.get(key)

        return _resolver

    def show_view(key: str) -> PreShowHook:
        def _hook() -> None:
            with contextlib.suppress(Exception):
                main_window.show(key)

        return _hook

    def theme_btn() -> Any:
        return getattr(main_window, "_theme_btn", None)

    return [
        TourStep(
            key="welcome",
            title_key="tour.welcome.title",
            body_key="tour.welcome.body",
            placement="center",
        ),
        TourStep(
            key="dashboard",
            title_key="tour.dashboard.title",
            body_key="tour.dashboard.body",
            target_resolver=sidebar("dashboard"),
            placement="right",
            before_show=show_view("dashboard"),
        ),
        TourStep(
            key="anggota",
            title_key="tour.anggota.title",
            body_key="tour.anggota.body",
            target_resolver=sidebar("anggota"),
            placement="right",
            before_show=show_view("anggota"),
        ),
        TourStep(
            key="buku",
            title_key="tour.buku.title",
            body_key="tour.buku.body",
            target_resolver=sidebar("buku"),
            placement="right",
            before_show=show_view("buku"),
        ),
        TourStep(
            key="peminjaman",
            title_key="tour.peminjaman.title",
            body_key="tour.peminjaman.body",
            target_resolver=sidebar("peminjaman"),
            placement="right",
            before_show=show_view("peminjaman"),
        ),
        TourStep(
            key="pengembalian",
            title_key="tour.pengembalian.title",
            body_key="tour.pengembalian.body",
            target_resolver=sidebar("pengembalian"),
            placement="right",
            before_show=show_view("pengembalian"),
        ),
        TourStep(
            key="laporan",
            title_key="tour.laporan.title",
            body_key="tour.laporan.body",
            target_resolver=sidebar("laporan"),
            placement="right",
            before_show=show_view("laporan"),
        ),
        TourStep(
            key="setting",
            title_key="tour.setting.title",
            body_key="tour.setting.body",
            target_resolver=sidebar("setting"),
            placement="right",
            before_show=show_view("setting"),
        ),
        TourStep(
            key="theme",
            title_key="tour.theme.title",
            body_key="tour.theme.body",
            target_resolver=theme_btn,
            placement="bottom",
        ),
        TourStep(
            key="done",
            title_key="tour.done.title",
            body_key="tour.done.body",
            placement="center",
        ),
    ]


class TourPopup(ctk.CTkToplevel):
    """Popup tooltip kecil untuk satu step tour."""

    _MARGIN = 12  # px jarak dari widget target
    _MAX_WIDTH = 380

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
        # Tanpa decoration window manager — tampilan tooltip yang clean.
        with contextlib.suppress(Exception):
            self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.transient(master)
        self.configure(fg_color=("#ffffff", "#1f2937"))

        # Header: judul + step counter
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=14, pady=(12, 4))
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

        # Body
        body_label = ctk.CTkLabel(
            self,
            text=body,
            wraplength=self._MAX_WIDTH - 32,
            justify="left",
            anchor="w",
            text_color=("#1f2937", "#e5e7eb"),
        )
        body_label.pack(fill="x", padx=14, pady=(4, 12))

        # Footer: Skip kiri, Prev/Next kanan
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

        # Force layout & set size sesuai requested.
        self.update_idletasks()


class TourManager:
    """Orkestrasi seluruh tour."""

    def __init__(self, main_window: Any, steps: list[TourStep]) -> None:
        self.main_window = main_window
        self.steps = list(steps)
        self._index = 0
        self._popup: TourPopup | None = None

    @property
    def current_index(self) -> int:
        return self._index

    @property
    def current_step(self) -> TourStep | None:
        if 0 <= self._index < len(self.steps):
            return self.steps[self._index]
        return None

    def start(self) -> None:
        if not self.steps:
            return
        self._index = 0
        self._render()

    def _close_popup(self) -> None:
        if self._popup is not None:
            with contextlib.suppress(Exception):
                self._popup.destroy()
            self._popup = None

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
        # Tetap mark completed supaya tutorial tidak auto-muncul lagi.
        with contextlib.suppress(Exception):
            settings_repo.set_value("tutorial.completed", "1")

    def _finish(self) -> None:
        self._close_popup()
        with contextlib.suppress(Exception):
            settings_repo.set_value("tutorial.completed", "1")

    def _render(self) -> None:
        step = self.current_step
        if step is None:
            self._finish()
            return
        if step.before_show is not None:
            with contextlib.suppress(Exception):
                step.before_show()
        # Beri Tk waktu menggambar view yang baru di-raise sebelum popup.
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
        # Posisikan setelah popup di-render (butuh ukuran).
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
