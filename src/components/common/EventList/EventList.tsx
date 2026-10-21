'use client';

import Box from '@mui/material/Box';
import { Event } from '@/types/event.types';
import EventRow from '@/components/common/EventRow/EventRow';
import type { LatLng } from '@/lib/geo';

interface EventListProps {
  events: Event[];
  /** The proximity filter's point: each row then states its distance from it. */
  origin?: LatLng | null;
}

export default function EventList({ events, origin }: EventListProps) {
  return (
    <Box
      sx={{
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      {events.map((event) => (
        <EventRow key={event.id} event={event} distanceFrom={origin} />
      ))}
    </Box>
  );
}
