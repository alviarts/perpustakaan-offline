import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OpacBookCard } from './OpacBookCard';
import { OpacBookDetailDialog } from './OpacBookDetailDialog';
import { OpacWishlistDialog } from './OpacWishlistDialog';
import { bukuApi, type Buku } from '@/lib/buku';
import type { Anggota } from '@/lib/anggota';

export interface OpacSearchPageProps {
  initialQuery: string;
  onBack: () => void;
  member?: Anggota | null;
  onReserve?: (buku: Buku) => void;
}

const PAGE_SIZE = 24;

export function OpacSearchPage({
  initialQuery,
  onBack,
  member,
  onReserve,
}: OpacSearchPageProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [items, setItems] = useState<Buku[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Buku | null>(null);
  const [wishlistFor, setWishlistFor] = useState<Buku | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    bukuApi
      .list({
        query: debouncedQuery.trim() || undefined,
        limit: PAGE_SIZE,
        offset: 0,
        sortBy: 'judul',
        sortDir: 'asc',
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const headerCount = useMemo(() => t('search.results', { count: total }), [t, total]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b bg-background/95 p-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 w-fit gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('search.back')}
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="h-12 pl-10 text-lg"
            autoFocus
          />
        </div>
        <p className="text-sm text-muted-foreground">{headerCount}</p>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('search.empty')}</p>
            <Button variant="outline" onClick={() => setWishlistFor({ ...EMPTY_BUKU, judul: query })}>
              {t('detail.wishlist')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((b) => (
              <OpacBookCard key={b.id} buku={b} onClick={setSelected} />
            ))}
          </div>
        )}
      </main>

      <OpacBookDetailDialog
        buku={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        onWishlist={(b) => {
          setSelected(null);
          setWishlistFor(b);
        }}
        guest={!member}
        onReserve={
          onReserve
            ? (b) => {
                onReserve(b);
                setSelected(null);
              }
            : undefined
        }
      />
      <OpacWishlistDialog
        open={wishlistFor !== null}
        onOpenChange={(o) => !o && setWishlistFor(null)}
        defaultJudul={wishlistFor?.judul ?? ''}
        defaultPengarang={wishlistFor?.pengarang ?? ''}
      />
    </div>
  );
}

const EMPTY_BUKU: Buku = {
  id: 0,
  kodeBuku: '',
  judul: '',
  jumlahEksemplar: 0,
  jumlahTersedia: 0,
  harga: 0,
  tanggalInput: '',
  createdAt: '',
  updatedAt: '',
};
