@echo off
REM ============================================================
REM   Perpustakaan Offline - Build .exe Windows (PyInstaller)
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo === Perpustakaan Offline :: Build EXE ===
echo.

REM ---- Pastikan Python 3.11+ tersedia
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH.
    echo Install Python 3.11+ dari https://www.python.org/downloads/
    exit /b 1
)

REM ---- Buat / aktifkan venv
if not exist ".venv\Scripts\activate.bat" (
    echo [INFO] Membuat virtual environment...
    python -m venv .venv
    if errorlevel 1 exit /b 1
)
call .venv\Scripts\activate.bat

REM ---- Install dependencies
echo [INFO] Instalasi dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Gagal install dependencies.
    exit /b 1
)

REM ---- Bersihkan build sebelumnya
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

REM ---- Build dengan PyInstaller
echo [INFO] Building EXE dengan PyInstaller...
python -m PyInstaller build.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] Build gagal.
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD SELESAI
echo   Output: dist\PerpustakaanOffline.exe
echo ============================================================
echo.
endlocal
