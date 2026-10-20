import { PageSize } from '@/types/filter.types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE: PageSize = 15;
export const PAGE_SIZE_OPTIONS: PageSize[] = [15, 30, 60];
export const SEARCH_DEBOUNCE_MS = 1500;

// The real base path the app is served under — same resolution as
// next.config.js and @/config/site. Next.js auto-prefixes <Link>, next/router
// and asset imports, but raw anchors built outside the React tree (e.g. Leaflet
// popup HTML) need it applied manually. Reading the env (instead of hardcoding
// '/your-events') keeps those anchors correct whether the site is served under
// /your-events on GitHub Pages or at the domain root (dev / preview / custom
// domain) — otherwise map-pin links 404 anywhere but production.
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/your-events';
export const BASE_PATH = rawBasePath === '' ? '' : rawBasePath.replace(/\/+$/, '');

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}
