import { GROW_WITH_US_PATH, MY_FILTERS_PATH, PRIVACY_PATH } from '@/config/community';
import { withTrailingSlash } from '@/lib/href';
import { collectCityPages } from './sitePages';

// Read by react-router.config.ts at build time (through Vite's module runner,
// so the `@/` alias and import.meta.env work here as they do in the app).

/** Pages that exist regardless of data, plus the two generated SEO files. */
export const STATIC_PATHS = ['/', MY_FILTERS_PATH, PRIVACY_PATH, GROW_WITH_US_PATH, '/sitemap.xml', '/robots.txt'];

/**
 * Every path the static export writes. The equivalent of the old
 * generateStaticParams + dynamicParams=false: a path not listed here does not
 * exist on the host, and GitHub Pages answers it with 404.html.
 */
export async function prerenderPaths(): Promise<string[]> {
  const paths = [...STATIC_PATHS];
  for (const city of await collectCityPages()) {
    paths.push(`/${city.cityId}`, `/${city.cityId}/wydarzenia`, ...city.hubs, ...city.events.map((e) => e.path));
  }
  // Written under the trailing-slash URL — the one every AppLink points at and
  // GitHub Pages redirects to. React Router names a page's loader-data file
  // after that URL (/a/b/ → /a/b/_.data, but /a/b → /a/b.data), so the
  // slash-less form would leave every client-side navigation to an event or a
  // hub fetching a file that does not exist. withTrailingSlash leaves the two
  // resource files (sitemap.xml, robots.txt) alone.
  return [...new Set(paths.map(withTrailingSlash))];
}
