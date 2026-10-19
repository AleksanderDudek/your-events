export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A sitemaps.org `<urlset>` document. */
export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      '<url>',
      `<loc>${escapeXml(e.url)}</loc>`,
      `<lastmod>${e.lastModified.toISOString()}</lastmod>`,
      `<changefreq>${e.changeFrequency}</changefreq>`,
      `<priority>${e.priority}</priority>`,
      '</url>',
    ].join('\n')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
