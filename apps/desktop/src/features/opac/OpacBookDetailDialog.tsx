import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Heart, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { bukuApi, type Buku, type BukuDetail } from '@/lib/buku';

export interface OpacBookDetailDialogProps {
  buku: Buku | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWishlist?: (buku: Buku) => void;
  onReserve?: (buku: Buku) => void;
  /** When true, hide reserve / wishlist actions (no member session) */
  guest?: boolean;
}

export function OpacBookDetailDialog({
  buku,
  open,
  onOpenChange,
  onWishlist,
  onReserve,
  guest = true,
}: OpacBookDetailDialogProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [detail, setDetail] = useState<BukuDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !buku) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    bukuApi
      .get(buku.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setDetail({ buku, eksemplar: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, buku]);

  if (!buku) return <></>;

  const display = detail?.buku ?? buku;
  const available = display.jumlahTersedia > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{display.judul}</DialogTitle>
          {display.pengarang ? (
            <DialogDescription>{display.pengarang}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="flex h-56 items-center justify-center rounded-md bg-muted">
            {display.coverPath ? (
              <img
                src={display.coverPath}
                alt={display.judul}
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-2 text-sm">
            <Badge variant={available ? 'default' : 'secondary'} className={available ? 'bg-emerald-500 hover:bg-emerald-500' : ''}>
              {t('detail.stockTersedia', {
                tersedia: display.jumlahTersedia,
                total: display.jumlahEksemplar,
              })}
            </Badge>
            {display.penerbit ? (
              <p>
                <span className="text-muted-foreground">{t('detail.penerbit')}: </span>
                {display.penerbit}
                {display.tahunTerbit ? ` (${display.tahunTerbit})` : ''}
              </p>
            ) : null}
            {display.kategori ? (
              <p>
                <span className="text-muted-foreground">{t('detail.kategori')}: </span>
                {display.kategori}
              </p>
            ) : null}
            {display.kodeDdc ? (
              <p>
                <span className="text-muted-foreground">{t('detail.ddc')}: </span>
                {display.kodeDdc}
              </p>
            ) : null}
            {display.isbn ? (
              <p>
                <span className="text-muted-foreground">{t('detail.isbn')}: </span>
                {display.isbn}
              </p>
            ) : null}
            {display.rak ? (
              <p className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-muted-foreground">{t('detail.rak')}: </span>
                {display.rak}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t('detail.deskripsi')}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm">
            {display.deskripsi || t('detail.noDescription')}
          </p>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">{t('search.loading')}</p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('detail.close')}
          </Button>
          <div className="flex gap-2">
            {onWishlist ? (
              <Button
                variant="outline"
                onClick={() => onWishlist(display)}
                title={t('detail.wishlistTooltip')}
                className="gap-2"
              >
                <Heart className="h-4 w-4" />
                {t('detail.wishlist')}
              </Button>
            ) : null}
            {onReserve && !guest ? (
              <Button
                onClick={() => onReserve(display)}
                disabled={available}
                title={t('detail.reserveTooltip')}
              >
                {t('detail.reserve')}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
