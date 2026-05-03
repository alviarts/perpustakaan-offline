import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ToastProvider>
      <TooltipProvider delayDuration={150}>
        <Outlet />
        <ToastViewport />
      </TooltipProvider>
    </ToastProvider>
  );
}
