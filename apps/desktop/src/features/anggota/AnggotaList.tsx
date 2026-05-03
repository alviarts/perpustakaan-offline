import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CreditCard, FileSpreadsheet, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTauriError } from '@/lib/errors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ImportExcelDialog } from './ImportExcelDialog';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { useToast } from '@/components/ui/toast-manager';

const PAGE_SIZE = 20;

interface AnggotaListSearch {
  q?: string;
  kelas?: string;
  jurusan?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
}

interface AnggotaListProps {
  search: AnggotaListSearch;
  onSearchChange: (next: Partial<AnggotaListSearch>) => void;
}

export function AnggotaList({ search, onSearchChange }: AnggotaListProps) {
  const { t } = useTranslation(['anggota', 'common']);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const initialQ = search.q ?? '';
  const { query, debouncedQuery, setQuery } = useDebouncedSearch({
    delay: 200,
    initialValue: initialQ,
  });

  // Sync external `q` (from header global search) into the input.
  useEffect(() => {
    if ((search.q ?? '') !== query) {
      setQuery(search.q ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.q]);

  const [items, setItems] = useState<Anggota[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>({
    key: 'nama',
    dir: 'asc',
  });
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);
  const [jurusanOptions, setJurusanOptions] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const page = Math.max(1, search.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = search.status ?? 'all';

  const aktifFilter = status === 'active' ? true : status === 'inactive' ? false : null;

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await anggotaApi.list({
        query: debouncedQuery,
        kelas: search.kelas || undefined,
        jurusan: search.jurusan || undefined,
        aktif: aktifFilter,
        limit: PAGE_SIZE,
        offset,
        sortBy: sort?.key ?? 'nama',
        sortDir: sort?.dir,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('anggota:feedback.loadError'),
        description: formatTauriError(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, search.kelas, search.jurusan, aktifFilter, offset, sort, showToast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void Promise.all([
      anggotaApi.distinct('kelas').then(setKelasOptions).catch(() => undefined),
      anggotaApi.distinct('jurusan').then(setJurusanOptions).catch(() => undefined),
    ]);
  }, [items.length]);

  // Push debounced query back into URL search so refresh + bookmarking work.
  useEffect(() => {
    if ((search.q ?? '') !== debouncedQuery) {
      onSearchChange({ q: debouncedQuery || undefined, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const columns: DataTableColumn<Anggota>[] = useMemo(
    () => [
      {
        key: 'kodeAnggota',
        header: t('anggota:columns.kode'),
        sortable: true,
        cell: (row) => <span className="font-mono text-xs">{row.kodeAnggota}</span>,
        className: 'w-32',
      },
      {
        key: 'nama',
        header: t('anggota:columns.nama'),
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.nama}</span>
            {row.email && <span className="text-xs text-muted-foreground">{row.email}</span>}
          </div>
        ),
      },
      {
        key: 'kelas',
        header: t('anggota:columns.kelas'),
        sortable: true,
        cell: (row) => row.kelas ?? '—',
      },
      {
        key: 'jurusan',
        header: t('anggota:columns.jurusan'),
        sortable: true,
        cell: (row) => row.jurusan ?? '—',
      },
      {
        key: 'agama',
        header: t('anggota:columns.agama'),
        cell: (row) => row.agama ?? '—',
      },
      {
        key: 'aktif',
        header: t('anggota:columns.status'),
        cell: (row) =>
          row.aktif ? (
            <Badge variant="success">{t('anggota:list.filterActive')}</Badge>
          ) : (
            <Badge variant="warning">{t('anggota:list.filterInactive')}</Badge>
          ),
        className: 'w-32',
      },
    ],
    [t],
  );

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="container mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('anggota:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('anggota:subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            data-testid="anggota-import"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('anggota:list.import')}
          </Button>
          <Button variant="outline" asChild data-testid="anggota-cetak-kta">
            <Link to="/anggota/cetak-kta">
              <CreditCard className="mr-2 h-4 w-4" />
              {t('kta:menu.cetak', 'Cetak KTA')}
            </Link>
          </Button>
          <Button asChild data-testid="anggota-add">
            <Link to="/anggota/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('anggota:list.addNew')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr,1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="anggota-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('anggota:list.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select
          value={search.kelas ?? '__all__'}
          onValueChange={(v) => onSearchChange({ kelas: v === '__all__' ? undefined : v, page: 1 })}
        >
          <SelectTrigger data-testid="filter-kelas">
            <SelectValue placeholder={t('anggota:list.filterKelas')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('anggota:list.filterAll')}</SelectItem>
            {kelasOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.jurusan ?? '__all__'}
          onValueChange={(v) => onSearchChange({ jurusan: v === '__all__' ? undefined : v, page: 1 })}
        >
          <SelectTrigger data-testid="filter-jurusan">
            <SelectValue placeholder={t('anggota:list.filterJurusan')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('anggota:list.filterAll')}</SelectItem>
            {jurusanOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => onSearchChange({ status: v as AnggotaListSearch['status'], page: 1 })}
        >
          <SelectTrigger data-testid="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('anggota:list.filterAll')}</SelectItem>
            <SelectItem value="active">{t('anggota:list.filterActive')}</SelectItem>
            <SelectItem value="inactive">{t('anggota:list.filterInactive')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data-testid="anggota-table"
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        empty={
          (search.q ?? '') || search.kelas || search.jurusan || status !== 'all'
            ? t('anggota:list.emptyFiltered')
            : t('anggota:list.empty')
        }
        sort={sort}
        onSortChange={setSort}
        onRowClick={(row) => void navigate({ to: '/anggota/$id', params: { id: String(row.id) } })}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('anggota:list.showing', { from: showingFrom, to: showingTo, total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onSearchChange({ page: Math.max(1, page - 1) })}
            data-testid="page-prev"
          >
            <ChevronLeft className="mr-1 h-3 w-3" />
            Prev
          </Button>
          <span>
            {page} / {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onSearchChange({ page: page + 1 })}
            data-testid="page-next"
          >
            Next
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>

      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void reload();
        }}
      />
    </div>
  );
}

export function useAnggotaListSearchSync(): {
  search: AnggotaListSearch;
  patch: (next: Partial<AnggotaListSearch>) => void;
} {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authed/anggota/' }) as AnggotaListSearch;
  const patch = useCallback(
    (next: Partial<AnggotaListSearch>) => {
      void navigate({
        to: '/anggota',
        search: (prev) => ({ ...(prev as AnggotaListSearch), ...next }),
      });
    },
    [navigate],
  );
  return { search, patch };
}
