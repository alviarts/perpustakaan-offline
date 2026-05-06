import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, CalendarPlus, Printer, Undo2, User2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DendaQuickPresetRow } from '@/components/shared/DendaQuickPresetRow';
import { useToast } from '@/components/ui/toast-manager';
import { peminjamanApi, type PeminjamanDetail as Detail } from '@/lib/peminjaman';
import { generateNotaPdf } from '@/lib/pdf/nota';
import { formatTauriError } from '@/lib/errors';
import { DEFAULT_LOAN_RULES, settingsApi, type LoanRules } from '@/lib/settings';

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
  const [perpanjangOpen, setPerpanjangOpen] = useState(false);
  const [perpanjangPreview, setPerpanjangPreview] = useState<{
    days: number;
    baru: string;
  } | null>(null);
  const [extending, setExtending] = useState(false);
  const [loanRules, setLoanRules] = useState<LoanRules>(DEFAULT_LOAN_RULES);

  useEffect(() => {
    let cancel = false;
    settingsApi
      .getLoanRules()
      .then((rules) => {
        if (!cancel) setLoanRules(rules);
      })
      .catch(() => {
        // Settings unavailable (mock/offline) — fall through with the
        // baked-in defaults so the page is still usable.
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function load(): Promise<void> {
    try {
      const d = await peminjamanApi.get(id);
      setDetail(d);
      setSelected(new Set(d.items.filter((i) => i.status === 'dipinjam').map((i) => i.id)));
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.loadError', { defaultValue: 'Gagal memuat detail' }),
        description: formatTauriError(err),
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
      const res = await peminjamanApi.kembalikan({
        peminjamanId: id,
        itemIds: Array.from(selected),
        bayar: Number(bayar) || 0,
      });
      showToast({
        title: t('peminjaman:feedback.returned', { defaultValue: 'Pengembalian berhasil' }),
      });
      // FEAT-18: surface promoted reservasi to operator so they know to
      // physically pull the book off the return cart and shelve it under
      // the assigned slot for the next anggota.
      for (const promo of res.reservasiPromoted ?? []) {
        showToast({
          title: t('peminjaman:feedback.reservasiPromoted', {
            judul: promo.bukuJudul,
            nama: promo.anggotaNama,
            slot: promo.slotRak,
            expired: promo.expiredAt,
            defaultValue:
              'Buku "{{judul}}" di-reserve oleh {{nama}} — simpan di rak {{slot}} (kedaluwarsa {{expired}})',
          }),
        });
      }
      setConfirmOpen(false);
      await load();
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

  function openPerpanjangDialog(): void {
    if (!detail) return;
    // Default extend window matches `transaksi.lama_pinjam_hari` —
    // backend will use that setting too when `days` is omitted, so we
    // hard-code 7 here as a safe preview value.
    const days = 7;
    const baru = new Date(
      new Date(detail.header.tanggalJatuhTempo + 'T00:00:00Z').getTime() +
        days * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    setPerpanjangPreview({ days, baru });
    setPerpanjangOpen(true);
  }

  async function handlePerpanjang(): Promise<void> {
    if (!detail) return;
    setExtending(true);
    try {
      const res = await peminjamanApi.perpanjang({
        peminjamanId: id,
        days: perpanjangPreview?.days,
      });
      showToast({
        title: t('peminjaman:feedback.perpanjangSuccess', {
          baru: res.tanggalJatuhTempoBaru,
          kali: res.kaliPerpanjangan,
          max: res.maxPerpanjangan,
          defaultValue:
            'Diperpanjang. Jatuh tempo baru: {{baru}} ({{kali}}/{{max}}×)',
        }),
      });
      setPerpanjangOpen(false);
      await load();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('peminjaman:feedback.perpanjangError', {
          defaultValue: 'Gagal memperpanjang',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setExtending(false);
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
        description: formatTauriError(err),
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
          {activeItems.length > 0 && (
            <Button
              variant="outline"
              onClick={openPerpanjangDialog}
              data-testid="peminjaman-perpanjang"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              {t('peminjaman:action.perpanjang', { defaultValue: 'Perpanjang' })}
            </Button>
          )}
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
                  <DendaQuickPresetRow
                    dendaPerHari={loanRules.dendaPerHari}
                    onSelect={(value) => setBayar(String(value))}
                    testidPrefix="peminjaman-bayar"
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
              {header.kaliPerpanjangan > 0 && (
                <div
                  className="text-xs text-muted-foreground"
                  data-testid="peminjaman-kali-perpanjangan"
                >
                  {t('peminjaman:detail.kaliPerpanjangan', {
                    count: header.kaliPerpanjangan,
                    max: 1,
                    defaultValue:
                      'Sudah diperpanjang {{count}}× (max {{max}}×)',
                  })}
                  {header.tanggalPerpanjanganTerakhir && (
                    <>
                      {' '}
                      ·{' '}
                      {t('peminjaman:detail.perpanjanganTerakhir', {
                        tanggal: header.tanggalPerpanjanganTerakhir,
                        defaultValue: 'Terakhir diperpanjang {{tanggal}}',
                      })}
                    </>
                  )}
                </div>
              )}
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

      <ConfirmDialog
        open={perpanjangOpen}
        onOpenChange={(open) => {
          if (!extending) setPerpanjangOpen(open);
        }}
        title={t('peminjaman:confirm.perpanjangTitle', {
          defaultValue: 'Perpanjang Peminjaman',
        })}
        description={t('peminjaman:confirm.perpanjangDesc', {
          old: header.tanggalJatuhTempo,
          baru: perpanjangPreview?.baru ?? '',
          days: perpanjangPreview?.days ?? 7,
          defaultValue:
            'Jatuh tempo akan diperpanjang dari {{old}} menjadi {{baru}} ({{days}} hari). Lanjutkan?',
        })}
        confirmText={
          t('peminjaman:confirm.perpanjangButton', {
            defaultValue: 'Perpanjang',
          }) as string
        }
        onConfirm={handlePerpanjang}
      />
    </div>
  );
}
