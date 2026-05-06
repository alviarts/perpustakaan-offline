import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Monitor, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-manager';
import { SettingsSection } from './SettingsSection';
import { settingsApi, type AppMode } from '@/lib/settings';

export function AksesModePage(): JSX.Element {
  const { t } = useTranslation(['settings', 'opac']);
  const { showToast } = useToast();
  const [mode, setMode] = useState<AppMode>('admin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmTo, setConfirmTo] = useState<AppMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await settingsApi.getAppMode();
        if (!cancelled) setMode(current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (next: AppMode): void => {
    if (next === mode) return;
    setConfirmTo(next);
  };

  const confirmSwitch = async (): Promise<void> => {
    if (confirmTo === null) return;
    setSaving(true);
    try {
      await settingsApi.saveAppMode(confirmTo);
      showToast({
        title: t('settings:sections.aksesMode.feedback.saved', {
          defaultValue: 'Mode akses tersimpan. Memuat ulang…',
        }),
      });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('settings:sections.aksesMode.feedback.error', {
          defaultValue: 'Gagal menyimpan mode akses',
        }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
      setConfirmTo(null);
    }
  };

  return (
    <SettingsSection i18nKey="aksesMode">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          mode="admin"
          active={mode === 'admin'}
          icon={<Users className="h-5 w-5" />}
          title={t('settings:sections.aksesMode.admin.label', { defaultValue: 'Admin' })}
          description={t('settings:sections.aksesMode.admin.description', {
            defaultValue: 'Mode normal untuk pustakawan / petugas.',
          })}
          disabled={loading}
          onSelect={() => handleSelect('admin')}
        />
        <ModeCard
          mode="public"
          active={mode === 'public'}
          icon={<Monitor className="h-5 w-5" />}
          title={t('settings:sections.aksesMode.public.label', { defaultValue: 'Public OPAC' })}
          description={t('settings:sections.aksesMode.public.description', {
            defaultValue: 'Kios fullscreen untuk siswa / pengunjung.',
          })}
          disabled={loading}
          onSelect={() => handleSelect('public')}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t('settings:sections.aksesMode.warning', {
            defaultValue:
              'Setelah berpindah ke Public OPAC, aplikasi reload ke mode kios fullscreen. Untuk kembali ke admin, klik tombol "Mode Admin" di pojok bawah-kanan dan masukkan password admin.',
          })}
        </span>
      </p>

      <Dialog open={confirmTo !== null} onOpenChange={(o) => !o && setConfirmTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmTo === 'public'
                ? t('settings:sections.aksesMode.confirmPublic.title', {
                    defaultValue: 'Beralih ke Public OPAC?',
                  })
                : t('settings:sections.aksesMode.confirmAdmin.title', {
                    defaultValue: 'Beralih ke mode Admin?',
                  })}
            </DialogTitle>
            <DialogDescription>
              {confirmTo === 'public'
                ? t('settings:sections.aksesMode.confirmPublic.description', {
                    defaultValue:
                      'Aplikasi akan reload ke kios fullscreen. Untuk keluar, masuk lewat tombol "Mode Admin".',
                  })
                : t('settings:sections.aksesMode.confirmAdmin.description', {
                    defaultValue: 'Aplikasi akan reload ke mode admin normal.',
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTo(null)} disabled={saving}>
              {t('common:cancel', { defaultValue: 'Batal' })}
            </Button>
            <Button onClick={confirmSwitch} disabled={saving}>
              {saving
                ? '…'
                : t('settings:sections.aksesMode.confirm', { defaultValue: 'Lanjutkan' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

interface ModeCardProps {
  mode: AppMode;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
}

function ModeCard({ mode, active, icon, title, description, disabled, onSelect }: ModeCardProps): JSX.Element {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      data-testid={`akses-mode-card-${mode}`}
      data-active={active ? 'true' : 'false'}
      aria-pressed={active}
      className={`cursor-pointer p-4 transition ${
        active
          ? 'border-primary ring-2 ring-primary'
          : 'hover:border-primary/60 hover:shadow'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}
