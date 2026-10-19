// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { finalizeExport } from './finalizeExport';

let root: string;

async function put(path: string, content = path) {
  const full = join(root, path);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content);
}

async function read(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

async function exists(path: string): Promise<boolean> {
  return access(join(root, path)).then(
    () => true,
    () => false
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'finalize-export-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('finalizeExport', () => {
  // React Router writes prerendered pages under the basename
  // (build/client/your-events/…) and the SPA fallback at the client root,
  // because it assumes the client directory IS the domain root. GitHub Pages
  // serves the artifact AT the base path instead, so pages move up a level.
  it('hoists pages out of the base-path folder and turns the SPA fallback into 404.html', async () => {
    await put('client/index.html', 'spa fallback');
    await put('client/assets/app-abc.js');
    await put('client/sw.js');
    await put('client/your-events/index.html', 'home');
    await put('client/your-events/wroclaw/wydarzenia/index.html', 'list');
    await put('client/your-events/wroclaw/muzyka/jazz-1.data', 'data');
    await put('client/your-events/sitemap.xml', 'xml');

    await finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '/your-events' });

    expect(await read('out/index.html')).toBe('home');
    expect(await read('out/404.html')).toBe('spa fallback');
    expect(await read('out/wroclaw/wydarzenia/index.html')).toBe('list');
    expect(await read('out/wroclaw/muzyka/jazz-1.data')).toBe('data');
    expect(await read('out/sitemap.xml')).toBe('xml');
    expect(await exists('out/assets/app-abc.js')).toBe(true);
    expect(await exists('out/sw.js')).toBe(true);
    expect(await exists('out/your-events')).toBe(false);
  });

  // Served at a domain root, the pages are already where they belong; only the
  // fallback, which React Router names __spa-fallback.html there, is renamed.
  it('renames __spa-fallback.html when there is no base path', async () => {
    await put('client/index.html', 'home');
    await put('client/__spa-fallback.html', 'spa fallback');
    await put('client/wroclaw/index.html', 'city');

    await finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '' });

    expect(await read('out/index.html')).toBe('home');
    expect(await read('out/404.html')).toBe('spa fallback');
    expect(await read('out/wroclaw/index.html')).toBe('city');
    expect(await exists('out/__spa-fallback.html')).toBe(false);
  });

  // Resource routes (sitemap.xml, robots.txt) also get a loader-data twin from
  // the prerender. Nothing ever fetches it — the file itself is the resource.
  it('drops the data twins of prerendered resource files', async () => {
    await put('client/index.html', 'home');
    await put('client/__spa-fallback.html');
    await put('client/sitemap.xml', 'xml');
    await put('client/sitemap.xml.data');
    await put('client/robots.txt.data');
    await put('client/robots.txt', 'txt');
    await put('client/wroclaw/muzyka/jazz-1.data', 'page data');

    await finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '' });

    expect(await exists('out/sitemap.xml.data')).toBe(false);
    expect(await exists('out/robots.txt.data')).toBe(false);
    expect(await read('out/sitemap.xml')).toBe('xml');
    expect(await read('out/wroclaw/muzyka/jazz-1.data')).toBe('page data');
  });

  it('marks the output as not-Jekyll', async () => {
    await put('client/index.html', 'home');
    await put('client/__spa-fallback.html');
    await finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '' });
    expect(await exists('out/.nojekyll')).toBe(true);
  });

  it('replaces whatever a previous build left in the output directory', async () => {
    await put('out/stale.html');
    await put('client/index.html', 'home');
    await put('client/__spa-fallback.html');
    await finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '' });
    expect(await exists('out/stale.html')).toBe(false);
  });

  // A deploy without a home page is a blank site. Failing the build is the
  // better outcome: the previous deploy stays up.
  it('fails when the home page was not produced', async () => {
    await put('client/__spa-fallback.html');
    await expect(
      finalizeExport({ clientDir: join(root, 'client'), outDir: join(root, 'out'), basePath: '' })
    ).rejects.toThrow(/index\.html/);
  });
});
