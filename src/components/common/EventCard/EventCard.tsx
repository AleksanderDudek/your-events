'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { Route } from 'next';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import PlaceIcon from '@mui/icons-material/Place';
import { Event } from '@/types/event.types';
import { useCategories } from '@/components/service/useCategories';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import {
  formatDateShort,
  formatDay,
  formatMonth,
  categoryFallbackImage,
  categoryColorSolidVar,
} from '@/lib/utils';
import { useCity } from '@/config/CityProvider';
import { eventPath } from '@/lib/slug';
import styles from './EventCard.module.scss';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const { city } = useCity();
  const { displayNameToSlug } = useCategories();
  const href = eventPath(city.id, event, displayNameToSlug);
  // Dedupe — some events have categoryMain === categorySub (e.g. both "Warsztaty"),
  // which would render two identical chips and collide on React keys.
  const chips = Array.from(
    new Set([event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c)))
  );
  const maxChips = 2;
  const visibleCategories = chips.slice(0, maxChips);
  const extraCount = chips.length - maxChips;
  const sourceLabel = event.sources.join(' · ');

  return (
    <Link href={href as Route} className={styles.link}>
      <Card
        component="article"
        role="article"
        aria-label={`${event.name}, ${formatDateShort(event.date)}, ${event.location.name}`}
        className={styles.card}
      >
        <Box className={styles.imageWrapper}>
          <ImageWrapper event={event} />
          <div className={styles.dateBadge} aria-hidden>
            <span className={styles.dateDay}>{formatDay(event.date)}</span>
            <span className={styles.dateMonth}>{formatMonth(event.date)}</span>
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
              <PriceLabel amount={event.price.amount} currency={event.price.currency} label={event.price.label} showLabel={event.price.showLabel} />
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
  const artSrc = categoryFallbackImage(event.categoryMain, event.id || event.eventKey);
  // stage 0 = real imageUrl, 1 = category art PNG, 2 = solid color box
  const [stage, setStage] = useState<0 | 1 | 2>(event.imageUrl ? 0 : 1);

  if (stage < 2) {
    return (
      <Image
        src={stage === 0 ? event.imageUrl : artSrc}
        alt={event.categoryMain}
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
        bgcolor: categoryColorSolidVar(event.categoryMain),
      }}
    />
  );
}
