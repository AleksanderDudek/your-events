import { describe, it, expect, vi } from 'vitest';

// constants.ts resolves BASE_PATH at module load, so each case reloads the graph.
async function loadManifest(basePath: string) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_BASE_PATH = basePath;
  const mod = await import('./manifest');
  return mod.default();
}

describe('web app manifest', () => {
  it('prefixes start_url and icons with the configured base path', async () => {
    const manifest = await loadManifest('/your-events-prod');
    expect(manifest.start_url).toBe('/your-events-prod/');
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/your-events-prod/favicons/')).toBe(true);
    }
  });

  // Served from a domain root there is no prefix at all, and a leftover one
  // would 404 every icon.
  it('uses root-relative paths when there is no base path', async () => {
    const manifest = await loadManifest('');
    expect(manifest.start_url).toBe('/');
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/favicons/')).toBe(true);
    }
  });
});
