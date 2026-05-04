import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18nStore, type Locale } from '@/stores/i18nStore';

export function LanguageSwitcher() {
  const { t } = useTranslation('common');
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);

  const options: { value: Locale; labelKey: string }[] = [
    { value: 'id', labelKey: 'language.id' },
    { value: 'en', labelKey: 'language.en' },
  ];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('language.label')}>
              <Globe className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('language.label')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40 animate-fade-in">
        {options.map(({ value, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setLocale(value)}
            className="cursor-pointer"
            data-active={locale === value}
          >
            <span className="text-xs uppercase opacity-60 mr-2">{value}</span>
            <span>{t(labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
