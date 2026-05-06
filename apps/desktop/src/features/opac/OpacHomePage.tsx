import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ScanLine, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OpacBookCard } from './OpacBookCard';
import { OpacBookDetailDialog } from './OpacBookDetailDialog';
import { bukuApi, type Buku } from '@/lib/buku';

export interface OpacHomePageProps {
  onSearch: (query: string) => void;
  onScanKta: () => void;
  libraryName?: string;
}

const FEATURED_LIMIT = 8;

export function OpacHomePage({ onSearch, onScanKta, libraryName }: OpacHomePageProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [query, setQuery] = useState('');
  const [featured, setFeatured] = useState<Buku[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Buku | null>(null);

  useEffect(() => {
    let cancelled = false;
    bukuApi
      .list({ limit: FEATURED_LIMIT, offset: 0, sortBy: 'tanggalInput', sortDir: 'desc' })
      .then((res) => {
        if (!cancelled) setFeatured(res.items);
      })
      .catch(() => {
        // ignore - home page degrades gracefully without featured row
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSearch(query);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col items-center gap-2 px-6 pb-4 pt-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {libraryName ? libraryName : t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="h-14 pl-12 pr-32 text-lg"
            autoFocus
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
            {t('home.browse')}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="lg" onClick={onScanKta} className="gap-2">
            <ScanLine className="h-5 w-5" />
            {t('home.scanKta')}
          </Button>
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {t('home.scanKtaSubtitle')}
        </p>
      </section>

      <section className="flex-1 overflow-auto px-6 pb-6 pt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <BookOpen className="h-4 w-4" /> {t('home.browse')}
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
        ) : featured.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('search.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {featured.map((b) => (
              <OpacBookCard key={b.id} buku={b} onClick={setSelected} />
            ))}
          </div>
        )}
      </section>

      <OpacBookDetailDialog
        buku={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
