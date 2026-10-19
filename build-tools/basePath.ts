// The path the site is served under, read once by the build configs
// (vite.config.ts and react-router.config.ts). Everything inside the app reads
// the result back through import.meta.env.BASE_URL, so there is one source of
// truth instead of several files "kept in sync".
//
//   dev site (GitHub Pages project page)  VITE_BASE_PATH unset → /your-events
//   production (idznamiasto.pl, root)     VITE_BASE_PATH = ''  → ''
//   local dev / Playwright                VITE_BASE_PATH = ''  → ''
export const DEFAULT_BASE_PATH = '/your-events';

/** `''` means the domain root; anything else is `/segment` with no trailing slash. */
export function resolveBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? DEFAULT_BASE_PATH).trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Vite `base` / React Router `basename` form: always with a trailing slash. */
export function toViteBase(basePath: string): string {
  return `${basePath}/`;
}
