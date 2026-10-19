import { describe, it, expect, vi, afterEach } from 'vitest';

// site.ts computes its exports at module load from env, so each case reloads it.
async function loadSite(overrides: Record<string, string>) {
  vi.resetModules();
  delete process.env.VITE_ROBOTS_NOINDEX;
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  return import('./site');
}

describe('IS_NOINDEX', () => {
  it('is false when the variable is unset — production must stay indexable', async () => {
    const { IS_NOINDEX } = await loadSite({});
    expect(IS_NOINDEX).toBe(false);
  });

  it('is true for the exact string "true"', async () => {
    const { IS_NOINDEX } = await loadSite({ VITE_ROBOTS_NOINDEX: 'true' });
    expect(IS_NOINDEX).toBe(true);
  });

  // A half-set variable must not accidentally hide production from Google.
  it('is false for any other value', async () => {
    for (const value of ['false', '1', 'yes', '']) {
      const { IS_NOINDEX } = await loadSite({ VITE_ROBOTS_NOINDEX: value });
      expect(IS_NOINDEX).toBe(false);
    }
  });
});

describe('SITE_URL', () => {
  afterEach(() => vi.unstubAllEnvs());

  // The base path is Vite's `base`, which the app sees as BASE_URL (always with
  // a trailing slash) — not a second env var of its own.
  it('joins the origin and the base path', async () => {
    vi.stubEnv('BASE_URL', '/your-events-prod/');
    const { SITE_URL } = await loadSite({ VITE_SITE_ORIGIN: 'https://example.test' });
    expect(SITE_URL).toBe('https://example.test/your-events-prod');
  });

  it('is the bare origin when the site is served at the domain root', async () => {
    vi.stubEnv('BASE_URL', '/');
    const { SITE_URL } = await loadSite({ VITE_SITE_ORIGIN: 'https://idznamiasto.pl/' });
    expect(SITE_URL).toBe('https://idznamiasto.pl');
  });
});
