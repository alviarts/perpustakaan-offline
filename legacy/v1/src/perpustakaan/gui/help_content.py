"""Konten Bantuan/FAQ dan inventarisasi video tutorial untuk dialog Bantuan
(PR-D v0.5.3).

Modul ini sengaja dipisah dari ``help_dialog.py`` supaya:

* **Data** (FAQ entries, daftar video, link ekstern) bisa di-test tanpa
  harus instantiate widget Tk — penting karena CI runner pytest jalan
  tanpa display.
* **i18n keys** tersentralisasi di sini sebagai source of truth — test
  bisa verifikasi setiap key punya entry di kedua locale (id + en).

FAQ entries didefinisikan sebagai list of :class:`FAQEntry` ber-id
stabil. Question + answer mengacu ke key i18n sehingga teks bisa
diterjemahkan bilingual seperti komponen lain.

Daftar video ditemukan secara dinamis di ``docs/demo/`` runtime — kalau
file tidak ada (misal user pasang installer tanpa demo bundle), tab
Video tetap render dengan empty-state + link ke GitHub Releases.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from perpustakaan.config import RESOURCE_ROOT


# ---------------------------------------------------------------------------
# FAQ entries
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class FAQEntry:
    """Satu entry FAQ.

    ``id`` dipakai sebagai stable identifier (untuk test + audit),
    ``question_key`` & ``answer_key`` mengacu ke i18n strings.
    """

    id: str
    question_key: str
    answer_key: str


FAQ_ENTRIES: tuple[FAQEntry, ...] = (
    FAQEntry("about", "help.faq.about.q", "help.faq.about.a"),
    FAQEntry("login_default", "help.faq.login_default.q", "help.faq.login_default.a"),
    FAQEntry("forgot_password", "help.faq.forgot_password.q", "help.faq.forgot_password.a"),
    FAQEntry("change_password", "help.faq.change_password.q", "help.faq.change_password.a"),
    FAQEntry("add_anggota", "help.faq.add_anggota.q", "help.faq.add_anggota.a"),
    FAQEntry("import_excel", "help.faq.import_excel.q", "help.faq.import_excel.a"),
    FAQEntry("cetak_kta", "help.faq.cetak_kta.q", "help.faq.cetak_kta.a"),
    FAQEntry("peminjaman", "help.faq.peminjaman.q", "help.faq.peminjaman.a"),
    FAQEntry("pengembalian", "help.faq.pengembalian.q", "help.faq.pengembalian.a"),
    FAQEntry("bebas_pustaka", "help.faq.bebas_pustaka.q", "help.faq.bebas_pustaka.a"),
    FAQEntry("naik_kelas", "help.faq.naik_kelas.q", "help.faq.naik_kelas.a"),
    FAQEntry("cek_data_ganda", "help.faq.cek_data_ganda.q", "help.faq.cek_data_ganda.a"),
    FAQEntry("backup_manual", "help.faq.backup_manual.q", "help.faq.backup_manual.a"),
    FAQEntry("backup_terjadwal", "help.faq.backup_terjadwal.q", "help.faq.backup_terjadwal.a"),
    FAQEntry("db_location", "help.faq.db_location.q", "help.faq.db_location.a"),
    FAQEntry("ddc", "help.faq.ddc.q", "help.faq.ddc.a"),
    FAQEntry("export_sheets", "help.faq.export_sheets.q", "help.faq.export_sheets.a"),
    FAQEntry("report_bug", "help.faq.report_bug.q", "help.faq.report_bug.a"),
)


def faq_keys() -> tuple[str, ...]:
    """Semua key i18n yang dipakai FAQ — dipakai test untuk verifikasi
    coverage di kedua locale."""
    keys: list[str] = []
    for e in FAQ_ENTRIES:
        keys.append(e.question_key)
        keys.append(e.answer_key)
    return tuple(keys)


# ---------------------------------------------------------------------------
# Video tutorial discovery
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class VideoEntry:
    """Satu entry video tutorial."""

    path: Path
    title_key: str
    description_key: str
    size_bytes: int


# Direktori demo bundle — sama dengan yang dipakai installer.iss saat
# packaging .exe Windows (lihat installer/installer.iss bagian [Files]).
DEMO_DIR: Path = RESOURCE_ROOT / "docs" / "demo"

# Mapping nama-file → (title_key, description_key). Kalau ada video baru
# di docs/demo/, tinggal append entry di sini supaya muncul di tab Video.
KNOWN_VIDEOS: dict[str, tuple[str, str]] = {
    "perpustakaan-offline-v0.3.0-demo.mp4": (
        "help.video.v030_demo.title",
        "help.video.v030_demo.desc",
    ),
}


def discover_videos(demo_dir: Path | None = None) -> tuple[VideoEntry, ...]:
    """Scan ``docs/demo/`` dan kembalikan video yang terdaftar di
    :data:`KNOWN_VIDEOS` dan benar-benar ada di disk.

    Default ``demo_dir`` adalah :data:`DEMO_DIR` (auto-resolve via
    config, supaya jalan baik di dev maupun di PyInstaller bundle).
    """
    base = demo_dir or DEMO_DIR
    out: list[VideoEntry] = []
    if not base.exists():
        return ()
    for filename, (title_key, desc_key) in KNOWN_VIDEOS.items():
        path = base / filename
        if not path.is_file():
            continue
        try:
            size = path.stat().st_size
        except OSError:
            size = 0
        out.append(
            VideoEntry(
                path=path,
                title_key=title_key,
                description_key=desc_key,
                size_bytes=size,
            )
        )
    return tuple(out)


def video_keys() -> tuple[str, ...]:
    """Semua key i18n yang dipakai video metadata."""
    keys: list[str] = []
    for title_key, desc_key in KNOWN_VIDEOS.values():
        keys.append(title_key)
        keys.append(desc_key)
    return tuple(keys)


# ---------------------------------------------------------------------------
# About / external links
# ---------------------------------------------------------------------------
GITHUB_REPO_URL: str = "https://github.com/alviarts/perpustakaan-offline"
GITHUB_ISSUES_URL: str = f"{GITHUB_REPO_URL}/issues"
GITHUB_RELEASES_URL: str = f"{GITHUB_REPO_URL}/releases"


def format_size(num_bytes: int) -> str:
    """Format ukuran file ke MB/KB human-readable. Fallback B untuk
    file kecil. Tidak di-i18n: hanya angka + unit."""
    if num_bytes <= 0:
        return "—"
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.1f} MB"
    if num_bytes >= 1024:
        return f"{num_bytes / 1024:.0f} KB"
    return f"{num_bytes} B"
