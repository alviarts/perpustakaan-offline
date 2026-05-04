import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BukuForm } from '@/features/buku/BukuForm';
import { bukuApi, type Buku } from '@/lib/buku';
import { masterDataApi, type MasterItem } from '@/lib/masterData';
import { toBukuInput } from '@/features/buku/schema';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';

export const Route = createFileRoute('/_authed/buku/$id')({
  component: EditBukuRoute,
});

function EditBukuRoute() {
  const { t } = useTranslation(['buku', 'common']);
  const params = useParams({ from: '/_authed/buku/$id' });
  const navigate = useNavigate();
  const { showToast } = useToast();

  const id = Number(params.id);
  const [item, setItem] = useState<Buku | null>(null);
  const [loading, setLoading] = useState(true);
  const [ddc, setDdc] = useState<MasterItem[]>([]);
  const [kategori, setKategori] = useState<MasterItem[]>([]);
  const [bahasa, setBahasa] = useState<MasterItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      bukuApi.get(id),
      masterDataApi.list('ddc'),
      masterDataApi.list('kategori'),
      masterDataApi.list('bahasa'),
    ])
      .then(([detail, d, k, b]) => {
        if (cancelled) return;
        setItem(detail.buku);
        setDdc(d);
        setKategori(k);
        setBahasa(b);
      })
      .catch((err) => {
        if (cancelled) return;
        showToast({
          variant: 'destructive',
          title: t('buku:feedback.loadError'),
          description: formatTauriError(err),
        });
        void navigate({ to: '/buku' });
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
          <Link to="/buku">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common:actions.back')}
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('buku:form.editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('buku:form.editSubtitle')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : (
        item && (
          <BukuForm
            initial={item}
            ddcOptions={ddc}
            kategoriOptions={kategori}
            bahasaOptions={bahasa}
            submitLabel={t('buku:form.submitUpdate')}
            onCancel={() => void navigate({ to: '/buku' })}
            onDelete={() => setConfirmOpen(true)}
            onSubmit={async (values) => {
              try {
                await bukuApi.update(id, toBukuInput(values));
                showToast({ title: t('buku:feedback.updateSuccess') });
                void navigate({ to: '/buku' });
              } catch (err) {
                showToast({
                  variant: 'destructive',
                  title: t('buku:feedback.updateError', {
                    message: formatTauriError(err),
                  }),
                });
              }
            }}
          />
        )
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('buku:delete.title', { name: item?.judul ?? '' })}
        description={t('buku:delete.description')}
        confirmText={t('common:actions.delete')}
        destructive
        onConfirm={async () => {
          try {
            await bukuApi.remove(id);
            showToast({ title: t('buku:feedback.deleteSuccess') });
            void navigate({ to: '/buku' });
          } catch (err) {
            showToast({
              variant: 'destructive',
              title: t('buku:feedback.deleteError'),
              description: formatTauriError(err),
            });
          }
        }}
      />
    </div>
  );
}
