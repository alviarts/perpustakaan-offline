import * as React from 'react';
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
import { useToast } from '@/components/ui/toast-manager';
import { getSecurityQuestion, resetViaSecurityQuestion } from '@/lib/auth';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'username' | 'reset';

/**
 * Offline forgot-password flow (PR-5). Two-step modal:
 *
 * 1. Ask for username, fetch the configured security question via
 *    `auth_get_security_question`. If the user has none configured we abort
 *    with a friendly notice that points at Settings → Akun (the admin path).
 * 2. Show the question, collect answer + new password (with confirmation),
 *    submit `auth_reset_via_security_question`. On success we close and toast.
 *
 * Wrong-answer maps to `invalid_credentials` from the backend so the existing
 * error-code switch in Login carries through; we surface a dedicated forgot-
 * specific i18n string here so the error reads correctly inside this dialog.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
}: ForgotPasswordDialogProps): JSX.Element {
  const { t } = useTranslation('auth');
  const { showToast } = useToast();

  const [stage, setStage] = React.useState<Stage>('username');
  const [username, setUsername] = React.useState('');
  const [question, setQuestion] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [errorKey, setErrorKey] = React.useState<string | null>(null);

  const reset = React.useCallback((): void => {
    setStage('username');
    setUsername('');
    setQuestion(null);
    setAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    setErrorKey(null);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean): void => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleLookup = React.useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setErrorKey(null);
      const trimmed = username.trim();
      if (!trimmed) {
        setErrorKey('forgot.feedback.generic');
        return;
      }
      setSubmitting(true);
      try {
        const q = await getSecurityQuestion(trimmed);
        if (!q) {
          setErrorKey('forgot.feedback.noQuestion');
          return;
        }
        setQuestion(q);
        setStage('reset');
      } catch {
        setErrorKey('forgot.feedback.generic');
      } finally {
        setSubmitting(false);
      }
    },
    [username],
  );

  const handleReset = React.useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setErrorKey(null);
      if (newPassword.trim().length < 6) {
        setErrorKey('forgot.feedback.passwordTooShort');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorKey('forgot.feedback.passwordMismatch');
        return;
      }
      setSubmitting(true);
      try {
        await resetViaSecurityQuestion({
          username: username.trim(),
          answer,
          newPassword,
        });
        showToast({ title: t('forgot.feedback.success') });
        handleOpenChange(false);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'generic';
        setErrorKey(
          code === 'invalid_credentials'
            ? 'forgot.feedback.wrongAnswer'
            : code === 'validation'
              ? 'forgot.feedback.passwordTooShort'
              : 'forgot.feedback.generic',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [answer, confirmPassword, handleOpenChange, newPassword, showToast, t, username],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('forgot.title')}</DialogTitle>
          <DialogDescription>{t('forgot.intro')}</DialogDescription>
        </DialogHeader>

        {stage === 'username' ? (
          <form onSubmit={handleLookup} className="space-y-4" data-testid="forgot-step-username">
            <p className="text-muted-foreground text-sm font-medium">
              {t('forgot.steps.username')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="forgot-username">{t('forgot.fields.username')}</Label>
              <Input
                id="forgot-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('forgot.fields.usernamePlaceholder')}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            {errorKey ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
                data-testid="forgot-error"
              >
                {t(errorKey)}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                {t('forgot.actions.cancel')}
              </Button>
              <Button type="submit" disabled={submitting} data-testid="forgot-next">
                {t('forgot.actions.next')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4" data-testid="forgot-step-reset">
            <p className="text-muted-foreground text-sm font-medium">{t('forgot.steps.answer')}</p>
            <div className="space-y-2">
              <Label>{t('forgot.questionLabel')}</Label>
              <p
                className="bg-muted/40 rounded-md border p-3 text-sm font-medium"
                data-testid="forgot-question"
              >
                {question}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-answer">{t('forgot.fields.answer')}</Label>
              <Input
                id="forgot-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t('forgot.fields.answerPlaceholder')}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-new-password">{t('forgot.fields.newPassword')}</Label>
              <Input
                id="forgot-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('forgot.fields.newPasswordPlaceholder')}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-confirm-password">{t('forgot.fields.confirmPassword')}</Label>
              <Input
                id="forgot-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {errorKey ? (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
                data-testid="forgot-error"
              >
                {t(errorKey)}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStage('username');
                  setErrorKey(null);
                }}
                disabled={submitting}
              >
                {t('forgot.actions.back')}
              </Button>
              <Button type="submit" disabled={submitting} data-testid="forgot-submit">
                {t('forgot.actions.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
