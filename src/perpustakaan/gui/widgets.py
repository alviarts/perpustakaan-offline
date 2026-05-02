"""Widget reusable + helper untuk view CustomTkinter.

Termasuk wrapper :class:`StyledTreeview` (ttk.Treeview yang nyaman dipakai untuk
list data dengan scrollbar) — CustomTkinter belum punya tabel data nativ.
"""
from __future__ import annotations

import contextlib
import logging
from collections.abc import Callable, Iterable
from tkinter import ttk
from typing import Any

import customtkinter as ctk

from perpustakaan.i18n import t

_log = logging.getLogger("perpustakaan.gui")


# ---------------------------------------------------------------------------
# Theme defaults
# ---------------------------------------------------------------------------
def configure_theme(theme: str = "system", color: str = "blue") -> None:
    if theme not in {"system", "light", "dark"}:
        theme = "system"
    if color not in {"blue", "green", "dark-blue"}:
        color = "blue"
    ctk.set_appearance_mode(theme)
    ctk.set_default_color_theme(color)


# ---------------------------------------------------------------------------
# Styled Treeview
# ---------------------------------------------------------------------------
class StyledTreeview(ctk.CTkFrame):
    """Treeview dengan scrollbar vertikal & horizontal."""

    def __init__(
        self,
        parent: Any,
        columns: list[tuple[str, str, int]],
        *,
        on_double_click: Callable[[dict], None] | None = None,
        height: int = 18,
    ) -> None:
        super().__init__(parent, fg_color="transparent")

        self._columns = columns
        self._key_field = columns[0][0] if columns else "id"
        self._on_double = on_double_click

        # Style untuk dukung dark mode
        style = ttk.Style()
        with contextlib.suppress(Exception):
            style.theme_use("clam")
        bg = "#212121" if ctk.get_appearance_mode().lower() == "dark" else "#ffffff"
        fg = "#e5e5e5" if ctk.get_appearance_mode().lower() == "dark" else "#1f2937"
        sel = "#1d4ed8"
        style.configure(
            "Perpus.Treeview",
            background=bg,
            foreground=fg,
            fieldbackground=bg,
            rowheight=26,
            bordercolor=bg,
            borderwidth=0,
        )
        style.map("Perpus.Treeview", background=[("selected", sel)])
        style.configure(
            "Perpus.Treeview.Heading",
            background="#1f2937",
            foreground="#f9fafb",
            font=("Segoe UI", 10, "bold"),
            relief="flat",
        )

        col_ids = [c[0] for c in columns]
        self.tree = ttk.Treeview(
            self,
            columns=col_ids,
            show="headings",
            style="Perpus.Treeview",
            height=height,
        )
        for col_id, label, width in columns:
            self.tree.heading(col_id, text=label)
            anchor = "e" if col_id in {"jumlah", "denda", "harga", "nominal"} else "w"
            self.tree.column(col_id, width=width, anchor=anchor)

        vsb = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(self, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._items_by_iid: dict[str, dict] = {}
        self.tree.bind("<Double-1>", self._handle_double)

    def set_rows(self, rows: Iterable[dict]) -> None:
        self.tree.delete(*self.tree.get_children())
        self._items_by_iid.clear()
        for r in rows:
            iid = str(r.get(self._key_field, r.get("id", id(r))))
            if iid in self._items_by_iid:
                fallback = r.get("id")
                iid = str(fallback) if fallback is not None else f"{iid}_{id(r)}"
            values = [r.get(col_id, "") for col_id, _, _ in self._columns]
            self.tree.insert("", "end", iid=iid, values=values)
            self._items_by_iid[iid] = r

    def selected(self) -> dict | None:
        sel = self.tree.selection()
        if not sel:
            return None
        return self._items_by_iid.get(sel[0])

    def selected_many(self) -> list[dict]:
        return [self._items_by_iid[i] for i in self.tree.selection() if i in self._items_by_iid]

    def _handle_double(self, _event) -> None:
        if self._on_double is None:
            return
        row = self.selected()
        if row is not None:
            self._on_double(row)


# ---------------------------------------------------------------------------
# Form helpers
# ---------------------------------------------------------------------------
class LabeledEntry(ctk.CTkFrame):
    def __init__(
        self,
        parent: Any,
        label: str,
        *,
        placeholder: str = "",
        show: str | None = None,
        width: int = 220,
    ) -> None:
        super().__init__(parent, fg_color="transparent")
        self._label = ctk.CTkLabel(self, text=label, anchor="w", width=140)
        self._label.grid(row=0, column=0, sticky="w", padx=(0, 8), pady=2)
        self.entry = ctk.CTkEntry(self, width=width, placeholder_text=placeholder, show=show)
        self.entry.grid(row=0, column=1, sticky="we", pady=2)
        self.grid_columnconfigure(1, weight=1)

    def set(self, value: object) -> None:
        self.entry.delete(0, "end")
        if value is not None:
            self.entry.insert(0, str(value))

    def get(self) -> str:
        return self.entry.get().strip()


class StatCard(ctk.CTkFrame):
    """Kartu statistik utk dashboard, dengan ikon bulat berwarna + hover lift."""

    _NORMAL_FG: tuple[str, str] = ("white", "#1f2937")
    _HOVER_FG: tuple[str, str] = ("#f9fafb", "#283344")
    _NORMAL_BORDER: tuple[str, str] = ("#e5e7eb", "#374151")
    _HOVER_BORDER: tuple[str, str] = ("#c7d2fe", "#4338ca")

    def __init__(
        self,
        parent: Any,
        title: str,
        value: str = "0",
        *,
        color: str = "#3b82f6",
        icon: str = "•",
    ) -> None:
        super().__init__(
            parent,
            corner_radius=14,
            fg_color=self._NORMAL_FG,
            border_width=1,
            border_color=self._NORMAL_BORDER,
        )
        self._color = color

        # Header row: icon bubble + title
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=14, pady=(14, 0))
        try:
            from perpustakaan.gui.fonts import (
                get_font as _get_font,
            )
            from perpustakaan.gui.fonts import (
                small_font as _small_font,
            )
            from perpustakaan.gui.fonts import (
                stat_value_font as _stat_value_font,
            )
            _icon_font = _get_font(14, weight="bold")
            _title_font = _small_font()
            _value_font = _stat_value_font()
        except Exception:  # noqa: BLE001
            _icon_font = ctk.CTkFont(size=14, weight="bold")
            _title_font = ctk.CTkFont(size=11, weight="bold")
            _value_font = ctk.CTkFont(size=26, weight="bold")
        self._icon_bubble = ctk.CTkLabel(
            header,
            text=icon,
            width=30, height=30,
            corner_radius=15,
            fg_color=color,
            text_color="white",
            font=_icon_font,
        )
        self._icon_bubble.pack(side="left", padx=(0, 10))
        self._title_lbl = ctk.CTkLabel(
            header,
            text=title,
            font=_title_font,
            text_color=("#4b5563", "#d1d5db"),
            anchor="w",
        )
        self._title_lbl.pack(side="left", fill="x", expand=True)

        self._value_lbl = ctk.CTkLabel(
            self,
            text=value,
            font=_value_font,
            text_color=color,
            anchor="w",
        )
        self._value_lbl.pack(fill="x", padx=14, pady=(6, 14))

        # Hover lift: subtle bg/border change ketika kursor masuk.
        self.bind("<Enter>", self._on_enter, add=True)
        self.bind("<Leave>", self._on_leave, add=True)
        for child in (header, self._title_lbl, self._value_lbl, self._icon_bubble):
            child.bind("<Enter>", self._on_enter, add=True)
            child.bind("<Leave>", self._on_leave, add=True)

    def set_value(self, value: str) -> None:
        self._value_lbl.configure(text=value)

    def _on_enter(self, _event: Any = None) -> None:
        with contextlib.suppress(Exception):
            self.configure(fg_color=self._HOVER_FG, border_color=self._HOVER_BORDER)

    def _on_leave(self, _event: Any = None) -> None:
        with contextlib.suppress(Exception):
            self.configure(fg_color=self._NORMAL_FG, border_color=self._NORMAL_BORDER)


# ---------------------------------------------------------------------------
# Toast (non-blocking, auto-dismiss)
# ---------------------------------------------------------------------------
_TOAST_COLORS = {
    "info":    {"bg": ("#dbeafe", "#1e3a8a"), "fg": ("#1e3a8a", "#dbeafe"), "border": "#2563eb"},
    "success": {"bg": ("#dcfce7", "#14532d"), "fg": ("#14532d", "#dcfce7"), "border": "#16a34a"},
    "warning": {"bg": ("#fef3c7", "#78350f"), "fg": ("#78350f", "#fef3c7"), "border": "#d97706"},
    "error":   {"bg": ("#fee2e2", "#7f1d1d"), "fg": ("#7f1d1d", "#fee2e2"), "border": "#dc2626"},
}


def show_toast(
    parent: Any,
    message: str,
    *,
    kind: str = "info",
    duration_ms: int = 3000,
) -> None:
    """Tampilkan toast notification non-blocking di pojok kanan-bawah window.

    Args:
        parent: widget atau window induk.
        message: teks pesan (max ~200 karakter).
        kind: ``"info"`` / ``"success"`` / ``"warning"`` / ``"error"``.
        duration_ms: durasi tampil dalam milidetik sebelum auto-dismiss.
    """
    palette = _TOAST_COLORS.get(kind, _TOAST_COLORS["info"])
    try:
        # Cari toplevel-nya parent (kasus parent berupa frame nested)
        top = parent.winfo_toplevel()
    except Exception:  # noqa: BLE001 - widget belum di-realize
        _log.warning("show_toast: parent tidak punya toplevel, fallback log: %s", message)
        return

    toast = ctk.CTkFrame(
        top,
        fg_color=palette["bg"],
        border_color=palette["border"],
        border_width=2,
        corner_radius=8,
    )
    label = ctk.CTkLabel(
        toast,
        text=message,
        text_color=palette["fg"],
        font=ctk.CTkFont(size=13, weight="bold"),
        anchor="w",
        justify="left",
        wraplength=320,
    )
    label.pack(padx=14, pady=10)

    # Animasi slide-in dari kanan + dismiss halus dengan import lokal supaya
    # tidak ada cycle import (animations butuh widgets-free saja).
    from perpustakaan.gui.animations import slide_in_x

    def _place_and_animate() -> None:
        try:
            top.update_idletasks()
            tw = max(toast.winfo_reqwidth(), 200)
            th = max(toast.winfo_reqheight(), 40)
            tw_total = max(top.winfo_width(), 1)
            th_total = max(top.winfo_height(), 1)
            target_x = max(tw_total - tw - 16, 16)
            start_x = tw_total + 8  # mulai sedikit di luar layar kanan
            target_y = max(th_total - th - 16, 16)
            toast.place(x=start_x, y=target_y)
            slide_in_x(
                toast,
                from_x=start_x,
                to_x=target_x,
                y=target_y,
                duration_ms=220,
                steps=12,
            )
        except Exception:  # noqa: BLE001
            toast.place(relx=1.0, rely=1.0, x=-16, y=-16, anchor="se")

    def _safe_destroy() -> None:
        with contextlib.suppress(Exception):
            toast.destroy()

    def _dismiss() -> None:
        # Slide keluar lalu destroy.
        try:
            cur_x = toast.winfo_x()
            cur_y = toast.winfo_y()
            tw_total = max(top.winfo_width(), cur_x + 100)
            slide_in_x(
                toast,
                from_x=cur_x,
                to_x=tw_total + 8,
                y=cur_y,
                duration_ms=180,
                steps=8,
                on_done=_safe_destroy,
            )
        except Exception:  # noqa: BLE001
            _safe_destroy()

    _place_and_animate()
    top.after(max(duration_ms, 500), _dismiss)


# ---------------------------------------------------------------------------
# Modal dialog (info / warn / error / confirm)
# ---------------------------------------------------------------------------
def info(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showinfo(title or t("common.info"), message, parent=parent)


def warn(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showwarning(title or t("common.warning"), message, parent=parent)


def error(parent: Any, message: str, title: str | None = None) -> None:
    from tkinter import messagebox

    messagebox.showerror(title or t("common.error"), message, parent=parent)


def confirm(parent: Any, message: str, title: str | None = None) -> bool:
    from tkinter import messagebox

    return bool(
        messagebox.askyesno(title or t("common.confirm"), message, parent=parent)
    )


# ---------------------------------------------------------------------------
# Exception reporter — log + show user-friendly toast / modal
# ---------------------------------------------------------------------------
# Exception types yang biasanya berarti "user input error" — pesan singkat
# saja sudah cukup, tidak perlu modal merah dan tidak perlu link ke log.
_USER_INPUT_EXC = (ValueError, TypeError, KeyError)


def report_exception(
    parent: Any,
    exc: BaseException,
    context: str = "",
    *,
    use_modal: bool = False,
) -> None:
    """Log full exception ke ``app.log`` lalu tampilkan toast/modal user-friendly.

    Args:
        parent: widget induk untuk toast/modal.
        exc: exception yang ditangkap.
        context: deskripsi singkat operasi (mis "simpan anggota") — akan
            ditampilkan ke user sebagai prefix supaya jelas operasi mana.
        use_modal: kalau True, pakai messagebox modal (untuk error kritis
            yang user wajib acknowledge). Default False = toast.
    """
    _log.exception("[%s] %s", context or "operation failed", exc)

    if isinstance(exc, _USER_INPUT_EXC):
        msg = str(exc) or t("common.error")
        kind = "warning"
    else:
        # Exception tidak terduga — kasih hint ke log
        msg = (
            f"{context or 'Terjadi kesalahan'}: {exc}\n"
            f"Detail tersimpan di app.log."
        )
        kind = "error"

    if use_modal:
        if kind == "error":
            error(parent, msg)
        else:
            warn(parent, msg)
    else:
        show_toast(parent, msg, kind=kind, duration_ms=4500)


# ---------------------------------------------------------------------------
# HeadingBar
# ---------------------------------------------------------------------------
class HeadingBar(ctk.CTkFrame):
    """Heading konsisten utk tiap view: judul besar + tombol "?" inline.

    Layout::

        ┌────────────────────────────────────────────┐
        │  Data Anggota   [?]              (extras…) │
        └────────────────────────────────────────────┘

    - Klik tombol "?" memanggil ``on_help`` (mis. replay tour menu ini).
    - ``extras`` adalah CTkFrame transparan di kanan untuk widget tambahan
      view-specific (mis. tombol Refresh di Dashboard).
    """

    def __init__(
        self,
        parent: Any,
        *,
        text: str,
        menu_key: str | None = None,
        main_window: Any = None,
        on_help: Callable[[], None] | None = None,
    ) -> None:
        """Heading konsisten dengan tombol "?" inline.

        Salah satu mode harus dipilih:
            - ``menu_key`` + ``main_window``: HeadingBar otomatis memanggil
              ``start_menu_tour(main_window, menu_key)`` saat tombol "?" diklik.
            - ``on_help``: callable kustom dipanggil saat klik "?".
            - keduanya kosong: tombol "?" tidak ditampilkan.
        """
        super().__init__(parent, fg_color="transparent")
        try:
            from perpustakaan.gui.fonts import heading_font
            font = heading_font()
        except Exception:  # noqa: BLE001
            font = ctk.CTkFont(size=22, weight="bold")
        self._title = ctk.CTkLabel(self, text=text, font=font, anchor="w")
        self._title.pack(side="left")

        # Resolve callback
        if on_help is None and menu_key and main_window is not None:
            def _replay() -> None:
                try:
                    from perpustakaan.gui.tour import start_menu_tour

                    start_menu_tour(main_window, menu_key)
                except Exception:  # noqa: BLE001
                    pass
            on_help = _replay

        if on_help is not None:
            self._help_btn = ctk.CTkButton(
                self,
                text="?",
                width=26, height=26,
                corner_radius=13,
                fg_color=("#e0e7ff", "#312e81"),
                text_color=("#3730a3", "#c7d2fe"),
                hover_color=("#c7d2fe", "#4338ca"),
                font=ctk.CTkFont(size=12, weight="bold"),
                command=on_help,
            )
            self._help_btn.pack(side="left", padx=(10, 0), pady=(2, 0))
            with contextlib.suppress(Exception):
                self._help_btn.configure(cursor="hand2")
        # Frame slot di kanan utk extras (refresh button, dst.).
        self.extras = ctk.CTkFrame(self, fg_color="transparent")
        self.extras.pack(side="right")

    def set_text(self, text: str) -> None:
        with contextlib.suppress(Exception):
            self._title.configure(text=text)


def fmt_rupiah(value: int | float) -> str:
    try:
        return f"Rp {int(value):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "Rp 0"


# ---------------------------------------------------------------------------
# Permission helpers (RBAC v0.4.3)
# ---------------------------------------------------------------------------
def permission_button(
    parent: Any,
    *,
    text: str,
    permission: str,
    command: Callable[[], None] | None = None,
    **kwargs: Any,
) -> ctk.CTkButton:
    """Build a CTkButton yang otomatis di-disable kalau user aktif tidak punya
    ``permission``. Klik saat tidak punya hak tetap menampilkan toast
    "Akses ditolak" (defense in depth — secara visual juga sudah greyed).

    Pakai sebagai pengganti ``ctk.CTkButton`` untuk aksi yang protected::

        permission_button(toolbar, text="+ Tambah", permission="anggota.tambah",
                          command=self._add)
    """
    try:
        from perpustakaan.services import permissions as permissions_service

        allowed = permissions_service.current_has(permission)
    except Exception:  # noqa: BLE001
        # Kalau service tidak available (mis. tabel permissions belum ada),
        # default = allow agar app tidak kunci semua tombol di skenario error.
        allowed = True

    def _wrapped() -> None:
        if not allowed:
            with contextlib.suppress(Exception):
                show_toast(
                    parent,
                    t("permissions.toast.denied", permission=permission),
                    kind="warning",
                )
            return
        if command is not None:
            command()

    btn = ctk.CTkButton(parent, text=text, command=_wrapped, **kwargs)
    if not allowed:
        with contextlib.suppress(Exception):
            btn.configure(state="disabled")
    return btn


def require_permission_or_toast(parent: Any, permission: str) -> bool:
    """Helper imperative: ``True`` kalau user punya hak, ``False`` + toast
    "Akses ditolak" kalau tidak. Cocok untuk aksi yang dipanggil dari
    keyboard shortcut / context menu (tidak dari permission_button).
    """
    try:
        from perpustakaan.services import permissions as permissions_service

        if permissions_service.current_has(permission):
            return True
    except Exception:  # noqa: BLE001
        return True
    with contextlib.suppress(Exception):
        show_toast(
            parent,
            t("permissions.toast.denied", permission=permission),
            kind="warning",
        )
    return False
