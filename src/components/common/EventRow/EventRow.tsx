'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Event } from '@/types/event.types';
import { useCategories } from '@/components/service/useCategories';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { EventDateBadge, EventTimeLabel, EventVenue } from '@/components/ui/EventMeta/EventMeta';
import { formatEventTime } from '@/lib/utils';
import { useCity } from '@/config/CityProvider';
import { eventPath } from '@/lib/slug';
import { useTranslated } from '@/i18n/translation';
import styles from './EventRow.module.scss';

interface EventRowProps {
  event: Event;
}

export default function EventRow({ event }: EventRowProps) {
  const { city } = useCity();
  const { byDisplayName, displayNameToSlug } = useCategories();
  const href = eventPath(city.id, event, displayNameToSlug);
  const categoryData = byDisplayName.get(event.categoryMain) ?? byDisplayName.get('Inne');
  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);
  // Dedupe — some events have categoryMain === categorySub, which would
  // render two identical chips and collide on React keys.
  const chips = Array.from(
    new Set([event.categoryMain, event.categorySub].filter((c): c is string => Boolean(c)))
  );
  // Same cap as the grid card, so a given event shows the same chips in both views.
  const visibleCategories = chips.slice(0, 2);
  const sourceLabel = event.sources.join(' · ');
  // Hook, not <Translated/>, because it also feeds the aria-label below, which
  // needs a plain string. The venue name stays Polish — a proper noun.
  const translatedName = useTranslated(event.name);

  return (
    <Link href={href as Route} className={styles.link}>
      <Box
        component="article"
        role="article"
        aria-label={`${translatedName}, ${event.date}, ${event.location.name}`}
        className={styles.row}
      >
        <Box className={styles.dateCol}>
          <EventDateBadge date={event.date} />
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
            {translatedName}
          </Typography>

          <Box className={styles.metaLine}>
            <Box className={styles.venue}>
              <EventVenue name={event.location.name} />
            </Box>
            {visibleCategories.length > 0 && (
              <Box className={styles.chips}>
                {visibleCategories.map((label) => (
                  <CategoryChip key={label} category={label} />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Time sits above the price in the right column rather than inline in
            the meta line: anchored to the row's right edge it lands at the same
            spot on every row, instead of drifting with the venue name's length
            (and getting clipped by the meta line's overflow on narrow screens). */}
        {/* Mirrors the grid card's corner semantics: time top, price bottom,
            source as the muted footnote beside the price. Anchored to the
            row's right edge, so none of it drifts with the title or venue
            length the way the inline time used to. */}
        <Box className={styles.rightCol}>
          <EventTimeLabel time={time} reserveSpace />
          <Box className={styles.priceLine}>
            {sourceLabel && (
              <span className={styles.source} title={sourceLabel}>
                {sourceLabel}
              </span>
            )}
            <PriceLabel amount={event.price.amount} currency={event.price.currency} label={event.price.label} showLabel={event.price.showLabel} />
          </Box>
        </Box>

        <Box className={styles.chevron}>
          <ChevronRightIcon sx={{ color: 'var(--color-text-muted)' }} />
        </Box>
      </Box>
    </Link>
  );
}
