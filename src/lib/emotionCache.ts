import createCache from '@emotion/cache';

/**
 * One Emotion cache per render, with the same key on the server and in the
 * browser. The key is how the browser cache recognizes the <style> tags
 * entry.server.tsx extracted into the prerendered HTML and adopts them instead
 * of inserting every rule a second time.
 */
export function createEmotionCache() {
  return createCache({ key: 'css' });
}
