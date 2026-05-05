import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Autocomplete, type AutocompleteOption } from '@/components/shared/Autocomplete';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { bukuApi, type Buku } from '@/lib/buku';
import { reservasiApi } from '@/lib/reservasi';
import { formatTauriError } from '@/lib/errors';

interface CreateReservasiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create — the page should refresh its list. */
  onCreated: () => void;
}

export function CreateReservasiDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateReservasiDialogProps): React.ReactElement {
  const { t } = useTranslation(['reservasi', 'common', 'peminjaman']);
  const { showToast } = useToast();
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [bukuList, setBukuList] = useState<Buku[]>([]);
  const [anggotaId, setAnggotaId] = useState<string | null>(null);
  const [bukuId, setBukuId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    Promise.all([
      anggotaApi.list({ aktif: true, limit: 200 }).catch(() => ({ items: [] as Anggota[] })),
      bukuApi.list({ limit: 200 }).catch(() => ({ items: [] as Buku[] })),
    ]).then(([a, b]) => {
      if (cancel) return;
      setAnggotaList((a as { items: Anggota[] }).items ?? []);
      setBukuList((b as { items: Buku[] }).items ?? []);
    });
    return () => {
      cancel = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setAnggotaId(null);
      setBukuId(null);
    }
  }, [open]);

  const anggotaOptions: AutocompleteOption[] = useMemo(
    () =>
      anggotaList.map((a) => ({
        value: String(a.id),
        label: a.nama,
        hint: a.kodeAnggota,
      })),
    [anggotaList],
  );

  const bukuOptions: AutocompleteOption[] = useMemo(
    () =>
      bukuList.map((b) => ({
        value: String(b.id),
        label: b.judul,
        hint: b.kodeBuku ?? null,
      })),
    [bukuList],
  );

  const selectedAnggota = useMemo(
    () => anggotaList.find((a) => String(a.id) === anggotaId) ?? null,
    [anggotaList, anggotaId],
  );

  const selectedBuku = useMemo(
    () => bukuList.find((b) => String(b.id) === bukuId) ?? null,
    [bukuList, bukuId],
  );

  const canSubmit = anggotaId !== null && bukuId !== null && !submitting;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || anggotaId === null || bukuId === null) return;
    setSubmitting(true);
    try {
      const row = await reservasiApi.create({
        anggotaId: Number(anggotaId),
        bukuId: Number(bukuId),
      });
      showToast({
        title: t('reservasi:feedback.createSuccess', {
          urutan: row.urutan,
          defaultValue: 'Reservasi dibuat — urutan ke-{{urutan}}',
        }),
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('reservasi:feedback.createError', {
          defaultValue: 'Gagal membuat reservasi',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!submitting ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="reservasi-create-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('reservasi:confirm.createTitle', { defaultValue: 'Buat Reservasi' })}
          </DialogTitle>
          <DialogDescription>
            {t('reservasi:confirm.createDesc', {
              nama: selectedAnggota?.nama ?? '—',
              judul: selectedBuku?.judul ?? '—',
              defaultValue:
                'Anggota {{nama}} akan masuk antrian untuk buku "{{judul}}". Lanjutkan?',
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('reservasi:column.anggota', { defaultValue: 'Anggota' })}
            </label>
            <Autocomplete
              options={anggotaOptions}
              value={anggotaId}
              onChange={setAnggotaId}
              placeholder={t('peminjaman:form.anggotaPlaceholder', {
                defaultValue: 'Pilih anggota…',
              })}
              data-testid="reservasi-create-anggota"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('reservasi:column.buku', { defaultValue: 'Buku' })}
            </label>
            <Autocomplete
              options={bukuOptions}
              value={bukuId}
              onChange={setBukuId}
              placeholder={t('peminjaman:form.bukuPlaceholder', {
                defaultValue: 'Pilih buku…',
              })}
              data-testid="reservasi-create-buku"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="reservasi-create-cancel"
          >
            {t('common:actions.cancel', { defaultValue: 'Batal' })}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            data-testid="reservasi-create-submit"
          >
            {t('reservasi:confirm.createButton', { defaultValue: 'Masukkan Antrian' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
