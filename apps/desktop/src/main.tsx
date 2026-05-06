import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import './styles/globals.css';
import './i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useIdentityStore, subscribeIdentityChanges } from '@/stores/identityStore';
import { tryAutoLogin } from '@/lib/auth';
import { settingsApi } from '@/lib/settings';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import { ToastManagerProvider } from '@/components/ui/toast-manager';
import { OpacApp } from '@/features/opac/OpacApp';
import { routeTree } from './routeTree.gen';

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

useThemeStore.getState().resolve();

function OpacRoot(): JSX.Element {
  return (
    <ToastProvider>
      <ToastManagerProvider>
        <TooltipProvider delayDuration={150}>
          <div className="flex h-screen flex-col">
            <div className="min-h-0 flex-1">
              <OpacApp />
            </div>
          </div>
          <ToastViewport />
        </TooltipProvider>
      </ToastManagerProvider>
    </ToastProvider>
  );
}

void (async () => {
  void useIdentityStore.getState().loadIdentity();
  void subscribeIdentityChanges();

  let appMode: 'admin' | 'public' = 'admin';
  try {
    appMode = await settingsApi.getAppMode();
  } catch {
    // Default to admin mode on read failure.
  }

  if (appMode !== 'public') {
    const auth = useAuthStore.getState();
    if (auth.rememberMe && !auth.user) {
      try {
        const user = await tryAutoLogin();
        if (user) auth.setUser(user);
      } catch {
        /* ignore */
      }
    }
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element not found');

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      {appMode === 'public' ? <OpacRoot /> : <RouterProvider router={router} />}
    </React.StrictMode>,
  );
})();
