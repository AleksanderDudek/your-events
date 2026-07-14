'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import EventGrid from '@/components/common/EventGrid/EventGrid';
import { Event } from '@/types/event.types';

interface CategoryHubViewProps {
  citySlug: string;
  categorySlug: string;
  categoryName: string;
  events: Event[];
}

export default function CategoryHubView({ citySlug, categorySlug, categoryName, events }: CategoryHubViewProps) {
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ fontFamily: 'var(--font-display)', fontWeight: 700, mb: 1 }}>
        {categoryName}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
        {/* TODO(i18n Task 12): swap to t.CATEGORY_HUB_INTRO(categoryName) */}
        {`Nadchodzące wydarzenia z kategorii ${categoryName}.`}
      </Typography>
      <EventGrid events={events} />
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Button
          component={Link}
          href={`/${citySlug}/wydarzenia?categories=${categorySlug}` as Route}
          variant="outlined"
        >
          {/* TODO(i18n Task 12): swap to t.CATEGORY_HUB_SEE_ALL */}
          Zobacz wszystkie i filtruj
        </Button>
      </Box>
    </Box>
  );
}
