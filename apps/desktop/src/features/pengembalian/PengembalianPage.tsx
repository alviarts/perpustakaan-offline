import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Check, Loader2, Search, Undo2, User2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useToast } from '@/components/ui/toast-manager';
import { calculateDenda, peminjamanApi, type PeminjamanDetail, type PeminjamanRow } from '@/lib/peminjaman';
import { formatTauriError } from '@/lib/errors';

const DENDA_PER_HARI = 500;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PengembalianPage() {
  const { t } = useTranslation(['peminjaman', 'common']);
  const { showToast } = useToast();
  const { query, debouncedQuery, setQuery } = useDebouncedSearch({ delay: 200 });

  const [results, setResults] = useState<PeminjamanRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeminjamanDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bayar, setBayar] = useState<string>('0');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancel = false;
    setSearching(true);
    peminjamanApi
      .search(debouncedQuery)
      .then((rows) => {
        if (!cancel) setResults(rows);
      })
      .catch(() => {
        if (!cancel) setResults([]);
      })
      .finally(() => {
        if (!cancel) setSearching(false);
      });
    return () => {
      cancel = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (activeId == null) {
      setDetail(null);
      setSelected(new Set());
      return;
    }
    let cancel = false;
    peminjamanApi
      .get(activeId)
      .then((d) => {
        if (cancel) return;
        setDetail(d);
        setSelected(new Set(d.items.filter((i) => i.status === 'dipinjam').map((i) => i.id)));
      })
      .catch((err) => {
        if (cancel) return;
        showToast({
          variant: 'destructive',
          title: t('peminjaman:feedback.loadError', { defaultValue: 'Gagal memuat detail' }),
          description: formatTauriError(err),
        });
      });
    return () => {
      cancel = true;
    };
  }, [activeId, showToast, t]);

  const dendaPreview = useMemo(() => {
    if (!detail) return { hariTerlambat: 0, denda: 0 };
    return calculateDenda(detail.header.tanggalJatuhTempo, todayIso(), DENDA_PER_HARI);
  }, [detail]);

  function toggle(itemId: number): void {
    const next = new Set(selected);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelected(next);
  }

  async function handleReturn(): Promise<void> {
    if (!detail || selected.size === 0) return;
    setSubmitting(true);
    try {
      await peminjamanApi.kembalikan({
        peminjamanId: detail.header.id,
        itemIds: Array.from(selected),
        bayar: Number(bayar) || 0,
      });
      showToast({
        title: t('peminjaman:feedback.returned', { defaultValue: 'Pengembalian berhasil' }),
      });
      // Reload detail and refresh search results
      const refreshed = await peminjamanApi.get(detail.header.id);
      setDetail(refreshed);
      const newSelected = new Set(refreshed.items.filter((i) => i.status === 'dipinjam').map((i) => i.id));
      setSelected(newSelected);
      const rows = await peminjamanApi.search(debouncedQuery);
      setResults(rows);
      if (refreshed.header.status === 'dikembalikan') {
        setActiveId(null);
      }
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.returnError', { defaultValue: 'Gagal mengembalikan' }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const activeItems = detail?.items.filter((i) => i.status === 'dipinjam') ?? [];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="pengembalian-page">
      <div>
        <h1 className="text-2xl font-semibold">
          {t('peminjaman:pengembalian.title', { defaultValue: 'Pengembalian' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('peminjaman:pengembalian.subtitle', {
            defaultValue: 'Cari peminjaman aktif lalu pilih item yang dikembalikan',
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('peminjaman:pengembalian.search', { defaultValue: 'Cari Peminjaman Aktif' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('peminjaman:pengembalian.searchPlaceholder', {
                  defaultValue: 'Nomor / nama / NIS',
                })}
                className="pl-9"
                data-testid="pengembalian-search"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
              {results.length === 0 && !searching && (
                <li className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {t('peminjaman:pengembalian.empty', { defaultValue: 'Tidak ada peminjaman aktif' })}
                </li>
              )}
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left transition-colors hover:bg-accent ${
                      activeId === r.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    data-testid={`pengembalian-result-${r.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <User2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.anggotaNama}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.nomorPinjam} · {r.itemDipinjam}/{r.totalItem} item
                      </p>
                    </div>
                    {activeId === r.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('peminjaman:pengembalian.detail', { defaultValue: 'Detail Pengembalian' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!detail ? (
              <p className="text-sm text-muted-foreground">
                {t('peminjaman:pengembalian.selectFirst', {
                  defaultValue: 'Pilih peminjaman dari hasil pencarian',
                })}
              </p>
            ) : (
              <>
                <div className="rounded border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">{detail.header.anggotaNama}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.header.nomorPinjam} · {detail.header.anggotaKode}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {t('peminjaman:column.jatuhTempo', { defaultValue: 'Jatuh Tempo' })}:{' '}
                      <strong>{detail.header.tanggalJatuhTempo}</strong>
                    </span>
                  </div>
                  {dendaPreview.hariTerlambat > 0 && (
                    <p
                      className="mt-1 text-xs font-medium text-rose-600"
                      data-testid="pengembalian-denda-preview"
                    >
                      {t('peminjaman:pengembalian.dendaPreview', {
                        defaultValue: 'Terlambat {{count}} hari · Rp {{denda}}',
                        count: dendaPreview.hariTerlambat,
                        denda: dendaPreview.denda.toLocaleString('id-ID'),
                      })}
                    </p>
                  )}
                </div>

                {activeItems.length === 0 ? (
                  <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {t('peminjaman:pengembalian.allReturned', {
                      defaultValue: 'Semua item sudah dikembalikan',
                    })}
                  </p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-1.5">
                      {activeItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 rounded border px-3 py-2"
                        >
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggle(item.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.bukuJudul}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.bukuKode}
                              {item.eksemplarKode ? ` · ${item.eksemplarKode}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {t('peminjaman:detail.bayar', { defaultValue: 'Bayar Denda' })}
                        </label>
                        <Input
                          type="number"
                          value={bayar}
                          onChange={(e) => setBayar(e.target.value)}
                          min="0"
                          data-testid="pengembalian-bayar"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          className="w-full"
                          onClick={handleReturn}
                          disabled={selected.size === 0 || submitting}
                          data-testid="pengembalian-submit"
                        >
                          <Undo2 className="mr-2 h-4 w-4" />
                          {t('peminjaman:action.returnSelected', {
                            defaultValue: 'Kembalikan {{count}} item',
                            count: selected.size,
                          })}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
