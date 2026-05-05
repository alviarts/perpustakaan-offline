import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, Copy, X } from 'lucide-react';

/**
 * Lazy import handle to `@tauri-apps/api/window`. We keep the type as `any`
 * to avoid pulling the runtime into the SSR path; the ImportError is caught
 * inside the effect so the component degrades gracefully when running in a
 * browser dev session (no Tauri host present).
 */
type TauriWindow = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (cb: () => void) => Promise<() => void>;
};

let cachedWindow: TauriWindow | null | undefined;

async function getTauriWindow(): Promise<TauriWindow | null> {
  if (cachedWindow !== undefined) return cachedWindow;
  try {
    const mod = await import('@tauri-apps/api/window');
    cachedWindow = mod.getCurrentWindow() as unknown as TauriWindow;
  } catch {
    cachedWindow = null;
  }
  return cachedWindow;
}

interface TitleBarProps {
  /** Override the visible product name; falls back to the i18n appName. */
  appName?: string;
}

/**
 * Custom 36 px title bar that replaces the OS-native chrome.
 *
 * Layout:
 *   [icon][app name] ........ <drag region> ........ [_][▢][×]
 *
 * The middle stretch is a single span with `data-tauri-drag-region` so the
 * user can grab anywhere outside the buttons to move the window. Double-click
 * inside that region toggles maximise — the same gesture as native chrome on
 * GNOME / Windows.
 */
export function TitleBar({ appName }: TitleBarProps): JSX.Element {
  const { t } = useTranslation(['common']);
  const [maximized, setMaximized] = useState(false);
  const label = appName ?? t('common:appName', { defaultValue: 'Perpustakaan Offline' });

  // Sync the maximize-button icon with the actual window state, including
  // when the user drags-to-edge or hits the OS shortcut (Super+Up on GNOME,
  // Win+Up on Windows). `onResized` covers both maximize and unmaximize
  // because both fire a resize event.
  useEffect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      const w = await getTauriWindow();
      if (!w || cancelled) return;
      try {
        setMaximized(await w.isMaximized());
        dispose = await w.onResized(() => {
          void w.isMaximized().then((m) => {
            if (!cancelled) setMaximized(m);
          });
        });
      } catch {
        // Fall through — the title bar is purely decorative without a host.
      }
    })();
    return () => {
      cancelled = true;
      if (dispose) dispose();
    };
  }, []);

  async function handleMinimize(): Promise<void> {
    const w = await getTauriWindow();
    if (w) await w.minimize();
  }

  async function handleToggleMaximize(): Promise<void> {
    const w = await getTauriWindow();
    if (w) await w.toggleMaximize();
  }

  async function handleClose(): Promise<void> {
    const w = await getTauriWindow();
    if (w) await w.close();
  }

  return (
    <div
      className="flex h-9 w-full select-none items-center border-b bg-card text-card-foreground"
      data-testid="title-bar"
    >
      <div
        className="flex flex-1 items-center gap-2 px-3"
        data-tauri-drag-region
        onDoubleClick={() => {
          void handleToggleMaximize();
        }}
      >
        <img
          src="/icon.png"
          alt=""
          className="h-4 w-4"
          draggable={false}
          onError={(e) => {
            // Hide gracefully if the favicon isn't available in dev.
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="pointer-events-none text-xs font-medium tracking-tight">
          {label}
        </span>
      </div>
      <div className="flex h-full items-stretch">
        <TitleBarButton
          aria-label={t('common:titleBar.minimize', { defaultValue: 'Minimize' })}
          onClick={() => {
            void handleMinimize();
          }}
        >
          <Minus className="h-3.5 w-3.5" />
        </TitleBarButton>
        <TitleBarButton
          aria-label={
            maximized
              ? t('common:titleBar.restore', { defaultValue: 'Restore' })
              : t('common:titleBar.maximize', { defaultValue: 'Maximize' })
          }
          onClick={() => {
            void handleToggleMaximize();
          }}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3 w-3" />}
        </TitleBarButton>
        <TitleBarButton
          aria-label={t('common:titleBar.close', { defaultValue: 'Close' })}
          onClick={() => {
            void handleClose();
          }}
          variant="danger"
        >
          <X className="h-3.5 w-3.5" />
        </TitleBarButton>
      </div>
    </div>
  );
}

interface TitleBarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger';
}

function TitleBarButton({
  children,
  variant = 'default',
  className,
  ...rest
}: TitleBarButtonProps): JSX.Element {
  const hover =
    variant === 'danger'
      ? 'hover:bg-destructive hover:text-destructive-foreground'
      : 'hover:bg-muted/60';
  return (
    <button
      type="button"
      className={`flex h-full w-11 items-center justify-center text-muted-foreground transition-colors ${hover} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
