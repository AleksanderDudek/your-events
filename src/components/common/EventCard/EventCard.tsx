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
import { useCategories } from '@/components/service/useCategories';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { formatDateShort, formatEventTime, getCategoryIconPath } from '@/lib/utils';
import styles from './EventCard.module.scss';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const chips = [event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c));
  const maxChips = 2;
  const visibleCategories = chips.slice(0, maxChips);
  const extraCount = chips.length - maxChips;
  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);
  const sourceLabel = event.sources.join(' · ');

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
            {formatDateShort(event.date)}
            {time && ` · ${time}`}
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

          {visibleCategories.length > 0 && (
            <Box className={styles.chips}>
              {visibleCategories.map((label) => (
                <CategoryChip key={label} category={label} />
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
          )}

          <Box className={styles.footer}>
            <PriceLabel amount={event.price.amount} currency={event.price.currency} />
            {sourceLabel && (
              <Typography
                variant="caption"
                noWrap
                sx={{ color: 'var(--color-text-muted)', maxWidth: '50%' }}
                title={sourceLabel}
              >
                {sourceLabel}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Link>
  );
}

function ImageWrapper({ event }: { event: Event }) {
  const { byDisplayName } = useCategories();
  const categoryData = byDisplayName.get(event.categoryMain) ?? byDisplayName.get('Inne');
  const iconPath = getCategoryIconPath(event.categoryMain || 'inne');
  const [errored, setErrored] = useState(false);

  if (!errored) {
    return (
      <Image
        src={iconPath}
        alt={categoryData?.display_name ?? event.categoryMain}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={styles.image}
        onError={() => setErrored(true)}
        unoptimized
      />
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: categoryData?.color ?? '#6B7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '3rem',
      }}
    >
      {categoryData?.icon ?? '●'}
    </Box>
  );
}
