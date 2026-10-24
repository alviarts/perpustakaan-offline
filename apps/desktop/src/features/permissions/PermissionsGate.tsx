import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
import { Camera, CheckCircle2, Download, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LS_PERMISSIONS = 'perpustakaan.permissions.done';

export function permissionsDone(): boolean {
  try {
    return window.localStorage.getItem(LS_PERMISSIONS) === '1';
  } catch {
    return true;
  }
}

function markDone(): void {
  try {
    window.localStorage.setItem(LS_PERMISSIONS, '1');
  } catch {
    // ignore
  }
}

type CameraState = 'idle' | 'asking' | 'ok' | 'denied' | 'unsupported';

/**
 * Layar persiapan izin (sekali saja).
 *
 * - Meminta izin **kamera** (untuk scan barcode ISBN / sirkulasi).
 * - Menjelaskan bahwa **unduh** dan **cetak** memakai dialog sistem
 *   (bukan izin browser), jadi tidak ada pop-up yang perlu diizinkan.
 */
export function PermissionsGate() {
  const navigate = useNavigate();
  const [camera, setCamera] = useState<CameraState>('idle');

  const askCamera = async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      return;
    }
    setCamera('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCamera('ok');
    } catch {
      setCamera('denied');
    }
  };

  const finish = (): void => {
    markDone();
    void navigate({ to: '/login' });
  };

  const items = [
    {
      icon: Camera,
      title: 'Kamera',
      body: 'Dipakai untuk memindai barcode ISBN dan kartu anggota.',
      status:
        camera === 'ok'
          ? 'Diizinkan'
          : camera === 'denied'
            ? 'Ditolak'
            : camera === 'unsupported'
              ? 'Tidak tersedia'
              : 'Belum diminta',
      ok: camera === 'ok',
    },
    {
      icon: Download,
      title: 'Unduh file',
      body: 'Ekspor Excel/PDF/disiapkan otomatis lewat dialog simpan sistem.',
      status: 'Otomatis',
      ok: true,
    },
    {
      icon: Printer,
      title: 'Cetak',
      body: 'Nota, label, dan kartu dicetak lewat dialog cetak sistem.',
      status: 'Otomatis',
      ok: true,
    },
  ] as const;

  return (
    <div className="bg-background text-foreground flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl space-y-6 rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Siapkan Izin Aplikasi</h1>
          <p className="text-sm text-muted-foreground">
            Izinkan semua agar fitur berjalan sempurna. Cukup sekali.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    item.ok ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>

        {camera === 'denied' && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Izin kamera ditolak. Aktifkan lewat pengaturan sistem (Windows: Settings →
            Privacy &amp; security → Camera), lalu tekan tombol di bawah lagi.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => void askCamera()}
            disabled={camera === 'asking'}
            data-testid="permintaan-kamera"
          >
            <Camera className="mr-2 h-4 w-4" />
            {camera === 'ok'
              ? 'Kamera siap'
              : camera === 'asking'
                ? 'Meminta izin…'
                : 'Izinkan kamera'}
          </Button>
          <Button type="button" className="flex-1" onClick={finish} data-testid="izin-lanjut">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Izinkan semua &amp; lanjut
          </Button>
        </div>

        <button
          type="button"
          onClick={finish}
          className="w-full text-center text-xs text-muted-foreground underline"
        >
          Lewati untuk sekarang
        </button>
      </motion.div>
    </div>
  );
}
