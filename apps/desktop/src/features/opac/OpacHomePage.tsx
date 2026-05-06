import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronLeft, ChevronRight, ScanLine, Search } from 'lucide-react';
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

const PAGE_SIZE = 24;

export function OpacHomePage({ onSearch, onScanKta, libraryName }: OpacHomePageProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Buku[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Buku | null>(null);

  const fetchPage = useCallback((pageNum: number) => {
    setLoading(true);
    bukuApi
      .list({ limit: PAGE_SIZE, offset: pageNum * PAGE_SIZE, sortBy: 'judul', sortDir: 'asc' })
      .then((res) => {
        setBooks(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setBooks([]);
        setTotal(0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSearch(query);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <BookOpen className="h-4 w-4" /> {t('home.browse')}
            {total > 0 && <span className="font-normal">({total})</span>}
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1}/{totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('search.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {books.map((b) => (
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
