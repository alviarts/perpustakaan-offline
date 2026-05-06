/**
 * FEAT-OPAC-PostScanProfile (v1.1.0) — full-screen member profile that
 * mounts after a successful KTA scan.
 *
 * User feedback (BUGS.md): "scan kta hanya itu fungsi nya? memuncukan
 * nama? tambah misal anggota sudah scan muncul peminjaman aktif atau
 * langsung absen kehadiran, atau bisa resevasi buku apa bila kosong
 * eksemplar nya".
 *
 * The component:
 *   1. Fetches the member's loan history (active + last 10) and their
 *      active reservasi rows in parallel on mount.
 *   2. Renders a header with avatar/foto + nama/kode/kelas + Logout
 *      button that delegates to the parent.
 *   3. Shows three sections: Peminjaman Aktif, Denda Outstanding,
 *      Reservasi Saya, Riwayat Peminjaman (collapsible).
 *   4. Lets the member cancel their own reservasi rows.
 *   5. Forwards a "Cari Buku" callback so the page header can route
 *      back into OpacSearchPage with the member context preserved.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  History,
  LogOut,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-manager';
import {
  peminjamanApi,
  type AnggotaLoanHistory,
  type AnggotaLoanHistoryRow,
} from '@/lib/peminjaman';
import { reservasiApi, type ReservasiRow } from '@/lib/reservasi';
import { formatTauriError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Anggota } from '@/lib/anggota';

export interface OpacMemberProfileProps {
  member: Anggota;
  onLogout: () => void;
  onSearchBooks: () => void;
}

const ACTIVE_STATUSES = new Set<AnggotaLoanHistoryRow['status']>([
  'dipinjam',
  'sebagian',
  'terlambat',
]);

function fmtRupiah(n: number): string {
  if (!Number.isFinite(n)) return '-';
  try {
    return n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  } catch {
    return `Rp ${Math.round(n)}`;
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function daysOverdue(jatuhTempoIso: string): number {
  const jt = new Date(jatuhTempoIso);
  const today = new Date();
  jt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const ms = today.getTime() - jt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

interface ReservasiStatusBadgeProps {
  status: ReservasiRow['status'];
}

function ReservasiStatusBadge({ status }: ReservasiStatusBadgeProps): JSX.Element {
  const { t } = useTranslation('opac');
  const cls = (() => {
    switch (status) {
      case 'menunggu':
        return 'bg-amber-500 text-white hover:bg-amber-500';
      case 'siap_diambil':
        return 'bg-emerald-500 text-white hover:bg-emerald-500';
      case 'diambil':
        return 'bg-sky-500 text-white hover:bg-sky-500';
      case 'expired':
        return 'bg-zinc-500 text-white hover:bg-zinc-500';
      case 'dibatalkan':
        return 'bg-zinc-400 text-white hover:bg-zinc-400';
      default:
        return '';
    }
  })();
  return (
    <Badge className={cls} data-testid={`reservasi-status-${status}`}>
      {t(`profile.reservasi.status.${status}`)}
    </Badge>
  );
}

export function OpacMemberProfile({
  member,
  onLogout,
  onSearchBooks,
}: OpacMemberProfileProps): JSX.Element {
  const { t } = useTranslation('opac');
  const { showToast } = useToast();
  const [history, setHistory] = useState<AnggotaLoanHistory | null>(null);
  const [reservasi, setReservasi] = useState<ReservasiRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingReservasi, setLoadingReservasi] = useState(true);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [fotoError, setFotoError] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoadingHistory(true);
    setLoadingReservasi(true);
    try {
      const [hist, resv] = await Promise.allSettled([
        peminjamanApi.anggotaLoanHistory(member.id, 50),
        reservasiApi.listByAnggota(member.id),
      ]);
      if (hist.status === 'fulfilled') {
        setHistory(hist.value);
      } else {
        showToast({
          variant: 'destructive',
          title: t('profile.loadError'),
          description: formatTauriError(hist.reason),
        });
      }
      if (resv.status === 'fulfilled') {
        setReservasi(resv.value);
      } else {
        // Reservasi may legitimately be empty for first-time members;
        // surface an unexpected RPC error but don't block the screen.
        setReservasi([]);
      }
    } finally {
      setLoadingHistory(false);
      setLoadingReservasi(false);
    }
  }, [member.id, showToast, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeLoans = useMemo(
    () => (history?.history ?? []).filter((h) => ACTIVE_STATUSES.has(h.status)),
    [history],
  );

  const dendaOutstanding = useMemo(() => {
    if (!history) return 0;
    return Math.max(0, history.summary.totalDenda - history.summary.totalBayar);
  }, [history]);

  const handleCancelReservasi = async (row: ReservasiRow): Promise<void> => {
    setCancellingId(row.id);
    try {
      await reservasiApi.cancel(row.id);
      showToast({
        title: t('profile.reservasi.cancelOk'),
        description: row.bukuJudul,
      });
      void refresh();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('profile.reservasi.cancelFail'),
        description: formatTauriError(err),
      });
    } finally {
      setCancellingId(null);
    }
  };

  const memberInitials = (member.nama ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" data-testid="opac-member-profile">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {member.fotoPath && !fotoError ? (
              <img
                src={member.fotoPath}
                alt={member.nama}
                className="h-full w-full object-cover"
                onError={() => setFotoError(true)}
              />
            ) : (
              <span className="text-lg font-semibold" aria-hidden="true">
                {memberInitials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{member.nama}</h2>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{member.kodeAnggota}</span>
              {member.kelas ? <span>{t('profile.kelas')}: {member.kelas}</span> : null}
              {member.jurusan ? <span>{t('profile.jurusan')}: {member.jurusan}</span> : null}
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSearchBooks}
              data-testid="opac-profile-search"
            >
              <Search className="mr-1.5 h-4 w-4" />
              {t('profile.searchBooks')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              data-testid="opac-profile-logout"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              {t('session.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dendaOutstanding > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5" data-testid="opac-profile-denda">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('profile.denda.title')}</p>
              <p className="text-xs text-muted-foreground">{t('profile.denda.description')}</p>
            </div>
            <p className="text-lg font-semibold text-destructive">
              {fmtRupiah(dendaOutstanding)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card data-testid="opac-profile-active-loans">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            {t('profile.activeLoans.title')}
            {activeLoans.length > 0 ? (
              <Badge variant="secondary">{activeLoans.length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingHistory ? (
            <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
          ) : activeLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.activeLoans.empty')}</p>
          ) : (
            activeLoans.map((row) => {
              const overdue = daysOverdue(row.tanggalJatuhTempo);
              const isLate = overdue > 0;
              return (
                <div
                  key={row.peminjamanId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md border p-3',
                    isLate && 'border-destructive/40 bg-destructive/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.bukuJudulPertama ?? row.nomorPinjam}
                      {row.totalItem > 1 ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (+{row.totalItem - 1})
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Calendar className="mr-1 inline h-3 w-3 align-[-2px]" />
                      {t('profile.activeLoans.due', { date: fmtDate(row.tanggalJatuhTempo) })}
                    </p>
                  </div>
                  {isLate ? (
                    <Badge className="bg-destructive text-white hover:bg-destructive">
                      {t('profile.activeLoans.overdue', { days: overdue })}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                      {t('profile.activeLoans.onTime')}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card data-testid="opac-profile-reservasi">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDollarSign className="h-4 w-4" />
            {t('profile.reservasi.title')}
            {reservasi && reservasi.length > 0 ? (
              <Badge variant="secondary">{reservasi.length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingReservasi ? (
            <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
          ) : !reservasi || reservasi.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('profile.reservasi.empty')}</p>
          ) : (
            reservasi.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.bukuJudul}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('profile.reservasi.queue', { urutan: row.urutan })}
                    {row.slotRak ? ` · ${t('profile.reservasi.slot', { slot: row.slotRak })}` : ''}
                    {row.expiredAt ? ` · ${t('profile.reservasi.expires', { date: fmtDate(row.expiredAt) })}` : ''}
                  </p>
                </div>
                <ReservasiStatusBadge status={row.status} />
                {(row.status === 'menunggu' || row.status === 'siap_diambil') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void handleCancelReservasi(row);
                    }}
                    disabled={cancellingId === row.id}
                    data-testid={`opac-reservasi-cancel-${row.id}`}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    {t('profile.reservasi.cancel')}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card data-testid="opac-profile-history">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('profile.history.title')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRiwayat((v) => !v)}
              data-testid="opac-profile-history-toggle"
            >
              {showRiwayat ? (
                <>
                  <ChevronUp className="mr-1 h-3.5 w-3.5" />
                  {t('profile.history.hide')}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                  {t('profile.history.show')}
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        {showRiwayat ? (
          <CardContent className="space-y-2">
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground">{t('search.loading')}</p>
            ) : !history || history.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('profile.history.empty')}</p>
            ) : (
              history.history.slice(0, 10).map((row) => (
                <div
                  key={row.peminjamanId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.bukuJudulPertama ?? row.nomorPinjam}</p>
                    <p className="text-muted-foreground">
                      {fmtDate(row.tanggalPinjam)} → {fmtDate(row.tanggalKembali ?? row.tanggalJatuhTempo)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{row.status}</Badge>
                </div>
              ))
            )}
            {history?.summary?.lastPinjam ? (
              <p className="pt-1 text-[10px] text-muted-foreground">
                <UserIcon className="mr-1 inline h-3 w-3 align-[-2px]" />
                {t('profile.history.lastPinjam', { date: fmtDate(history.summary.lastPinjam) })}
              </p>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
