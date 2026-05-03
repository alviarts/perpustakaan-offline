import { useTranslation } from 'react-i18next';
import { BookOpen, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openManual } from '@/lib/manual';
import { useIdentityStore } from '@/stores/identityStore';
import { SettingsSection } from './SettingsSection';

const APP_VERSION = '2.0.0-dev';
const REPO_URL = 'https://github.com/alviarts/perpustakaan-offline';

export function TentangPage(): JSX.Element {
  const { t } = useTranslation('settings');
  const { identity } = useIdentityStore();

  return (
    <SettingsSection i18nKey="tentang">
      <dl className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <dt className="text-sm text-muted-foreground">
          {t('sections.tentang.version', { defaultValue: 'Versi' })}
        </dt>
        <dd className="font-mono text-sm">{APP_VERSION}</dd>

        <dt className="text-sm text-muted-foreground">
          {t('sections.tentang.credits', { defaultValue: 'Kredit' })}
        </dt>
        <dd className="text-sm">
          {t('sections.tentang.creditsValue', { defaultValue: 'alvi arts / vwrks' })}
        </dd>

        <dt className="text-sm text-muted-foreground">
          {t('sections.tentang.license', { defaultValue: 'Lisensi' })}
        </dt>
        <dd className="text-sm">MIT</dd>

        <dt className="text-sm text-muted-foreground">Perpustakaan</dt>
        <dd className="text-sm">{identity.nama}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void openManual(identity)}
          data-testid="tentang-open-manual"
        >
          <BookOpen className="h-4 w-4" />
          {t('sections.tentang.openManual', { defaultValue: 'Buka Manual' })}
        </Button>
        <Button asChild variant="outline">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4" />
            {t('sections.tentang.openRepo', { defaultValue: 'Repositori GitHub' })}
          </a>
        </Button>
      </div>
    </SettingsSection>
  );
}
