import { CacheProvider } from '@emotion/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { createEmotionCache } from '@/lib/emotionCache';

// Same cache key as entry.server.tsx, so the styles extracted into the
// prerendered HTML are adopted rather than inserted again.
const cache = createEmotionCache();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <CacheProvider value={cache}>
        <HydratedRouter />
      </CacheProvider>
    </StrictMode>
  );
});
