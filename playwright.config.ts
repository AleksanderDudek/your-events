import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Real-Supabase reads + a Next dev server can be momentarily slow; a couple
  // of retries keep the (non-blocking) signal clean without hiding real breaks.
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  // Dev-server route compilation on first hit can be slow — give tests and
  // assertions comfortable headroom so cold compiles don't read as failures.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [
        ['github'],
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'results.json' }],
      ]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
    // Serve the app at the domain root (drop the '/your-events' GitHub Pages
    // base path) so specs can use root-relative paths like '/events'. Supabase
    // credentials flow in from .env.local locally and from CI secrets in the
    // pipeline (Playwright merges these over process.env).
    env: { NEXT_PUBLIC_BASE_PATH: '' },
  },
});
