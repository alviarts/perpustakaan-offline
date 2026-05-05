import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import { TitleBar } from '@/components/layout/TitleBar';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ToastProvider>
      <ToastManagerProvider>
        <TooltipProvider delayDuration={150}>
          <div className="flex h-screen flex-col">
            <TitleBar />
            <div className="min-h-0 flex-1">
              <Outlet />
            </div>
          </div>
          <ToastViewport />
        </TooltipProvider>
      </ToastManagerProvider>
    </ToastProvider>
  );
}
