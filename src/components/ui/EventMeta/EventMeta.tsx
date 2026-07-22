'use client';

import PlaceIcon from '@mui/icons-material/Place';
import { formatDay, formatMonth } from '@/lib/utils';
import styles from './EventMeta.module.scss';

// Shared card metadata primitives. EventCard (grid) and EventRow (list) both
// render date / time / venue, and they used to do it with independently drifted
// fonts, sizes and colours. These components are the single source of truth, so
// the two views stay visually identical across breakpoints.
//
// `variant` only switches the chrome needed by the surface underneath:
//   overlay — sits on the grid card's hero band (may be a photo), so it needs an
//             opaque surface + shadow to stay legible.
//   inline  — sits on the card background in the row view; no chrome needed.
type MetaVariant = 'overlay' | 'inline';

interface EventDateBadgeProps {
  date: string;
  variant?: MetaVariant;
}

export function EventDateBadge({ date, variant = 'inline' }: EventDateBadgeProps) {
  return (
    <div className={`${styles.dateBadge} ${styles[variant]}`} aria-hidden>
      <span className={styles.dateDay}>{formatDay(date)}</span>
      <span className={styles.dateMonth}>{formatMonth(date)}</span>
    </div>
  );
}

interface EventTimeLabelProps {
  /** Preformatted range from formatEventTime; empty renders an empty slot. */
  time: string;
  variant?: MetaVariant;
  /**
   * Keep the element (and its height) when `time` is empty, so siblings below
   * it hold their position. Only meaningful for the inline variant — the
   * overlay variant has nothing stacked under it.
   */
  reserveSpace?: boolean;
}

export function EventTimeLabel({ time, variant = 'inline', reserveSpace = false }: EventTimeLabelProps) {
  if (!time && !reserveSpace) return null;

  return (
    <span className={`${styles.time} ${styles[variant]}`} aria-hidden={!time || undefined}>
      {time}
    </span>
  );
}

interface EventVenueProps {
  name: string;
}

export function EventVenue({ name }: EventVenueProps) {
  return (
    <span className={styles.venue}>
      {/* sx, not a CSS Module class: MUI's emotion styles are injected at the
          end of <head> and outrank equal-specificity module classes, so
          font-size here would be clobbered. */}
      <PlaceIcon sx={{ fontSize: 13, color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <span className={styles.venueText}>{name}</span>
    </span>
  );
}
