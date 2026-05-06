import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { formatTauriError } from '@/lib/errors';
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Search,
} from 'lucide-react';
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
import { bukuApi, type Buku, type BukuDetail } from '@/lib/buku';
import { masterDataApi, type MasterItem } from '@/lib/masterData';
import { useToast } from '@/components/ui/toast-manager';
import { ImportBukuDialog } from './ImportBukuDialog';
import { IsbnImportDialog } from './IsbnImportDialog';

const PAGE_SIZE = 20;

interface BukuListSearch {
  q?: string;
  kategori?: string;
  bahasa?: string;
  page?: number;
  selected?: number;
}

interface BukuListProps {
  search: BukuListSearch;
  onSearchChange: (next: Partial<BukuListSearch>) => void;
}

export function BukuList({ search, onSearchChange }: BukuListProps) {
  const { t } = useTranslation(['buku', 'common']);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const initialQ = search.q ?? '';
  const { query, debouncedQuery, setQuery } = useDebouncedSearch({
    delay: 200,
    initialValue: initialQ,
  });

  useEffect(() => {
    if ((search.q ?? '') !== query) setQuery(search.q ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.q]);

  const [items, setItems] = useState<Buku[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>({
    key: 'judul',
    dir: 'asc',
  });
  const [kategoriOptions, setKategoriOptions] = useState<MasterItem[]>([]);
  const [bahasaOptions, setBahasaOptions] = useState<MasterItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [isbnImportOpen, setIsbnImportOpen] = useState(false);
  const [detail, setDetail] = useState<BukuDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const page = Math.max(1, search.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;
  const selectedId = search.selected ?? null;

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await bukuApi.list({
        query: debouncedQuery,
        kategori: search.kategori || undefined,
        bahasa: search.bahasa || undefined,
        limit: PAGE_SIZE,
        offset,
        sortBy: sort?.key ?? 'judul',
        sortDir: sort?.dir,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('buku:feedback.loadError'),
        description: formatTauriError(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, search.kategori, search.bahasa, offset, sort, showToast, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void Promise.all([
      masterDataApi.list('kategori').then(setKategoriOptions).catch(() => undefined),
      masterDataApi.list('bahasa').then(setBahasaOptions).catch(() => undefined),
    ]);
  }, []);

  useEffect(() => {
    if ((search.q ?? '') !== debouncedQuery) {
      onSearchChange({ q: debouncedQuery || undefined, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    bukuApi
      .get(selectedId)
      .then((d) => setDetail(d))
      .catch((err) => {
        showToast({
          variant: 'destructive',
          title: t('buku:feedback.loadError'),
          description: formatTauriError(err),
        });
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId, showToast, t]);

  const columns: DataTableColumn<Buku>[] = useMemo(
    () => [
      {
        key: 'kodeBuku',
        header: t('buku:columns.kode'),
        sortable: true,
        cell: (row) => <span className="font-mono text-xs">{row.kodeBuku}</span>,
        className: 'w-28',
      },
      {
        key: 'judul',
        header: t('buku:columns.judul'),
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.judul}</span>
            {row.pengarang && (
              <span className="text-xs text-muted-foreground">{row.pengarang}</span>
            )}
          </div>
        ),
      },
      {
        key: 'kategori',
        header: t('buku:columns.kategori'),
        sortable: true,
        cell: (row) => row.kategori ?? '—',
      },
      {
        key: 'kodeDdc',
        header: t('buku:columns.ddc'),
        sortable: true,
        cell: (row) => (row.kodeDdc ? <span className="font-mono text-xs">{row.kodeDdc}</span> : '—'),
      },
      {
        key: 'jumlahTersedia',
        header: t('buku:columns.tersedia'),
        cell: (row) => (
          <Badge
            variant={row.jumlahTersedia > 0 ? 'success' : 'warning'}
            data-testid={`buku-badge-${row.id}`}
          >
            {row.jumlahTersedia} / {row.jumlahEksemplar}
          </Badge>
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
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('buku:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('buku:subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="buku-import">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('buku:list.import')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsbnImportOpen(true)}
            data-testid="buku-import-isbn"
          >
            <ScanLine className="mr-2 h-4 w-4" />
            {t('buku:list.importIsbn', { defaultValue: 'Impor via ISBN' })}
          </Button>
          <Button variant="outline" asChild data-testid="buku-cetak-label">
            <Link to="/buku/cetak-label">
              <Printer className="mr-2 h-4 w-4" />
              {t('label-buku:menu.cetak', { defaultValue: 'Cetak Label' })}
            </Link>
          </Button>
          <Button asChild data-testid="buku-add">
            <Link to="/buku/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('buku:list.addNew')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="buku-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('buku:list.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select
          value={search.kategori ?? '__all__'}
          onValueChange={(v) =>
            onSearchChange({ kategori: v === '__all__' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger data-testid="filter-kategori">
            <SelectValue placeholder={t('buku:list.filterKategori')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('buku:list.filterAll')}</SelectItem>
            {kategoriOptions.map((opt) => (
              <SelectItem key={opt.id ?? opt.nama} value={opt.nama}>
                {opt.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.bahasa ?? '__all__'}
          onValueChange={(v) =>
            onSearchChange({ bahasa: v === '__all__' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger data-testid="filter-bahasa">
            <SelectValue placeholder={t('buku:list.filterBahasa')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('buku:list.filterAll')}</SelectItem>
            {bahasaOptions.map((opt) => (
              <SelectItem key={opt.kode ?? opt.nama} value={opt.kode ?? opt.nama}>
                {opt.kode ? `${opt.kode} — ${opt.nama}` : opt.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr,2fr]">
        <div>
          <DataTable
            data-testid="buku-table"
            columns={columns}
            rows={items}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            empty={
              (search.q ?? '') || search.kategori || search.bahasa
                ? t('buku:list.emptyFiltered')
                : t('buku:list.empty')
            }
            sort={sort}
            onSortChange={setSort}
            onRowClick={(row) => onSearchChange({ selected: row.id })}
            highlightedRowKey={selectedId ?? undefined}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t('buku:list.showing', { from: showingFrom, to: showingTo, total })}</span>
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
        </div>

        <BukuDetailPanel
          detail={detail}
          isLoading={detailLoading}
          onEdit={(id) => void navigate({ to: '/buku/$id', params: { id: String(id) } })}
        />
      </div>

      <ImportBukuDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void reload();
        }}
      />
      <IsbnImportDialog
        open={isbnImportOpen}
        onOpenChange={setIsbnImportOpen}
        onImported={() => {
          void reload();
        }}
      />
    </div>
  );
}

interface BukuDetailPanelProps {
  detail: BukuDetail | null;
  isLoading: boolean;
  onEdit: (id: number) => void;
}

function BukuDetailPanel({ detail, isLoading, onEdit }: BukuDetailPanelProps) {
  const { t } = useTranslation(['buku']);

  if (isLoading) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        {t('buku:list.loadingDetail')}
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        data-testid="buku-empty-detail"
        className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed bg-card p-8 text-center"
      >
        <BookOpenText className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <h3 className="text-base font-semibold">{t('buku:detail.emptyTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('buku:detail.emptyHint')}</p>
      </div>
    );
  }

  const { buku, eksemplar } = detail;
  return (
    <div className="space-y-4 rounded-md border bg-card p-5" data-testid="buku-detail">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{buku.kodeBuku}</p>
          <h2 className="text-lg font-semibold leading-tight">{buku.judul}</h2>
          {buku.pengarang && (
            <p className="text-sm text-muted-foreground">{buku.pengarang}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => onEdit(buku.id)} data-testid="buku-detail-edit">
          <Pencil className="mr-1 h-3 w-3" />
          {t('buku:detail.edit')}
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <DT label={t('buku:detail.kategori')} value={buku.kategori} />
        <DT label={t('buku:detail.bahasa')} value={buku.bahasa} />
        <DT label={t('buku:detail.kodeDdc')} value={buku.kodeDdc} />
        <DT label={t('buku:detail.tahunTerbit')} value={buku.tahunTerbit?.toString()} />
        <DT label={t('buku:detail.penerbit')} value={buku.penerbit} />
        <DT label={t('buku:detail.isbn')} value={buku.isbn} />
        <DT label={t('buku:detail.rak')} value={buku.rak} />
        <DT label={t('buku:detail.sumber')} value={buku.sumber} />
      </dl>

      {buku.deskripsi && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">{buku.deskripsi}</div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('buku:detail.eksemplarTitle', { count: eksemplar.length })}
        </p>
        <div className="flex flex-wrap gap-2" data-testid="buku-eksemplar-list">
          {eksemplar.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t('buku:detail.eksemplarEmpty')}
            </p>
          )}
          {eksemplar.map((e) => (
            <Badge
              key={e.id}
              variant={e.status === 'tersedia' ? 'success' : 'warning'}
              className="font-mono"
            >
              {e.kodeEksemplar}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function DT({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value ?? '—'}</dd>
    </>
  );
}

export function useBukuListSearchSync(): {
  search: BukuListSearch;
  patch: (next: Partial<BukuListSearch>) => void;
} {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authed/buku/' }) as BukuListSearch;
  const patch = useCallback(
    (next: Partial<BukuListSearch>) => {
      void navigate({
        to: '/buku',
        search: (prev) => ({ ...(prev as BukuListSearch), ...next }),
      });
    },
    [navigate],
  );
  return { search, patch };
}
