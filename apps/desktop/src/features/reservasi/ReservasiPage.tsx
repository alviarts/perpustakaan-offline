import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, CalendarClock, Plus, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import {
  reservasiApi,
  expiredAtCountdownDays,
  type ReservasiRow,
  type ReservasiStatus,
} from '@/lib/reservasi';
import { CreateReservasiDialog } from './CreateReservasiDialog';

type FilterValue = 'all' | 'menunggu' | 'siap_diambil';

const STATUS_TONE: Record<ReservasiStatus, string> = {
  menunggu: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  siap_diambil: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  diambil: 'bg-muted text-muted-foreground',
  expired: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  dibatalkan: 'bg-muted text-muted-foreground line-through',
};

export function ReservasiPage() {
  const { t } = useTranslation(['reservasi', 'common']);
  const { showToast } = useToast();
  const [rows, setRows] = useState<ReservasiRow[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [loading, setLoading] = useState(true);
  const [pendingCancel, setPendingCancel] = useState<ReservasiRow | null>(null);
  const [pendingPickup, setPendingPickup] = useState<ReservasiRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await reservasiApi.listActive();
      setRows(all);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('reservasi:feedback.loadError', {
          defaultValue: 'Gagal memuat reservasi',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function handleCheckExpired(): Promise<void> {
    try {
      const count = await reservasiApi.checkExpiredTick();
      showToast({
        title: t('reservasi:feedback.checkExpiredDone', {
          count,
          defaultValue: '{{count}} reservasi kedaluwarsa diproses',
        }),
      });
      await reload();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('reservasi:feedback.loadError', {
          defaultValue: 'Gagal memuat reservasi',
        }),
        description: formatTauriError(err),
      });
    }
  }

  async function handleCancel(row: ReservasiRow): Promise<void> {
    setWorking(true);
    try {
      await reservasiApi.cancel(row.id);
      showToast({
        title: t('reservasi:feedback.cancelSuccess', {
          defaultValue: 'Reservasi dibatalkan',
        }),
      });
      setPendingCancel(null);
      await reload();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('reservasi:feedback.cancelError', {
          defaultValue: 'Gagal membatalkan reservasi',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setWorking(false);
    }
  }

  async function handlePickup(row: ReservasiRow): Promise<void> {
    setWorking(true);
    try {
      await reservasiApi.markDiambil(row.id);
      showToast({
        title: t('reservasi:feedback.markDiambilSuccess', {
          defaultValue: 'Reservasi ditandai sudah diambil',
        }),
      });
      setPendingPickup(null);
      await reload();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('reservasi:feedback.markDiambilError', {
          defaultValue: 'Gagal menandai diambil',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setWorking(false);
    }
  }

  function renderCountdown(row: ReservasiRow): React.ReactNode {
    if (row.status !== 'siap_diambil' || !row.expiredAt) return '—';
    const days = expiredAtCountdownDays(row.expiredAt);
    if (days === null) return '—';
    if (days < 0) {
      return (
        <span className="text-rose-600 dark:text-rose-400">
          {t('reservasi:countdown.overdue', {
            count: -days,
            defaultValue: 'Lewat {{count}} hari',
          })}
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="text-amber-600 dark:text-amber-400">
          {t('reservasi:countdown.today', { defaultValue: 'Hari ini' })}
        </span>
      );
    }
    return (
      <span className="text-muted-foreground">
        {t('reservasi:countdown.days', {
          count: days,
          defaultValue: '{{count}} hari lagi',
        })}
      </span>
    );
  }

  const columns: DataTableColumn<ReservasiRow>[] = [
    {
      key: 'urutan',
      header: t('reservasi:column.urutan', { defaultValue: 'Antrian' }),
      className: 'w-20',
      cell: (row) => (
        <Badge variant={row.urutan === 1 ? 'success' : 'outline'}>#{row.urutan}</Badge>
      ),
    },
    {
      key: 'buku',
      header: t('reservasi:column.buku', { defaultValue: 'Buku' }),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.bukuJudul}</span>
          <span className="text-xs text-muted-foreground">{row.bukuKode}</span>
        </div>
      ),
    },
    {
      key: 'anggota',
      header: t('reservasi:column.anggota', { defaultValue: 'Anggota' }),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.anggotaNama}</span>
          <span className="text-xs text-muted-foreground">{row.anggotaKode}</span>
        </div>
      ),
    },
    {
      key: 'tanggalRequest',
      header: t('reservasi:column.tanggalRequest', { defaultValue: 'Tanggal Request' }),
      cell: (row) => row.tanggalRequest,
    },
    {
      key: 'status',
      header: t('reservasi:column.status', { defaultValue: 'Status' }),
      cell: (row) => (
        <span
          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status]}`}
        >
          {t(`reservasi:status.${row.status}`, { defaultValue: row.status })}
        </span>
      ),
    },
    {
      key: 'slot',
      header: t('reservasi:column.slot', { defaultValue: 'Slot Rak' }),
      cell: (row) =>
        row.slotRak ? (
          <span className="font-mono text-sm">{row.slotRak}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'expired',
      header: t('reservasi:column.expired', { defaultValue: 'Kedaluwarsa' }),
      cell: renderCountdown,
    },
    {
      key: 'aksi',
      header: t('reservasi:column.aksi', { defaultValue: 'Aksi' }),
      cellClassName: 'text-right',
      className: 'w-48 text-right',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          {row.status === 'siap_diambil' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingPickup(row)}
              data-testid={`reservasi-pickup-${row.id}`}
            >
              {t('reservasi:action.markDiambil', { defaultValue: 'Tandai Diambil' })}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPendingCancel(row)}
            data-testid={`reservasi-cancel-${row.id}`}
          >
            <X className="mr-1 h-4 w-4" />
            {t('reservasi:action.cancel', { defaultValue: 'Batalkan' })}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="reservasi-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookMarked className="h-6 w-6" />
            {t('reservasi:title', { defaultValue: 'Reservasi Buku' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('reservasi:subtitle', {
              defaultValue:
                'Antrian buku yang sedang dipinjam — anggota lain bisa daftar untuk dipanggil saat buku kembali',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
            <SelectTrigger className="w-44" data-testid="reservasi-filter">
              <SelectValue placeholder={t('reservasi:filter.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('reservasi:filter.all', { defaultValue: 'Semua Aktif' })}
              </SelectItem>
              <SelectItem value="menunggu">
                {t('reservasi:filter.menunggu', { defaultValue: 'Menunggu' })}
              </SelectItem>
              <SelectItem value="siap_diambil">
                {t('reservasi:filter.siap_diambil', { defaultValue: 'Siap Diambil' })}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setCreateOpen(true)}
            data-testid="reservasi-create-open"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('reservasi:action.create', { defaultValue: 'Reservasi (Antri)' })}
          </Button>
          <Button
            variant="outline"
            onClick={handleCheckExpired}
            data-testid="reservasi-check-expired"
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            {t('reservasi:action.checkExpired', { defaultValue: 'Cek Kedaluwarsa' })}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void reload()}
            data-testid="reservasi-refresh"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {t('common:actions.refresh', { defaultValue: 'Muat Ulang' })}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(r) => r.id}
        isLoading={loading}
        empty={t('reservasi:empty', { defaultValue: 'Belum ada reservasi aktif' })}
        data-testid="reservasi-table"
      />

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open && !working) setPendingCancel(null);
        }}
        title={t('reservasi:confirm.cancelTitle', { defaultValue: 'Batalkan Reservasi' })}
        description={t('reservasi:confirm.cancelDesc', {
          defaultValue:
            'Reservasi ini akan ditandai dibatalkan dan antrian berikutnya akan naik ke urutan yang lebih atas. Lanjutkan?',
        })}
        confirmText={
          t('reservasi:confirm.cancelButton', { defaultValue: 'Batalkan' }) as string
        }
        destructive
        onConfirm={() => (pendingCancel ? handleCancel(pendingCancel) : Promise.resolve())}
      />

      <ConfirmDialog
        open={pendingPickup !== null}
        onOpenChange={(open) => {
          if (!open && !working) setPendingPickup(null);
        }}
        title={t('reservasi:confirm.markDiambilTitle', { defaultValue: 'Tandai Diambil' })}
        description={t('reservasi:confirm.markDiambilDesc', {
          nama: pendingPickup?.anggotaNama ?? '',
          judul: pendingPickup?.bukuJudul ?? '',
          slot: pendingPickup?.slotRak ?? '',
          defaultValue:
            'Konfirmasi anggota {{nama}} sudah mengambil buku "{{judul}}" dari rak {{slot}}.',
        })}
        confirmText={
          t('reservasi:confirm.markDiambilButton', {
            defaultValue: 'Tandai Diambil',
          }) as string
        }
        onConfirm={() => (pendingPickup ? handlePickup(pendingPickup) : Promise.resolve())}
      />

      <CreateReservasiDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void reload()}
      />
    </div>
  );
}
