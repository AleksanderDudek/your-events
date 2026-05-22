'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlaceIcon from '@mui/icons-material/Place';
import { Event } from '@/types/event.types';
import { useCategories } from '@/components/service/useCategories';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { formatDay, formatEventTime, formatMonth } from '@/lib/utils';
import styles from './EventRow.module.scss';

interface EventRowProps {
  event: Event;
}

export default function EventRow({ event }: EventRowProps) {
  const { byDisplayName } = useCategories();
  const categoryData = byDisplayName.get(event.categoryMain) ?? byDisplayName.get('Inne');
  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);
  // Dedupe — some events have categoryMain === categorySub, which would
  // render two identical chips and collide on React keys.
  const chips = Array.from(
    new Set([event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c)))
  );

  return (
    <Link href={`/events/${event.id}`} className={styles.link}>
      <Box
        component="article"
        role="article"
        aria-label={`${event.name}, ${event.date}, ${event.location.name}`}
        className={styles.row}
      >
        <Box className={styles.dateCol}>
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--color-accent-primary)',
              fontSize: '1.375rem',
              lineHeight: 1,
            }}
          >
            {formatDay(event.date)}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-accent-primary)',
              fontSize: '0.625rem',
              letterSpacing: '0.08em',
              lineHeight: 1.2,
            }}
          >
            {formatMonth(event.date)}
          </Typography>
        </Box>

        <Box
          className={styles.iconTile}
          sx={{ bgcolor: categoryData?.color ?? '#6B7280' }}
          aria-hidden
        >
          {categoryData?.icon ?? '●'}
        </Box>

        <Box className={styles.contentCol}>
          <Typography variant="subtitle1" component="h3" className={styles.name}>
            {event.name}
          </Typography>

          <Box className={styles.metaLine}>
            <Box className={styles.venue}>
              <PlaceIcon
                sx={{ fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0 }}
              />
              <Typography component="span" className={styles.venueText}>
                {event.location.name}
              </Typography>
            </Box>
            {time && <span className={styles.time}>{time}</span>}
            {chips.length > 0 && (
              <Box className={styles.chips}>
                {chips.map((label) => (
                  <CategoryChip key={label} category={label} />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Box className={styles.rightCol}>
          <PriceLabel amount={event.price.amount} currency={event.price.currency} />
        </Box>

        <Box className={styles.chevron}>
          <ChevronRightIcon sx={{ color: 'var(--color-text-muted)' }} />
        </Box>
      </Box>
    </Link>
  );
}
