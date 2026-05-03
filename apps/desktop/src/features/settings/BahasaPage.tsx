import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18nStore, type Locale } from '@/stores/i18nStore';
import { FieldRow, SettingsSection } from './SettingsSection';

export function BahasaPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { locale, setLocale } = useI18nStore();

  return (
    <SettingsSection
      i18nKey="bahasa"
      onReset={() => {
        setLocale('id');
      }}
    >
      <FieldRow
        label={t('sections.bahasa.fields.language', { defaultValue: 'Bahasa Aplikasi' })}
      >
        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <SelectTrigger data-testid="bahasa-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">Bahasa Indonesia</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </SettingsSection>
  );
}
