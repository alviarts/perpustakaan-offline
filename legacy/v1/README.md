# Perpustakaan Offline — v1 (frozen)

> **This directory is frozen.** It contains the original v1 application — Python 3.11 + CustomTkinter + SQLite — and is no longer maintained. The active codebase is the v2 Tauri app under [`apps/desktop/`](../../apps/desktop/). See the [root README](../../README.md) for the v2 stack.

These files are kept for **historical reference only**:

- [`src/perpustakaan/`](src/perpustakaan/) — Python source (CustomTkinter views, SQLite models, services, CLI entrypoint)
- [`tests/`](tests/) — pytest suite for v1
- [`assets/`](assets/) — animations / fonts / icons / illustrations bundled by PyInstaller
- [`scripts/`](scripts/) — Python tooling (animation generator, illustration generator, screenshot capture, demo screencast recorder, Lucide icon fetcher, quickstart PDF builder)
- [`installer/`](installer/) — Inno Setup script + lang files for Windows installer
- [`pyproject.toml`](pyproject.toml), [`requirements.txt`](requirements.txt) — Python dependency manifests
- [`build.spec`](build.spec), [`build.bat`](build.bat) — PyInstaller spec + Windows one-click build script
- [`.github/workflows/ci-legacy-v1.yml.disabled`](.github/workflows/ci-legacy-v1.yml.disabled) — disabled v1 CI workflow

## Last release

- **v0.6.2** (2026-05-03) — last v1 tag. Highlights: Phosphor Icons + procedural illustrations + procedural animations + microinteractions + drop shadow + gradient.
- See the v1 git tags (`v0.1.0` … `v0.6.2`) for the historical changelog.

## Why kept?

- Reference for porting bug-fixes and behaviour back to v2 if needed.
- `git log` and `git blame` continue to work with full history thanks to the `git mv`-based archive.
- Eventually safe to delete entirely once v2 reaches feature parity (currently it does, modulo Google Sheets export which v2 has not re-implemented).

## Running v1 locally (if you really need to)

```bash
cd legacy/v1
python -m venv .venv
source .venv/bin/activate    # Linux/macOS
# .venv\Scripts\activate      # Windows
pip install -r requirements.txt
PYTHONPATH=src python -m perpustakaan
```

The v1 GUI requires a desktop environment with Tk/CustomTkinter rendering. PyInstaller `.exe` build only works on Windows. Treat as **read-only** — please do not commit new feature code here.
