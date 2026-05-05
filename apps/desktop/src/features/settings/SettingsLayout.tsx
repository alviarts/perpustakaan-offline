import * as React from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SECTIONS, type SectionWithLabel, filterSections } from './sections';

export function SettingsLayout(): JSX.Element {
  const { t } = useTranslation(['settings', 'common']);
  const [query, setQuery] = React.useState('');

  const sections: SectionWithLabel[] = React.useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        label: t(`settings:sections.${s.i18nKey}.label`, { defaultValue: s.id }),
        summary: t(`settings:sections.${s.i18nKey}.summary`, { defaultValue: '' }),
      })),
    [t],
  );

  const filtered = React.useMemo(() => filterSections(sections, query), [sections, query]);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-6 px-6 pb-10 pt-6"
      data-testid="settings-layout"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('settings:title', { defaultValue: 'Pengaturan' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('settings:subtitle', {
            defaultValue: 'Atur perilaku aplikasi, identitas perpustakaan, akun, dan integrasi.',
          })}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside
          className="flex flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"
          data-testid="settings-sidebar"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="settings-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('settings:search.placeholder', { defaultValue: 'Cari pengaturan…' })}
              className="pl-9"
              aria-label={t('settings:search.placeholder', { defaultValue: 'Cari pengaturan…' })}
            />
          </div>

          {query.trim() && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="settings-search-count"
            >
              {t('settings:search.results', {
                count: filtered.length,
                defaultValue: '{{count}} hasil',
              })}
            </p>
          )}

          <nav className="flex flex-col gap-0.5" data-testid="settings-nav">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {t('settings:search.empty', { defaultValue: 'Tidak ada pengaturan yang cocok.' })}
              </p>
            ) : (
              filtered.map((section) => {
                const Icon = section.Icon;
                return (
                  <Link
                    key={section.id}
                    to={section.to}
                    data-testid={`settings-nav-${section.id}`}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
                      '[&.active]:bg-primary/10 [&.active]:font-medium [&.active]:text-primary',
                    )}
                    activeProps={{ className: 'active' }}
                    title={section.summary}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{section.label}</span>
                      <span className="block truncate text-[0.72rem] font-normal text-muted-foreground">
                        {section.summary}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </nav>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
