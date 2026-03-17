'use client';

import Box from '@mui/material/Box';
import { Event } from '@/types/event.types';
import EventCard from '@/components/common/EventCard/EventCard';
import styles from './EventGrid.module.scss';

interface EventGridProps {
  events: Event[];
}

export default function EventGrid({ events }: EventGridProps) {
  return (
    <Box className={styles.grid}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </Box>
  );
}
