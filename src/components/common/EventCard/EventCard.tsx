'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
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
  // Dedupe — some events have categoryMain === categorySub (e.g. both "Warsztaty"),
  // which would render two identical chips and collide on React keys.
  const chips = Array.from(
    new Set([event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c)))
  );
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
          <div className={styles.dateOverlay} aria-hidden>
            <span className={styles.dateText}>{formatDateShort(event.date)}</span>
            {time && <span className={styles.timeText}>{time}</span>}
          </div>
        </Box>

        {/* Grid container — row heights are locked in EventCard.module.scss
            so every card lays out title/venue/chips/footer at identical
            y-offsets, regardless of content length. */}
        <div className={styles.content}>
          <div className={styles.titleSlot}>
            <h3 className={styles.name}>{event.name}</h3>
          </div>

          <div className={styles.locationSlot}>
            <PlaceIcon sx={{ fontSize: 14, color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span className={styles.venue}>{event.location.name}</span>
          </div>

          {/* Always rendered (even when empty) so the chip row reserves its
              26px slot in the grid. aria-hidden suppresses the empty region
              for screen readers. */}
          <div className={styles.chipsSlot} aria-hidden={visibleCategories.length === 0}>
            {visibleCategories.map((label) => (
              <CategoryChip key={label} category={label} />
            ))}
            {extraCount > 0 && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                +{extraCount}
              </span>
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.price}>
              <PriceLabel amount={event.price.amount} currency={event.price.currency} />
            </span>
            {sourceLabel && (
              <span className={styles.source} title={sourceLabel}>
                {sourceLabel}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ImageWrapper({ event }: { event: Event }) {
  const { byDisplayName } = useCategories();
  const categoryData = byDisplayName.get(event.categoryMain) ?? byDisplayName.get('Inne');
  const iconPath = getCategoryIconPath(event.categoryMain || 'inne');

  // Image source chain: real event image (poster / source logo) → category
  // icon → solid color box with emoji. `stage` advances on each onError:
  //   0 = real imageUrl, 1 = category icon, 2 = color box.
  const hasRealImage = Boolean(event.imageUrl);
  const [stage, setStage] = useState<0 | 1 | 2>(hasRealImage ? 0 : 1);

  if (stage < 2) {
    return (
      <Image
        src={stage === 0 ? event.imageUrl : iconPath}
        alt={categoryData?.display_name ?? event.categoryMain}
        fill
        sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={styles.image}
        onError={() => setStage((s) => (s === 0 ? 1 : 2))}
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
        fontSize: '2rem',
      }}
    >
      {categoryData?.icon ?? '●'}
    </Box>
  );
}
