import { useEffect, useMemo, useState, useCallback } from 'react';
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Search, X, ArrowUp, ArrowDown } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import {
  type Anggota,
  type AnggotaPayload,
  type DistinctValues,
  createAnggota,
  deleteAnggota,
  getDistinctValues,
  listAnggota,
  updateAnggota,
} from '@/lib/anggota';
import { AnggotaForm } from '@/features/anggota/AnggotaForm';

const searchSchema = z.object({
  q: z.string().optional(),
  kelas: z.string().optional(),
  jurusan: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const ALL_VALUE = '__all__';

export const Route = createFileRoute('/_authed/anggota')({
  validateSearch: (search) => searchSchema.parse(search),
  component: AnggotaListPage,
});

type SortKey = 'nama' | 'kode_anggota' | 'kelas' | 'jurusan' | 'tanggal_daftar';

function AnggotaListPage() {
  const { t } = useTranslation(['anggota', 'common']);
  const navigate = useNavigate({ from: '/anggota' });
  const search = useSearch({ from: '/_authed/anggota' });
  const [error, setError] = useState<string | null>(null);

  const limit = search.limit ?? 25;
  const page = search.page ?? 1;
  const offset = (page - 1) * limit;

  const initialQuery = search.q ?? '';
  const { query, debouncedQuery, setQuery } = useDebouncedSearch(initialQuery, 200);

  const [items, setItems] = useState<Anggota[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [distinct, setDistinct] = useState<DistinctValues>({ kelas: [], jurusan: [], agama: [] });
  const [sortBy, setSortBy] = useState<SortKey>('nama');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Anggota | null>(null);
  const [deleting, setDeleting] = useState<Anggota | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDistinct = useCallback(async () => {
    try {
      setDistinct(await getDistinctValues());
    } catch {
      // ignore distinct failure
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAnggota({
        query: debouncedQuery,
        kelas: search.kelas,
        jurusan: search.jurusan,
        limit,
        offset,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('anggota:errors.loadFailed', { message: msg }));
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, search.kelas, search.jurusan, limit, offset, sortBy, sortDir, t]);

  useEffect(() => {
    void loadDistinct();
  }, [loadDistinct]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Sync URL with debounced query (so refresh + share link works)
  useEffect(() => {
    if ((search.q ?? '') === debouncedQuery) return;
    void navigate({
      search: (prev) => ({
        ...prev,
        q: debouncedQuery || undefined,
        page: 1,
      }),
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const onSubmit = async (payload: AnggotaPayload) => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateAnggota(editing.id, payload);
      } else {
        await createAnggota(payload);
      }
      setFormOpen(false);
      setEditing(null);
      await Promise.all([fetchData(), loadDistinct()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('anggota:errors.saveFailed', { message: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await deleteAnggota(deleting.id);
      setDeleting(null);
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t('anggota:errors.deleteFailed', { message: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ keyName, children }: { keyName: SortKey; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSort(keyName)}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground"
    >
      {children}
      {sortBy === keyName && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  const tableContent = useMemo(() => {
    if (loading && items.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
            {t('common:states.loading')}
          </td>
        </tr>
      );
    }
    if (items.length === 0) {
      const isFiltered = Boolean(debouncedQuery || search.kelas || search.jurusan);
      return (
        <tr>
          <td colSpan={6} className="p-12 text-center text-sm text-muted-foreground">
            {isFiltered ? t('anggota:emptyFiltered') : t('anggota:empty')}
          </td>
        </tr>
      );
    }
    return items.map((a) => (
      <tr
        key={a.id}
        data-testid="anggota-row"
        data-id={a.id}
        className="border-b border-border last:border-b-0 hover:bg-accent/30"
      >
        <td className="px-4 py-3 text-sm font-medium">{a.nama}</td>
        <td className="px-4 py-3 text-sm font-mono">{a.kode_anggota}</td>
        <td className="px-4 py-3 text-sm">{a.kelas ?? '—'}</td>
        <td className="px-4 py-3 text-sm">{a.jurusan ?? '—'}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{a.tanggal_daftar}</td>
        <td className="px-4 py-3 text-right">
          <Button
            size="sm"
            variant="ghost"
            data-testid="edit-anggota"
            onClick={() => {
              setEditing(a);
              setFormOpen(true);
            }}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t('anggota:actions.edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="delete-anggota"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleting(a)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t('anggota:actions.delete')}
          </Button>
        </td>
      </tr>
    ));
  }, [items, loading, debouncedQuery, search.kelas, search.jurusan, t]);

  return (
    <div className="container mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('anggota:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('anggota:subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          data-testid="add-anggota"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('anggota:addButton')}
        </Button>
      </div>

      {error && (
        <div
          data-testid="anggota-error"
          role="alert"
          className="mb-4 flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('anggota:searchPlaceholder')}
                className="pl-9 pr-9"
                data-testid="anggota-search"
              />
              {query && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setQuery('')}
                  aria-label={t('common:actions.reset')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select
              value={search.kelas ?? ALL_VALUE}
              onValueChange={(v) => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    kelas: v === ALL_VALUE ? undefined : v,
                    page: 1,
                  }),
                });
              }}
            >
              <SelectTrigger data-testid="filter-kelas">
                <SelectValue placeholder={t('anggota:filterKelas')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('anggota:filterAll')}</SelectItem>
                {distinct.kelas.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={search.jurusan ?? ALL_VALUE}
              onValueChange={(v) => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    jurusan: v === ALL_VALUE ? undefined : v,
                    page: 1,
                  }),
                });
              }}
            >
              <SelectTrigger data-testid="filter-jurusan">
                <SelectValue placeholder={t('anggota:filterJurusan')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('anggota:filterAll')}</SelectItem>
                {distinct.jurusan.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full" data-testid="anggota-table">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader keyName="nama">{t('anggota:fields.nama')}</SortHeader>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader keyName="kode_anggota">{t('anggota:fields.kodeAnggota')}</SortHeader>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader keyName="kelas">{t('anggota:fields.kelas')}</SortHeader>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader keyName="jurusan">{t('anggota:fields.jurusan')}</SortHeader>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader keyName="tanggal_daftar">{t('anggota:fields.tanggalDaftar')}</SortHeader>
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>{tableContent}</tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p data-testid="anggota-total">{t('anggota:tableTotal', { count: total })}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}
              >
                {t('anggota:pagination.previous')}
              </Button>
              <span>
                {t('anggota:pagination.page', { current: page, total: totalPages })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}
              >
                {t('anggota:pagination.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('anggota:editTitle') : t('anggota:newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editing ? `#${editing.id} · ${editing.kode_anggota}` : t('anggota:subtitle')}
            </DialogDescription>
          </DialogHeader>
          <AnggotaForm
            defaultValues={editing}
            onSubmit={onSubmit}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('anggota:deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('anggota:deleteDescription', { nama: deleting?.nama ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              {t('common:actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden link so router prefetches */}
      <Link to="/dashboard" className="sr-only" aria-hidden>
        dashboard
      </Link>
    </div>
  );
}
