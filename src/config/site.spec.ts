import { describe, it, expect, vi } from 'vitest';

// site.ts computes its exports at module load from env, so each case reloads it.
async function loadSite(overrides: Record<string, string>) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  return import('./site');
}

describe('IS_NOINDEX', () => {
  it('is false when the variable is unset — production must stay indexable', async () => {
    const { IS_NOINDEX } = await loadSite({});
    expect(IS_NOINDEX).toBe(false);
  });

  it('is true for the exact string "true"', async () => {
    const { IS_NOINDEX } = await loadSite({ NEXT_PUBLIC_ROBOTS_NOINDEX: 'true' });
    expect(IS_NOINDEX).toBe(true);
  });

  // A half-set variable must not accidentally hide production from Google.
  it('is false for any other value', async () => {
    for (const value of ['false', '1', 'yes', '']) {
      const { IS_NOINDEX } = await loadSite({ NEXT_PUBLIC_ROBOTS_NOINDEX: value });
      expect(IS_NOINDEX).toBe(false);
    }
  });
});

describe('SITE_URL', () => {
  it('joins the origin and the base path', async () => {
    const { SITE_URL } = await loadSite({
      NEXT_PUBLIC_SITE_ORIGIN: 'https://example.test',
      NEXT_PUBLIC_BASE_PATH: '/your-events-prod',
    });
    expect(SITE_URL).toBe('https://example.test/your-events-prod');
  });
});
