'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Route } from 'next';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import { Event } from '@/types/event.types';
import { useCategories } from '@/components/service/useCategories';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import MediaFill from '@/components/ui/MediaFill/MediaFill';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { EventDateBadge, EventTimeLabel, EventVenue } from '@/components/ui/EventMeta/EventMeta';
import {
  formatDateShort,
  formatEventTime,
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
  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);

  return (
    <Link href={href as Route} className={styles.link}>
      <Card
        component="article"
        role="article"
        aria-label={[event.name, formatDateShort(event.date), time, event.location.name]
          .filter(Boolean)
          .join(', ')}
        className={styles.card}
      >
        <Box className={styles.imageWrapper}>
          <ImageWrapper event={event} />
          {/* Date top-left, time top-right — both overlay the band so the
              content grid below keeps its fixed row heights. The article's
              aria-label already carries both, so the badges are aria-hidden. */}
          <EventDateBadge date={event.date} variant="overlay" />
          <EventTimeLabel time={time} variant="overlay" />
        </Box>

        {/* Grid container — row heights are locked in EventCard.module.scss
            so every card lays out title/venue/chips/footer at identical
            y-offsets, regardless of content length. */}
        <div className={styles.content}>
          <div className={styles.titleSlot}>
            <h3 className={styles.name}>{event.name}</h3>
          </div>

          <div className={styles.locationSlot}>
            <EventVenue name={event.location.name} />
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
      <MediaFill
        src={stage === 0 ? event.imageUrl : artSrc}
        // Real poster gets the event name; the category-art fallback is
        // decorative (the article's aria-label already names the event).
        alt={stage === 0 ? event.name : ''}
        sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
        onError={() => setStage((s) => (s === 0 ? 1 : 2))}
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
