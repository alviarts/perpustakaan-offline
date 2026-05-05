import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
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

      <SinkronisasiGuide />
    </SettingsSection>
  );
}

/**
 * Inline how-to panel rendered below the form in Pengaturan -> Sinkronisasi.
 *
 * Walks the user through obtaining the two credentials the form asks for:
 * the Google Sheets Spreadsheet ID (from the sheet URL) and a Google Cloud
 * Console API key (with the Google Sheets API enabled). The same content
 * is mirrored in `docs/manual.md` so users who prefer reading the manual
 * book get the identical instructions.
 *
 * Kept as a static panel (no collapse) because the user explicitly asked
 * for the guide to live directly under the form, always visible. The
 * external links open in a new browser tab via `target="_blank"`; in a
 * Tauri webview that delegates to the OS default browser.
 */
function SinkronisasiGuide(): JSX.Element {
  const { t } = useTranslation('settings');
  const base = 'sections.sinkronisasi.guide';

  const renderStep = (key: string, defaultValue: string): JSX.Element => (
    <li className="leading-relaxed">{t(`${base}.${key}`, { defaultValue })}</li>
  );

  return (
    <section
      data-testid="sinkronisasi-guide"
      className="rounded-md border border-border bg-muted/30 p-4 text-sm"
    >
      <h3 className="text-base font-semibold">
        {t(`${base}.title`, { defaultValue: 'Cara dapat ID Spreadsheet & API Key' })}
      </h3>
      <p className="mt-1 text-muted-foreground">
        {t(`${base}.intro`, {
          defaultValue:
            'Sinkronisasi memerlukan dua nilai: ID Spreadsheet dan API key dari Google Cloud Console.',
        })}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="font-semibold">
            {t(`${base}.spreadsheetId.title`, { defaultValue: '1. ID Spreadsheet' })}
          </h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {renderStep(
              'spreadsheetId.step1',
              'Buka spreadsheet Google Sheets yang akan dipakai.',
            )}
            {renderStep('spreadsheetId.step2', 'Lihat URL di bilah alamat browser.')}
            <li>
              <code className="block break-all rounded bg-background px-2 py-1 text-xs">
                {t(`${base}.spreadsheetId.exampleUrl`, {
                  defaultValue:
                    'https://docs.google.com/spreadsheets/d/1aBcDeFgHIjkLMNopQRstUvWxYz0123456789AbcDe/edit#gid=0',
                })}
              </code>
            </li>
            {renderStep(
              'spreadsheetId.step3',
              'Copy bagian ID — teks panjang antara /d/ dan /edit.',
            )}
            {renderStep('spreadsheetId.step4', 'Paste ke field ID Spreadsheet di atas.')}
          </ol>
        </div>

        <div>
          <h4 className="font-semibold">
            {t(`${base}.apiKey.title`, { defaultValue: '2. API Key (Google Cloud Console)' })}
          </h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {renderStep('apiKey.step1', 'Buka Google Cloud Console.')}
            {renderStep('apiKey.step2', 'Buat project baru atau pilih project yang ada.')}
            {renderStep('apiKey.step3', 'Aktifkan Google Sheets API.')}
            {renderStep(
              'apiKey.step4',
              'Buka APIs & Services → Credentials → Create Credentials → API key.',
            )}
            {renderStep('apiKey.step5', 'Copy nilai API key dan paste ke field API Key di atas.')}
            {renderStep(
              'apiKey.step6',
              'Disarankan: restrict key ke Google Sheets API saja.',
            )}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" />
              {t(`${base}.openCloudConsole`, { defaultValue: 'Buka Google Cloud Console' })}
            </a>
            <a
              href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" />
              {t(`${base}.openSheetsApi`, { defaultValue: 'Buka halaman Google Sheets API' })}
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold">
            {t(`${base}.sharing.title`, { defaultValue: '3. Setting Sharing Spreadsheet' })}
          </h4>
          <p className="mt-1 text-muted-foreground">
            {t(`${base}.sharing.intro`, {
              defaultValue:
                'Karena sinkronisasi memakai API key, spreadsheet harus bisa-dibaca-publik:',
            })}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {renderStep('sharing.step1', 'Buka spreadsheet → klik Share.')}
            {renderStep('sharing.step2', 'Pilih Anyone with the link.')}
            {renderStep('sharing.step3', 'Set role ke Viewer (atau Editor).')}
            {renderStep('sharing.step4', 'Klik Done.')}
          </ol>
        </div>
      </div>

      <p className="mt-4 rounded border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
        {t(`${base}.devNote`, {
          defaultValue:
            'Catatan: backend sinkronisasi masih dalam tahap pengembangan. Nilai yang Anda simpan akan dipakai begitu sinkronisasi penuh dirilis.',
        })}
      </p>
    </section>
  );
}
