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
#define MyAppVersion "0.3.1"
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
; Single-file PyInstaller .exe — semua dependency (Python runtime, libs) sudah embedded
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\manual.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\google-sheets-setup.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\quickstart.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\docs\quickstart.pdf"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\Manual Pengguna"; Filename: "{app}\docs\manual.md"
Name: "{autoprograms}\Quickstart (PDF)"; Filename: "{app}\docs\quickstart.pdf"
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Saat uninstall, JANGAN hapus folder data user (ada di %APPDATA%\PerpustakaanOffline\)
; Folder install saja yang dibersihkan; data user dipertahankan untuk install ulang.
Type: filesandordirs; Name: "{app}\__pycache__"

[Code]
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
