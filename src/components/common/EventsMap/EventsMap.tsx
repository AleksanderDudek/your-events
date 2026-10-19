// Public entry point for the events map. Leaflet touches `window` at import
// time, which would crash the build-time prerender — so the real implementation
// lives in EventsMapInner.tsx, is split into its own chunk, and is only loaded
// once this component has mounted in a browser.
import { lazy, Suspense } from 'react';
import { useIsClient } from '@/components/service/useIsClient';
import type { EventsMapInnerProps } from './EventsMapInner';
import styles from './EventsMap.module.scss';

const EventsMapInner = lazy(() => import('./EventsMapInner'));

export type EventsMapProps = EventsMapInnerProps;

export default function EventsMap(props: EventsMapProps) {
  const isClient = useIsClient();
  const placeholder = <div className={styles.placeholder} aria-hidden="true" />;
  if (!isClient) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <EventsMapInner {...props} />
    </Suspense>
  );
}
