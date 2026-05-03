import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useToast } from '@/components/ui/toast-manager';
import {
  masterDataApi,
  type MasterInput,
  type MasterItem,
  type MasterTable,
} from '@/lib/masterData';
import { cn } from '@/lib/utils';

const TABLES: { id: MasterTable; key: string; needsKode?: boolean }[] = [
  { id: 'ddc', key: 'ddc', needsKode: true },
  { id: 'kategori', key: 'kategori' },
  { id: 'bahasa', key: 'bahasa', needsKode: true },
  { id: 'jurusan', key: 'jurusan' },
  { id: 'kelas', key: 'kelas' },
  { id: 'agama', key: 'agama' },
];

export function MasterDataPage() {
  const { t } = useTranslation(['masterData', 'common']);
  const { showToast } = useToast();
  const [active, setActive] = useState<MasterTable>('ddc');
  const { query, debouncedQuery, setQuery } = useDebouncedSearch({
    delay: 200,
    initialValue: '',
  });
  const [items, setItems] = useState<MasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<MasterItem | null | 'new'>(null);
  const [deleting, setDeleting] = useState<MasterItem | null>(null);

  const config = TABLES.find((t) => t.id === active)!;

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await masterDataApi.list(active, debouncedQuery || undefined);
      setItems(rows);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('masterData:feedback.loadError'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [active, debouncedQuery, showToast, t]);

  useEffect(() => {
    void reload();
    // Reset search when switching tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const columns: DataTableColumn<MasterItem>[] = useMemo(() => {
    const cols: DataTableColumn<MasterItem>[] = [];
    if (config.needsKode) {
      cols.push({
        key: 'kode',
        header: t('masterData:columns.kode'),
        cell: (row) => <span className="font-mono text-xs">{row.kode ?? '—'}</span>,
        className: 'w-32',
      });
    }
    cols.push({
      key: 'nama',
      header: t('masterData:columns.nama'),
      cell: (row) => <span className="font-medium">{row.nama}</span>,
    });
    if (active === 'kategori') {
      cols.push({
        key: 'deskripsi',
        header: t('masterData:columns.deskripsi'),
        cell: (row) => row.deskripsi ?? '—',
      });
    }
    cols.push({
      key: '__actions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(row)}
            data-testid={`master-edit-${row.kode ?? row.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleting(row)}
            data-testid={`master-delete-${row.kode ?? row.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
      className: 'w-24',
    });
    return cols;
  }, [active, config, t]);

  return (
    <div className="container mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('masterData:title')}</h1>
        <p className="text-sm text-muted-foreground">{t('masterData:subtitle')}</p>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-2 border-b pb-2"
        role="tablist"
        data-testid="master-tabs"
      >
        {TABLES.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            data-testid={`master-tab-${tab.id}`}
            onClick={() => {
              setActive(tab.id);
              setQuery('');
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              tab.id === active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t(`masterData:tabs.${tab.key}`)}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[2fr,auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="master-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('masterData:list.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setEditing('new')} data-testid="master-add">
          <Plus className="mr-2 h-4 w-4" />
          {t('masterData:list.addNew')}
        </Button>
      </div>

      <DataTable
        data-testid="master-table"
        columns={columns}
        rows={items}
        rowKey={(row) => row.kode ?? row.id ?? row.nama}
        isLoading={isLoading}
        empty={t('masterData:list.empty')}
      />

      <MasterEditDialog
        table={active}
        needsKode={config.needsKode ?? false}
        item={editing === 'new' ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('masterData:delete.title', { name: deleting?.nama ?? '' })}
        description={t('masterData:delete.description')}
        confirmText={t('common:actions.delete')}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            const key = deleting.kode ?? String(deleting.id ?? '');
            await masterDataApi.remove(active, key);
            showToast({ title: t('masterData:feedback.deleteSuccess') });
            setDeleting(null);
            void reload();
          } catch (err) {
            showToast({
              variant: 'destructive',
              title: t('masterData:feedback.deleteError'),
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }}
      />
    </div>
  );
}

interface MasterEditDialogProps {
  table: MasterTable;
  needsKode: boolean;
  item: MasterItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function MasterEditDialog({
  table,
  needsKode,
  item,
  open,
  onOpenChange,
  onSaved,
}: MasterEditDialogProps) {
  const { t } = useTranslation(['masterData', 'common']);
  const { showToast } = useToast();
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKode(item?.kode ?? '');
      setNama(item?.nama ?? '');
      setDeskripsi(item?.deskripsi ?? '');
    }
  }, [open, item]);

  const handleSubmit = async (): Promise<void> => {
    if (!nama.trim()) {
      showToast({
        variant: 'destructive',
        title: t('masterData:feedback.namaRequired'),
      });
      return;
    }
    if (needsKode && !kode.trim()) {
      showToast({
        variant: 'destructive',
        title: t('masterData:feedback.kodeRequired'),
      });
      return;
    }
    setBusy(true);
    try {
      const input: MasterInput = {
        kode: needsKode ? kode.trim() : null,
        nama: nama.trim(),
        deskripsi: deskripsi.trim() || null,
        urutan: item?.urutan ?? null,
      };
      if (item) {
        const key = item.kode ?? String(item.id ?? '');
        await masterDataApi.update(table, key, input);
        showToast({ title: t('masterData:feedback.updateSuccess') });
      } else {
        await masterDataApi.create(table, input);
        showToast({ title: t('masterData:feedback.createSuccess') });
      }
      onSaved();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: item ? t('masterData:feedback.updateError') : t('masterData:feedback.createError'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item
              ? t('masterData:dialog.editTitle')
              : t('masterData:dialog.newTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(`masterData:tabs.${table}`)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {needsKode && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('masterData:columns.kode')}
              </Label>
              <Input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                disabled={!!item}
                data-testid="master-form-kode"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('masterData:columns.nama')}
            </Label>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              data-testid="master-form-nama"
              autoFocus
            />
          </div>
          {table === 'kategori' && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('masterData:columns.deskripsi')}
              </Label>
              <Input
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                data-testid="master-form-deskripsi"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={busy} data-testid="master-form-submit">
            {busy ? t('common:states.loading') : t('common:actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
