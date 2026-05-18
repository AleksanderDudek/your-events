import { PageSize } from '@/types/filter.types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE: PageSize = 15;
export const PAGE_SIZE_OPTIONS: PageSize[] = [15, 30, 60];
export const SEARCH_DEBOUNCE_MS = 1500;

// Mirrors the basePath set in next.config.js. Next.js auto-prefixes <Link>,
// next/router, and asset imports, but raw anchors built outside the React tree
// (e.g. Leaflet popup HTML) need this prefix applied manually.
export const BASE_PATH = '/your-events';

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}
