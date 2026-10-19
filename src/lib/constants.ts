import { PageSize } from '@/types/filter.types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE: PageSize = 15;
export const PAGE_SIZE_OPTIONS: PageSize[] = [15, 30, 60];
export const SEARCH_DEBOUNCE_MS = 1500;

// The base path the app is served under: '' at a domain root, '/your-events'
// on the GitHub Pages project site. It is Vite's `base` (set from
// VITE_BASE_PATH in the build configs — build-tools/basePath.ts) read back as
// BASE_URL, which always ends in '/'. React Router's <Link> and navigate()
// prefix it themselves; anything built outside the router — Leaflet popup HTML,
// <img> src, history entries — needs withBasePath().
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}
