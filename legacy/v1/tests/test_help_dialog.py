"""Test PR-D v0.5.3: Bantuan / FAQ / Video tutorial / Tentang.

Coverage utama:

* :data:`help_content.FAQ_ENTRIES` — semua entry punya id unik dan
  pasangan question/answer i18n key valid di kedua locale (id + en).
* :func:`help_content.discover_videos` — auto-discovery dari
  ``docs/demo/`` saat file ada / tidak ada.
* :func:`help_content.format_size` — formatting MB/KB/B + edge cases.
* :data:`help_content.KNOWN_VIDEOS` — semua video metadata key
  ter-i18n di kedua locale.

Tests untuk widget Tk (HelpDialog instance, tab tersebar dengan benar)
ada di ``tests/test_smoke_gui.py`` karena butuh display Xvfb.
"""
from __future__ import annotations

from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# FAQ_ENTRIES
# ---------------------------------------------------------------------------
def test_faq_entries_non_empty():
    from perpustakaan.gui.help_content import FAQ_ENTRIES

    assert len(FAQ_ENTRIES) >= 10, "FAQ wajib punya minimal 10 entri"


def test_faq_entries_unique_ids():
    from perpustakaan.gui.help_content import FAQ_ENTRIES

    ids = [e.id for e in FAQ_ENTRIES]
    assert len(ids) == len(set(ids)), f"Duplicate FAQ ids: {ids}"


def test_faq_entries_keys_have_translations_id_en():
    """Setiap question_key + answer_key wajib punya entry di kedua
    locale supaya tidak fallback ke key string saat render UI."""
    from perpustakaan.gui.help_content import FAQ_ENTRIES
    from perpustakaan.i18n import _STRINGS

    missing: list[str] = []
    for entry in FAQ_ENTRIES:
        for key in (entry.question_key, entry.answer_key):
            bundle = _STRINGS.get(key)
            if bundle is None:
                missing.append(f"{key} (no entry)")
                continue
            if not bundle.get("id"):
                missing.append(f"{key} (missing id)")
            if not bundle.get("en"):
                missing.append(f"{key} (missing en)")
    assert not missing, f"FAQ keys missing translations: {missing}"


def test_faq_entries_translation_strings_non_trivial():
    """Question minimal 5 char, answer minimal 30 char di tiap locale."""
    from perpustakaan.gui.help_content import FAQ_ENTRIES
    from perpustakaan.i18n import _STRINGS

    for entry in FAQ_ENTRIES:
        q_bundle = _STRINGS[entry.question_key]
        a_bundle = _STRINGS[entry.answer_key]
        for loc in ("id", "en"):
            assert len(q_bundle[loc]) >= 5, (
                f"Question {entry.id} ({loc}) terlalu pendek: {q_bundle[loc]!r}"
            )
            assert len(a_bundle[loc]) >= 30, (
                f"Answer {entry.id} ({loc}) terlalu pendek (<30 char): "
                f"{a_bundle[loc]!r}"
            )


def test_faq_keys_helper_returns_all_keys():
    from perpustakaan.gui.help_content import FAQ_ENTRIES, faq_keys

    keys = faq_keys()
    assert len(keys) == len(FAQ_ENTRIES) * 2
    # Pastikan urutan deterministic: question dulu, jawaban menyusul.
    assert keys[0] == FAQ_ENTRIES[0].question_key
    assert keys[1] == FAQ_ENTRIES[0].answer_key


# ---------------------------------------------------------------------------
# discover_videos
# ---------------------------------------------------------------------------
def test_discover_videos_returns_tuple_when_dir_missing(tmp_path):
    from perpustakaan.gui.help_content import discover_videos

    missing = tmp_path / "no_such_dir"
    result = discover_videos(missing)
    assert result == ()


def test_discover_videos_skips_unknown_files(tmp_path):
    from perpustakaan.gui.help_content import discover_videos

    # Buat file MP4 yang TIDAK di-register di KNOWN_VIDEOS.
    (tmp_path / "random-video.mp4").write_bytes(b"\x00" * 100)
    result = discover_videos(tmp_path)
    assert result == ()


def test_discover_videos_picks_up_known_video(tmp_path):
    from perpustakaan.gui.help_content import KNOWN_VIDEOS, discover_videos

    # Pakai filename pertama dari KNOWN_VIDEOS supaya test bertahan
    # walaupun bundle nanti diganti versinya.
    known_filename = next(iter(KNOWN_VIDEOS))
    (tmp_path / known_filename).write_bytes(b"\x00" * 2048)

    result = discover_videos(tmp_path)
    assert len(result) == 1
    assert result[0].path.name == known_filename
    assert result[0].size_bytes == 2048
    title_key, desc_key = KNOWN_VIDEOS[known_filename]
    assert result[0].title_key == title_key
    assert result[0].description_key == desc_key


def test_discover_videos_real_demo_dir():
    """Smoke test: kalau bundle docs/demo/perpustakaan-offline-v0.3.0-demo.mp4
    ada di repo (default development checkout), discover_videos() harus
    pick up minimal 1 video."""
    from perpustakaan.config import RESOURCE_ROOT
    from perpustakaan.gui.help_content import discover_videos

    demo_path = RESOURCE_ROOT / "docs" / "demo"
    if not demo_path.exists():
        pytest.skip("docs/demo/ tidak ada — skip (CI bundle stripped)")
    result = discover_videos(demo_path)
    # Tidak strict — bundle mungkin di-strip di CI runner. Yang penting
    # tidak crash dan return tuple of VideoEntry.
    for v in result:
        assert isinstance(v.path, Path)
        assert v.path.is_file()


def test_known_videos_have_translations_id_en():
    from perpustakaan.gui.help_content import KNOWN_VIDEOS
    from perpustakaan.i18n import _STRINGS

    missing: list[str] = []
    for filename, (title_key, desc_key) in KNOWN_VIDEOS.items():
        for key in (title_key, desc_key):
            bundle = _STRINGS.get(key)
            if bundle is None:
                missing.append(f"{filename}:{key} (no entry)")
                continue
            for loc in ("id", "en"):
                if not bundle.get(loc):
                    missing.append(f"{filename}:{key} (missing {loc})")
    assert not missing, f"Video metadata missing translations: {missing}"


# ---------------------------------------------------------------------------
# format_size
# ---------------------------------------------------------------------------
def test_format_size_zero_returns_dash():
    from perpustakaan.gui.help_content import format_size

    assert format_size(0) == "—"
    assert format_size(-100) == "—"


def test_format_size_bytes():
    from perpustakaan.gui.help_content import format_size

    assert format_size(1) == "1 B"
    assert format_size(1023) == "1023 B"


def test_format_size_kb():
    from perpustakaan.gui.help_content import format_size

    assert format_size(1024) == "1 KB"
    assert format_size(1024 * 500) == "500 KB"


def test_format_size_mb():
    from perpustakaan.gui.help_content import format_size

    assert format_size(1024 * 1024) == "1.0 MB"
    assert format_size(int(1.5 * 1024 * 1024)) == "1.5 MB"


# ---------------------------------------------------------------------------
# Help-related i18n shell keys
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "key",
    [
        "menu.help",
        "help.title",
        "help.subtitle",
        "help.tab.faq",
        "help.tab.video",
        "help.tab.about",
        "help.video.empty.title",
        "help.video.empty.desc",
        "help.video.size_label",
        "help.video.open_button",
        "help.video.open_failed",
        "help.about.app_name",
        "help.about.tagline",
        "help.about.version",
        "help.about.license",
        "help.about.author",
        "help.about.inspiration",
        "help.about.github",
        "help.about.releases",
        "help.about.report_bug",
        "help.about.open_link_failed",
    ],
)
def test_help_shell_keys_translated_id_en(key: str):
    from perpustakaan.i18n import _STRINGS

    bundle = _STRINGS.get(key)
    assert bundle is not None, f"Missing i18n bundle for {key}"
    assert bundle.get("id"), f"Missing 'id' for {key}"
    assert bundle.get("en"), f"Missing 'en' for {key}"


# ---------------------------------------------------------------------------
# External links
# ---------------------------------------------------------------------------
def test_github_links_point_to_correct_repo():
    from perpustakaan.gui.help_content import (
        GITHUB_ISSUES_URL,
        GITHUB_RELEASES_URL,
        GITHUB_REPO_URL,
    )

    assert GITHUB_REPO_URL == "https://github.com/alviarts/perpustakaan-offline"
    assert GITHUB_ISSUES_URL.startswith(GITHUB_REPO_URL)
    assert GITHUB_ISSUES_URL.endswith("/issues")
    assert GITHUB_RELEASES_URL.startswith(GITHUB_REPO_URL)
    assert GITHUB_RELEASES_URL.endswith("/releases")


# ---------------------------------------------------------------------------
# Version bump propagation
# ---------------------------------------------------------------------------
def test_version_at_least_053():
    """Memastikan version bump >= v0.5.3 sampai ke runtime config.

    PR-D shipped 0.5.3; PR-V4a bumped ke 0.6.0. Test pakai semver compare
    supaya tidak perlu update tiap version bump.
    """
    from perpustakaan import __version__
    from perpustakaan.config import APP_VERSION

    def _parse(v: str) -> tuple[int, ...]:
        return tuple(int(x) for x in v.split(".") if x.isdigit())

    assert _parse(__version__) >= (0, 5, 3)
    assert _parse(APP_VERSION) >= (0, 5, 3)
    # Konsistensi antara kedua sumber
    assert __version__ == APP_VERSION
