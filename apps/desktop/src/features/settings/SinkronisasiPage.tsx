import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import {
  DEFAULT_SYNC_CONFIG,
  type SyncConfig,
  settingsApi,
} from '@/lib/settings';
import { FieldRow, SettingsSection } from './SettingsSection';

export function SinkronisasiPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const [cfg, setCfg] = React.useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    settingsApi.getSyncConfig().then(setCfg);
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveSyncConfig(cfg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    const next = await settingsApi.resetSyncConfig();
    setCfg(next);
  };

  const handleSyncNow = async (): Promise<void> => {
    setSyncing(true);
    try {
      const next = await settingsApi.syncNow();
      setCfg(next);
      showToast({
        title: t('sections.sinkronisasi.syncSuccess', { defaultValue: 'Sinkronisasi berhasil.' }),
      });
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.syncError', { defaultValue: 'Sinkronisasi gagal.' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SettingsSection
      i18nKey="sinkronisasi"
      onSave={handleSave}
      onReset={handleReset}
      saving={saving}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
        />
        {t('sections.sinkronisasi.fields.enabled', { defaultValue: 'Aktifkan Sinkronisasi' })}
      </label>
      <FieldRow
        label={t('sections.sinkronisasi.fields.spreadsheetId', { defaultValue: 'ID Spreadsheet' })}
      >
        <Input
          value={cfg.spreadsheetId}
          onChange={(e) => setCfg((c) => ({ ...c, spreadsheetId: e.target.value }))}
          disabled={!cfg.enabled}
        />
      </FieldRow>
      <FieldRow label={t('sections.sinkronisasi.fields.apiKey', { defaultValue: 'API Key' })}>
        <Input
          type="password"
          value={cfg.apiKey}
          onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
          disabled={!cfg.enabled}
        />
      </FieldRow>
      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {t('sections.sinkronisasi.fields.lastSync', { defaultValue: 'Terakhir sinkron' })}:{' '}
          {cfg.lastSync ? new Date(cfg.lastSync).toLocaleString() : '—'}
        </span>
        <Button size="sm" onClick={handleSyncNow} disabled={!cfg.enabled || syncing}>
          {t('sections.sinkronisasi.syncNow', { defaultValue: 'Sinkron sekarang' })}
        </Button>
      </div>
    </SettingsSection>
  );
}
