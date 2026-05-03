import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import {
  DEFAULT_CLOSE_BEHAVIOR,
  DEFAULT_DISPLAY_PREFS,
  type CloseBehavior,
  type DisplayPrefs,
  settingsApi,
} from '@/lib/settings';
import { FieldRow, SettingsSection } from './SettingsSection';

const FONT_SCALES = [0.85, 0.9, 1.0, 1.1, 1.2, 1.3];

function applyDisplayPrefs(prefs: DisplayPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--app-font-scale', String(prefs.fontScale));
  root.style.fontSize = `${prefs.fontScale * 100}%`;
  root.dataset.density = prefs.density;
}

export function TampilanPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { showToast } = useToast();
  const { theme, setTheme } = useThemeStore();
  const [prefs, setPrefs] = React.useState<DisplayPrefs>(DEFAULT_DISPLAY_PREFS);
  const [closeBehavior, setCloseBehavior] = React.useState<CloseBehavior>(
    DEFAULT_CLOSE_BEHAVIOR,
  );

  React.useEffect(() => {
    settingsApi.getDisplayPrefs().then((p) => {
      setPrefs(p);
      applyDisplayPrefs(p);
    });
    settingsApi.getCloseBehavior().then(setCloseBehavior).catch(() => undefined);
  }, []);

  const handleSaveCloseBehavior = async (next: CloseBehavior): Promise<void> => {
    setCloseBehavior(next);
    try {
      await settingsApi.saveCloseBehavior(next);
    } catch (e) {
      showToast({
        title: t('sections.identitas.saveError', { defaultValue: 'Gagal menyimpan' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleSavePrefs = async (next: DisplayPrefs): Promise<void> => {
    setPrefs(next);
    applyDisplayPrefs(next);
    try {
      await settingsApi.saveDisplayPrefs(next);
    } catch (e) {
      showToast({
        title: t('sections.identitas.saveError', { defaultValue: 'Gagal menyimpan' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleReset = async (): Promise<void> => {
    setTheme('system');
    const next = await settingsApi.resetDisplayPrefs();
    setPrefs(next);
    applyDisplayPrefs(next);
  };

  return (
    <SettingsSection i18nKey="tampilan" onReset={handleReset}>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow label={t('sections.tampilan.fields.theme', { defaultValue: 'Tema' })}>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger data-testid="tampilan-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label={t('sections.tampilan.fields.fontScale', { defaultValue: 'Skala font' })}>
          <Select
            value={String(prefs.fontScale)}
            onValueChange={(v) => handleSavePrefs({ ...prefs, fontScale: parseFloat(v) })}
          >
            <SelectTrigger data-testid="tampilan-fontscale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SCALES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {Math.round(s * 100)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label={t('sections.tampilan.fields.density', { defaultValue: 'Kerapatan' })}>
          <Select
            value={prefs.density}
            onValueChange={(v) =>
              handleSavePrefs({ ...prefs, density: v as DisplayPrefs['density'] })
            }
          >
            <SelectTrigger data-testid="tampilan-density">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">
                {t('sections.tampilan.density.comfortable', { defaultValue: 'Nyaman' })}
              </SelectItem>
              <SelectItem value="compact">
                {t('sections.tampilan.density.compact', { defaultValue: 'Padat' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mt-2">
        <FieldRow
          label={t('sections.tampilan.fields.closeBehavior', {
            defaultValue: 'Saat tombol X diklik',
          })}
        >
          <Select
            value={closeBehavior}
            onValueChange={(v) => handleSaveCloseBehavior(v as CloseBehavior)}
          >
            <SelectTrigger data-testid="tampilan-close-behavior">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exit">
                {t('sections.tampilan.closeBehavior.exit', {
                  defaultValue: 'Tutup aplikasi sepenuhnya',
                })}
              </SelectItem>
              <SelectItem value="tray">
                {t('sections.tampilan.closeBehavior.tray', {
                  defaultValue: 'Minimize ke system tray',
                })}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            {closeBehavior === 'tray'
              ? t('sections.tampilan.closeBehavior.trayHint', {
                  defaultValue:
                    'Aplikasi tetap berjalan di tray; klik ikon untuk membuka kembali.',
                })
              : t('sections.tampilan.closeBehavior.exitHint', {
                  defaultValue: 'Aplikasi benar-benar keluar dari Task Manager.',
                })}
          </p>
        </FieldRow>
      </div>
    </SettingsSection>
  );
}
