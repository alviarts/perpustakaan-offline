import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { ToastManagerProvider } from '@/components/ui/toast-manager';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ToastProvider>
      <ToastManagerProvider>
        <TooltipProvider delayDuration={150}>
          <Outlet />
          <ToastViewport />
        </TooltipProvider>
      </ToastManagerProvider>
    </ToastProvider>
  );
}
