import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CameraOff, Loader2, ScanLine, Video, VideoOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-manager';
import { useBarcodeScanner } from '@/features/sirkulasi/useBarcodeScanner';
import { ScannerTrackingOverlay } from '@/features/sirkulasi/ScannerTrackingOverlay';
import { anggotaApi, type Anggota } from '@/lib/anggota';
import { parseQrPayload } from '@/lib/kta';

export interface OpacKtaScanFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAuthenticated?: (member: Anggota) => void;
}

/**
 * KTA scan flow for OPAC public mode. Wraps `useBarcodeScanner` to show a
 * camera preview inside the modal, decode `kode_anggota` (Code-128) or
 * `member:<id>` (QR), look up the member, and notify the caller.
 *
 * Camera lifecycle is owned here — the hook itself is generic, this
 * component holds the only DOM `<video>` so other OPAC components don't
 * have to. The hook is automatically stopped when the dialog closes.
 */
export function OpacKtaScanFlow({
  open,
  onOpenChange,
  onMemberAuthenticated,
}: OpacKtaScanFlowProps): JSX.Element {
  const { t } = useTranslation('opac');
  const { showToast } = useToast();
  const [resolving, setResolving] = useState(false);

  const handleDecode = async (text: string): Promise<void> => {
    if (resolving) return;
    setResolving(true);
    try {
      let member: Anggota | null = null;
      const memberId = parseQrPayload(text);
      if (memberId !== null) {
        try {
          member = await anggotaApi.get(memberId);
        } catch {
          member = null;
        }
      }
      if (!member) {
        member = await anggotaApi.getByKode(text.trim());
      }
      if (!member) {
        showToast({
          variant: 'destructive',
          title: t('session.memberNotFound', { kode: text }),
        });
        return;
      }
      scanner.stop();
      onOpenChange(false);
      onMemberAuthenticated?.(member);
    } catch (err) {
      showToast({
        variant: 'destructive',
        title: t('session.scanError'),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setResolving(false);
    }
  };

  const scanner = useBarcodeScanner({
    onDecode: (text) => {
      void handleDecode(text);
    },
  });

  // Stop the camera whenever the dialog closes so the MediaStream is
  // released even if the user dismisses the modal mid-scan.
  useEffect(() => {
    if (!open) scanner.stop();
  }, [open, scanner]);

  const errorMessage =
    scanner.errorKind === 'permission'
      ? t('session.cameraPermissionDenied')
      : scanner.errorKind === 'no-device'
        ? t('session.cameraNoDevice')
        : scanner.errorKind === 'in-use'
          ? t('session.cameraInUse')
          : scanner.errorKind === 'unsupported'
            ? t('session.cameraUnsupported')
            : scanner.error
              ? t('session.cameraOtherError')
              : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {t('home.scanKta')}
          </DialogTitle>
          <DialogDescription>{t('session.scanInstruction')}</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-md border bg-black/90">
          <video
            ref={scanner.videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          {scanner.active && scanner.lastDetection && (
            <ScannerTrackingOverlay
              location={scanner.lastDetection.location}
              roiWidth={scanner.lastDetection.roiWidth}
              roiHeight={scanner.lastDetection.roiHeight}
              flash={scanner.decodeFlash}
            />
          )}
          {!scanner.active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
              <CameraOff className="h-10 w-10 opacity-70" aria-hidden="true" />
              <p className="text-sm">
                {scanner.starting ? t('session.starting') : t('session.cameraOff')}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scanner.active ? (
            <Button variant="outline" onClick={() => scanner.stop()}>
              <VideoOff className="mr-1.5 h-4 w-4" />
              {t('session.stopCamera')}
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
              {t('session.startCamera')}
            </Button>
          )}
          {scanner.devices.length > 1 && scanner.selectedDeviceId && (
            <Select
              value={scanner.selectedDeviceId}
              onValueChange={(v) => scanner.selectDevice(v)}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder={t('session.selectDevice')} />
              </SelectTrigger>
              <SelectContent>
                {scanner.devices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 6)}…`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              scanner.stop();
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('search.back')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
