import { access, cp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface FinalizeOptions {
  /** React Router's browser build (build/client). */
  clientDir: string;
  /** What GitHub Pages publishes (out/). */
  outDir: string;
  /** '' or '/segment[/segment]' — see build-tools/basePath.ts. */
  basePath: string;
}

// What every deploy must contain: the home page and the fallback that answers
// every other path (without them the site is blank), the PWA (without it the
// app silently stops being installable and offline-capable), and the files
// crawlers read first.
const REQUIRED_FILES = [
  'index.html',
  '404.html',
  'sw.js',
  'manifest.webmanifest',
  'offline.html',
  'sitemap.xml',
  'robots.txt',
] as const;

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

/**
 * Turns React Router's client build into the tree GitHub Pages serves.
 *
 * React Router assumes its client directory is the domain root: with a
 * basename it writes prerendered pages to build/client/<basename>/… and the
 * SPA fallback to build/client/index.html. GitHub Pages serves the artifact AT
 * the base path, so:
 *
 *   build/client/<base>/**       → out/**          (pages, .data, sitemap, robots)
 *   SPA fallback                 → out/404.html    (what Pages serves for unknown paths)
 *   everything else (assets, sw) → out/**          (already at the right level)
 *
 * The 404 page is the SPA fallback on purpose: it hydrates the real router,
 * which renders NotFoundRedirect for an unknown path — and for an event added
 * since the last build, the same countdown to the city's list as before.
 */
export async function finalizeExport({ clientDir, outDir, basePath }: FinalizeOptions): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await cp(clientDir, outDir, { recursive: true });

  // With a basename the root index.html IS the fallback (the real home page is
  // under the basename); at a domain root React Router names it separately.
  const fallback = join(outDir, basePath ? 'index.html' : '__spa-fallback.html');
  if (await exists(fallback)) await rename(fallback, join(outDir, '404.html'));

  if (basePath) {
    const pagesDir = join(outDir, ...basePath.split('/').filter(Boolean));
    for (const entry of await readdir(pagesDir)) {
      await cp(join(pagesDir, entry), join(outDir, entry), { recursive: true, force: true });
    }
    // Remove the now-empty prefix from the top, not just its last segment.
    await rm(join(outDir, basePath.split('/').filter(Boolean)[0]), { recursive: true, force: true });
  }

  // The prerender also writes a loader-data twin for each resource route
  // (sitemap.xml.data next to sitemap.xml). Nothing fetches it: the file itself
  // is the resource.
  for (const entry of await readdir(outDir)) {
    if (!entry.endsWith('.data')) continue;
    const resource = join(outDir, entry.slice(0, -'.data'.length));
    if ((await exists(resource)) && (await stat(resource)).isFile()) await rm(join(outDir, entry));
  }

  // Pages served from a branch go through Jekyll, which drops every path that
  // starts with an underscore.
  await writeFile(join(outDir, '.nojekyll'), '');

  // The deploy publishes whatever out/ holds, so this is the last place a
  // missing piece can stop it — and failing keeps the previous deploy up.
  for (const required of REQUIRED_FILES) {
    if (!(await exists(join(outDir, required)))) {
      throw new Error(`finalizeExport: ${required} is missing from ${outDir} — refusing to ship an incomplete site`);
    }
  }
}
