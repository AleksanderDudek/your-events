'use client';

import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlaceIcon from '@mui/icons-material/Place';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { formatDay, formatMonth, formatTimeRange } from '@/lib/utils';
import styles from './EventRow.module.scss';

interface EventRowProps {
  event: Event;
}

export default function EventRow({ event }: EventRowProps) {
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
            variant="h4"
            component="span"
            sx={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--color-accent-primary)',
              lineHeight: 1,
            }}
          >
            {formatDay(event.date)}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            sx={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-accent-primary)',
              fontSize: '0.625rem',
              letterSpacing: '0.08em',
            }}
          >
            {formatMonth(event.date)}
          </Typography>
        </Box>

        <Box className={styles.contentCol}>
          <Box className={styles.topLine}>
            <Typography variant="subtitle1" component="h3" className={styles.name}>
              {event.name}
            </Typography>
            {event.status !== 'active' && <StatusBadge status={event.status} />}
          </Box>

          <Box className={styles.meta}>
            <Box className={styles.chips}>
              {event.categories.slice(0, 3).map((cat) => (
                <CategoryChip key={cat} category={cat} />
              ))}
            </Box>
            <Box className={styles.locationTime}>
              <PlaceIcon sx={{ fontSize: 14, color: 'var(--color-text-muted)' }} />
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {event.location.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', ml: 1 }}
              >
                {formatTimeRange(event.startTime, event.endTime)}
              </Typography>
            </Box>
          </Box>

          <PriceLabel amount={event.price.amount} currency={event.price.currency} />
        </Box>

        <Box className={styles.chevron}>
          <ChevronRightIcon sx={{ color: 'var(--color-text-muted)' }} />
        </Box>
      </Box>
    </Link>
  );
}
