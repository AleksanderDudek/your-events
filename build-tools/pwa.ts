import type { VitePWAOptions } from 'vite-plugin-pwa';
// Relative on purpose: Vite loads this file before any alias exists. messages.ts
// has no imports of its own, so pulling it in here costs nothing.
import { messages, DEFAULT_LOCALE } from '../src/i18n/messages.ts';

// React Router writes the browser build here (react-router.config.ts →
// buildDirectory). finalizeExport later copies it to out/ unchanged in shape for
// everything the service worker precaches, so precache URLs stay valid.
export const CLIENT_BUILD_DIR = 'build/client';

/**
 * vite-plugin-pwa configuration.
 *
 * injectManifest rather than generateSW: the caching rules are app-specific
 * (Supabase reads, React Router `.data` payloads, third-party event art), and
 * they read better as code in src/sw.ts than as Workbox config.
 *
 * Only the app shell is precached. The ~1500 prerendered event pages are not —
 * at ~100 KB each, precaching them would download the whole site on first
 * visit. They are cached as they are visited instead (see src/sw.ts). Nothing
 * produced by the prerender step is in the precache, which is why the service
 * worker can be built at the normal end of the client build.
 */
export function pwaOptions(base: string): Partial<VitePWAOptions> {
  const m = messages[DEFAULT_LOCALE];
  return {
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    // A prompt, not autoUpdate: reloading under someone half-way through
    // setting filters would lose what they were doing. PwaUpdatePrompt asks.
    registerType: 'prompt',
    // Registration goes through virtual:pwa-register/react in PwaUpdatePrompt.
    injectRegister: false,
    outDir: CLIENT_BUILD_DIR,
    manifest: {
      id: base,
      name: m.APP_NAME,
      short_name: m.APP_NAME,
      description: m.PWA_DESCRIPTION,
      lang: DEFAULT_LOCALE,
      start_url: base,
      scope: base,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#fbf8f3',
      theme_color: '#f4553b',
      categories: ['entertainment', 'events', 'lifestyle'],
      // Relative to the manifest, which is served from the base path.
      icons: [
        { src: 'favicons/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'favicons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'favicons/web-app-manifest-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    injectManifest: {
      globDirectory: CLIENT_BUILD_DIR,
      globPatterns: ['**/*.{js,css,svg,ico,png,webmanifest}', 'offline.html'],
      // City photos (4 MB) and the per-category fallback art (130 files) are
      // fetched on demand and runtime-cached; nobody needs all of them up front.
      globIgnores: ['images/**', 'fallbacks/**'],
      // Hashed file names already change with their content.
      dontCacheBustURLsMatching: /assets\//,
    },
    devOptions: { enabled: false },
  };
}
