'use client';

import Box from '@mui/material/Box';
import { Event } from '@/types/event.types';
import EventCard from '@/components/common/EventCard/EventCard';
import type { LatLng } from '@/lib/geo';
import styles from './EventGrid.module.scss';

interface EventGridProps {
  events: Event[];
  /**
   * Permalink for a card, when the caller can resolve it.
   *
   * Without it EventCard derives the path from useCategories(), a client query
   * that is empty during a prerender — so a server-rendered grid bakes hrefs
   * whose category segment fell back to "inne", pointing at routes that were
   * never generated. See EventCard's `href` prop.
   */
  hrefFor?: (event: Event) => string;
  /** The proximity filter's point: each card then states its distance from it. */
  origin?: LatLng | null;
}

export default function EventGrid({ events, hrefFor, origin }: EventGridProps) {
  return (
    <Box className={styles.grid}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} href={hrefFor?.(event)} distanceFrom={origin} />
      ))}
    </Box>
  );
}
