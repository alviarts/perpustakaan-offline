import * as React from 'react';
import { Toast, ToastClose, ToastDescription, ToastTitle } from '@/components/ui/toast';

export type ToastVariant = 'default' | 'destructive';

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. Defaults to 5000. Pass 0 to disable. */
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastManagerCtx {
  toasts: ToastEntry[];
  showToast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastManagerContext = React.createContext<ToastManagerCtx | null>(null);

let toastIdCounter = 0;
const nextId = (): string => {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
};

export function ToastManagerProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (opts: ToastOptions): string => {
      const id = nextId();
      setToasts((current) => [...current, { ...opts, id }]);
      return id;
    },
    [],
  );

  const value = React.useMemo<ToastManagerCtx>(
    () => ({ toasts, showToast, dismiss }),
    [toasts, showToast, dismiss],
  );

  return (
    <ToastManagerContext.Provider value={value}>
      {children}
      {toasts.map((entry) => (
        <Toast
          key={entry.id}
          variant={entry.variant ?? 'default'}
          duration={entry.duration ?? 5000}
          onOpenChange={(open) => {
            if (!open) dismiss(entry.id);
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{entry.title}</ToastTitle>
            {entry.description && <ToastDescription>{entry.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
    </ToastManagerContext.Provider>
  );
}

export function useToast(): ToastManagerCtx {
  const ctx = React.useContext(ToastManagerContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastManagerProvider>');
  }
  return ctx;
}
