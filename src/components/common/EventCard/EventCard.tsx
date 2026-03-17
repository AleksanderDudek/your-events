'use client';

import Link from 'next/link';
import Image from 'next/image';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { formatDateShort, formatTimeRange } from '@/lib/utils';
import styles from './EventCard.module.scss';

interface EventCardProps {
  event: Event;
}

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #1a1a2e 0%, #2d1b3d 50%, #1a1a2e 100%)',
  'linear-gradient(135deg, #1a2a1a 0%, #2d3b1b 50%, #1a2a1a 100%)',
  'linear-gradient(135deg, #2a1a1a 0%, #3d2b1b 50%, #2a1a1a 100%)',
  'linear-gradient(135deg, #1a1a2a 0%, #1b2d3d 50%, #1a1a2a 100%)',
  'linear-gradient(135deg, #2a2a1a 0%, #3d3b1b 50%, #2a2a1a 100%)',
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length];
}

export default function EventCard({ event }: EventCardProps) {
  const maxChips = 3;
  const visibleCategories = event.categories.slice(0, maxChips);
  const extraCount = event.categories.length - maxChips;

  return (
    <Link href={`/events/${event.id}`} className={styles.link}>
      <Card
        component="article"
        role="article"
        aria-label={`${event.name}, ${formatDateShort(event.date)}, ${event.location.name}`}
        className={styles.card}
      >
        <Box className={styles.imageWrapper}>
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className={styles.image}
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          ) : (
            <Box
              className={styles.gradient}
              sx={{ background: getGradient(event.id) }}
            />
          )}
          {event.status !== 'active' && (
            <Box className={styles.statusBadge}>
              <StatusBadge status={event.status} />
            </Box>
          )}
        </Box>

        <CardContent className={styles.content}>
          <Typography variant="h6" component="h3" className={styles.name}>
            {event.name}
          </Typography>

          <Typography
            variant="body2"
            className={styles.datetime}
            sx={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}
          >
            {formatDateShort(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
          </Typography>

          <Box className={styles.location}>
            <PlaceIcon sx={{ fontSize: 16, color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{ color: 'var(--color-text-secondary)' }}
              noWrap
            >
              {event.location.name}
            </Typography>
          </Box>

          <Box className={styles.chips}>
            {visibleCategories.map((cat) => (
              <CategoryChip key={cat} category={cat} />
            ))}
            {extraCount > 0 && (
              <Typography
                variant="caption"
                sx={{ color: 'var(--color-text-muted)', alignSelf: 'center' }}
              >
                +{extraCount}
              </Typography>
            )}
          </Box>

          <Box className={styles.footer}>
            <PriceLabel amount={event.price.amount} currency={event.price.currency} />
            <Typography
              variant="caption"
              sx={{ color: 'var(--color-text-muted)' }}
            >
              {event.sourceName}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Link>
  );
}
