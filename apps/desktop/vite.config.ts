import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: 'src/routes',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@docs': path.resolve(__dirname, '../../docs'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    hmr: { protocol: 'ws', host: '0.0.0.0', port: 1421 },
    watch: { ignored: ['**/src-tauri/**'] },
    // Allow Vite to serve the repo-root `docs/manual.md` as a `?raw` import
    // for the in-app Manual tab (revisi #4 — moved from a separate HTML
    // window into Settings → Manual to avoid the WebView2 child-window bug
    // observed on Windows installs).
    fs: {
      allow: [path.resolve(__dirname, '..', '..')],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
  },
});
