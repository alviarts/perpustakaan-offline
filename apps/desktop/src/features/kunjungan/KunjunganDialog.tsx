import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatTauriError } from '@/lib/errors';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Autocomplete, type AutocompleteOption } from '@/components/shared/Autocomplete';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { kunjunganApi } from '@/lib/kunjungan';

const KEPERLUAN_OPTIONS = ['Membaca', 'Pinjam Buku', 'Tugas', 'Lainnya'];

interface KunjunganDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function KunjunganDialog({ open, onOpenChange, onCreated }: KunjunganDialogProps) {
  const { t } = useTranslation(['kunjungan', 'common']);
  const { showToast } = useToast();
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [anggotaId, setAnggotaId] = useState<number | null>(null);
  const [keperluan, setKeperluan] = useState<string>('Membaca');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    anggotaApi
      .list({ aktif: true, limit: 200 })
      .then((res) => setAnggotaList(res.items))
      .catch(() => setAnggotaList([]));
  }, [open]);

  useEffect(() => {
    if (open) {
      setAnggotaId(null);
      setKeperluan('Membaca');
      setCatatan('');
      setError(null);
    }
  }, [open]);

  const options = useMemo<AutocompleteOption[]>(
    () =>
      anggotaList.map((a) => ({
        value: String(a.id),
        label: a.nama,
        hint: `${a.kodeAnggota}${a.kelas ? ` · ${a.kelas}` : ''}`,
      })),
    [anggotaList],
  );

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await kunjunganApi.create({
        anggotaId,
        keperluan,
        catatan: catatan.trim() || null,
        sumber: 'manual',
      });
      showToast({
        title: t('kunjungan:feedback.created', { defaultValue: 'Kunjungan tercatat' }),
      });
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      setError(formatTauriError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('kunjungan:dialog.title', { defaultValue: 'Catat Kunjungan' })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('kunjungan:dialog.anggota', { defaultValue: 'Anggota (opsional)' })}
            </label>
            <Autocomplete
              options={options}
              value={anggotaId == null ? null : String(anggotaId)}
              onChange={(v) => setAnggotaId(v ? Number(v) : null)}
              placeholder={t('kunjungan:dialog.anggotaPlaceholder', {
                defaultValue: 'Cari nama / NIS — atau biarkan kosong untuk kunjungan tamu',
              })}
              data-testid="kunjungan-anggota-autocomplete"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('kunjungan:dialog.keperluan', { defaultValue: 'Keperluan' })}
            </label>
            <Select value={keperluan} onValueChange={setKeperluan}>
              <SelectTrigger data-testid="kunjungan-keperluan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEPERLUAN_OPTIONS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('kunjungan:dialog.catatan', { defaultValue: 'Catatan' })}
            </label>
            <Input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={t('kunjungan:dialog.catatanPlaceholder', { defaultValue: 'Opsional' })}
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common:actions.cancel', { defaultValue: 'Batal' })}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="kunjungan-submit">
            {submitting
              ? t('common:states.loading', { defaultValue: 'Menyimpan…' })
              : t('kunjungan:dialog.submit', { defaultValue: 'Simpan' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
