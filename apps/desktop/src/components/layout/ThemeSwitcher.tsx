import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore, type Theme } from '@/stores/themeStore';

export function ThemeSwitcher() {
  const { t } = useTranslation('common');
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const items: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: 'light', icon: Sun, labelKey: 'theme.light' },
    { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
    { value: 'system', icon: Monitor, labelKey: 'theme.system' },
  ];

  const ActiveIcon = items.find((i) => i.value === theme)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme.label')}>
          <ActiveIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 animate-fade-in">
        {items.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="cursor-pointer gap-2"
            data-active={theme === value}
          >
            <Icon className="h-4 w-4" />
            <span>{t(labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
