import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * false while prerendering and during the hydration pass, true afterwards.
 *
 * For things that only exist in a browser (Leaflet, the service worker): they
 * render nothing into the static HTML, and hydration still matches it.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
