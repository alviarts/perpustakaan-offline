import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, FolderOpen, Save, Upload } from 'lucide-react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-manager';
import { isTauri } from '@/lib/auth';
import { describeCron, laporanApi, type BackupResult, type BackupSchedule } from '@/lib/laporan';

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
        const picked = await openDialog({ directory: true, multiple: false, title: t('laporan:backup.pickFolder', { defaultValue: 'Pilih folder backup' }) });
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
        description: err instanceof Error ? err.message : String(err),
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
        description: err instanceof Error ? err.message : String(err),
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
        description: err instanceof Error ? err.message : String(err),
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t('laporan:backup.currentDb', { defaultValue: 'File DB Aktif' })}
            </Label>
            <code className="overflow-x-auto whitespace-nowrap rounded-md bg-muted px-2 py-1.5 text-xs">
              {dbPath || '...'}
            </code>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackup} disabled={busy} data-testid="backup-create">
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('laporan:backup.createBtn', { defaultValue: 'Backup Sekarang' })}
            </Button>
            <Button variant="outline" onClick={handleRestore} disabled={busy} data-testid="backup-restore">
              <Upload className="mr-2 h-4 w-4" />
              {t('laporan:backup.restoreBtn', { defaultValue: 'Restore dari File' })}
            </Button>
          </div>

          {lastBackup && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                {t('laporan:backup.lastBackup', { defaultValue: 'Backup terakhir' })}
              </div>
              <div className="mt-1 break-all text-muted-foreground">{lastBackup.path}</div>
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
              defaultValue: 'Cron 5-field. Devin 12 akan menambahkan runner cron-like.',
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
                <Label htmlFor="cron-input" className="text-xs uppercase tracking-wider text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">{describeCron(cronInput)}</p>
              </div>
              {schedule.lastRun && (
                <div className="text-xs text-muted-foreground">
                  {t('laporan:backup.lastRun', { defaultValue: 'Terakhir berjalan' })}: {schedule.lastRun}
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
    </div>
  );
}
