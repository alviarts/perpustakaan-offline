import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { BadgeCheck, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_ACTIVATION_URL,
  TRIAL_DAYS,
  activateLicense,
  getMachineId,
  readLicenseState,
  trialDaysLeft,
} from '@/lib/license';

/**
 * Layar Aktivasi / Trial.
 *
 * - Trial 30 hari otomatis sejak pemakaian pertama (tanpa lisensi).
 * - Setelah trial habis, aplikasi terkunci sampai kode aktivasi dimasukkan.
 */
export function Aktivasi() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [url, setUrl] = useState(DEFAULT_ACTIVATION_URL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(readLicenseState());

  const machineId = useMemo(() => getMachineId(), []);
  const daysLeft = useMemo(() => trialDaysLeft(), []);

  useEffect(() => {
    setState(readLicenseState());
  }, []);

  // Sudah aktif → langsung ke dashboard.
  useEffect(() => {
    if (state.status === 'aktif') {
      const timer = window.setTimeout(() => void navigate({ to: '/dashboard' }), 800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state.status, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await activateLicense(code, url);
      setState(readLicenseState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktivasi gagal');
    } finally {
      setSubmitting(false);
    }
  };

  const locked = state.status !== 'aktif' && daysLeft <= 0;

  return (
    <div className="bg-background text-foreground flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-6 rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {state.status === 'aktif' ? (
              <BadgeCheck className="h-6 w-6 text-emerald-600" />
            ) : locked ? (
              <ShieldAlert className="h-6 w-6 text-destructive" />
            ) : (
              <KeyRound className="h-6 w-6 text-primary" />
            )}
          </div>
          <h1 className="text-xl font-semibold">
            {state.status === 'aktif' ? 'Lisensi Aktif' : 'Aktivasi Perpustakaan'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.status === 'aktif'
              ? `Terdaftar${state.licenseId ? ` (${state.licenseId})` : ''}${
                  state.expires ? ` · berlaku s.d. ${state.expires}` : ''
                }`
              : locked
                ? 'Masa trial sudah berakhir. Masukkan kode aktivasi untuk melanjutkan.'
                : `Mode trial: ${daysLeft} dari ${TRIAL_DAYS} hari tersisa.`}
          </p>
        </div>

        {state.status !== 'aktif' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-code">Kode aktivasi</Label>
              <Textarea
                id="license-code"
                rows={3}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PU1.…"
                className="font-mono text-xs"
                data-testid="license-code"
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                ID perangkat: <span className="font-mono">{machineId}</span>
              </p>
            </div>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Pengaturan lanjutan</summary>
              <div className="mt-2 space-y-2">
                <Label htmlFor="license-url">URL aktivasi</Label>
                <Input
                  id="license-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </details>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aktifkan
            </Button>

            {!locked && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void navigate({ to: '/dashboard' })}
              >
                Lanjut dengan trial
              </Button>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
