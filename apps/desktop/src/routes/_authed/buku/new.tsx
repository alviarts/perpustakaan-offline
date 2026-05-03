import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BukuForm } from '@/features/buku/BukuForm';
import { bukuApi } from '@/lib/buku';
import { masterDataApi, type MasterItem } from '@/lib/masterData';
import { toBukuInput } from '@/features/buku/schema';
import { useToast } from '@/components/ui/toast-manager';

export const Route = createFileRoute('/_authed/buku/new')({
  component: NewBukuRoute,
});

function NewBukuRoute() {
  const { t } = useTranslation(['buku', 'common']);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ddc, setDdc] = useState<MasterItem[]>([]);
  const [kategori, setKategori] = useState<MasterItem[]>([]);
  const [bahasa, setBahasa] = useState<MasterItem[]>([]);

  useEffect(() => {
    void Promise.all([
      masterDataApi.list('ddc').then(setDdc).catch(() => undefined),
      masterDataApi.list('kategori').then(setKategori).catch(() => undefined),
      masterDataApi.list('bahasa').then(setBahasa).catch(() => undefined),
    ]);
  }, []);

  return (
    <div className="container mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/buku">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common:actions.back')}
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('buku:form.newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('buku:form.newSubtitle')}</p>
      </div>

      <BukuForm
        ddcOptions={ddc}
        kategoriOptions={kategori}
        bahasaOptions={bahasa}
        submitLabel={t('buku:form.submitCreate')}
        onCancel={() => void navigate({ to: '/buku' })}
        onSubmit={async (values) => {
          try {
            await bukuApi.create(toBukuInput(values));
            showToast({ title: t('buku:feedback.createSuccess') });
            void navigate({ to: '/buku' });
          } catch (err) {
            showToast({
              variant: 'destructive',
              title: t('buku:feedback.createError', {
                message: err instanceof Error ? err.message : String(err),
              }),
            });
          }
        }}
      />
    </div>
  );
}
