import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AnggotaForm } from '@/features/anggota/AnggotaForm';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { toAnggotaInput } from '@/features/anggota/schema';
import { useToast } from '@/components/ui/toast-manager';

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      anggotaApi.get(id),
      anggotaApi.distinct('kelas'),
      anggotaApi.distinct('jurusan'),
      anggotaApi.distinct('agama'),
    ])
      .then(([fetched, k, j, a]) => {
        if (cancelled) return;
        setItem(fetched);
        setKelas(k);
        setJurusan(j);
        setAgama(a);
      })
      .catch((err) => {
        if (cancelled) return;
        showToast({
          variant: 'destructive',
          title: t('anggota:feedback.loadError'),
          description: err instanceof Error ? err.message : String(err),
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
    <div className="container mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/anggota">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common:actions.back')}
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('anggota:form.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('anggota:form.editSubtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : item ? (
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
                  message: err instanceof Error ? err.message : String(err),
                }),
              });
            }
          }}
        />
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
                message: err instanceof Error ? err.message : String(err),
              }),
            });
          }
        }}
      />
    </div>
  );
}
