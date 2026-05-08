import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Buku } from '@/lib/buku';
import { assetsApi } from '@/lib/assets';

export interface OpacBookCardProps {
  buku: Buku;
  onClick: (buku: Buku) => void;
}

export function OpacBookCard({ buku, onClick }: OpacBookCardProps): JSX.Element {
  const { t } = useTranslation('opac');
  const available = buku.jumlahTersedia > 0;
  const [imgError, setImgError] = useState(false);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);

  // Resolve cover path (relative → absolute)
  useEffect(() => {
    console.log('[OpacBookCard] buku:', buku.judul, 'coverPath:', buku.coverPath);
    
    if (!buku.coverPath) {
      setResolvedPath(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        console.log('[OpacBookCard] Resolving path:', buku.coverPath);
        const absPath = await assetsApi.resolve(buku.coverPath!);
        console.log('[OpacBookCard] Resolved to:', absPath);
        if (!cancelled) setResolvedPath(absPath);
      } catch (err) {
        console.error('[OpacBookCard] Resolve error:', err);
        if (!cancelled) setResolvedPath(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buku.coverPath]);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onClick(buku)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(buku);
        }
      }}
      className="group cursor-pointer overflow-hidden transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="opac-book-card"
    >
      <div className="relative flex h-40 items-center justify-center bg-muted">
        {buku.coverPath && resolvedPath && !imgError ? (
          <img
            src={`asset://localhost/${encodeURI(resolvedPath.replace(/\\/g, '/'))}`}
            alt={buku.judul}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              console.error('[OpacBookCard] Cover load error:', {
                coverPath: buku.coverPath,
                resolvedPath,
                src: `asset://localhost/${encodeURI(resolvedPath.replace(/\\/g, '/'))}`,
              });
              setImgError(true);
            }}
            onLoad={() => {
              console.log('[OpacBookCard] Cover loaded successfully!', resolvedPath);
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BookOpen className="h-10 w-10" aria-hidden="true" />
            <span className="text-xs">{t('card.noCover')}</span>
          </div>
        )}
        <Badge
          className={cn(
            'absolute right-2 top-2',
            available ? 'bg-emerald-500 text-white hover:bg-emerald-500' : 'bg-amber-500 text-white hover:bg-amber-500',
          )}
        >
          {available ? t('card.available') : t('card.borrowed')}
        </Badge>
      </div>
      <CardContent className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{buku.judul}</h3>
        {buku.pengarang ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{buku.pengarang}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>{t('card.stock', { tersedia: buku.jumlahTersedia, total: buku.jumlahEksemplar })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
