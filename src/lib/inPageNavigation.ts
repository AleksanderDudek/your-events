import { withBasePath } from '@/lib/constants';

/**
 * Go to another URL of the page already open — the same route with a
 * different query string — without the App Router's navigate.
 *
 * Why not router.push()/replace() or a <Link>: in the STATIC EXPORT (what
 * GitHub Pages serves; `next dev` is fine, so tests running on it never see
 * this) Next 16 caches a route by its pathname together with the canonical URL
 * the document was cold-loaded with, query string included. A navigation to
 * the same pathname then reuses that URL: from `?plan=1.2` a replace to the
 * bare page writes `?plan=1.2` straight back, and nothing changes. The events
 * list hit it with its filters, "Twój tydzień" with "Skopiuj do moich planów".
 *
 * Writing history ourselves and replaying a popstate makes the router re-read
 * the location — a soft navigation, no reload, useSearchParams updates.
 *
 * @param path the app path WITHOUT the base path, e.g. `/szczecin/moj-tydzien/?id=k3x9`;
 *   history.pushState is not base-path-aware the way router.push is.
 */
export function navigateInPage(
  path: string,
  { replace = false }: { replace?: boolean } = {}
): void {
  const href = withBasePath(path);
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

/**
 * Whether a link to `path` (no base path, no query) points at the page already
 * open, with a query string the link would drop — the case a <Link> gets wrong
 * in the static export (see navigateInPage).
 */
export function isSamePageWithQuery(path: string, currentPathname: string): boolean {
  const strip = (p: string) => p.replace(/\/+$/, '') || '/';
  return strip(path) === strip(currentPathname) && window.location.search !== '';
}
