import { describe, it, expect } from 'vitest';
import { robotsTxt, BLOCKED_BOTS } from './robots';

const SITE = 'https://example.test/your-events-prod';

/** robots.txt groups, split on blank lines, each as its trimmed lines. */
function groups(txt: string): string[][] {
  return txt
    .trim()
    .split(/\n\s*\n/)
    .map((g) => g.split('\n').map((l) => l.trim()));
}

describe('robotsTxt', () => {
  it('welcomes crawlers and declines AI harvesters when indexable', () => {
    const [everyone, harvesters] = groups(robotsTxt({ noindex: false, siteUrl: SITE }));
    expect(everyone).toEqual(['User-Agent: *', 'Allow: /']);
    // The AI/scraper opt-out survives — it is orthogonal to the environment.
    expect(harvesters).toContain('User-Agent: GPTBot');
    expect(harvesters.filter((l) => l.startsWith('User-Agent:'))).toHaveLength(BLOCKED_BOTS.length);
    expect(harvesters.at(-1)).toBe('Disallow: /');
  });

  it('declines every crawler when the environment is noindex', () => {
    const txt = robotsTxt({ noindex: true, siteUrl: SITE });
    const [only, sitemap] = groups(txt);
    expect(only).toEqual(['User-Agent: *', 'Disallow: /']);
    expect(sitemap).toEqual([`Sitemap: ${SITE}/sitemap.xml`]);
    expect(txt).not.toContain('Allow: /');
  });

  it('always advertises the sitemap for its own origin', () => {
    expect(robotsTxt({ noindex: false, siteUrl: SITE })).toContain(
      'Sitemap: https://example.test/your-events-prod/sitemap.xml'
    );
  });
});
