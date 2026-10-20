'use client';

// Public entry point for the events map. Leaflet directly accesses `window`
// at import time, which would crash SSR / static export — so the real
// implementation lives in EventsMapInner.tsx and is loaded only in the
// browser via next/dynamic({ ssr: false }).
import dynamic from 'next/dynamic';
import type { EventsMapInnerProps } from './EventsMapInner';
import styles from './EventsMap.module.scss';

const EventsMapInner = dynamic(() => import('./EventsMapInner'), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

export type EventsMapProps = EventsMapInnerProps;

export default function EventsMap(props: EventsMapProps) {
  return <EventsMapInner {...props} />;
}
