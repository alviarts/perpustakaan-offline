import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { BookOpen, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useAuthStore } from '@/stores/authStore';
import { useIdentityStore } from '@/stores/identityStore';
import { loginRequest } from '@/lib/auth';

export function Login() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setRememberMe = useAuthStore((s) => s.setRememberMe);
  const identity = useIdentityStore((s) => s.identity);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorKey(null);
    setSubmitting(true);
    try {
      const { user } = await loginRequest({ username, password, rememberMe: remember });
      setUser(user);
      setRememberMe(remember);
      void navigate({ to: '/dashboard' });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'generic';
      setErrorKey(
        code === 'invalid_credentials'
          ? 'login.error.invalid'
          : code === 'inactive'
            ? 'login.error.inactive'
            : 'login.error.generic',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="grid min-h-screen md:grid-cols-2">
        {/* Left: form */}
        <div className="flex items-center justify-center p-6 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('common:tagline')}
                </p>
                <h1 className="text-lg font-semibold">{identity.nama}</h1>
              </div>
            </div>

            <h2 className="text-3xl font-bold tracking-tight">{t('auth:login.title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('auth:login.subtitle', { appName: t('common:appName') })}
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth:login.username')}</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder={t('auth:login.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth:login.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('auth:login.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-accent"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    id="remember"
                  />
                  <span>{t('auth:login.rememberMe')}</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    /* TODO: forgot password — Devin 11 (revisi #4) */
                  }}
                >
                  {t('auth:login.forgot')}
                </button>
              </div>

              {errorKey ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {t(`auth:${errorKey}`)}
                </div>
              ) : null}

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? t('auth:login.submitting') : t('auth:login.submit')}
              </Button>
            </form>
          </motion.div>
        </div>

        {/* Right: gradient + illustration */}
        <div className="relative hidden overflow-hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/40" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative flex h-full flex-col items-center justify-center gap-8 p-12 text-primary-foreground"
          >
            <img
              src="/illustrations/login-illustration.svg"
              alt=""
              aria-hidden="true"
              className="h-72 w-full max-w-md object-contain drop-shadow-xl"
            />
            <div className="flex flex-col items-center gap-2 text-center">
              <BookOpen className="h-10 w-10 opacity-80" strokeWidth={1.5} />
              <p className="max-w-sm text-lg font-medium opacity-95">
                {t('common:tagline')}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
