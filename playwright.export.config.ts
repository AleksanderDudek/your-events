import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

// Second Playwright project, aimed at the STATIC EXPORT rather than `next dev`.
// The default config (playwright.config.ts) drives the dev server, which has a
// real server and RSC endpoint behind it — several App Router behaviours only
// differ in `output: 'export'`, so bugs that only exist in the deployed
// artifact never show up there. This config builds the site and serves `out/`
// with a plain file server, the same shape GitHub Pages does.
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
    // A production build, then a dumb static file server — no Next.js runtime.
    // No SPA rewrite (-s): the export is a real directory tree of prerendered
    // pages, and GitHub Pages serves it the same way.
    command: 'pnpm exec next build && npx --yes serve -l 4173 out',
    url: 'http://localhost:4173/wroclaw/wydarzenia/',
    reuseExistingServer: !isCI,
    // A cold `next build` prerenders every event permalink; give it room.
    timeout: 600_000,
    // Serve at the domain root so specs can use root-relative paths. Supabase
    // credentials flow in from .env.local locally and CI secrets in the
    // pipeline (Playwright merges these over process.env).
    env: { NEXT_PUBLIC_BASE_PATH: '' },
  },
});
