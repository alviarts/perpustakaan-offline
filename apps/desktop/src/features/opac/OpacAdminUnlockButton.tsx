import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
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

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60 * 1000;

export interface OpacAdminUnlockButtonProps {
  /** Returns true on success, false on bad credentials. Throws on network error. */
  onVerify: (username: string, password: string) => Promise<boolean>;
  onSuccess: () => void;
}

export function OpacAdminUnlockButton({ onVerify, onSuccess }: OpacAdminUnlockButtonProps): JSX.Element {
  const { t } = useTranslation('opac');
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil === null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockedSecondsRemaining =
    lockedUntil !== null ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLocked = lockedUntil !== null && lockedSecondsRemaining > 0;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (isLocked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onVerify(username.trim(), password);
      if (ok) {
        setOpen(false);
        onSuccess();
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setPassword('');
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setAttempts(0);
        setError(t('admin.tooManyTries', { seconds: Math.round(LOCKOUT_MS / 1000) }));
      } else {
        setError(t('admin.wrongPassword'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setError(null);
      setPassword('');
    }
    setOpen(next);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Lock className="h-3.5 w-3.5" />
        {t('admin.unlockButton')}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.unlockTitle')}</DialogTitle>
            <DialogDescription>{t('admin.unlockDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opac-unlock-username">{t('admin.username')}</Label>
              <Input
                id="opac-unlock-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isLocked || submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opac-unlock-password">{t('admin.password')}</Label>
              <Input
                id="opac-unlock-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLocked || submitting}
                autoFocus
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
                {isLocked
                  ? ` (${t('admin.lockedFor', { seconds: lockedSecondsRemaining })})`
                  : null}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                {t('admin.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isLocked || submitting || password.length === 0}
              >
                {submitting ? '…' : t('admin.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
