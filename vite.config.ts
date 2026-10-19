import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveBasePath, toViteBase } from './build-tools/basePath.ts';
import { pwaOptions } from './build-tools/pwa.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = toViteBase(resolveBasePath(env.VITE_BASE_PATH));

  return {
    base,
    resolve: { tsconfigPaths: true },
    server: {
      port: 3000,
      strictPort: true,
      // Build output and test reports live inside the project; a build run
      // next to the dev server must not reload every open page.
      watch: { ignored: ['**/build/**', '**/out/**', '**/playwright-report/**', '**/test-results/**'] },
    },
    optimizeDeps: {
      // Scan every module up front. Left to discover dependencies as pages
      // request them (the map, the date pickers, icons in lazily loaded
      // routes), the dev server re-bundles and force-reloads the page each
      // time it finds a new one — mid-click, and in a way that briefly loads
      // Emotion twice.
      entries: ['src/root.tsx', 'src/routes/**/*.{ts,tsx}', 'src/components/**/*.tsx', '!src/**/*.spec.{ts,tsx}'],
    },
    preview: { port: 4173, strictPort: true },
    plugins: [reactRouter(), VitePWA(pwaOptions(base))],
    css: {
      modules: {
        // Readable, file-prefixed class names (EventRow-module__row__x1Y2z), as
        // the Next build had: they make the shipped markup debuggable, and the
        // export e2e suite tells views apart by them.
        generateScopedName: '[name]__[local]__[hash:base64:5]',
      },
    },
    ssr: {
      // Bundle MUI and Emotion into the prerender build rather than loading
      // them from node_modules. Left external, the dev server ends up with two
      // copies of Emotion's React context (one per import path) and styles
      // silently stop applying — MUI's own React Router example does the same:
      // https://github.com/mui/material-ui/issues/45878#issuecomment-2987441663
      optimizeDeps: { include: ['@emotion/*', '@mui/*'] },
      noExternal: ['@emotion/*', '@mui/*'],
    },
  };
});
