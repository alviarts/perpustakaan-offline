import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import {
  laporanApi,
  type KasJenis,
  type KasMutationInput,
  type KasRow,
  type KasSumber,
} from '@/lib/laporan';

interface KasFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing row when editing; `null` for a new manual entry. */
  initial: KasRow | null;
  /** Called after a successful create/update so the parent can refetch. */
  onSaved: () => void;
}

const SUMBER_OPTIONS: KasSumber[] = ['manual', 'denda', 'hilang', 'modal'];
const JENIS_OPTIONS: KasJenis[] = ['masuk', 'keluar'];

function todayIso(): string {
  // Local-date ISO string (the kas table stores YYYY-MM-DD in local time, so
  // we deliberately avoid `toISOString()` which would shift timezones).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function KasFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: KasFormDialogProps): JSX.Element {
  const { t } = useTranslation(['laporan', 'common']);
  const { showToast } = useToast();
  const [tanggal, setTanggal] = useState(todayIso());
  const [jenis, setJenis] = useState<KasJenis>('masuk');
  const [sumber, setSumber] = useState<KasSumber>('manual');
  const [nominal, setNominal] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTanggal(initial.tanggal);
      setJenis(initial.jenis);
      setSumber(initial.sumber);
      setNominal(String(initial.nominal));
      setKeterangan(initial.keterangan);
    } else {
      setTanggal(todayIso());
      setJenis('masuk');
      setSumber('manual');
      setNominal('');
      setKeterangan('');
    }
    setError(null);
  }, [open, initial]);

  const isEdit = initial !== null;

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const parsedNominal = Number.parseInt(nominal.replace(/\D/g, ''), 10);
      if (!Number.isFinite(parsedNominal) || parsedNominal <= 0) {
        throw new Error(
          t('laporan:kas.form.errorNominal', { defaultValue: 'Nominal harus lebih besar dari 0.' }),
        );
      }
      if (!keterangan.trim()) {
        throw new Error(
          t('laporan:kas.form.errorKeterangan', { defaultValue: 'Keterangan wajib diisi.' }),
        );
      }
      const payload: KasMutationInput = {
        tanggal,
        keterangan: keterangan.trim(),
        jenis,
        sumber,
        nominal: parsedNominal,
      };
      if (isEdit && initial) {
        await laporanApi.kasUpdate(initial.id, payload);
        showToast({
          title: t('laporan:kas.form.savedUpdate', {
            defaultValue: 'Kas diperbarui.',
          }),
        });
      } else {
        await laporanApi.kasCreate(payload);
        showToast({
          title: t('laporan:kas.form.savedCreate', {
            defaultValue: 'Kas baru tersimpan.',
          }),
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatTauriError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('laporan:kas.form.editTitle', { defaultValue: 'Edit Kas' })
              : t('laporan:kas.form.createTitle', { defaultValue: 'Tambah Kas' })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="kas-tanggal"
              >
                {t('laporan:kas.form.tanggal', { defaultValue: 'Tanggal' })}
              </label>
              <Input
                id="kas-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                data-testid="kas-tanggal"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="kas-nominal"
              >
                {t('laporan:kas.form.nominal', { defaultValue: 'Nominal (Rp)' })}
              </label>
              <Input
                id="kas-nominal"
                inputMode="numeric"
                placeholder="50000"
                value={nominal}
                onChange={(e) => setNominal(e.target.value.replace(/\D/g, ''))}
                data-testid="kas-nominal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('laporan:kas.form.jenis', { defaultValue: 'Jenis' })}
              </label>
              <Select value={jenis} onValueChange={(v) => setJenis(v as KasJenis)}>
                <SelectTrigger data-testid="kas-jenis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JENIS_OPTIONS.map((j) => (
                    <SelectItem key={j} value={j}>
                      {t(`laporan:kas.jenisOption.${j}`, {
                        defaultValue: j === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('laporan:kas.form.sumber', { defaultValue: 'Sumber' })}
              </label>
              <Select value={sumber} onValueChange={(v) => setSumber(v as KasSumber)}>
                <SelectTrigger data-testid="kas-sumber">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUMBER_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`laporan:kas.sumberOption.${s}`, {
                        defaultValue:
                          s === 'manual'
                            ? 'Manual'
                            : s === 'denda'
                              ? 'Denda'
                              : s === 'hilang'
                                ? 'Ganti hilang'
                                : 'Modal',
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="kas-keterangan"
            >
              {t('laporan:kas.form.keterangan', { defaultValue: 'Keterangan' })}
            </label>
            <Input
              id="kas-keterangan"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder={t('laporan:kas.form.keteranganPlaceholder', {
                defaultValue: 'Contoh: Sumbangan wali murid',
              })}
              data-testid="kas-keterangan"
            />
          </div>
          {isEdit && initial && initial.sumber !== 'manual' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              {t('laporan:kas.form.warnAuto', {
                defaultValue:
                  'Entri ini terhubung ke peminjaman / pengembalian otomatis. Perubahan akan tetap dicatat di audit log.',
              })}
            </p>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common:actions.cancel', { defaultValue: 'Batal' })}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="kas-submit">
            {submitting
              ? t('common:states.loading', { defaultValue: 'Menyimpan…' })
              : t('common:actions.save', { defaultValue: 'Simpan' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
