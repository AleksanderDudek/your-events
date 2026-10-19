import { GROW_WITH_US_PATH, PRIVACY_PATH } from '@/config/community';
import { SITE_URL } from '@/config/site';
import { collectCityPages } from '@/build/sitePages';
import { withTrailingSlash } from '@/lib/href';
import { sitemapXml, type SitemapEntry } from '@/lib/sitemap';

// A resource route, rendered to out/sitemap.xml at build time. Same URL form
// as the canonicals (absolute, trailing slash), so every entry is the page's
// own canonical and none of them is a redirect.
const absolute = (path: string) => `${SITE_URL}${withTrailingSlash(path)}`;

function lastModifiedOf(updatedAt: string | null, fallback: Date): Date {
  if (!updatedAt) return fallback;
  const d = new Date(updatedAt);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function loader() {
  const now = new Date();
  const entries: SitemapEntry[] = [
    { url: absolute('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absolute(GROW_WITH_US_PATH), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absolute(PRIVACY_PATH), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  for (const city of await collectCityPages()) {
    entries.push(
      { url: absolute(`/${city.cityId}`), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
      { url: absolute(`/${city.cityId}/wydarzenia`), lastModified: now, changeFrequency: 'daily', priority: 0.8 }
    );
    for (const hub of city.hubs) {
      entries.push({ url: absolute(hub), lastModified: now, changeFrequency: 'daily', priority: 0.7 });
    }
    for (const e of city.events) {
      entries.push({
        url: absolute(e.path),
        lastModified: lastModifiedOf(e.updatedAt, now),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }

  return new Response(sitemapXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
