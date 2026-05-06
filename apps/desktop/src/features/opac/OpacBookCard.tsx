import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Buku } from '@/lib/buku';

export interface OpacBookCardProps {
  buku: Buku;
  onClick: (buku: Buku) => void;
}

export function OpacBookCard({ buku, onClick }: OpacBookCardProps): JSX.Element {
  const { t } = useTranslation('opac');
  const available = buku.jumlahTersedia > 0;

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
        {buku.coverPath ? (
          <img
            src={buku.coverPath}
            alt={buku.judul}
            className="h-full w-full object-cover"
            loading="lazy"
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
        {buku.rak ? (
          <p className="text-xs text-muted-foreground">{t('card.rak', { kode: buku.rak })}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
