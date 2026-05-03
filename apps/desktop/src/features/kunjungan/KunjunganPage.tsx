import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useToast } from '@/components/ui/toast-manager';
import { kunjunganApi, rangeForPreset, type KunjunganRow } from '@/lib/kunjungan';
import { KunjunganBackdrop } from './KunjunganBackdrop';
import { KunjunganQuickStatsBar } from './QuickStats';
import { KunjunganDialog } from './KunjunganDialog';

const SUMBER_TONE: Record<KunjunganRow['sumber'], string> = {
  manual: 'bg-primary/10 text-primary',
  peminjaman: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pengembalian: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  kelas: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function KunjunganPage() {
  const { t } = useTranslation(['kunjungan', 'common']);
  const { showToast } = useToast();
  const { query, debouncedQuery, setQuery } = useDebouncedSearch({ delay: 200 });
  const [range, setRange] = useState(() => rangeForPreset('week'));
  const [rows, setRows] = useState<KunjunganRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    kunjunganApi
      .list({
        query: debouncedQuery,
        from: range.from,
        to: range.to,
        limit: 100,
      })
      .then((res) => {
        if (cancel) return;
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancel) return;
        showToast({
          variant: 'destructive',
          title: t('kunjungan:feedback.loadError', { defaultValue: 'Gagal memuat kunjungan' }),
          description: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [debouncedQuery, range, refreshKey, showToast, t]);

  async function handleDelete(id: number): Promise<void> {
    try {
      await kunjunganApi.remove(id);
      setRefreshKey((k) => k + 1);
      showToast({
        title: t('kunjungan:feedback.deleted', { defaultValue: 'Kunjungan dihapus' }),
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('kunjungan:feedback.deleteError', { defaultValue: 'Gagal menghapus kunjungan' }),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="relative flex flex-col gap-6 p-6" data-testid="kunjungan-page">
      <KunjunganBackdrop />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('kunjungan:title', { defaultValue: 'Kunjungan' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('kunjungan:subtitle', {
              defaultValue: 'Catat & monitor kunjungan harian perpustakaan',
            })}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="kunjungan-add">
          <Plus className="mr-2 h-4 w-4" />
          {t('kunjungan:action.add', { defaultValue: 'Tambah Kunjungan' })}
        </Button>
      </div>

      <KunjunganQuickStatsBar refreshKey={refreshKey} />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('kunjungan:searchPlaceholder', {
                defaultValue: 'Cari nama / kode / keperluan',
              })}
              data-testid="kunjungan-search"
            />
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm" data-testid="kunjungan-table">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.tanggal', { defaultValue: 'Tanggal' })}
                  </th>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.jam', { defaultValue: 'Jam' })}
                  </th>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.anggota', { defaultValue: 'Anggota' })}
                  </th>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.kelas', { defaultValue: 'Kelas' })}
                  </th>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.keperluan', { defaultValue: 'Keperluan' })}
                  </th>
                  <th className="px-3 py-2">
                    {t('kunjungan:column.sumber', { defaultValue: 'Sumber' })}
                  </th>
                  <th className="w-[1%] px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {t('common:states.loading', { defaultValue: 'Memuat…' })}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {t('kunjungan:empty', {
                        defaultValue: 'Belum ada kunjungan pada rentang ini',
                      })}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.tanggal}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.jam.slice(0, 5)}</td>
                      <td className="px-3 py-2">
                        {r.anggotaNama ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{r.anggotaNama}</span>
                            <span className="text-xs text-muted-foreground">{r.anggotaKode}</span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            {t('kunjungan:guest', { defaultValue: 'Tamu' })}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.anggotaKelas ?? r.kelas ?? '—'}
                      </td>
                      <td className="px-3 py-2">{r.keperluan ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${SUMBER_TONE[r.sumber]}`}
                        >
                          {t(`kunjungan:sumber.${r.sumber}`, { defaultValue: r.sumber })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.sumber === 'manual' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(r.id)}
                            aria-label={t('common:actions.delete', { defaultValue: 'Hapus' })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <Badge variant="outline">{total}</Badge>{' '}
              {t('kunjungan:totalRecords', { defaultValue: 'kunjungan dalam rentang' })}
            </span>
            <span>
              {range.from} → {range.to}
            </span>
          </div>
        </CardContent>
      </Card>

      <KunjunganDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
