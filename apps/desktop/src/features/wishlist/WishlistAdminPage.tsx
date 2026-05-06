import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Plus, ThumbsUp, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-manager';
import { formatTauriError } from '@/lib/errors';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import {
  canTransition,
  WISHLIST_STATUSES,
  wishlistApi,
  type WishlistRow,
  type WishlistStatus,
} from '@/lib/wishlist';

type StatusFilter = 'all' | WishlistStatus;

const STATUS_TONE: Record<WishlistStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  disetujui: 'bg-sky-100 text-sky-800 hover:bg-sky-200',
  ditolak: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
  sudah_diadakan: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  dibatalkan: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
};

const STATUS_FILTER_KEYS: Record<StatusFilter, string> = {
  all: 'wishlist:filter.all',
  pending: 'wishlist:filter.pending',
  disetujui: 'wishlist:filter.disetujui',
  ditolak: 'wishlist:filter.ditolak',
  sudah_diadakan: 'wishlist:filter.sudahDiadakan',
  dibatalkan: 'wishlist:filter.dibatalkan',
};

export function WishlistAdminPage(): React.ReactElement {
  const { t } = useTranslation(['wishlist', 'common']);
  const { showToast } = useToast();

  const [rows, setRows] = React.useState<WishlistRow[]>([]);
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<WishlistRow | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await wishlistApi.list(
        filter === 'all' ? {} : { status: filter },
      );
      setRows(list);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: formatTauriError(err),
      });
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpvote = async (row: WishlistRow): Promise<void> => {
    try {
      const updated = await wishlistApi.upvote(row.id);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      showToast({ title: t('wishlist:upvoteFeedback.success') });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('wishlist:upvoteFeedback.error', { message: formatTauriError(err) }),
      });
    }
  };

  const handleStatusChange = async (
    row: WishlistRow,
    status: WishlistStatus,
  ): Promise<void> => {
    if (!canTransition(row.status, status)) return;
    try {
      const updated = await wishlistApi.updateStatus({ id: row.id, status });
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      showToast({ title: t('wishlist:updateStatus.feedback.success') });
      if (filter !== 'all' && updated.status !== filter) {
        setRows((rs) => rs.filter((r) => r.id !== updated.id));
      }
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('wishlist:updateStatus.feedback.error', {
          message: formatTauriError(err),
        }),
      });
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await wishlistApi.delete(deleteTarget.id);
      setRows((rs) => rs.filter((r) => r.id !== deleteTarget.id));
      showToast({ title: t('wishlist:deleteConfirm.feedback.success') });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('wishlist:deleteConfirm.feedback.error', {
          message: formatTauriError(err),
        }),
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6 md:p-8" data-testid="wishlist-admin-page">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Heart className="h-5 w-5" />
            {t('wishlist:title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('wishlist:subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
            <SelectTrigger className="w-44" data-testid="wishlist-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_FILTER_KEYS) as StatusFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {t(STATUS_FILTER_KEYS[k])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} data-testid="wishlist-create-button">
            <Plus className="mr-1 h-4 w-4" />
            {t('wishlist:action.tambah')}
          </Button>
        </div>
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">{t('wishlist:column.upvote')}</TableHead>
              <TableHead>{t('wishlist:column.judul')}</TableHead>
              <TableHead>{t('wishlist:column.anggota')}</TableHead>
              <TableHead>{t('wishlist:column.status')}</TableHead>
              <TableHead>{t('wishlist:column.tanggal')}</TableHead>
              <TableHead className="text-right">{t('wishlist:column.aksi')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('common:states.loading')}
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                  data-testid="wishlist-empty"
                >
                  {filter === 'all'
                    ? t('wishlist:empty.all')
                    : t('wishlist:empty.filtered')}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((row) => (
                <TableRow key={row.id} data-testid={`wishlist-row-${row.id}`}>
                  <TableCell className="text-center font-mono text-sm">
                    {row.upvoteCount}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.judul}</div>
                    <div className="text-xs text-muted-foreground">
                      {[row.pengarang, row.isbn].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.anggotaNama}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.anggotaKode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_TONE[row.status]}>
                      {t(`wishlist:status.${row.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleUpvote(row)}
                        data-testid={`wishlist-upvote-${row.id}`}
                        title={t('wishlist:action.upvote')}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <StatusActions
                        row={row}
                        onChange={(status) => void handleStatusChange(row, status)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(row)}
                        data-testid={`wishlist-delete-${row.id}`}
                        title={t('wishlist:action.hapus')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <WishlistCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        destructive
        title={t('wishlist:deleteConfirm.title')}
        description={t('wishlist:deleteConfirm.description')}
        confirmText={t('wishlist:deleteConfirm.confirm')}
        cancelText={t('wishlist:deleteConfirm.cancel')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

interface StatusActionsProps {
  row: WishlistRow;
  onChange: (status: WishlistStatus) => void;
}

function StatusActions({ row, onChange }: StatusActionsProps): React.ReactElement {
  const { t } = useTranslation(['wishlist']);
  return (
    <Select
      value={row.status}
      onValueChange={(v) => onChange(v as WishlistStatus)}
    >
      <SelectTrigger className="h-8 w-40" data-testid={`wishlist-status-${row.id}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WISHLIST_STATUSES.map((s) => (
          <SelectItem key={s} value={s} disabled={!canTransition(row.status, s)}>
            {t(`wishlist:status.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface WishlistCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function WishlistCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: WishlistCreateDialogProps): React.ReactElement {
  const { t } = useTranslation(['wishlist', 'common']);
  const { showToast } = useToast();

  const [members, setMembers] = React.useState<Anggota[]>([]);
  const [anggotaId, setAnggotaId] = React.useState<string>('');
  const [judul, setJudul] = React.useState('');
  const [pengarang, setPengarang] = React.useState('');
  const [isbn, setIsbn] = React.useState('');
  const [alasan, setAlasan] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    anggotaApi
      .list({ aktif: true, limit: 200, sortBy: 'nama', sortDir: 'asc' })
      .then((res) => {
        if (cancelled) return;
        setMembers(res.items);
      })
      .catch(() => {
        if (cancelled) return;
        setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = (): void => {
    setAnggotaId('');
    setJudul('');
    setPengarang('');
    setIsbn('');
    setAlasan('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!anggotaId || !judul.trim()) return;
    setSubmitting(true);
    try {
      await wishlistApi.create({
        anggotaId: Number(anggotaId),
        judul: judul.trim(),
        pengarang: pengarang.trim() || undefined,
        isbn: isbn.trim() || undefined,
        alasan: alasan.trim() || undefined,
      });
      showToast({ title: t('wishlist:create.feedback.success') });
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('wishlist:create.feedback.error', { message: formatTauriError(err) }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('wishlist:create.title')}</DialogTitle>
          <DialogDescription>{t('wishlist:create.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label={t('wishlist:create.field.anggota')}>
            <Select value={anggotaId} onValueChange={setAnggotaId}>
              <SelectTrigger data-testid="wishlist-create-anggota">
                <SelectValue placeholder={t('wishlist:create.field.anggotaPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.nama} ({m.kodeAnggota})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('wishlist:create.field.judul')}>
            <Input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder={t('wishlist:create.field.judulPlaceholder')}
              data-testid="wishlist-create-judul"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t('wishlist:create.field.pengarang')}>
              <Input value={pengarang} onChange={(e) => setPengarang(e.target.value)} />
            </Field>
            <Field label={t('wishlist:create.field.isbn')}>
              <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            </Field>
          </div>
          <Field label={t('wishlist:create.field.alasan')}>
            <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('wishlist:create.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !anggotaId || !judul.trim()}
            data-testid="wishlist-create-submit"
          >
            {t('wishlist:create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="block text-sm">
      <span className="mb-1 inline-block font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
