'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { formatDateShort, formatTimeRange, getCategoryIconPath } from '@/lib/utils';
import styles from './EventCard.module.scss';

interface EventCardProps {
  event: Event;
}

// category icons are used as consistent visual fallback

export default function EventCard({ event }: EventCardProps) {
  const chips = [event.categoryMain, event.categorySub].filter(Boolean);
  const maxChips = 2;
  const visibleCategories = chips.slice(0, maxChips);
  const extraCount = chips.length - maxChips;

  return (
    <Link href={`/events/${event.id}`} className={styles.link}>
      <Card
        component="article"
        role="article"
        aria-label={`${event.name}, ${formatDateShort(event.date)}, ${event.location.name}`}
        className={styles.card}
      >
        <Box className={styles.imageWrapper}>
          <ImageWrapper event={event} />
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

function ImageWrapper({ event }: { event: Event }) {
  const fallback = getCategoryIconPath(event.categoryMain || 'Inne');
  const initialSrc = event.imageUrl || fallback;
  const [src, setSrc] = useState(initialSrc);

  return (
    <Image
      src={src}
      alt={event.name}
      fill
      sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className={styles.image}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}
