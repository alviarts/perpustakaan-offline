# Installer — Perpustakaan Offline

Skrip Inno Setup untuk membuat Windows installer (`.exe` Setup wizard).

## Output

`installer/Output/PerpustakaanOffline-Setup-vX.Y.Z.exe`

## Build di Windows (lokal)

1. Install [Inno Setup 6](https://jrsoftware.org/isdl.php)
2. Build dulu portable .exe:
   ```cmd
   build.bat
   ```
3. Compile installer:
   ```cmd
   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\installer.iss
   ```

## Build via Wine (Linux/macOS)

Lihat `.github/workflows/ci.yml` job `build-installer` — pipeline native di
GitHub Actions Windows runner adalah cara yang direkomendasikan.

Untuk build manual via Wine:

```bash
# Sekali setup:
sudo apt-get install wine winetricks
winetricks -q dotnet48
wget https://files.jrsoftware.org/is/6/innosetup-6.2.2.exe -O /tmp/inno.exe
wine /tmp/inno.exe /VERYSILENT /SUPPRESSMSGBOXES

# Build:
cd /path/to/repo
wine "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\\installer.iss
```

## Apa yang di-include installer?

- `PerpustakaanOffline.exe` (single-file, semua dependency sudah embedded)
- `README.md`, `LICENSE`
- `docs/manual.md`, `docs/google-sheets-setup.md`

## Apa yang TIDAK di-include?

- Folder data user (`%APPDATA%\PerpustakaanOffline\`) — dibuat otomatis saat first run
- File `client_secret.json` — user setup sendiri (lihat docs/google-sheets-setup.md)

## Behavior

- **Install path default**: `%LOCALAPPDATA%\Programs\Perpustakaan Offline\` (no admin needed) atau `%PROGRAMFILES%\Perpustakaan Offline\` (kalau pilih All Users)
- **Start Menu**: shortcut di `Programs → Perpustakaan Offline`
- **Desktop**: shortcut opsional (checkbox di wizard, default off)
- **Uninstaller**: terdaftar di Control Panel → Programs and Features
- **Upgrade**: kalau install versi baru, uninstall otomatis versi lama (silent), data user dipertahankan
- **Bilingual**: pilih bahasa Indonesia atau English saat run installer

## Versi

Edit `MyAppVersion` di `installer.iss` saat rilis baru. Sebaiknya match dengan
`__version__` di `src/perpustakaan/__init__.py`.
