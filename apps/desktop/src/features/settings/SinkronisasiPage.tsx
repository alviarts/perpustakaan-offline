import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-manager';
import {
  DEFAULT_SYNC_CONFIG,
  type SyncConfig,
  type SyncLogEntry,
  type SyncStateRow,
  type SyncStatusSnapshot,
  settingsApi,
} from '@/lib/settings';
import { FieldRow, SettingsSection } from './SettingsSection';

/**
 * Sinkronisasi page (Pengaturan → Sinkronisasi).
 *
 * v1.0.6 shipped a placeholder UI with `apiKey` (read-only Sheets access).
 * v1.0.8 PR G (FEAT-26) extends it with Service Account–based bidirectional
 * sync. Push uploads the local `anggota` table to the configured spreadsheet
 * (replacing the entire `anggota` tab), pull downloads rows back and applies
 * them with last-write-wins on `updated_at`. Other tables follow in G2/G3.
 */
export function SinkronisasiPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const [cfg, setCfg] = React.useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [status, setStatus] = React.useState<SyncStatusSnapshot | null>(null);
  const [serviceAccountJson, setServiceAccountJson] = React.useState('');
  const [showSaJson, setShowSaJson] = React.useState(false);
  const [savingSa, setSavingSa] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [pushing, setPushing] = React.useState(false);
  const [pulling, setPulling] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [next, snap] = await Promise.all([
      settingsApi.getSyncConfig(),
      settingsApi.getSyncStatus(),
    ]);
    setCfg(next);
    setStatus(snap);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await settingsApi.saveSyncConfig(cfg);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    const next = await settingsApi.resetSyncConfig();
    setCfg(next);
    await refresh();
  };

  const handleSaveServiceAccount = async (): Promise<void> => {
    setSavingSa(true);
    try {
      await settingsApi.saveServiceAccountJson(serviceAccountJson);
      setServiceAccountJson('');
      await refresh();
      showToast({
        title: t('sections.sinkronisasi.toast.saSaved', {
          defaultValue: 'Service Account JSON disimpan.',
        }),
      });
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.toast.saSaveError', {
          defaultValue: 'Service Account JSON tidak valid.',
        }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingSa(false);
    }
  };

  const handleClearServiceAccount = async (): Promise<void> => {
    setSavingSa(true);
    try {
      await settingsApi.saveServiceAccountJson('');
      await refresh();
      showToast({
        title: t('sections.sinkronisasi.toast.saCleared', {
          defaultValue: 'Service Account JSON dihapus.',
        }),
      });
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.toast.saSaveError', {
          defaultValue: 'Service Account JSON tidak valid.',
        }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingSa(false);
    }
  };

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    try {
      const result = await settingsApi.testSyncConnection();
      showToast({
        title: t('sections.sinkronisasi.toast.testOk', {
          defaultValue: 'Koneksi ke Sheets berhasil.',
        }),
        description: t('sections.sinkronisasi.toast.testOkDesc', {
          defaultValue: 'Spreadsheet "{{title}}" • {{count}} tab',
          title: result.spreadsheet_title,
          count: result.tabs.length,
        }),
      });
      await refresh();
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.toast.testError', {
          defaultValue: 'Tes koneksi gagal.',
        }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePush = async (): Promise<void> => {
    setPushing(true);
    try {
      const results = await settingsApi.pushSyncNow();
      const total = results.reduce((acc, r) => acc + (r.status === 'ok' ? r.rows_changed : 0), 0);
      showToast({
        title: t('sections.sinkronisasi.toast.pushOk', {
          defaultValue: 'Push selesai: {{count}} baris.',
          count: total,
        }),
      });
      await refresh();
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.toast.pushError', { defaultValue: 'Push gagal.' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async (): Promise<void> => {
    setPulling(true);
    try {
      const results = await settingsApi.pullSyncNow();
      const total = results.reduce((acc, r) => acc + (r.status === 'ok' ? r.rows_changed : 0), 0);
      showToast({
        title: t('sections.sinkronisasi.toast.pullOk', {
          defaultValue: 'Pull selesai: {{count}} baris.',
          count: total,
        }),
      });
      await refresh();
    } catch (e) {
      showToast({
        title: t('sections.sinkronisasi.toast.pullError', { defaultValue: 'Pull gagal.' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPulling(false);
    }
  };

  const ready = cfg.serviceAccountConfigured && cfg.spreadsheetId.trim().length > 0;

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
          data-testid="sync-spreadsheet-id"
          value={cfg.spreadsheetId}
          onChange={(e) => setCfg((c) => ({ ...c, spreadsheetId: e.target.value }))}
          disabled={!cfg.enabled}
          placeholder="1aBcDeFgHIjkLMNopQRstUvWxYz0123456789AbcDe"
        />
      </FieldRow>

      <FieldRow
        label={t('sections.sinkronisasi.fields.serviceAccount', {
          defaultValue: 'Service Account JSON',
        })}
      >
        <ServiceAccountField
          configured={cfg.serviceAccountConfigured}
          email={cfg.serviceAccountEmail}
          json={serviceAccountJson}
          show={showSaJson}
          saving={savingSa}
          onJsonChange={setServiceAccountJson}
          onToggleShow={() => setShowSaJson((v) => !v)}
          onSave={handleSaveServiceAccount}
          onClear={handleClearServiceAccount}
          disabled={false}
        />
      </FieldRow>

      <SyncActions
        ready={ready && cfg.enabled}
        testing={testing}
        pushing={pushing}
        pulling={pulling}
        onTest={handleTestConnection}
        onPush={handlePush}
        onPull={handlePull}
        onRefresh={refresh}
      />

      {status ? <SyncStatusPanel status={status} /> : null}

      <SinkronisasiGuide />
    </SettingsSection>
  );
}

interface ServiceAccountFieldProps {
  configured: boolean;
  email: string;
  json: string;
  show: boolean;
  saving: boolean;
  disabled: boolean;
  onJsonChange: (next: string) => void;
  onToggleShow: () => void;
  onSave: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
}

function ServiceAccountField(props: ServiceAccountFieldProps): JSX.Element {
  const { t } = useTranslation('settings');
  const {
    configured,
    email,
    json,
    show,
    saving,
    disabled,
    onJsonChange,
    onToggleShow,
    onSave,
    onClear,
  } = props;
  return (
    <div className="space-y-2">
      {configured ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-500/20 dark:bg-emerald-950/30">
          <div className="min-w-0">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              {t('sections.sinkronisasi.serviceAccount.savedTitle', {
                defaultValue: 'Service Account aktif',
              })}
            </p>
            <p className="truncate text-xs text-emerald-800 dark:text-emerald-200">{email || '—'}</p>
          </div>
          <Button
            data-testid="sync-sa-clear"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onClear()}
            disabled={saving || disabled}
          >
            {t('sections.sinkronisasi.serviceAccount.clear', { defaultValue: 'Hapus Service Account' })}
          </Button>
        </div>
      ) : (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
          {t('sections.sinkronisasi.serviceAccount.notConfigured', {
            defaultValue:
              'Belum ada Service Account JSON. Paste JSON dari Google Cloud Console di bawah lalu klik Simpan.',
          })}
        </p>
      )}

      <textarea
        data-testid="sync-sa-json"
        value={json}
        onChange={(e) => onJsonChange(e.target.value)}
        disabled={saving || disabled}
        spellCheck={false}
        rows={6}
        className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        placeholder={t('sections.sinkronisasi.serviceAccount.placeholder', {
          defaultValue: '{ "type": "service_account", "project_id": "...", ... }',
        })}
        style={{ filter: show ? 'none' : 'blur(0)' }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-testid="sync-sa-save"
          type="button"
          size="sm"
          onClick={() => void onSave()}
          disabled={saving || json.trim().length === 0 || disabled}
        >
          {saving
            ? t('sections.sinkronisasi.serviceAccount.saving', { defaultValue: 'Menyimpan…' })
            : t('sections.sinkronisasi.serviceAccount.save', { defaultValue: 'Simpan Service Account' })}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToggleShow}>
          {show
            ? t('sections.sinkronisasi.serviceAccount.hide', { defaultValue: 'Sembunyikan' })
            : t('sections.sinkronisasi.serviceAccount.show', { defaultValue: 'Tampilkan' })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('sections.sinkronisasi.serviceAccount.privacy', {
          defaultValue:
            'JSON hanya disimpan di komputer ini, tidak pernah dikirim ke server selain Google Sheets.',
        })}
      </p>
    </div>
  );
}

interface SyncActionsProps {
  ready: boolean;
  testing: boolean;
  pushing: boolean;
  pulling: boolean;
  onTest: () => void | Promise<void>;
  onPush: () => void | Promise<void>;
  onPull: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

function SyncActions(props: SyncActionsProps): JSX.Element {
  const { t } = useTranslation('settings');
  const { ready, testing, pushing, pulling, onTest, onPush, onPull, onRefresh } = props;
  const busy = testing || pushing || pulling;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        data-testid="sync-test-connection"
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onTest()}
        disabled={!ready || busy}
      >
        <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
        {t('sections.sinkronisasi.actions.test', { defaultValue: 'Tes Koneksi' })}
      </Button>
      <Button
        data-testid="sync-push-now"
        type="button"
        size="sm"
        onClick={() => void onPush()}
        disabled={!ready || busy}
      >
        <ArrowUpFromLine className={`mr-1.5 h-3.5 w-3.5 ${pushing ? 'animate-pulse' : ''}`} />
        {t('sections.sinkronisasi.actions.push', { defaultValue: 'Push Sekarang' })}
      </Button>
      <Button
        data-testid="sync-pull-now"
        type="button"
        size="sm"
        onClick={() => void onPull()}
        disabled={!ready || busy}
      >
        <ArrowDownToLine className={`mr-1.5 h-3.5 w-3.5 ${pulling ? 'animate-pulse' : ''}`} />
        {t('sections.sinkronisasi.actions.pull', { defaultValue: 'Pull Sekarang' })}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => void onRefresh()} disabled={busy}>
        {t('sections.sinkronisasi.actions.refresh', { defaultValue: 'Refresh status' })}
      </Button>
    </div>
  );
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  const trimmed = ts.replace(' ', 'T');
  const d = new Date(trimmed.endsWith('Z') ? trimmed : `${trimmed}Z`);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function SyncStatusPanel({ status }: { status: SyncStatusSnapshot }): JSX.Element {
  const { t } = useTranslation('settings');
  return (
    <section
      data-testid="sync-status-panel"
      className="rounded-md border border-border bg-muted/30 p-4 text-sm"
    >
      <h3 className="text-base font-semibold">
        {t('sections.sinkronisasi.status.title', { defaultValue: 'Status Sinkronisasi' })}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {status.configured
          ? t('sections.sinkronisasi.status.configured', {
              defaultValue: 'Spreadsheet ID dan Service Account terkonfigurasi.',
            })
          : t('sections.sinkronisasi.status.notConfigured', {
              defaultValue: 'Belum siap — lengkapi Spreadsheet ID dan Service Account.',
            })}
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold">
            {t('sections.sinkronisasi.status.tablesTitle', { defaultValue: 'Per-tabel' })}
          </h4>
          {status.states.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('sections.sinkronisasi.status.tablesEmpty', {
                defaultValue: 'Belum pernah push/pull.',
              })}
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs" data-testid="sync-status-tables">
              {status.states.map((s) => (
                <SyncStateRowItem key={s.table_name} row={s} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold">
            {t('sections.sinkronisasi.status.logTitle', { defaultValue: 'Riwayat (terbaru)' })}
          </h4>
          {status.log.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('sections.sinkronisasi.status.logEmpty', { defaultValue: 'Belum ada log.' })}
            </p>
          ) : (
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 text-xs" data-testid="sync-status-log">
              {status.log.map((entry) => (
                <SyncLogItem key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function SyncStateRowItem({ row }: { row: SyncStateRow }): JSX.Element {
  const { t } = useTranslation('settings');
  return (
    <li className="rounded border border-border bg-background px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium">{row.table_name}</span>
        <span className="text-[10px] uppercase text-muted-foreground">
          {row.rows_pushed} ↑ / {row.rows_pulled} ↓
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>
          {t('sections.sinkronisasi.status.lastPush', { defaultValue: 'Last push' })}:{' '}
          {formatTs(row.last_push_at)}
        </span>
        <span>
          {t('sections.sinkronisasi.status.lastPull', { defaultValue: 'Last pull' })}:{' '}
          {formatTs(row.last_pull_at)}
        </span>
      </div>
    </li>
  );
}

function SyncLogItem({ entry }: { entry: SyncLogEntry }): JSX.Element {
  const color =
    entry.status === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : entry.status === 'error'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';
  return (
    <li className="rounded border border-border bg-background px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{formatTs(entry.ts)}</span>
        <span className={`text-[10px] font-semibold uppercase ${color}`}>
          {entry.direction} · {entry.status}
        </span>
      </div>
      <div className="text-[11px]">
        <span className="font-mono">{entry.table_name}</span>
        {entry.message ? <span className="text-muted-foreground"> — {entry.message}</span> : null}
      </div>
    </li>
  );
}

/**
 * Inline how-to panel rendered below the form in Pengaturan -> Sinkronisasi.
 *
 * Walks the user through (1) creating a Google Cloud Service Account and
 * downloading its JSON key, (2) sharing the spreadsheet with the SA email,
 * and (3) pasting the JSON into the form. The same content is mirrored in
 * `docs/manual.md` so users who prefer reading the manual book get the
 * identical instructions.
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
        {t(`${base}.title`, { defaultValue: 'Cara siapkan Spreadsheet & Service Account' })}
      </h3>
      <p className="mt-1 text-muted-foreground">
        {t(`${base}.intro`, {
          defaultValue:
            'Sinkronisasi memerlukan dua hal: ID Spreadsheet dan Service Account JSON dari Google Cloud Console.',
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
            {t(`${base}.serviceAccount.title`, {
              defaultValue: '2. Service Account (Google Cloud Console)',
            })}
          </h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {renderStep('serviceAccount.step1', 'Buka Google Cloud Console.')}
            {renderStep('serviceAccount.step2', 'Buat project baru atau pilih project yang ada.')}
            {renderStep('serviceAccount.step3', 'Aktifkan Google Sheets API.')}
            {renderStep(
              'serviceAccount.step4',
              'Buka IAM & Admin → Service Accounts → Create Service Account.',
            )}
            {renderStep(
              'serviceAccount.step5',
              'Setelah dibuat, klik SA → Keys → Add Key → Create new key → JSON → Create.',
            )}
            {renderStep(
              'serviceAccount.step6',
              'Buka file JSON yang ter-download, copy seluruh isinya, lalu paste ke field Service Account JSON di atas.',
            )}
            {renderStep(
              'serviceAccount.step7',
              'Klik Simpan Service Account. Email service account akan muncul di kotak hijau.',
            )}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://console.cloud.google.com/iam-admin/serviceaccounts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" />
              {t(`${base}.openServiceAccounts`, { defaultValue: 'Buka Service Accounts' })}
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
            {t(`${base}.sharing.title`, { defaultValue: '3. Share Spreadsheet ke Service Account' })}
          </h4>
          <p className="mt-1 text-muted-foreground">
            {t(`${base}.sharing.intro`, {
              defaultValue:
                'Berbeda dari API key, Service Account butuh akses Editor pada spreadsheet supaya bisa write:',
            })}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {renderStep('sharing.step1', 'Buka spreadsheet → klik tombol Share.')}
            {renderStep(
              'sharing.step2',
              'Paste email Service Account (xxx@<project>.iam.gserviceaccount.com).',
            )}
            {renderStep('sharing.step3', 'Pilih role Editor.')}
            {renderStep('sharing.step4', 'Hilangkan centang "Notify people" (SA tidak punya inbox).')}
            {renderStep('sharing.step5', 'Klik Share → Done.')}
          </ol>
        </div>
      </div>

    </section>
  );
}
