import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface OpacWishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJudul?: string;
  defaultPengarang?: string;
  /** When provided, the dialog calls this on submit. If absent, shows a stub note. */
  onSubmit?: (entry: { judul: string; pengarang: string; alasan: string }) => Promise<void>;
}

export function OpacWishlistDialog({
  open,
  onOpenChange,
  defaultJudul = '',
  defaultPengarang = '',
  onSubmit,
}: OpacWishlistDialogProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [judul, setJudul] = useState(defaultJudul);
  const [pengarang, setPengarang] = useState(defaultPengarang);
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setJudul(defaultJudul);
      setPengarang(defaultPengarang);
      setAlasan('');
      setError(null);
      setSuccess(false);
    }
  }, [open, defaultJudul, defaultPengarang]);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    if (!onSubmit) {
      setError(t('wishlist.stub'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ judul: judul.trim(), pengarang: pengarang.trim(), alasan: alasan.trim() });
      setSuccess(true);
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('wishlist.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('wishlist.title')}</DialogTitle>
          <DialogDescription>{onSubmit ? null : t('wishlist.stub')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opac-wishlist-judul">{t('wishlist.judul')}</Label>
            <Input
              id="opac-wishlist-judul"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              required
              disabled={submitting || !onSubmit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opac-wishlist-pengarang">{t('wishlist.pengarang')}</Label>
            <Input
              id="opac-wishlist-pengarang"
              value={pengarang}
              onChange={(e) => setPengarang(e.target.value)}
              disabled={submitting || !onSubmit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opac-wishlist-alasan">{t('wishlist.alasan')}</Label>
            <Input
              id="opac-wishlist-alasan"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              disabled={submitting || !onSubmit}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-emerald-600" role="status">
              {t('wishlist.success')}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t('wishlist.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !onSubmit || judul.trim().length === 0}>
              {submitting ? '…' : t('wishlist.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
