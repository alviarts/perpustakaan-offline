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
  DEFAULT_DISPLAY_PREFS,
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

  React.useEffect(() => {
    settingsApi.getDisplayPrefs().then((p) => {
      setPrefs(p);
      applyDisplayPrefs(p);
    });
  }, []);

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
    </SettingsSection>
  );
}
