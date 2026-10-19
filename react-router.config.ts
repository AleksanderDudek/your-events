import type { Config } from '@react-router/dev/config';
import { loadEnv, runnerImport } from 'vite';
import { resolveBasePath, toViteBase } from './build-tools/basePath.ts';
import { finalizeExport } from './build-tools/finalizeExport.ts';
import { CLIENT_BUILD_DIR } from './build-tools/pwa.ts';

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const basePath = resolveBasePath(loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH);

type PrerenderModule = typeof import('./src/build/prerenderPaths');

// React Router calls prerender() more than once per build; the event list comes
// from Supabase, so fetch it once.
let paths: Promise<string[]> | undefined;

export default {
  appDirectory: 'src',
  buildDirectory: 'build',
  // The site is a static export: no server at runtime. Every page below is
  // rendered to HTML at build time, and their loaders run then too.
  ssr: false,
  basename: toViteBase(basePath),
  prerender: {
    paths() {
      // Loaded through Vite's module runner, not a plain import: this config is
      // read before the `@/` alias exists, and the module (like the app) reads
      // import.meta.env. The runner gives it both, exactly as the app gets them.
      paths ??= runnerImport<PrerenderModule>('./src/build/prerenderPaths.ts', {
        configFile: false,
        mode: 'production',
        envPrefix: 'VITE_',
        resolve: { tsconfigPaths: true },
      }).then(({ module }) => module.prerenderPaths());
      return paths;
    },
    // ~2000 pages. Loaders read a per-build cache (eventsApi), so this
    // overlaps rendering and file writes rather than Supabase requests.
    concurrency: 8,
  },
  async buildEnd() {
    await finalizeExport({ clientDir: CLIENT_BUILD_DIR, outDir: 'out', basePath });
  },
} satisfies Config;
