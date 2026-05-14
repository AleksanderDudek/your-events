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
  const chips = [event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c));

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  flex: '0 0 48px',
                  borderRadius: 1,
                  bgcolor: categoryData?.color ?? '#6B7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  userSelect: 'none',
                }}
              >
                {categoryData?.icon ?? '●'}
              </Box>
              <Typography variant="subtitle1" component="h3" className={styles.name}>
                {event.name}
              </Typography>
            </Box>
          </Box>

          <Box className={styles.meta}>
            {chips.length > 0 && (
              <Box className={styles.chips}>
                {chips.map((label) => (
                  <CategoryChip key={label} category={label} />
                ))}
              </Box>
            )}
            <Box className={styles.locationTime}>
              <PlaceIcon sx={{ fontSize: 14, color: 'var(--color-text-muted)' }} />
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {event.location.name}
              </Typography>
              {time && (
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', ml: 1 }}
                >
                  {time}
                </Typography>
              )}
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
