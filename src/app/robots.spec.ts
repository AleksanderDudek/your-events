import { describe, it, expect, vi } from 'vitest';

async function loadRobots(overrides: Record<string, string>) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
  const mod = await import('./robots');
  return mod.default();
}

describe('robots.txt', () => {
  it('welcomes crawlers and declines AI harvesters when indexable', async () => {
    const robots = await loadRobots({});
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/' });
    // The AI/scraper opt-out survives — it is orthogonal to the environment.
    expect(rules[1]).toMatchObject({ disallow: '/' });
    expect(rules[1].userAgent).toContain('GPTBot');
  });

  it('declines every crawler when the environment is noindex', async () => {
    const robots = await loadRobots({ NEXT_PUBLIC_ROBOTS_NOINDEX: 'true' });
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ userAgent: '*', disallow: '/' });
    expect(rules[0].allow).toBeUndefined();
  });

  it('always advertises the sitemap for its own origin', async () => {
    const robots = await loadRobots({
      NEXT_PUBLIC_SITE_ORIGIN: 'https://example.test',
      NEXT_PUBLIC_BASE_PATH: '/your-events-prod',
    });
    expect(robots.sitemap).toBe('https://example.test/your-events-prod/sitemap.xml');
  });
});
