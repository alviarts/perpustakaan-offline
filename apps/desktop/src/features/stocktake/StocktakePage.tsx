import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ClipboardList, Plus, RefreshCw, Trash2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-manager';
import {
  isTerminal,
  progressPercent,
  stocktakeApi,
  type StocktakeItemRow,
  type StocktakeItemStatus,
  type StocktakeSessionRow,
} from '@/lib/stocktake';
import { useIdentityStore } from '@/stores/identityStore';
import { formatTauriError } from '@/lib/errors';
import { buildStocktakeReport, type StocktakeReportLabels } from './pdf';

type Tab = 'all' | 'ditemukan' | 'missing';

export function StocktakePage() {
  const { t } = useTranslation(['stocktake', 'common']);
  const { showToast } = useToast();
  const identity = useIdentityStore((s) => s.identity);

  const [sessions, setSessions] = useState<StocktakeSessionRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshList, setRefreshList] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newCatatan, setNewCatatan] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoadingList(true);
    stocktakeApi
      .sessionList()
      .then((rows) => {
        if (cancel) return;
        setSessions(rows);
      })
      .catch((err) => {
        if (cancel) return;
        showToast({
          variant: 'destructive',
          title: t('stocktake:feedback.loadError'),
          description: formatTauriError(err),
        });
      })
      .finally(() => {
        if (!cancel) setLoadingList(false);
      });
    return () => {
      cancel = true;
    };
  }, [refreshList, showToast, t]);

  async function handleStartSession() {
    setSubmittingNew(true);
    try {
      const session = await stocktakeApi.start({
        nama: newNama.trim() || undefined,
        catatan: newCatatan.trim() || undefined,
      });
      setNewOpen(false);
      setNewNama('');
      setNewCatatan('');
      setActiveId(session.id);
      setRefreshList((k) => k + 1);
      showToast({ title: t('stocktake:feedback.started') });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('stocktake:feedback.startError'),
        description: formatTauriError(err),
      });
    } finally {
      setSubmittingNew(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm(t('stocktake:session.deleteConfirm'));
    if (!confirmed) return;
    try {
      await stocktakeApi.delete(id);
      setRefreshList((k) => k + 1);
      if (activeId === id) setActiveId(null);
      showToast({ title: t('stocktake:feedback.deleted') });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('stocktake:feedback.deleteError'),
        description: formatTauriError(err),
      });
    }
  }

  if (activeId !== null) {
    return (
      <StocktakeSessionView
        sessionId={activeId}
        onBack={() => {
          setActiveId(null);
          setRefreshList((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="h-6 w-6 text-primary" />
            {t('stocktake:title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('stocktake:subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshList((k) => k + 1)}>
            <RefreshCw className="mr-1 h-4 w-4" />
            {t('common:actions.refresh', { defaultValue: 'Refresh' })}
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('stocktake:actions.newSession')}
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t('stocktake:list.header.id')}</TableHead>
                <TableHead>{t('stocktake:list.header.nama')}</TableHead>
                <TableHead>{t('stocktake:list.header.tanggalMulai')}</TableHead>
                <TableHead>{t('stocktake:list.header.tanggalSelesai')}</TableHead>
                <TableHead>{t('stocktake:list.header.status')}</TableHead>
                <TableHead>{t('stocktake:list.header.progress')}</TableHead>
                <TableHead className="w-48 text-right">
                  {t('stocktake:list.header.aksi')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList && sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    {t('common:status.loading', { defaultValue: 'Loading...' })}
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    {t('stocktake:list.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.id}</TableCell>
                    <TableCell>{s.nama ?? `Sesi ${s.id}`}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.tanggalMulai}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.tanggalSelesai ?? '-'}
                    </TableCell>
                    <TableCell>
                      <SessionStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar
                        value={progressPercent(s)}
                        label={`${s.ditemukan}/${s.total}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveId(s.id)}
                      >
                        {s.status === 'berlangsung'
                          ? t('stocktake:actions.resume')
                          : t('stocktake:actions.view')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(s.id)}
                        aria-label={t('stocktake:actions.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stocktake:newDialog.title')}</DialogTitle>
            <DialogDescription>{t('stocktake:subtitle')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>{t('stocktake:newDialog.namaLabel')}</Label>
              <Input
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                placeholder={t('stocktake:newDialog.namaPlaceholder')}
                disabled={submittingNew}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t('stocktake:newDialog.catatanLabel')}</Label>
              <Input
                value={newCatatan}
                onChange={(e) => setNewCatatan(e.target.value)}
                disabled={submittingNew}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={submittingNew}>
              {t('stocktake:newDialog.cancel')}
            </Button>
            <Button onClick={handleStartSession} disabled={submittingNew}>
              {t('stocktake:newDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Detail / scan view
  // ---------------------------------------------------------------------------
  function StocktakeSessionView({ sessionId, onBack }: { sessionId: number; onBack: () => void }) {
    const [session, setSession] = useState<StocktakeSessionRow | null>(null);
    const [items, setItems] = useState<StocktakeItemRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<Tab>('missing');
    const [search, setSearch] = useState('');
    const [scanInput, setScanInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const scanRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      let cancel = false;
      setLoading(true);
      const itemStatus: StocktakeItemStatus | undefined =
        tab === 'ditemukan'
          ? 'ditemukan'
          : tab === 'missing'
            ? 'belum_scan'
            : undefined;
      Promise.all([
        stocktakeApi.sessionGet(sessionId),
        stocktakeApi.itemList({
          sessionId,
          status: itemStatus,
          query: search.trim() || undefined,
          limit: 1000,
        }),
      ])
        .then(([s, list]) => {
          if (cancel) return;
          setSession(s);
          setItems(list);
        })
        .catch((err) => {
          if (cancel) return;
          showToast({
            variant: 'destructive',
            title: t('stocktake:feedback.loadError'),
            description: formatTauriError(err),
          });
        })
        .finally(() => {
          if (!cancel) setLoading(false);
        });
      return () => {
        cancel = true;
      };
    }, [sessionId, tab, search, refreshKey]);

    useEffect(() => {
      // Keep focus on the scan input so handheld scanners can fire input
      // events without the user needing to click each time.
      if (session?.status === 'berlangsung') scanRef.current?.focus();
    }, [session?.status, refreshKey]);

    async function handleScan(e: React.FormEvent) {
      e.preventDefault();
      const kode = scanInput.trim();
      if (!kode) return;
      setScanning(true);
      try {
        const result = await stocktakeApi.scan({ sessionId, kode });
        setSession(result.session);
        setScanInput('');
        setRefreshKey((k) => k + 1);
        showToast({
          title: result.alreadyScanned
            ? t('stocktake:session.alreadyScannedToast', { kode })
            : t('stocktake:session.scannedToast', { kode }),
        });
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('stocktake:session.scanError', {
            message: formatTauriError(err),
          }),
        });
      } finally {
        setScanning(false);
        scanRef.current?.focus();
      }
    }

    async function handleFinish(status: 'selesai' | 'dibatalkan') {
      const confirmKey =
        status === 'selesai'
          ? 'stocktake:session.finishConfirm'
          : 'stocktake:session.cancelConfirm';
      if (!window.confirm(t(confirmKey))) return;
      try {
        const updated = await stocktakeApi.finish({ sessionId, status });
        setSession(updated);
        setRefreshKey((k) => k + 1);
        showToast({
          title:
            status === 'selesai'
              ? t('stocktake:feedback.finished')
              : t('stocktake:feedback.cancelled'),
        });
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('stocktake:feedback.finishError'),
          description: formatTauriError(err),
        });
      }
    }

    async function handleExport() {
      if (!session) return;
      const missing = await stocktakeApi.itemList({
        sessionId,
        status: 'tidak_ditemukan',
        limit: 5000,
      });
      const labels: StocktakeReportLabels = {
        reportTitle: t('stocktake:report.title'),
        subtitle: t('stocktake:report.headerSubtitle'),
        summary: t('stocktake:report.summary', {
          total: session.total,
          ditemukan: session.ditemukan,
          missing: session.missing,
        }),
        tableHeader: {
          no: t('stocktake:report.tableHeader.no'),
          kode: t('stocktake:report.tableHeader.kode'),
          judul: t('stocktake:report.tableHeader.judul'),
          pengarang: t('stocktake:report.tableHeader.pengarang'),
          status: t('stocktake:report.tableHeader.status'),
        },
        status: {
          belum_scan: t('stocktake:itemStatus.belum_scan'),
          ditemukan: t('stocktake:itemStatus.ditemukan'),
          tidak_ditemukan: t('stocktake:itemStatus.tidak_ditemukan'),
        },
        noMissing: t('stocktake:report.noMissing'),
        footer: {
          ttd: t('stocktake:report.footer.ttd'),
          kepsek: t('stocktake:report.footer.kepsek'),
        },
      };
      const doc = buildStocktakeReport({
        session,
        // For an in-progress session, "missing" still includes belum_scan rows.
        missing:
          session.status === 'berlangsung'
            ? items.filter((i) => i.status !== 'ditemukan')
            : missing,
        identity,
        labels,
      });
      doc.save(t('stocktake:report.fileName', { id: session.id }));
    }

    const counter = useMemo(() => {
      if (!session) return '';
      return t('stocktake:session.counter', {
        total: session.total,
        ditemukan: session.ditemukan,
        percent: progressPercent(session),
      });
    }, [session]);

    if (!session) {
      return (
        <div className="flex flex-col gap-4 p-6">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('stocktake:actions.back')}
          </Button>
          <p>{t('common:status.loading', { defaultValue: 'Loading...' })}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('stocktake:actions.back')}
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{session.nama ?? `Sesi ${session.id}`}</h1>
              <p className="text-sm text-muted-foreground">
                {session.tanggalMulai}
                {session.tanggalSelesai ? ` → ${session.tanggalSelesai}` : ''}
              </p>
            </div>
            <SessionStatusBadge status={session.status} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="mr-1 h-4 w-4" />
              {t('stocktake:actions.exportPdf')}
            </Button>
            {session.status === 'berlangsung' ? (
              <>
                <Button size="sm" onClick={() => handleFinish('selesai')}>
                  {t('stocktake:actions.finish')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFinish('dibatalkan')}
                >
                  {t('stocktake:actions.cancel')}
                </Button>
              </>
            ) : null}
          </div>
        </header>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">{counter}</span>
              <span className="text-sm text-muted-foreground">
                {t('stocktake:session.missing', { missing: session.missing })}
              </span>
            </div>
            <ProgressBar value={progressPercent(session)} />
          </CardContent>
        </Card>

        {session.status === 'berlangsung' && (
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <Label>{t('stocktake:session.scanLabel')}</Label>
              <form onSubmit={handleScan} className="flex gap-2">
                <Input
                  ref={scanRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder={t('stocktake:session.scanPlaceholder')}
                  disabled={scanning || isTerminal(session.status)}
                  autoFocus
                />
                <Button type="submit" disabled={scanning || !scanInput.trim()}>
                  {t('stocktake:actions.scan')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {(['all', 'ditemukan', 'missing'] as Tab[]).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={tab === key ? 'default' : 'outline'}
                    onClick={() => setTab(key)}
                  >
                    {t(`stocktake:session.tabs.${key}`)}
                  </Button>
                ))}
              </div>
              <Input
                placeholder={t('stocktake:session.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('stocktake:session.table.kode')}</TableHead>
                  <TableHead>{t('stocktake:session.table.judul')}</TableHead>
                  <TableHead>{t('stocktake:session.table.pengarang')}</TableHead>
                  <TableHead>{t('stocktake:session.table.status')}</TableHead>
                  <TableHead>{t('stocktake:session.table.tanggalScan')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {t('common:status.loading', { defaultValue: 'Loading...' })}
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {t('stocktake:list.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.eksemplarKode}</TableCell>
                      <TableCell>{row.bukuJudul}</TableCell>
                      <TableCell>{row.bukuPengarang ?? '-'}</TableCell>
                      <TableCell>
                        <ItemStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.tanggalScan ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }
}

function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground">
        {label ?? `${value}%`}
      </span>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: StocktakeSessionRow['status'] }) {
  const { t } = useTranslation(['stocktake']);
  const className =
    status === 'berlangsung'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : status === 'selesai'
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
  return <Badge className={className}>{t(`stocktake:status.${status}`)}</Badge>;
}

function ItemStatusBadge({ status }: { status: StocktakeItemRow['status'] }) {
  const { t } = useTranslation(['stocktake']);
  const className =
    status === 'ditemukan'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : status === 'tidak_ditemukan'
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        : 'bg-muted text-foreground';
  return <Badge className={className}>{t(`stocktake:itemStatus.${status}`)}</Badge>;
}
