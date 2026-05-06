import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cloud,
  CloudUpload,
  Database,
  FolderOpen,
  History,
  KeyRound,
  Lock,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import { isTauri } from '@/lib/auth';
import {
  describeCron,
  laporanApi,
  type BackupCloudSettings,
  type BackupHistoryRow,
  type BackupResult,
  type BackupSchedule,
} from '@/lib/laporan';
import { formatTauriError } from '@/lib/errors';

export function LaporanBackup() {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [dbPath, setDbPath] = useState<string>('');
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [cronInput, setCronInput] = useState('0 2 * * *');
  const [enabledInput, setEnabledInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupResult | null>(null);

  useEffect(() => {
    laporanApi
      .backupDbPath()
      .then(setDbPath)
      .catch(() => setDbPath('—'));
    laporanApi
      .backupScheduleGet()
      .then((s) => {
        setSchedule(s);
        setCronInput(s.cron);
        setEnabledInput(s.enabled);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  async function handleBackup(): Promise<void> {
    setBusy(true);
    try {
      let target: string;
      if (isTauri()) {
        const picked = await openDialog({
          directory: true,
          multiple: false,
          title: t('laporan:backup.pickFolder', { defaultValue: 'Pilih folder backup' }),
        });
        if (!picked || Array.isArray(picked)) {
          setBusy(false);
          return;
        }
        target = picked;
      } else {
        target = '/tmp';
      }
      const res = await laporanApi.backupCreate(target);
      setLastBackup(res);
      showToast({
        title: t('laporan:backup.success', { defaultValue: 'Backup berhasil' }),
        description: res.path,
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.failed', { defaultValue: 'Backup gagal' }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(): Promise<void> {
    setBusy(true);
    try {
      let filePath: string | null;
      if (isTauri()) {
        const picked = await openDialog({
          directory: false,
          multiple: false,
          filters: [{ name: 'SQLite', extensions: ['db', 'sqlite'] }],
          title: t('laporan:backup.pickRestoreFile', { defaultValue: 'Pilih file .db' }),
        });
        if (!picked || Array.isArray(picked)) {
          setBusy(false);
          return;
        }
        filePath = picked;
      } else {
        filePath = '/tmp/perpustakaan-mock.db';
      }
      const res = await laporanApi.backupRestore(filePath);
      showToast({
        title: t('laporan:backup.restoreSuccess', { defaultValue: 'Restore berhasil' }),
        description: `${res.checksum.slice(0, 16)}…`,
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.restoreFailed', { defaultValue: 'Restore gagal' }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleScheduleSave(): Promise<void> {
    setSaving(true);
    try {
      const updated = await laporanApi.backupScheduleSet(enabledInput, cronInput);
      setSchedule(updated);
      showToast({
        title: t('laporan:backup.scheduleSaved', { defaultValue: 'Jadwal disimpan' }),
        description: describeCron(updated.cron),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.scheduleFailed', { defaultValue: 'Gagal menyimpan jadwal' }),
        description: formatTauriError(err),
      });
    } finally {
      setSaving(false);
    }
  }

  // Suppress unused-var lint when Tauri save dialog isn't reachable in browser mode
  void saveDialog;

  return (
    <div className="flex flex-col gap-4" data-testid="laporan-backup">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            {t('laporan:backup.title', { defaultValue: 'Backup Database' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:backup.subtitle', {
              defaultValue: 'Backup full SQLite + checksum SHA256 untuk verifikasi',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 text-sm">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              {t('laporan:backup.currentDb', { defaultValue: 'File DB Aktif' })}
            </Label>
            <code className="bg-muted overflow-x-auto whitespace-nowrap rounded-md px-2 py-1.5 text-xs">
              {dbPath || '...'}
            </code>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackup} disabled={busy} data-testid="backup-create">
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('laporan:backup.createBtn', { defaultValue: 'Backup Sekarang' })}
            </Button>
            <Button
              variant="outline"
              onClick={handleRestore}
              disabled={busy}
              data-testid="backup-restore"
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('laporan:backup.restoreBtn', { defaultValue: 'Restore dari File' })}
            </Button>
          </div>

          {lastBackup && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                {t('laporan:backup.lastBackup', { defaultValue: 'Backup terakhir' })}
              </div>
              <div className="text-muted-foreground mt-1 break-all">{lastBackup.path}</div>
              <div className="text-muted-foreground">
                SHA256: <code className="text-[10px]">{lastBackup.checksum}</code>
              </div>
              <div className="text-muted-foreground">
                Size: {(lastBackup.sizeBytes / 1024).toFixed(1)} KB
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('laporan:backup.scheduleTitle', { defaultValue: 'Jadwal Backup Otomatis' })}
          </CardTitle>
          <CardDescription>
            {t('laporan:backup.scheduleHint', {
              defaultValue:
                'Cron 5-field (mis. "0 2 * * *"). Runner berjalan di latar belakang dan menyimpan backup ke folder data aplikasi.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {schedule == null ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="schedule-enabled"
                  checked={enabledInput}
                  onCheckedChange={(c) => setEnabledInput(c === true)}
                  data-testid="schedule-enabled"
                />
                <Label htmlFor="schedule-enabled" className="text-sm">
                  {t('laporan:backup.enableSchedule', { defaultValue: 'Aktifkan jadwal otomatis' })}
                </Label>
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cron-input"
                  className="text-muted-foreground text-xs uppercase tracking-wider"
                >
                  {t('laporan:backup.cron', { defaultValue: 'Cron Expression' })}
                </Label>
                <Input
                  id="cron-input"
                  value={cronInput}
                  onChange={(e) => setCronInput(e.target.value)}
                  placeholder="0 2 * * *"
                  className="font-mono text-sm"
                  data-testid="schedule-cron"
                />
                <p className="text-muted-foreground text-xs">{describeCron(cronInput)}</p>
              </div>
              {schedule.lastRun && (
                <div className="text-muted-foreground text-xs">
                  {t('laporan:backup.lastRun', { defaultValue: 'Terakhir berjalan' })}:{' '}
                  {schedule.lastRun}
                </div>
              )}
              <Button onClick={handleScheduleSave} disabled={saving} data-testid="schedule-save">
                <Save className="mr-2 h-4 w-4" />
                {t('laporan:backup.scheduleSave', { defaultValue: 'Simpan Jadwal' })}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <BackupEncryptedCard />

      <BackupCloudCard />

      <BackupHistoryCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FEAT-24 — Backup history list (filterable)
// ---------------------------------------------------------------------------

function BackupHistoryCard(): JSX.Element {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [rows, setRows] = useState<BackupHistoryRow[] | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterDestType, setFilterDestType] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await laporanApi.backupHistoryList({
        from: filterFrom || undefined,
        to: filterTo || undefined,
        destType: filterDestType || undefined,
        limit: 100,
      });
      setRows(list);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.history.loadFailed', { defaultValue: 'Gagal memuat riwayat' }),
        description: formatTauriError(err),
      });
      setRows([]);
    }
  }, [filterFrom, filterTo, filterDestType, showToast, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(id: number): Promise<void> {
    setBusyId(id);
    try {
      await laporanApi.backupHistoryDelete(id);
      await refresh();
      showToast({
        title: t('laporan:backup.history.deleteOk', {
          defaultValue: 'Entri riwayat dihapus.',
        }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.history.deleteFailed', {
          defaultValue: 'Gagal menghapus entri.',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card data-testid="backup-history-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          {t('laporan:backup.history.title', { defaultValue: 'Riwayat Backup' })}
        </CardTitle>
        <CardDescription>
          {t('laporan:backup.history.subtitle', {
            defaultValue:
              'Audit semua backup (lokal, cloud, encrypted). Sortir terbaru dulu.',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="history-from" className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('laporan:backup.history.from', { defaultValue: 'Dari (ISO)' })}
            </Label>
            <Input
              id="history-from"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              placeholder="2026-01-01"
              data-testid="history-from"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="history-to" className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('laporan:backup.history.to', { defaultValue: 'Sampai (ISO)' })}
            </Label>
            <Input
              id="history-to"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              placeholder="2026-12-31"
              data-testid="history-to"
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="history-desttype"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              {t('laporan:backup.history.destType', { defaultValue: 'Tipe Tujuan' })}
            </Label>
            <select
              id="history-desttype"
              value={filterDestType}
              onChange={(e) => setFilterDestType(e.target.value)}
              data-testid="history-desttype"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">
                {t('laporan:backup.history.allTypes', { defaultValue: 'Semua' })}
              </option>
              <option value="lokal">lokal</option>
              <option value="rclone">rclone</option>
              <option value="gdrive">gdrive</option>
              <option value="dropbox">dropbox</option>
            </select>
          </div>
        </div>
        {rows == null ? (
          <Skeleton className="h-32 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="history-empty">
            {t('laporan:backup.history.empty', {
              defaultValue: 'Belum ada riwayat backup.',
            })}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs" data-testid="history-table">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">
                    {t('laporan:backup.history.col.created', { defaultValue: 'Tanggal' })}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {t('laporan:backup.history.col.path', { defaultValue: 'Path' })}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {t('laporan:backup.history.col.dest', { defaultValue: 'Tujuan' })}
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    {t('laporan:backup.history.col.size', { defaultValue: 'Ukuran' })}
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    {t('laporan:backup.history.col.status', { defaultValue: 'Status' })}
                  </th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t" data-testid={`history-row-${row.id}`}>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono">{row.createdAt}</td>
                    <td className="px-2 py-1.5 break-all">
                      <span className="flex items-center gap-1">
                        {row.encrypted && <Lock className="h-3 w-3 text-amber-600" />}
                        <code className="text-[11px]">{row.path}</code>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.destType}
                      {row.destLabel ? ` (${row.destLabel})` : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {(row.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td
                      className={
                        'px-2 py-1.5 whitespace-nowrap ' +
                        (row.status === 'sukses'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-destructive')
                      }
                    >
                      {row.status}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => handleDelete(row.id)}
                        data-testid={`history-delete-${row.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            data-testid="history-refresh"
          >
            {t('laporan:backup.history.refresh', { defaultValue: 'Refresh' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FEAT-24 — Encrypted backup
// ---------------------------------------------------------------------------

function BackupEncryptedCard(): JSX.Element {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleEncryptedBackup(): Promise<void> {
    if (password.length < 8) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.encrypted.shortPwd', {
          defaultValue: 'Password minimal 8 karakter.',
        }),
      });
      return;
    }
    setBusy(true);
    try {
      let target: string;
      if (isTauri()) {
        const picked = await openDialog({
          directory: true,
          multiple: false,
          title: t('laporan:backup.pickFolder', { defaultValue: 'Pilih folder backup' }),
        });
        if (!picked || Array.isArray(picked)) {
          setBusy(false);
          return;
        }
        target = picked;
      } else {
        target = '/tmp';
      }
      const row = await laporanApi.backupCreateEncrypted(target, password);
      showToast({
        title: t('laporan:backup.encrypted.ok', {
          defaultValue: 'Backup terenkripsi berhasil.',
        }),
        description: row.path,
      });
      setPassword('');
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.encrypted.failed', {
          defaultValue: 'Backup terenkripsi gagal.',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-testid="backup-encrypted-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          {t('laporan:backup.encrypted.title', { defaultValue: 'Backup Terenkripsi' })}
        </CardTitle>
        <CardDescription>
          {t('laporan:backup.encrypted.subtitle', {
            defaultValue:
              'Backup .db dengan AES-256-GCM. Password diubah jadi key via PBKDF2 (200k iter). Wajib ingat password — file tidak bisa dipulihkan tanpa itu.',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label
            htmlFor="encrypted-pwd"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            {t('laporan:backup.encrypted.password', { defaultValue: 'Password (≥ 8 karakter)' })}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="encrypted-pwd"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="encrypted-pwd"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPwd((v) => !v)}
              data-testid="encrypted-pwd-toggle"
            >
              {showPwd
                ? t('laporan:backup.encrypted.hide', { defaultValue: 'Sembunyikan' })
                : t('laporan:backup.encrypted.show', { defaultValue: 'Tampilkan' })}
            </Button>
          </div>
        </div>
        <div>
          <Button
            onClick={() => void handleEncryptedBackup()}
            disabled={busy || password.length < 8}
            data-testid="encrypted-create"
          >
            <Lock className="mr-2 h-4 w-4" />
            {t('laporan:backup.encrypted.create', {
              defaultValue: 'Buat Backup Terenkripsi',
            })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FEAT-24 — Cloud (rclone passthrough) settings + manual upload
// ---------------------------------------------------------------------------

function BackupCloudCard(): JSX.Element {
  const { t } = useTranslation(['laporan']);
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BackupCloudSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    laporanApi
      .backupCloudSettingsGet()
      .then(setSettings)
      .catch(() =>
        setSettings({ provider: 'lokal', rcloneRemote: '', remoteFolder: '', autoUpload: false }),
      );
  }, []);

  async function handleSave(): Promise<void> {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await laporanApi.backupCloudSettingsSet(settings);
      setSettings(updated);
      showToast({
        title: t('laporan:backup.cloud.savedTitle', {
          defaultValue: 'Pengaturan cloud disimpan.',
        }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.cloud.saveFailed', {
          defaultValue: 'Gagal menyimpan pengaturan cloud.',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleManualUpload(): Promise<void> {
    if (!settings) return;
    setUploading(true);
    try {
      let pickedPath: string;
      if (isTauri()) {
        const picked = await openDialog({
          directory: false,
          multiple: false,
          filters: [{ name: 'Backup', extensions: ['db', 'enc'] }],
          title: t('laporan:backup.cloud.pickFile', {
            defaultValue: 'Pilih file backup untuk upload',
          }),
        });
        if (!picked || Array.isArray(picked)) {
          setUploading(false);
          return;
        }
        pickedPath = picked;
      } else {
        pickedPath = '/tmp/perpustakaan-mock.db';
      }
      const result = await laporanApi.backupCloudUpload({
        sourcePath: pickedPath,
        remote: settings.rcloneRemote || undefined,
        folder: settings.remoteFolder || undefined,
      });
      showToast({
        title: t('laporan:backup.cloud.uploadOk', {
          defaultValue: 'Upload selesai.',
        }),
        description: `${result.remote}:${result.folder}`,
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('laporan:backup.cloud.uploadFailed', {
          defaultValue: 'Upload gagal.',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card data-testid="backup-cloud-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4" />
          {t('laporan:backup.cloud.title', { defaultValue: 'Backup ke Cloud (rclone)' })}
        </CardTitle>
        <CardDescription>
          {t('laporan:backup.cloud.subtitle', {
            defaultValue:
              'Upload backup ke Google Drive / Dropbox / S3 / dst. via binary rclone yang sudah Anda install. Aplikasi tidak menyimpan kredensial cloud — semua dikelola lewat `rclone config`.',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {settings == null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cloud-provider"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {t('laporan:backup.cloud.provider', { defaultValue: 'Provider' })}
                </Label>
                <select
                  id="cloud-provider"
                  value={settings.provider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      provider: e.target.value as BackupCloudSettings['provider'],
                    })
                  }
                  data-testid="cloud-provider"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="lokal">lokal (no cloud)</option>
                  <option value="gdrive">Google Drive</option>
                  <option value="dropbox">Dropbox</option>
                  <option value="rclone">rclone (custom remote)</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cloud-remote"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {t('laporan:backup.cloud.remote', {
                    defaultValue: 'Nama Remote (`rclone config` name)',
                  })}
                </Label>
                <Input
                  id="cloud-remote"
                  value={settings.rcloneRemote}
                  onChange={(e) => setSettings({ ...settings, rcloneRemote: e.target.value })}
                  placeholder="gdrive-backup"
                  data-testid="cloud-remote"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label
                  htmlFor="cloud-folder"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {t('laporan:backup.cloud.folder', { defaultValue: 'Folder Remote' })}
                </Label>
                <Input
                  id="cloud-folder"
                  value={settings.remoteFolder}
                  onChange={(e) => setSettings({ ...settings, remoteFolder: e.target.value })}
                  placeholder="perpustakaan/backups"
                  data-testid="cloud-folder"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cloud-auto"
                checked={settings.autoUpload}
                onCheckedChange={(c) =>
                  setSettings({ ...settings, autoUpload: c === true })
                }
                data-testid="cloud-auto"
              />
              <Label htmlFor="cloud-auto" className="text-sm">
                {t('laporan:backup.cloud.autoUpload', {
                  defaultValue: 'Auto-upload setiap backup terjadwal selesai',
                })}
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={saving} data-testid="cloud-save">
                <Save className="mr-2 h-4 w-4" />
                {t('laporan:backup.cloud.save', { defaultValue: 'Simpan Pengaturan' })}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleManualUpload()}
                disabled={uploading || !settings.rcloneRemote}
                data-testid="cloud-upload"
              >
                <CloudUpload className="mr-2 h-4 w-4" />
                {t('laporan:backup.cloud.uploadNow', { defaultValue: 'Upload File ke Cloud' })}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
