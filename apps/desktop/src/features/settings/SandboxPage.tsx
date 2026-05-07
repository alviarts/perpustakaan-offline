import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/toast-manager';
import { sandboxApi, type SandboxStatus } from '@/lib/sandbox';
import { SettingsSection } from './SettingsSection';

/**
 * D5-SandboxDemoMode — Settings sub-page that toggles sandbox mode. Both
 * enable and disable trigger a hard reload after the RPC succeeds so every
 * cache (React Query, Zustand, route loaders) re-fetches against the new
 * active connection.
 */
export function SandboxPage(): JSX.Element {
  const { t } = useTranslation(['settings', 'common']);
  const { showToast } = useToast();
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirm, setConfirm] = useState<'enable' | 'disable' | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await sandboxApi.status();
        if (!cancelled) setStatus(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onConfirm = async (): Promise<void> => {
    if (confirm === null) return;
    setSaving(true);
    try {
      const next = confirm === 'enable' ? await sandboxApi.enable() : await sandboxApi.disable();
      setStatus(next);
      showToast({
        title:
          confirm === 'enable'
            ? t('settings:sections.sandbox.enabledToast', {
                defaultValue: 'Mode Demo aktif. Memuat ulang…',
              })
            : t('settings:sections.sandbox.disabledToast', {
                defaultValue: 'Mode Demo dinonaktifkan. Memuat ulang…',
              }),
      });
      if (typeof window !== 'undefined') window.location.reload();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('settings:sections.sandbox.error', {
          defaultValue: 'Gagal mengubah Mode Demo',
        }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const active = status?.active ?? false;

  return (
    <SettingsSection i18nKey="sandbox">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4">
          {active ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {active
                ? t('settings:sections.sandbox.activeTitle', {
                    defaultValue: 'Mode Demo aktif',
                  })
                : t('settings:sections.sandbox.inactiveTitle', {
                    defaultValue: 'Mode Demo nonaktif',
                  })}
            </p>
            <p className="text-sm text-muted-foreground">
              {active
                ? t('settings:sections.sandbox.activeDescription', {
                    defaultValue:
                      'Aplikasi sedang menyentuh database demo terpisah. Backup otomatis dilewati selama mode demo aktif.',
                  })
                : t('settings:sections.sandbox.inactiveDescription', {
                    defaultValue:
                      'Mengaktifkan mode demo akan menyalin database asli ke `demo.db` dan memuat ulang aplikasi.',
                  })}
            </p>
          </div>
        </div>

        <dl className="grid gap-2 rounded-md border p-4 text-sm" data-testid="sandbox-paths">
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-muted-foreground">
              {t('settings:sections.sandbox.activeDb', { defaultValue: 'DB aktif' })}
            </dt>
            <dd className="break-all font-mono text-xs">
              {loading ? '…' : status?.dbPath ?? '—'}
            </dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-muted-foreground">
              {t('settings:sections.sandbox.prodDb', { defaultValue: 'DB asli' })}
            </dt>
            <dd className="break-all font-mono text-xs">
              {loading ? '…' : status?.prodDbPath ?? '—'}
            </dd>
          </div>
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-muted-foreground">
              {t('settings:sections.sandbox.demoDb', { defaultValue: 'DB demo' })}
            </dt>
            <dd className="break-all font-mono text-xs">
              {loading ? '…' : status?.demoDbPath ?? '—'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {!active ? (
            <Button
              onClick={() => setConfirm('enable')}
              disabled={loading || saving}
              data-testid="sandbox-enable-btn"
            >
              {t('settings:sections.sandbox.enable', { defaultValue: 'Aktifkan Mode Demo' })}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setConfirm('disable')}
              disabled={loading || saving}
              data-testid="sandbox-disable-btn"
            >
              {t('settings:sections.sandbox.disable', { defaultValue: 'Kembali ke Mode Asli' })}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm === 'enable'
            ? t('settings:sections.sandbox.confirmEnableTitle', {
                defaultValue: 'Aktifkan Mode Demo?',
              })
            : t('settings:sections.sandbox.confirmDisableTitle', {
                defaultValue: 'Nonaktifkan Mode Demo?',
              })
        }
        description={
          confirm === 'enable'
            ? t('settings:sections.sandbox.confirmEnableDescription', {
                defaultValue:
                  'Database asli akan disalin ke demo.db. Aplikasi akan dimuat ulang dan semua perubahan berikutnya tidak menyentuh data asli.',
              })
            : t('settings:sections.sandbox.confirmDisableDescription', {
                defaultValue:
                  'Database demo akan diarsipkan dan aplikasi kembali ke data asli setelah memuat ulang.',
              })
        }
        confirmText={
          confirm === 'enable'
            ? t('settings:sections.sandbox.enable', { defaultValue: 'Aktifkan Mode Demo' })
            : t('settings:sections.sandbox.disable', { defaultValue: 'Kembali ke Mode Asli' })
        }
        cancelText={t('common:actions.cancel', { defaultValue: 'Batal' })}
        destructive={confirm === 'disable'}
        onConfirm={onConfirm}
      />
    </SettingsSection>
  );
}
