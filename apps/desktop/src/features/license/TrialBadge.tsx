import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  readLicenseState,
  trialDaysLeft,
  trialEndsAt,
  TRIAL_DAYS,
} from '@/lib/license';
import { cn } from '@/lib/utils';

/**
 * Notifikasi hitung mundur trial yang tampil di header selama aplikasi
 * berjalan dalam masa percobaan. Hilang sendiri setelah trial habis /
 * lisensi aktif (saat itu guard akan mengalihkan ke halaman aktivasi).
 */
export function TrialBadge(): JSX.Element | null {
  const { t } = useTranslation('common');
  const [state, setState] = useState(() => readLicenseState());

  // Hitung ulang setiap menit supaya angka hari tetap segar tanpa reload.
  useEffect(() => {
    const timer = window.setInterval(() => setState(readLicenseState()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const daysLeft = trialDaysLeft();
  const endsAt = trialEndsAt();

  if (state.status !== 'trial') return null;

  const urgent = daysLeft <= 7;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/aktivasi"
          data-testid="trial-badge"
          className={cn(
            'hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors sm:flex',
            urgent
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
          )}
        >
          <Clock3 className="h-3.5 w-3.5" />
          {t('license.trialBadge', {
            defaultValue: 'Trial · {{days}} hari tersisa',
            days: daysLeft,
          })}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t('license.trialTooltip', {
          defaultValue: 'Masa trial {{total}} hari berakhir {{date}}. Klik untuk mengaktifkan.',
          total: TRIAL_DAYS,
          date: endsAt.toLocaleDateString('id-ID'),
        })}
      </TooltipContent>
    </Tooltip>
  );
}
