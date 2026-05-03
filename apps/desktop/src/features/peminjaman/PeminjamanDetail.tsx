import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, Printer, Undo2, User2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/toast-manager';
import { peminjamanApi, type PeminjamanDetail as Detail } from '@/lib/peminjaman';
import { generateNotaPdf } from '@/lib/pdf/nota';

export function PeminjamanDetailView() {
  const { t } = useTranslation(['peminjaman', 'common']);
  const navigate = useNavigate();
  const params = useParams({ from: '/_authed/peminjaman/$id' });
  const { showToast } = useToast();

  const id = Number(params.id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bayar, setBayar] = useState<string>('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load(): Promise<void> {
    try {
      const d = await peminjamanApi.get(id);
      setDetail(d);
      setSelected(new Set(d.items.filter((i) => i.status === 'dipinjam').map((i) => i.id)));
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.loadError', { defaultValue: 'Gagal memuat detail' }),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t('common:state.loading', { defaultValue: 'Memuat…' })}
      </div>
    );
  }

  const { header, items } = detail;
  const activeItems = items.filter((i) => i.status === 'dipinjam');

  function toggle(itemId: number): void {
    const next = new Set(selected);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelected(next);
  }

  async function handleReturn(): Promise<void> {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await peminjamanApi.kembalikan({
        peminjamanId: id,
        itemIds: Array.from(selected),
        bayar: Number(bayar) || 0,
      });
      showToast({
        title: t('peminjaman:feedback.returned', { defaultValue: 'Pengembalian berhasil' }),
      });
      setConfirmOpen(false);
      await load();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.returnError', { defaultValue: 'Gagal mengembalikan' }),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrintNota(): void {
    try {
      generateNotaPdf({
        nomor: header.nomorPinjam,
        anggotaNama: header.anggotaNama,
        anggotaKode: header.anggotaKode,
        tanggalPinjam: header.tanggalPinjam,
        tanggalJatuhTempo: header.tanggalJatuhTempo,
        items: items.map((i) => ({ judul: i.bukuJudul, kode: i.bukuKode })),
        totalDenda: header.totalDenda,
      });
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.printError', { defaultValue: 'Gagal mencetak nota' }),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="peminjaman-detail">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/peminjaman' })}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('common:action.back', { defaultValue: 'Kembali' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{header.nomorPinjam}</h1>
            <p className="text-sm text-muted-foreground">
              {t(`peminjaman:status.${header.status}`, { defaultValue: header.status })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintNota}>
            <Printer className="mr-2 h-4 w-4" />
            {t('peminjaman:action.printNota', { defaultValue: 'Print Nota' })}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('peminjaman:detail.items', { defaultValue: 'Daftar Buku' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {items.map((item) => {
              const active = item.status === 'dipinjam';
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded border border-border px-3 py-2 transition-colors ${
                    active ? 'hover:bg-accent' : 'opacity-70'
                  }`}
                >
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => active && toggle(item.id)}
                    disabled={!active}
                  />
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.bukuJudul}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.bukuKode}
                      {item.eksemplarKode ? ` · ${item.eksemplarKode}` : ''} ·{' '}
                      {t(`peminjaman:itemStatus.${item.status}`, { defaultValue: item.status })}
                      {item.denda > 0 && ` · Rp ${item.denda.toLocaleString('id-ID')}`}
                    </p>
                  </div>
                </label>
              );
            })}
            {activeItems.length > 0 && (
              <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('peminjaman:detail.bayar', { defaultValue: 'Bayar Denda' })}
                  </label>
                  <Input
                    type="number"
                    value={bayar}
                    onChange={(e) => setBayar(e.target.value)}
                    min="0"
                    data-testid="peminjaman-bayar"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={selected.size === 0 || submitting}
                    data-testid="peminjaman-kembalikan"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    {t('peminjaman:action.return', {
                      defaultValue: 'Kembalikan',
                      count: selected.size,
                    })}{' '}
                    ({selected.size})
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:detail.anggota', { defaultValue: 'Anggota' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <Link
                    to="/anggota/$id"
                    params={{ id: String(header.anggotaId) }}
                    className="font-semibold hover:underline"
                  >
                    {header.anggotaNama}
                  </Link>
                  <p className="text-xs text-muted-foreground">{header.anggotaKode}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:detail.tanggal', { defaultValue: 'Tanggal' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('peminjaman:column.tanggal', { defaultValue: 'Tgl Pinjam' })}
                </span>
                <span className="font-medium">{header.tanggalPinjam}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('peminjaman:column.jatuhTempo', { defaultValue: 'Jatuh Tempo' })}
                </span>
                <span className="font-medium">{header.tanggalJatuhTempo}</span>
              </div>
              {header.tanggalKembali && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('peminjaman:column.tanggalKembali', { defaultValue: 'Tgl Kembali' })}
                  </span>
                  <span className="font-medium">{header.tanggalKembali}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('peminjaman:detail.denda', { defaultValue: 'Denda & Bayar' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('peminjaman:detail.totalDenda', { defaultValue: 'Total Denda' })}
                </span>
                <span className="font-medium">Rp {header.totalDenda.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('peminjaman:detail.totalBayar', { defaultValue: 'Total Bayar' })}
                </span>
                <span className="font-medium">Rp {header.totalBayar.toLocaleString('id-ID')}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('peminjaman:confirm.returnTitle', { defaultValue: 'Konfirmasi Pengembalian' })}
        description={t('peminjaman:confirm.returnDesc', {
          defaultValue: 'Item terpilih akan ditandai sebagai dikembalikan. Lanjutkan?',
        })}
        confirmText={t('peminjaman:action.return', { defaultValue: 'Kembalikan' }) as string}
        onConfirm={handleReturn}
      />
    </div>
  );
}
