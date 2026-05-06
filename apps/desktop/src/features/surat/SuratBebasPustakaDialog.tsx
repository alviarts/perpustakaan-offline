import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import {
  suratApi,
  type SuratEligibility,
  type SuratGenerateResult,
} from '@/lib/surat';
import { useIdentityStore } from '@/stores/identityStore';
import { downloadSuratPdf } from './pdf';

interface SuratBebasPustakaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anggotaId: number;
}

type DialogState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'eligible'; data: SuratEligibility }
  | { kind: 'ineligible'; data: SuratEligibility }
  | { kind: 'generated'; data: SuratGenerateResult };

export const SuratBebasPustakaDialog: React.FC<SuratBebasPustakaDialogProps> = ({
  open,
  onOpenChange,
  anggotaId,
}) => {
  const { t } = useTranslation(['surat', 'common']);
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);
  const [state, setState] = React.useState<DialogState>({ kind: 'idle' });

  React.useEffect(() => {
    if (!open) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    suratApi
      .checkEligibility(anggotaId)
      .then((data) => {
        if (cancelled) return;
        setState({ kind: data.eligible ? 'eligible' : 'ineligible', data });
      })
      .catch((err) => {
        if (cancelled) return;
        showToast({
          variant: 'destructive',
          title: t('surat:feedback.generateError', {
            message: formatTauriError(err),
          }),
        });
        onOpenChange(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, anggotaId, showToast, t, onOpenChange]);

  const handleGenerate = React.useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await suratApi.generate(anggotaId);
      setState({ kind: 'generated', data });
      showToast({
        title: t('surat:feedback.generated', { nomor: data.nomorSurat }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('surat:feedback.generateError', { message: formatTauriError(err) }),
      });
      setState({ kind: 'idle' });
    }
  }, [anggotaId, showToast, t]);

  const handleDownload = React.useCallback(() => {
    if (state.kind !== 'generated') return;
    downloadSuratPdf({
      result: state.data,
      identity: {
        namaPerpustakaan: identity.nama,
        alamat: identity.alamat,
        kota: undefined,
      },
    });
    showToast({ title: t('surat:feedback.downloadStarted') });
  }, [state, identity, showToast, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="surat-bebas-pustaka-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('surat:dialog.title')}
          </DialogTitle>
          <DialogDescription>{t('surat:subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {state.kind === 'loading' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('surat:dialog.checkingEligibility')}
            </p>
          )}

          {state.kind === 'eligible' && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
              {t('surat:dialog.eligible')}
            </p>
          )}

          {state.kind === 'ineligible' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <p className="font-medium">{t('surat:dialog.notEligible')}</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {!state.data.anggotaAktif && (
                  <li>{t('surat:dialog.summary.inactive')}</li>
                )}
                {state.data.activeLoans > 0 && (
                  <li>
                    {t('surat:dialog.summary.activeLoans', {
                      count: state.data.activeLoans,
                    })}
                  </li>
                )}
                {state.data.outstandingDenda > 0 && (
                  <li>
                    {t('surat:dialog.summary.outstandingDenda', {
                      amount: state.data.outstandingDenda.toLocaleString('id-ID'),
                    })}
                  </li>
                )}
              </ul>
            </div>
          )}

          {state.kind === 'generated' && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t('surat:dialog.preview.nomorSurat')}</dt>
              <dd className="font-mono">{state.data.nomorSurat}</dd>
              <dt className="text-muted-foreground">{t('surat:dialog.preview.tanggal')}</dt>
              <dd>{state.data.tanggalCetak}</dd>
              <dt className="text-muted-foreground">{t('surat:dialog.preview.anggota')}</dt>
              <dd>
                {state.data.anggotaNama}{' '}
                <span className="text-muted-foreground">({state.data.anggotaKode})</span>
              </dd>
              {state.data.anggotaKelas && (
                <>
                  <dt className="text-muted-foreground">{t('surat:dialog.preview.kelas')}</dt>
                  <dd>{state.data.anggotaKelas}</dd>
                </>
              )}
            </dl>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('surat:button.tutup')}
          </Button>
          {state.kind === 'eligible' && (
            <Button onClick={handleGenerate} data-testid="surat-cetak-button">
              {t('surat:button.cetak')}
            </Button>
          )}
          {state.kind === 'generated' && (
            <Button onClick={handleDownload} data-testid="surat-download-button">
              {t('surat:button.download')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
