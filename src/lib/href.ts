/**
 * The URL form the static host serves without a redirect.
 *
 * Every page is prerendered to `<path>/index.html`, and GitHub Pages answers the
 * slash-less form of a directory with a 301. Internal links and canonicals
 * carry the slash so neither visitors (cold loads, new tabs) nor crawlers pay
 * for that hop — the same URLs Next's `trailingSlash: true` used to emit.
 *
 * Only site-relative page paths are rewritten: absolute URLs, `mailto:`,
 * fragments and file paths (`/sitemap.xml`) pass through untouched.
 */
export function withTrailingSlash(href: string): string {
  if (!href.startsWith('/')) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);
  if (path.endsWith('/')) return href;
  // A dot in the last segment is a file, not a directory.
  if (/\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf('/') + 1))) return href;
  return `${path}/${rest}`;
}
