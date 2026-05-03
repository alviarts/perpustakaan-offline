import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useToast } from '@/components/ui/toast-manager';
import { peminjamanApi, type PeminjamanRow } from '@/lib/peminjaman';
import { PeminjamanQuickStatsBar } from './QuickStats';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<string, string> = {
  dipinjam: 'bg-primary/10 text-primary',
  sebagian: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  dikembalikan: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  terlambat: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  hilang: 'bg-rose-700/10 text-rose-700 dark:text-rose-400',
};

export function PeminjamanList() {
  const { t } = useTranslation(['peminjaman', 'common']);
  const { showToast } = useToast();
  const { query, debouncedQuery, setQuery, isPending } = useDebouncedSearch({
    delay: 200,
  });
  const [status, setStatus] = useState<string>('all');
  const [items, setItems] = useState<PeminjamanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey] = useState(0);

  const offset = (page - 1) * PAGE_SIZE;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await peminjamanApi.list({
        query: debouncedQuery,
        status: status === 'all' ? undefined : status,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.loadError', { defaultValue: 'Gagal memuat peminjaman' }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, status, offset, showToast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<PeminjamanRow>[] = [
    {
      key: 'nomorPinjam',
      header: t('peminjaman:column.nomor', { defaultValue: 'No. Pinjam' }),
      cell: (row) => (
        <Link
          to="/peminjaman/$id"
          params={{ id: String(row.id) }}
          className="font-medium text-primary hover:underline"
        >
          {row.nomorPinjam}
        </Link>
      ),
    },
    {
      key: 'anggota',
      header: t('peminjaman:column.anggota', { defaultValue: 'Anggota' }),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.anggotaNama}</span>
          <span className="text-xs text-muted-foreground">{row.anggotaKode}</span>
        </div>
      ),
    },
    {
      key: 'tanggalPinjam',
      header: t('peminjaman:column.tanggal', { defaultValue: 'Tgl Pinjam' }),
      cell: (row) => row.tanggalPinjam,
    },
    {
      key: 'tanggalJatuhTempo',
      header: t('peminjaman:column.jatuhTempo', { defaultValue: 'Jatuh Tempo' }),
      cell: (row) => row.tanggalJatuhTempo,
    },
    {
      key: 'item',
      header: t('peminjaman:column.item', { defaultValue: 'Item' }),
      cell: (row) => `${row.itemDipinjam}/${row.totalItem}`,
    },
    {
      key: 'status',
      header: t('peminjaman:column.status', { defaultValue: 'Status' }),
      cell: (row) => (
        <span
          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
            STATUS_TONE[row.status] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {t(`peminjaman:status.${row.status}`, { defaultValue: row.status })}
        </span>
      ),
    },
    {
      key: 'denda',
      header: t('peminjaman:column.denda', { defaultValue: 'Denda' }),
      cell: (row) =>
        row.totalDenda > 0 ? (
          <span className="font-medium">Rp {row.totalDenda.toLocaleString('id-ID')}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="peminjaman-list">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('peminjaman:title', { defaultValue: 'Peminjaman' })}</h1>
          <p className="text-sm text-muted-foreground">
            {t('peminjaman:subtitle', { defaultValue: 'Kelola aturan peminjaman buku' })}
          </p>
        </div>
        <Button asChild>
          <Link to="/peminjaman/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('peminjaman:action.create', { defaultValue: 'Pinjam Baru' })}
          </Link>
        </Button>
      </div>

      <PeminjamanQuickStatsBar refreshKey={refreshKey} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('peminjaman:searchPlaceholder', { defaultValue: 'Cari nomor / nama / NIS' })}
            className="pl-9"
            data-testid="peminjaman-search"
          />
          {isPending && (
            <Badge
              variant="outline"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            >
              …
            </Badge>
          )}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" data-testid="peminjaman-status-filter">
            <SelectValue placeholder={t('peminjaman:filter.status', { defaultValue: 'Status' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('peminjaman:status.all', { defaultValue: 'Semua' })}</SelectItem>
            <SelectItem value="dipinjam">{t('peminjaman:status.dipinjam', { defaultValue: 'Dipinjam' })}</SelectItem>
            <SelectItem value="sebagian">{t('peminjaman:status.sebagian', { defaultValue: 'Sebagian' })}</SelectItem>
            <SelectItem value="terlambat">{t('peminjaman:status.terlambat', { defaultValue: 'Terlambat' })}</SelectItem>
            <SelectItem value="dikembalikan">{t('peminjaman:status.dikembalikan', { defaultValue: 'Dikembalikan' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        isLoading={loading}
        empty={t('peminjaman:empty', { defaultValue: 'Belum ada peminjaman' })}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('peminjaman:pagination.summary', {
            defaultValue: 'Halaman {{page}} dari {{total}} ({{count}} data)',
            page,
            total: totalPages,
            count: total,
          })}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('common:pagination.prev', { defaultValue: 'Sebelumnya' })}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('common:pagination.next', { defaultValue: 'Berikutnya' })}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
