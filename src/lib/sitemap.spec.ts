import { describe, it, expect } from 'vitest';
import { sitemapXml } from './sitemap';

describe('sitemapXml', () => {
  const lastModified = new Date('2026-10-19T08:00:00.000Z');

  it('serializes every entry as a <url> in the sitemaps.org namespace', () => {
    const xml = sitemapXml([
      { url: 'https://example.test/', lastModified, changeFrequency: 'daily', priority: 1 },
      { url: 'https://example.test/wroclaw/', lastModified, changeFrequency: 'weekly', priority: 0.6 },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain(
      '<url>\n<loc>https://example.test/wroclaw/</loc>\n<lastmod>2026-10-19T08:00:00.000Z</lastmod>\n<changefreq>weekly</changefreq>\n<priority>0.6</priority>\n</url>'
    );
  });

  // Event slugs are ASCII, but a <loc> is XML text: an '&' from a future
  // query-string or a stray character must not make the whole file invalid.
  it('escapes XML special characters in URLs', () => {
    const xml = sitemapXml([
      { url: 'https://example.test/a?x=1&y=<2>', lastModified, changeFrequency: 'daily', priority: 0.5 },
    ]);
    expect(xml).toContain('<loc>https://example.test/a?x=1&amp;y=&lt;2&gt;</loc>');
  });
});
