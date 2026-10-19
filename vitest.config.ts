import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit tests run the components directly, without the React Router build
// plugin (which only makes sense for a whole app), so this config is separate
// from vite.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // A vite-plugin-pwa virtual module; this config does not load the plugin.
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/test-utils/pwaRegister.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Both e2e suites are Playwright's (dev server / static export).
    exclude: ['e2e/**', 'e2e-export/**', 'node_modules/**', 'build/**', 'out/**'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
});
