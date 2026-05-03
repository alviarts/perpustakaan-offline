import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnggotaForm } from '@/features/anggota/AnggotaForm';
import { anggotaApi } from '@/lib/anggota';
import { toAnggotaInput } from '@/features/anggota/schema';
import { useToast } from '@/components/ui/toast-manager';

export const Route = createFileRoute('/_authed/anggota/new')({
  component: NewAnggotaRoute,
});

function NewAnggotaRoute() {
  const { t } = useTranslation(['anggota', 'common']);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [kelas, setKelas] = useState<string[]>([]);
  const [jurusan, setJurusan] = useState<string[]>([]);
  const [agama, setAgama] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([
      anggotaApi.distinct('kelas').then(setKelas).catch(() => undefined),
      anggotaApi.distinct('jurusan').then(setJurusan).catch(() => undefined),
      anggotaApi.distinct('agama').then(setAgama).catch(() => undefined),
    ]);
  }, []);

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
        <h1 className="text-2xl font-bold tracking-tight">{t('anggota:form.newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('anggota:form.newSubtitle')}</p>
      </div>

      <AnggotaForm
        kelasOptions={kelas}
        jurusanOptions={jurusan}
        agamaOptions={agama}
        submitLabel={t('anggota:form.submitCreate')}
        onCancel={() => void navigate({ to: '/anggota' })}
        onSubmit={async (values) => {
          try {
            await anggotaApi.create(toAnggotaInput(values));
            showToast({ title: t('anggota:feedback.createSuccess') });
            void navigate({ to: '/anggota' });
          } catch (err) {
            showToast({
              variant: 'destructive',
              title: t('anggota:feedback.createError', {
                message: err instanceof Error ? err.message : String(err),
              }),
            });
          }
        }}
      />
    </div>
  );
}
