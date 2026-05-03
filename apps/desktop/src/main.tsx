import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import './styles/globals.css';
import './i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { tryAutoLogin } from '@/lib/auth';
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

void (async () => {
  const auth = useAuthStore.getState();
  if (auth.rememberMe && !auth.user) {
    try {
      const user = await tryAutoLogin();
      if (user) auth.setUser(user);
    } catch {
      /* ignore */
    }
  }
})();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
