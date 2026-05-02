; Inno Setup script — Perpustakaan Offline
; -----------------------------------------
; Build:
;   - Windows lokal: ISCC.exe installer\installer.iss
;   - Wine (Linux):  wine "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\installer.iss
;   - GitHub Actions: lihat .github/workflows/ci.yml job `build-installer`
;
; Output: installer\Output\PerpustakaanOffline-Setup-vX.Y.Z.exe
;
; Prasyarat:
;   - dist\PerpustakaanOffline.exe sudah dibuild via PyInstaller (build.bat / CI)

#define MyAppName "Perpustakaan Offline"
#define MyAppShortName "PerpustakaanOffline"
#define MyAppVersion "0.5.2"
#define MyAppPublisher "alviarts"
#define MyAppURL "https://github.com/alviarts/perpustakaan-offline"
#define MyAppExeName "PerpustakaanOffline.exe"
#define MyAppId "{{8E2C3A4D-9F3B-4A5E-B6F7-C1D2E3F4A5B6}"

[Setup]
; Identifikasi aplikasi (jangan ubah AppId setelah rilis pertama!)
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
LicenseFile=..\LICENSE
OutputDir=Output
OutputBaseFilename={#MyAppShortName}-Setup-v{#MyAppVersion}
SetupIconFile=
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
UninstallDisplayName={#MyAppName} {#MyAppVersion}
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} - Sistem Informasi Manajemen Perpustakaan Sekolah
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}.0

[Languages]
; Bahasa Indonesia (unofficial translation, di-bundle di repo)
Name: "indonesia"; MessagesFile: "lang\Indonesian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Single-file PyInstaller .exe — semua dependency (Python runtime, libs) sudah embedded.
; Pengguna TIDAK perlu install Python — runtime python3.11 + standard library + semua
; pip dependencies (customtkinter, Pillow, bcrypt, dll) sudah ada di dalam .exe ini.
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\manual.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\google-sheets-setup.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\quickstart.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\quickstart.pdf"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist

; Font Inter (modern UI font) — install ke user fonts dir supaya UI lebih enak dilihat.
; PrivilegesRequired=lowest -> {autofonts} resolve ke per-user fonts (Win10+).
; Flags onlyifdoesntexist + uninsneveruninstall: aman, tidak hapus font saat uninstall.
Source: "..\assets\fonts\Inter-Regular.otf"; DestDir: "{autofonts}"; FontInstall: "Inter"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\assets\fonts\Inter-Medium.otf"; DestDir: "{autofonts}"; FontInstall: "Inter Medium"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\assets\fonts\Inter-SemiBold.otf"; DestDir: "{autofonts}"; FontInstall: "Inter SemiBold"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\assets\fonts\Inter-Bold.otf"; DestDir: "{autofonts}"; FontInstall: "Inter Bold"; Flags: onlyifdoesntexist uninsneveruninstall
Source: "..\assets\fonts\Inter-LICENSE.txt"; DestDir: "{app}\assets\fonts"; Flags: ignoreversion

; Microsoft Visual C++ 2015-2022 Redistributable (x64) — di-bundle untuk auto-install
; kalau belum ada di sistem user. Sumber: https://aka.ms/vs/17/release/vc_redist.x64.exe
; Di-extract ke {tmp}, dijalankan via [Run], lalu dihapus (deleteafterinstall).
; File ini didownload oleh CI workflow ke installer\redist\ sebelum kompilasi Inno Setup.
Source: "redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: VCRedistNeedsInstall

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\Manual Pengguna"; Filename: "{app}\docs\manual.md"
Name: "{autoprograms}\Quickstart (PDF)"; Filename: "{app}\docs\quickstart.pdf"
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Auto-install VC++ Runtime kalau dirasa perlu (cek registry via VCRedistNeedsInstall).
; /install /passive /norestart -> tampil progress bar minimal, tidak reboot otomatis.
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /passive /norestart"; \
  StatusMsg: "Memasang Microsoft Visual C++ Runtime (x64)..."; \
  Check: VCRedistNeedsInstall; Flags: waituntilterminated

Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Saat uninstall, JANGAN hapus folder data user (ada di %APPDATA%\PerpustakaanOffline\)
; Folder install saja yang dibersihkan; data user dipertahankan untuk install ulang.
Type: filesandordirs; Name: "{app}\__pycache__"

[Code]
// ---------------------------------------------------------------------------
// VC++ Redistributable check — return True kalau perlu install
// ---------------------------------------------------------------------------
// Kunci registry yang ditulis Microsoft VC++ 2015-2022 Redist (x64) saat terinstall:
//   HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64\Installed = 1
// Path tersebut konsisten utk semua versi 14.x (2015 / 2017 / 2019 / 2022).
function VCRedistNeedsInstall(): Boolean;
var
  installed: Cardinal;
begin
  Result := True;
  if RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', installed) then
  begin
    if installed = 1 then
      Result := False;
  end;
end;

// Cek apakah versi lama sudah terinstall
function GetUninstallString(): String;
var
  sUnInstPath: String;
  sUnInstallString: String;
begin
  sUnInstPath := ExpandConstant('Software\Microsoft\Windows\CurrentVersion\Uninstall\{#emit SetupSetting("AppId")}_is1');
  sUnInstallString := '';
  if not RegQueryStringValue(HKLM, sUnInstPath, 'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKCU, sUnInstPath, 'UninstallString', sUnInstallString);
  Result := sUnInstallString;
end;

function IsUpgrade(): Boolean;
begin
  Result := (GetUninstallString() <> '');
end;

function UnInstallOldVersion(): Integer;
var
  sUnInstallString: String;
  iResultCode: Integer;
begin
  Result := 0;
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then begin
    sUnInstallString := RemoveQuotes(sUnInstallString);
    if Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES','', SW_HIDE, ewWaitUntilTerminated, iResultCode) then
      Result := 3
    else
      Result := 2;
  end else
    Result := 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssInstall) then
  begin
    if (IsUpgrade()) then
    begin
      UnInstallOldVersion();
    end;
  end;
end;
