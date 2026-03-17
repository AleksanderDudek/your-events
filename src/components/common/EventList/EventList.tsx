'use client';

import Box from '@mui/material/Box';
import { Event } from '@/types/event.types';
import EventRow from '@/components/common/EventRow/EventRow';

interface EventListProps {
  events: Event[];
}

export default function EventList({ events }: EventListProps) {
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
        <EventRow key={event.id} event={event} />
      ))}
    </Box>
  );
}
