"""Test untuk PR-V4b v0.6.1: animation player + procedural frame generator.

Strategi: test pure functions (frame generators di gen_animations + frame
loader) tanpa harus jalankan UI Tk. AnimationPlayer widget di-cover oleh
smoke test Xvfb.
"""
from __future__ import annotations

import sys
import warnings
from pathlib import Path

import pytest
from PIL import Image

# Pillow 11 deprecation warning pada getdata() \u2014 silence di test ini saja.
warnings.filterwarnings(
    "ignore", category=DeprecationWarning, message=".*getdata.*",
)

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import gen_animations  # noqa: E402  - script lives in scripts/


# ---------------------------------------------------------------------------
# Frame generator basics
# ---------------------------------------------------------------------------
def test_loader_dots_frame_count_default() -> None:
    frames = gen_animations.make_loader_dots()
    assert len(frames) == 24
    assert all(isinstance(f, Image.Image) for f in frames)


def test_loader_dots_size_matches_arg() -> None:
    frames = gen_animations.make_loader_dots(size=64)
    for f in frames:
        assert f.size == (64, 64)


def test_loader_dots_has_visible_pixels() -> None:
    """Setiap frame harus punya minimal 1 pixel non-transparent."""
    frames = gen_animations.make_loader_dots(size=64)
    for i, f in enumerate(frames):
        # Convert ke RGBA untuk akses alpha channel
        rgba = f.convert("RGBA")
        # Hitung pixel non-transparan
        non_transparent = sum(
            1 for px in rgba.getdata() if px[3] > 0
        )
        assert non_transparent > 0, f"Frame {i} kosong (semua transparent)"


def test_success_check_frame_count_default() -> None:
    frames = gen_animations.make_success_check()
    assert len(frames) == 15


def test_success_check_size_matches_arg() -> None:
    frames = gen_animations.make_success_check(size=96)
    for f in frames:
        assert f.size == (96, 96)


def test_success_check_progresses() -> None:
    """Frame terakhir harus punya pixel hijau lebih banyak dari frame pertama
    (karena lingkaran tumbuh + checkmark drawn)."""
    frames = gen_animations.make_success_check(size=64)
    # Hitung pixel non-transparent di frame[0] vs frame[-1]
    first_nonempty = sum(1 for px in frames[0].convert("RGBA").getdata() if px[3] > 0)
    last_nonempty = sum(1 for px in frames[-1].convert("RGBA").getdata() if px[3] > 0)
    assert last_nonempty > first_nonempty


def test_pulse_heart_frame_count_default() -> None:
    frames = gen_animations.make_pulse_heart()
    assert len(frames) == 10


def test_pulse_heart_has_red_pixels() -> None:
    frames = gen_animations.make_pulse_heart(size=64)
    # Frame mid (puncak pulse) harus punya pixel merah dominant.
    mid = frames[len(frames) // 2].convert("RGBA")
    red_count = sum(
        1 for px in mid.getdata()
        if px[3] > 200 and px[0] > 200 and px[1] < 100 and px[2] < 100
    )
    assert red_count > 50, "Heart pulse frame harus punya pixel merah"


def test_bounce_book_frame_count_default() -> None:
    frames = gen_animations.make_bounce_book()
    assert len(frames) == 12


def test_bounce_book_size_matches_arg() -> None:
    frames = gen_animations.make_bounce_book(size=80)
    for f in frames:
        assert f.size == (80, 80)


# ---------------------------------------------------------------------------
# Easing helper functions
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("t", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_ease_out_cubic_in_range(t: float) -> None:
    result = gen_animations._ease_out_cubic(t)
    assert 0.0 <= result <= 1.0


def test_ease_out_cubic_endpoints() -> None:
    assert gen_animations._ease_out_cubic(0.0) == pytest.approx(0.0)
    assert gen_animations._ease_out_cubic(1.0) == pytest.approx(1.0)


def test_ease_in_out_cubic_symmetric() -> None:
    for t in (0.1, 0.25, 0.4):
        a = gen_animations._ease_in_out_cubic(t)
        b = gen_animations._ease_in_out_cubic(1 - t)
        assert a + b == pytest.approx(1.0, abs=1e-9)


# ---------------------------------------------------------------------------
# Hex helper
# ---------------------------------------------------------------------------
def test_hex_to_rgba_full() -> None:
    assert gen_animations._hex_to_rgba("#ff0000", 255) == (255, 0, 0, 255)
    assert gen_animations._hex_to_rgba("#000000", 128) == (0, 0, 0, 128)


def test_hex_to_rgba_short() -> None:
    assert gen_animations._hex_to_rgba("#fff", 200) == (255, 255, 255, 200)


# ---------------------------------------------------------------------------
# Asset bundle integrity \u2014 frame_NN.png exists for each registered animation
# ---------------------------------------------------------------------------
def test_assets_animations_bundle_complete() -> None:
    """Setelah ``python scripts/gen_animations.py``, setiap animasi harus
    punya minimal 8 frame PNG di ``assets/animations/<name>/``.
    """
    assets_root = REPO_ROOT / "assets" / "animations"
    if not assets_root.exists():
        pytest.skip("assets/animations/ belum di-generate (run scripts/gen_animations.py)")
    for name in gen_animations.ANIMATIONS:
        folder = assets_root / name
        assert folder.exists(), f"Folder {folder} tidak ada"
        png_files = sorted(folder.glob("frame_*.png"))
        assert len(png_files) >= 8, f"{name} hanya punya {len(png_files)} frame, expected >= 8"
        # Sanity: frame pertama bisa di-open
        Image.open(png_files[0]).verify()


def test_animations_registry_complete() -> None:
    """Registry ANIMATIONS punya 4 animasi yang di-deliver di PR-V4b."""
    expected = {"loader_dots", "success_check", "pulse_heart", "bounce_book"}
    assert set(gen_animations.ANIMATIONS.keys()) == expected
    for name, fn in gen_animations.ANIMATIONS.items():
        assert callable(fn), f"{name} harus callable"
