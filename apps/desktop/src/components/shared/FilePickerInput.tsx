import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isTauri } from '@/lib/auth';
import { assetsApi, type AssetCategory } from '@/lib/assets';
import { cn } from '@/lib/utils';

export interface FilePickerInputProps {
  /** Path stored in DB (relative under `uploads/`, or empty / null). */
  value: string | null | undefined;
  /** Called with the new relative path, or `null` when cleared. */
  onChange: (relPath: string | null) => void;
  /** Maps to a subdirectory under `<app_data_dir>/uploads/`. */
  category: AssetCategory;
  /** Visible label on the "pick" button. Defaults to a generic i18n string. */
  pickLabel?: string;
  /** Visible label on the "clear" button. Defaults to a generic i18n string. */
  clearLabel?: string;
  /** Square preview side in px (default 96). */
  previewSize?: number;
  /** Render the preview round (e.g. for member photos). */
  rounded?: boolean;
  className?: string;
  disabled?: boolean;
  /**
   * Optional override for the `data-testid` on the wrapper. Inner buttons
   * derive their testids from this (`<id>-pick`, `<id>-clear`,
   * `<id>-preview`).
   */
  testId?: string;
}

/**
 * Compact file picker bound to the [`assetsApi`](../../lib/assets.ts) RPC:
 * empty state shows a placeholder icon + "Pilih foto" button; once a file
 * is picked, the preview thumbnail and a "Hapus" button replace it. The
 * component owns the dialog → save → preview pipeline so callers (form
 * fields) only see a single `value: string | null` in/out.
 *
 * Used as the canonical photo / cover / logo picker for the three deferred
 * surfaces from Devin session 5: anggota.foto_path, buku.cover_path, and
 * identity.logo_path.
 */
export function FilePickerInput({
  value,
  onChange,
  category,
  pickLabel,
  clearLabel,
  previewSize = 96,
  rounded = false,
  className,
  disabled,
  testId,
}: FilePickerInputProps) {
  const { t } = useTranslation(['common']);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tracks the in-flight resolution so a fast `value` change does not
  // race with a stale preview write-back.
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const myId = requestId.current;

    if (!value) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const abs = await assetsApi.resolve(value);
        if (cancelled || requestId.current !== myId) return;
        if (!abs || abs.startsWith('mock://')) {
          // Browser-mode mock: we cannot read local files, so just show
          // the placeholder.
          setPreviewUrl(null);
          return;
        }
        setPreviewUrl(isTauri() ? convertFileSrc(abs) : abs);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  async function handlePick() {
    if (disabled) return;
    setBusy(true);
    try {
      const result = await assetsApi.pickAndSave(category);
      if (!result) return;
      // Best-effort cleanup of the prior file so we don't leak stale
      // uploads when the user replaces a photo.
      if (value) {
        try {
          await assetsApi.delete(value);
        } catch {
          /* ignore — leftover file is harmless */
        }
      }
      onChange(result.relPath);
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (disabled || !value) return;
    setBusy(true);
    try {
      try {
        await assetsApi.delete(value);
      } catch {
        /* ignore — DB row should still drop the reference */
      }
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  const id = testId ?? 'file-picker';

  return (
    <div className={cn('flex items-start gap-3', className)} data-testid={id}>
      <div
        className={cn(
          'bg-muted relative flex shrink-0 items-center justify-center overflow-hidden border',
          rounded ? 'rounded-full' : 'rounded-md',
        )}
        style={{ width: previewSize, height: previewSize }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
            data-testid={`${id}-preview`}
          />
        ) : (
          <ImageIcon className="text-muted-foreground h-6 w-6" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePick}
          disabled={disabled || busy}
          data-testid={`${id}-pick`}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {pickLabel ?? t('common:filePicker.pick', { defaultValue: 'Pilih file…' })}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || busy}
            data-testid={`${id}-clear`}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {clearLabel ?? t('common:filePicker.clear', { defaultValue: 'Hapus file' })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
