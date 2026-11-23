import { describe, it, expect } from 'vitest';
import { buildRobotsTxt, CONTENT_SIGNAL, disallowedAgents } from './robotsTxt';
import { AI_CRAWLERS, ALWAYS_ALLOWED, DATA_HARVESTERS } from '@/config/bots';

const SITE = 'https://idznamiasto.pl';

describe('robots.txt for production', () => {
  const txt = buildRobotsTxt({ siteUrl: SITE, noindex: false });
  const blocked = disallowedAgents(txt).map((a) => a.toLowerCase());

  it('lets everyone else crawl the whole site', () => {
    expect(txt).toMatch(/^User-agent: \*\nContent-Signal: [^\n]+\nAllow: \/$/m);
    expect(blocked).not.toContain('*');
  });

  it('declares AI training and AI answers off, search on', () => {
    expect(txt).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
    expect(CONTENT_SIGNAL).toBe('search=yes, ai-train=no, ai-input=no');
  });

  it('reserves text and data mining rights in writing', () => {
    expect(txt).toContain('Article 4(3) of Directive (EU) 2019/790');
  });

  it('turns away the big AI crawlers and agents by name', () => {
    for (const bot of [
      'GPTBot',
      'ChatGPT-User',
      'OAI-SearchBot',
      'ClaudeBot',
      'Claude-User',
      'Claude-SearchBot',
      'anthropic-ai',
      'CCBot',
      'Google-Extended',
      'Applebot-Extended',
      'PerplexityBot',
      'Perplexity-User',
      'Bytespider',
      'meta-externalagent',
      'Amazonbot',
      'Scrapy',
    ]) {
      expect(blocked).toContain(bot.toLowerCase());
    }
  });

  it('turns away SEO and marketing harvesters', () => {
    for (const bot of DATA_HARVESTERS) expect(blocked).toContain(bot.toLowerCase());
    expect(blocked).toContain('ahrefsbot');
    expect(blocked).toContain('semrushbot');
  });

  it('never blocks a search engine or a link-preview bot', () => {
    for (const bot of ALWAYS_ALLOWED) expect(blocked).not.toContain(bot.toLowerCase());
  });

  it('keeps the synced AI list free of duplicates and generic tokens', () => {
    const lower = AI_CRAWLERS.map((a) => a.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    for (const generic of ['spider', 'dot', 'code', 'openai']) expect(lower).not.toContain(generic);
    expect(AI_CRAWLERS.length).toBeGreaterThan(100);
  });

  it('advertises the sitemap for its own origin', () => {
    expect(txt.trimEnd().split('\n').at(-1)).toBe(`Sitemap: ${SITE}/sitemap.xml`);
    expect(buildRobotsTxt({ siteUrl: 'https://example.test/your-events', noindex: false })).toContain(
      'Sitemap: https://example.test/your-events/sitemap.xml'
    );
  });
});

describe('robots.txt for a noindex environment', () => {
  const txt = buildRobotsTxt({ siteUrl: SITE, noindex: true });

  it('declines every crawler and lists no one by name', () => {
    expect(disallowedAgents(txt)).toEqual(['*']);
    expect(txt).not.toContain('Allow:');
    expect(txt).not.toContain('GPTBot');
  });

  it('still advertises the sitemap', () => {
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});

describe('disallowedAgents', () => {
  it('reads groups the way RFC 9309 defines them', () => {
    const txt = [
      'User-agent: a',
      'User-agent: b',
      'Disallow: /',
      '',
      'User-agent: c',
      'Allow: /',
      'User-agent: d # comment',
      'Disallow: /',
    ].join('\n');
    expect(disallowedAgents(txt)).toEqual(['a', 'b', 'd']);
  });
});
