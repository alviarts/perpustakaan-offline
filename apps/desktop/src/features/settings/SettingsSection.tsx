import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface SettingsSectionProps {
  i18nKey: string;
  onReset?: () => void | Promise<void>;
  saving?: boolean;
  onSave?: () => void | Promise<void>;
  testId?: string;
  children: React.ReactNode;
}

/**
 * Shared section header + body shell used by every Settings sub-page.
 *
 * Provides:
 *   - Title + summary (resolved from `settings:sections.<i18nKey>`)
 *   - Optional "Reset bagian ini" button with confirm dialog
 *   - Optional "Simpan" footer button
 */
export function SettingsSection({
  i18nKey,
  onReset,
  onSave,
  saving,
  testId,
  children,
}: SettingsSectionProps): JSX.Element {
  const { t } = useTranslation('settings');
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div
      className="flex flex-col gap-6 rounded-lg border bg-card p-6 shadow-sm"
      data-testid={testId ?? `settings-section-${i18nKey}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {t(`sections.${i18nKey}.label`, { defaultValue: i18nKey })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`sections.${i18nKey}.summary`, { defaultValue: '' })}
          </p>
        </div>
        {onReset && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            data-testid={`settings-reset-${i18nKey}`}
            className="shrink-0"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {t('actions.resetSection', { defaultValue: 'Reset Bagian Ini' })}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">{children}</div>

      {onSave && (
        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            onClick={() => onSave()}
            disabled={saving}
            data-testid={`settings-save-${i18nKey}`}
          >
            {saving
              ? t('actions.save', { defaultValue: 'Simpan' }) + '…'
              : t('actions.save', { defaultValue: 'Simpan' })}
          </Button>
        </div>
      )}

      {onReset && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('actions.resetConfirmTitle', { defaultValue: 'Reset ke nilai default?' })}
          description={t('actions.resetConfirmDescription', {
            defaultValue:
              'Pengaturan di bagian ini akan dikembalikan ke nilai default. Tindakan ini tidak dapat dibatalkan.',
          })}
          confirmText={t('actions.resetSection', { defaultValue: 'Reset Bagian Ini' })}
          destructive
          onConfirm={async () => {
            await onReset();
          }}
        />
      )}
    </div>
  );
}

interface FieldRowProps {
  label: React.ReactNode;
  help?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FieldRow({ label, help, htmlFor, children }: FieldRowProps): JSX.Element {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
