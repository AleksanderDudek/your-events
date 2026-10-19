import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

// Second Playwright project, aimed at the STATIC EXPORT rather than the dev
// server. The default config (playwright.config.ts) drives `react-router dev`,
// which renders every page on request — prerendered HTML, .data files, the
// 404.html fallback and the service worker only exist in the build, so bugs
// that only exist in the deployed artifact never show up there. This config
// builds the site and serves `out/` with a plain file server, the same shape
// GitHub Pages does.
//
// Run: pnpm test:e2e:export
export default defineConfig({
  testDir: './e2e-export',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A production build, then a dumb static file server. No SPA rewrite (-s):
    // the export is a real directory tree of prerendered pages, and GitHub
    // Pages serves it the same way (with 404.html for anything else).
    command: 'pnpm build && pnpm exec serve -l 4173 out',
    url: 'http://localhost:4173/wroclaw/wydarzenia/',
    reuseExistingServer: !isCI,
    // A cold build prerenders every event permalink; give it room.
    timeout: 600_000,
    // Serve at the domain root so specs can use root-relative paths. Supabase
    // credentials flow in from .env.local locally and CI secrets in the
    // pipeline (Playwright merges these over process.env).
    env: { VITE_BASE_PATH: '' },
  },
});
