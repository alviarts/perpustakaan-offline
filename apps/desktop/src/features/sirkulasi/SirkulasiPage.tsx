/**
 * Mode sirkulasi webcam (v1.0.6 #19).
 *
 * Halaman cepat untuk peminjaman & pengembalian berbasis pemindaian:
 * - Kamera + decode Code-128 / QR via {@link useBarcodeScanner}.
 * - Setiap kode hasil scan ditangani oleh {@link handleScan} yang berusaha
 *   mengenali (a) kode anggota, lalu (b) kode eksemplar.
 * - Mode **Pinjam**: kumpulkan eksemplar, isi anggota, klik *Simpan*.
 * - Mode **Kembalikan**: scan eksemplar yang sedang dipinjam → muncul kartu
 *   peminjaman terkait dengan opsi pengembalian per item.
 *
 * Tetap dapat dipakai tanpa kamera lewat input teks manual (mis. scanner
 * USB yang berperilaku seperti keyboard, atau ketik kode langsung).
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  CameraOff,
  CheckCircle2,
  Keyboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Trash2,
  Undo2,
  User2,
  Video,
  VideoOff,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import {
  peminjamanApi,
  type ActiveLoanForEksemplar,
  type EksemplarResolved,
} from '@/lib/peminjaman';
import { formatTauriError } from '@/lib/errors';
import { useBarcodeScanner } from './useBarcodeScanner';

type Mode = 'pinjam' | 'kembalikan';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface BasketItem {
  eksemplar: EksemplarResolved;
  /** When false the eksemplar is already loaned to someone — flagged in UI. */
  available: boolean;
}

export function SirkulasiPage() {
  const { t } = useTranslation(['peminjaman', 'common', 'sirkulasi']);
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('pinjam');
  const [manual, setManual] = useState('');
  const manualRef = useRef<HTMLInputElement>(null);

  // Pinjam mode state
  const [anggota, setAnggota] = useState<Anggota | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Kembalikan mode state — keyed by peminjamanId so multiple loans can be
  // staged before submitting.
  const [returnLoans, setReturnLoans] = useState<
    Record<number, { header: ActiveLoanForEksemplar; items: ActiveLoanForEksemplar[] }>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<
    | { kind: 'pinjam'; anggotaNama: string; count: number; nomor: string }
    | { kind: 'kembali'; count: number }
    | null
  >(null);

  const focusManual = (): void => {
    setTimeout(() => manualRef.current?.focus(), 0);
  };

  const beep = (kind: 'ok' | 'err'): void => {
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === 'ok' ? 880 : 220;
      gain.gain.value = 0.05;
      osc.start();
      osc.stop(ctx.currentTime + (kind === 'ok' ? 0.08 : 0.18));
    } catch {
      // Audio is purely a UX nicety — silent fallback if AudioContext fails.
    }
  };

  /**
   * Try to interpret the scanned text. Order:
   * 1. Pinjam mode without anggota → look up `anggota_get_by_kode`.
   * 2. Resolve as eksemplar (always attempted second).
   * 3. Kembalikan mode → use `peminjaman_aktif_by_eksemplar`.
   */
  const handleScan = async (raw: string): Promise<void> => {
    const code = raw.trim();
    if (!code) return;

    if (mode === 'pinjam' && !anggota) {
      try {
        const a = await anggotaApi.getByKode(code);
        if (a) {
          setAnggota(a);
          showToast({
            title: t('sirkulasi:toast.anggotaSet', { defaultValue: 'Anggota terpilih' }),
            description: `${a.kodeAnggota} · ${a.nama}`,
          });
          beep('ok');
          return;
        }
      } catch {
        // Fall through to try eksemplar resolution.
      }
    }

    if (mode === 'pinjam') {
      try {
        const eks = await peminjamanApi.resolveEksemplar(code);
        if (!eks) {
          showToast({
            variant: 'destructive',
            title: t('sirkulasi:toast.unknownCode', { defaultValue: 'Kode tidak dikenali' }),
            description: code,
          });
          beep('err');
          return;
        }
        setBasket((prev) => {
          if (prev.some((b) => b.eksemplar.eksemplarId === eks.eksemplarId)) {
            // Already in basket — keep the older entry, just notify.
            showToast({
              title: t('sirkulasi:toast.alreadyInBasket', {
                defaultValue: 'Sudah ada di keranjang',
              }),
              description: eks.kodeEksemplar,
            });
            return prev;
          }
          return [...prev, { eksemplar: eks, available: eks.status === 'tersedia' }];
        });
        beep(eks.status === 'tersedia' ? 'ok' : 'err');
      } catch (err) {
        showToast({
          variant: 'destructive',
          title: t('sirkulasi:toast.resolveError', {
            defaultValue: 'Gagal mengecek kode eksemplar',
          }),
          description: formatTauriError(err),
        });
        beep('err');
      }
      return;
    }

    // Kembalikan mode
    try {
      const loan = await peminjamanApi.aktifByEksemplar(code);
      if (!loan) {
        showToast({
          variant: 'destructive',
          title: t('sirkulasi:toast.notLoaned', {
            defaultValue: 'Tidak ada peminjaman aktif untuk kode ini',
          }),
          description: code,
        });
        beep('err');
        return;
      }
      setReturnLoans((prev) => {
        const existing = prev[loan.peminjamanId];
        if (existing) {
          if (
            existing.items.some((i) => i.peminjamanItemId === loan.peminjamanItemId)
          ) {
            showToast({
              title: t('sirkulasi:toast.alreadyInList', {
                defaultValue: 'Sudah masuk daftar',
              }),
              description: loan.kodeEksemplar,
            });
            return prev;
          }
          return {
            ...prev,
            [loan.peminjamanId]: {
              header: existing.header,
              items: [...existing.items, loan],
            },
          };
        }
        return {
          ...prev,
          [loan.peminjamanId]: { header: loan, items: [loan] },
        };
      });
      beep('ok');
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('sirkulasi:toast.lookupError', {
          defaultValue: 'Gagal mencari peminjaman aktif',
        }),
        description: formatTauriError(err),
      });
      beep('err');
    }
  };

  const scanner = useBarcodeScanner({
    onDecode: (text) => {
      void handleScan(text);
    },
  });

  const onSubmitManual = (e: React.FormEvent): void => {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    setManual('');
    void handleScan(v);
  };

  const removeFromBasket = (eksemplarId: number): void => {
    setBasket((prev) => prev.filter((b) => b.eksemplar.eksemplarId !== eksemplarId));
  };

  const removeReturnItem = (peminjamanId: number, itemId: number): void => {
    setReturnLoans((prev) => {
      const cur = prev[peminjamanId];
      if (!cur) return prev;
      const remaining = cur.items.filter((i) => i.peminjamanItemId !== itemId);
      const next = { ...prev };
      if (remaining.length === 0) {
        delete next[peminjamanId];
      } else {
        next[peminjamanId] = { header: cur.header, items: remaining };
      }
      return next;
    });
  };

  const submitPinjam = async (): Promise<void> => {
    if (!anggota || basket.length === 0) return;
    const usable = basket.filter((b) => b.available);
    if (usable.length === 0) {
      showToast({
        variant: 'destructive',
        title: t('sirkulasi:toast.noUsable', {
          defaultValue: 'Tidak ada eksemplar tersedia',
        }),
        description: t('sirkulasi:toast.noUsableDesc', {
          defaultValue: 'Semua kode yang di-scan sedang dipinjam.',
        }),
      });
      return;
    }
    setSubmitting(true);
    try {
      // Backend `peminjaman_create` saat ini menerima `bukuIds`. Untuk
      // kompatibilitas, kirim daftar bukuId — eksemplar otomatis akan
      // dipilih oleh backend (FIFO bedasarkan id). Itu sudah cukup karena
      // operator hanya butuh tahu eksemplar yg dipinjam = jumlah scan.
      const detail = await peminjamanApi.create({
        anggotaId: anggota.id,
        bukuIds: usable.map((b) => b.eksemplar.bukuId),
        tanggalPinjam: todayIso(),
        tanggalJatuhTempo: plusDays(7),
      });
      setLastResult({
        kind: 'pinjam',
        anggotaNama: anggota.nama,
        count: detail.items.length,
        nomor: detail.header.nomorPinjam,
      });
      showToast({
        title: t('sirkulasi:toast.borrowOk', {
          defaultValue: 'Peminjaman berhasil',
        }),
        description: detail.header.nomorPinjam,
      });
      // Reset for next round
      setAnggota(null);
      setBasket([]);
      focusManual();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('sirkulasi:toast.borrowFail', {
          defaultValue: 'Peminjaman gagal',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitKembali = async (): Promise<void> => {
    const groups = Object.values(returnLoans);
    if (groups.length === 0) return;
    setSubmitting(true);
    let totalReturned = 0;
    try {
      for (const g of groups) {
        await peminjamanApi.kembalikan({
          peminjamanId: g.header.peminjamanId,
          itemIds: g.items.map((i) => i.peminjamanItemId),
          bayar: 0,
        });
        totalReturned += g.items.length;
      }
      setLastResult({ kind: 'kembali', count: totalReturned });
      setReturnLoans({});
      showToast({
        title: t('sirkulasi:toast.returnOk', {
          defaultValue: 'Pengembalian berhasil',
        }),
        description: t('sirkulasi:toast.returnOkDesc', {
          count: totalReturned,
          defaultValue: '{{count}} eksemplar dikembalikan',
        }),
      });
      focusManual();
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('sirkulasi:toast.returnFail', {
          defaultValue: 'Pengembalian gagal',
        }),
        description: formatTauriError(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearAll = (): void => {
    setAnggota(null);
    setBasket([]);
    setReturnLoans({});
    setLastResult(null);
    setManual('');
    focusManual();
  };

  const basketUsableCount = useMemo(
    () => basket.filter((b) => b.available).length,
    [basket],
  );
  const returnTotal = useMemo(
    () => Object.values(returnLoans).reduce((acc, g) => acc + g.items.length, 0),
    [returnLoans],
  );

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ScanLine className="h-6 w-6" />
            {t('sirkulasi:title', { defaultValue: 'Sirkulasi (Webcam)' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('sirkulasi:subtitle', {
              defaultValue:
                'Pindai barcode anggota dan eksemplar untuk peminjaman/pengembalian cepat. Pintasan: Ctrl+L.',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'pinjam' ? 'default' : 'outline'}
            onClick={() => {
              setMode('pinjam');
              setLastResult(null);
              focusManual();
            }}
          >
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {t('sirkulasi:mode.pinjam', { defaultValue: 'Pinjam' })}
          </Button>
          <Button
            variant={mode === 'kembalikan' ? 'default' : 'outline'}
            onClick={() => {
              setMode('kembalikan');
              setLastResult(null);
              focusManual();
            }}
          >
            <Undo2 className="mr-1.5 h-4 w-4" />
            {t('sirkulasi:mode.kembalikan', { defaultValue: 'Kembalikan' })}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scanner column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4" />
              {t('sirkulasi:scanner.title', { defaultValue: 'Pemindai' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-md border bg-black/90">
              <video
                ref={scanner.videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              {!scanner.active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                  <CameraOff className="h-10 w-10 opacity-70" />
                  <p className="text-sm">
                    {scanner.starting
                      ? t('sirkulasi:scanner.starting', {
                          defaultValue: 'Membuka kamera…',
                        })
                      : t('sirkulasi:scanner.off', {
                          defaultValue: 'Kamera belum aktif',
                        })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {scanner.active ? (
                <Button variant="outline" onClick={() => scanner.stop()}>
                  <VideoOff className="mr-1.5 h-4 w-4" />
                  {t('sirkulasi:scanner.stop', { defaultValue: 'Matikan kamera' })}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void scanner.start();
                  }}
                  disabled={scanner.starting}
                >
                  {scanner.starting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="mr-1.5 h-4 w-4" />
                  )}
                  {t('sirkulasi:scanner.start', { defaultValue: 'Aktifkan kamera' })}
                </Button>
              )}
              {scanner.devices.length > 1 && scanner.selectedDeviceId && (
                <Select
                  value={scanner.selectedDeviceId}
                  onValueChange={(v) => scanner.selectDevice(v)}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue
                      placeholder={t('sirkulasi:scanner.devicePlaceholder', {
                        defaultValue: 'Pilih kamera',
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {scanner.devices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label || `Kamera ${d.deviceId.slice(0, 6)}…`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {scanner.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">
                  {scanner.errorKind === 'permission'
                    ? t('sirkulasi:scanner.permissionTitle', {
                        defaultValue: 'Akses kamera diblokir',
                      })
                    : scanner.errorKind === 'no-device'
                      ? t('sirkulasi:scanner.noDeviceTitle', {
                          defaultValue: 'Kamera tidak ditemukan',
                        })
                      : scanner.errorKind === 'in-use'
                        ? t('sirkulasi:scanner.inUseTitle', {
                            defaultValue: 'Kamera sedang dipakai aplikasi lain',
                          })
                        : t('sirkulasi:scanner.errorTitle', {
                            defaultValue: 'Gagal memulai kamera',
                          })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-destructive/80">
                  {scanner.errorKind === 'permission'
                    ? t('sirkulasi:scanner.permissionHelp', {
                        defaultValue:
                          'Buka pengaturan aplikasi/browser, ubah izin kamera ke "Izinkan", lalu klik Coba lagi. Jika tombol Coba lagi tidak memunculkan prompt izin, klik Muat ulang halaman.',
                      })
                    : scanner.errorKind === 'no-device'
                      ? t('sirkulasi:scanner.noDeviceHelp', {
                          defaultValue:
                            'Pastikan kamera webcam tersambung dan tidak dinonaktifkan di Device Manager.',
                        })
                      : scanner.errorKind === 'in-use'
                        ? t('sirkulasi:scanner.inUseHelp', {
                            defaultValue:
                              'Tutup aplikasi lain yang sedang menggunakan kamera (Zoom, Meet, Camera, dll), lalu klik Coba lagi.',
                          })
                        : scanner.error}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void scanner.start();
                    }}
                    disabled={scanner.starting}
                  >
                    {scanner.starting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {t('sirkulasi:scanner.retry', { defaultValue: 'Coba lagi' })}
                  </Button>
                  {scanner.errorKind === 'permission' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.reload();
                        }
                      }}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {t('sirkulasi:scanner.reload', {
                        defaultValue: 'Muat ulang halaman',
                      })}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={onSubmitManual} className="flex items-center gap-2 pt-2">
              <Keyboard className="h-4 w-4 text-muted-foreground" />
              <Input
                ref={manualRef}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={t('sirkulasi:manual.placeholder', {
                  defaultValue:
                    'Atau ketik / scan pakai USB scanner (Enter untuk submit)',
                })}
                autoFocus
              />
              <Button type="submit" variant="secondary">
                {t('sirkulasi:manual.submit', { defaultValue: 'Kirim' })}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Workspace column */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {mode === 'pinjam' ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              {mode === 'pinjam'
                ? t('sirkulasi:basket.titlePinjam', {
                    defaultValue: 'Keranjang Peminjaman',
                  })
                : t('sirkulasi:basket.titleKembali', {
                    defaultValue: 'Eksemplar Akan Dikembalikan',
                  })}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              {t('sirkulasi:basket.clear', { defaultValue: 'Bersihkan' })}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === 'pinjam' ? (
              <PinjamWorkspace
                anggota={anggota}
                basket={basket}
                basketUsableCount={basketUsableCount}
                onRemove={removeFromBasket}
                onClearAnggota={() => setAnggota(null)}
              />
            ) : (
              <KembalikanWorkspace
                groups={Object.values(returnLoans)}
                onRemoveItem={removeReturnItem}
              />
            )}

            {lastResult && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  {lastResult.kind === 'pinjam' ? (
                    <p>
                      {t('sirkulasi:result.pinjam', {
                        defaultValue:
                          'Peminjaman {{nomor}} tersimpan untuk {{anggota}} ({{count}} eksemplar).',
                        nomor: lastResult.nomor,
                        anggota: lastResult.anggotaNama,
                        count: lastResult.count,
                      })}
                    </p>
                  ) : (
                    <p>
                      {t('sirkulasi:result.kembali', {
                        defaultValue:
                          '{{count}} eksemplar berhasil dikembalikan.',
                        count: lastResult.count,
                      })}
                    </p>
                  )}
                  <Link
                    to="/peminjaman"
                    className="mt-1 inline-block text-xs underline"
                  >
                    {t('sirkulasi:result.openList', {
                      defaultValue: 'Buka daftar peminjaman →',
                    })}
                  </Link>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              {mode === 'pinjam' ? (
                <Button
                  onClick={() => {
                    void submitPinjam();
                  }}
                  disabled={submitting || !anggota || basketUsableCount === 0}
                >
                  {submitting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                  )}
                  {t('sirkulasi:basket.submitPinjam', {
                    defaultValue: 'Simpan Peminjaman',
                  })}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    void submitKembali();
                  }}
                  disabled={submitting || returnTotal === 0}
                >
                  {submitting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="mr-1.5 h-4 w-4" />
                  )}
                  {t('sirkulasi:basket.submitKembali', {
                    defaultValue: 'Proses Pengembalian',
                  })}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PinjamWorkspace({
  anggota,
  basket,
  basketUsableCount,
  onRemove,
  onClearAnggota,
}: {
  anggota: Anggota | null;
  basket: BasketItem[];
  basketUsableCount: number;
  onRemove: (eksemplarId: number) => void;
  onClearAnggota: () => void;
}) {
  const { t } = useTranslation(['sirkulasi']);
  return (
    <>
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User2 className="h-4 w-4" />
            {anggota
              ? `${anggota.kodeAnggota} · ${anggota.nama}`
              : t('sirkulasi:pinjam.scanAnggota', {
                  defaultValue: 'Scan kartu anggota dulu…',
                })}
          </div>
          {anggota && (
            <Button variant="ghost" size="sm" onClick={onClearAnggota}>
              <XCircle className="mr-1 h-3.5 w-3.5" />
              {t('sirkulasi:pinjam.clearAnggota', { defaultValue: 'Ganti' })}
            </Button>
          )}
        </div>
        {anggota?.kelas && (
          <p className="mt-1 text-xs text-muted-foreground">
            {anggota.kelas}
            {anggota.jurusan ? ` · ${anggota.jurusan}` : ''}
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
          {t('sirkulasi:pinjam.basketHeader', {
            defaultValue: 'Eksemplar ({{ok}}/{{total}} siap)',
            ok: basketUsableCount,
            total: basket.length,
          })}
        </div>
        {basket.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {t('sirkulasi:pinjam.basketEmpty', {
              defaultValue: 'Belum ada eksemplar yang di-scan.',
            })}
          </p>
        ) : (
          <ul className="divide-y">
            {basket.map((b) => (
              <li
                key={b.eksemplar.eksemplarId}
                className={
                  b.available
                    ? 'flex items-center justify-between px-3 py-2 text-sm'
                    : 'flex items-center justify-between bg-destructive/10 px-3 py-2 text-sm'
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.eksemplar.judul}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.eksemplar.kodeEksemplar} · {b.eksemplar.kodeBuku}
                  </p>
                  {!b.available && (
                    <p className="text-xs text-destructive">
                      {t('sirkulasi:pinjam.unavailable', {
                        defaultValue:
                          'Status: {{status}} — sedang dipinjam, tidak akan diikutkan.',
                        status: b.eksemplar.status,
                      })}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(b.eksemplar.eksemplarId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function KembalikanWorkspace({
  groups,
  onRemoveItem,
}: {
  groups: Array<{ header: ActiveLoanForEksemplar; items: ActiveLoanForEksemplar[] }>;
  onRemoveItem: (peminjamanId: number, itemId: number) => void;
}) {
  const { t } = useTranslation(['sirkulasi']);
  if (groups.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-muted-foreground">
        {t('sirkulasi:kembali.empty', {
          defaultValue:
            'Pindai barcode eksemplar yang sedang dipinjam untuk memulai.',
        })}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.header.peminjamanId} className="rounded-md border">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium">{g.header.nomorPinjam}</p>
            <p className="text-xs text-muted-foreground">
              {g.header.anggotaKode} · {g.header.anggotaNama}
            </p>
          </div>
          <ul className="divide-y">
            {g.items.map((it) => (
              <li
                key={it.peminjamanItemId}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.judul}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.kodeEksemplar} · {it.kodeBuku}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(g.header.peminjamanId, it.peminjamanItemId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
