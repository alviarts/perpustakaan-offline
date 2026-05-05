import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, History, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AnggotaForm } from '@/features/anggota/AnggotaForm';
import { AnggotaRiwayatPanel } from '@/features/anggota/AnggotaRiwayatPanel';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { toAnggotaInput } from '@/features/anggota/schema';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import { cn } from '@/lib/utils';

type AnggotaDetailTab = 'edit' | 'history';

export const Route = createFileRoute('/_authed/anggota/$id')({
  component: EditAnggotaRoute,
});

function EditAnggotaRoute() {
  const { t } = useTranslation(['anggota', 'common']);
  const params = useParams({ from: '/_authed/anggota/$id' });
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = Number(params.id);
  const [item, setItem] = useState<Anggota | null>(null);
  const [loading, setLoading] = useState(true);
  const [kelas, setKelas] = useState<string[]>([]);
  const [jurusan, setJurusan] = useState<string[]>([]);
  const [agama, setAgama] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<AnggotaDetailTab>('edit');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([anggotaApi.get(id), anggotaApi.loadFormOptions()])
      .then(([fetched, options]) => {
        if (cancelled) return;
        setItem(fetched);
        setKelas(options.kelas);
        setJurusan(options.jurusan);
        setAgama(options.agama);
      })
      .catch((err) => {
        if (cancelled) return;
        showToast({
          variant: 'destructive',
          title: t('anggota:feedback.loadError'),
          description: formatTauriError(err),
        });
        void navigate({ to: '/anggota' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate, showToast, t]);

  return (
    <div className="container mx-auto max-w-3xl xl:max-w-5xl 2xl:max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/anggota">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common:actions.back')}
          </Link>
        </Button>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('anggota:form.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('anggota:form.editSubtitle')}</p>
      </div>

      <div
        role="tablist"
        aria-label={t('anggota:detail.tabsLabel', { defaultValue: 'Detail anggota' })}
        className="mb-6 inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1 text-sm"
      >
        <TabButton
          active={tab === 'edit'}
          onClick={() => setTab('edit')}
          icon={<Pencil className="h-3.5 w-3.5" />}
          testid="anggota-tab-edit"
        >
          {t('anggota:detail.tab.edit', { defaultValue: 'Edit Profil' })}
        </TabButton>
        <TabButton
          active={tab === 'history'}
          onClick={() => setTab('history')}
          icon={<History className="h-3.5 w-3.5" />}
          testid="anggota-tab-history"
        >
          {t('anggota:detail.tab.history', { defaultValue: 'Riwayat Peminjaman' })}
        </TabButton>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : item && tab === 'edit' ? (
        <AnggotaForm
          initial={item}
          kelasOptions={kelas}
          jurusanOptions={jurusan}
          agamaOptions={agama}
          submitLabel={t('anggota:form.submitUpdate')}
          onCancel={() => void navigate({ to: '/anggota' })}
          onDelete={() => setConfirmOpen(true)}
          onSubmit={async (values) => {
            try {
              await anggotaApi.update(id, toAnggotaInput(values));
              showToast({ title: t('anggota:feedback.updateSuccess') });
              void navigate({ to: '/anggota' });
            } catch (err) {
              showToast({
                variant: 'destructive',
                title: t('anggota:feedback.updateError', {
                  message: formatTauriError(err),
                }),
              });
            }
          }}
        />
      ) : item ? (
        <AnggotaRiwayatPanel anggotaId={item.id} />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title={item ? t('anggota:delete.confirmTitle', { nama: item.nama }) : ''}
        description={t('anggota:delete.confirmDescription')}
        confirmText={t('common:actions.delete')}
        onConfirm={async () => {
          try {
            await anggotaApi.remove(id);
            showToast({ title: t('anggota:feedback.deleteSuccess') });
            void navigate({ to: '/anggota' });
          } catch (err) {
            showToast({
              variant: 'destructive',
              title: t('anggota:feedback.deleteError', {
                message: formatTauriError(err),
              }),
            });
          }
        }}
      />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  testid?: string;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon, testid, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testid}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
