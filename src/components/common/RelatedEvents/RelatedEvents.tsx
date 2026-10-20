'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventCard from '@/components/common/EventCard/EventCard';
import { useTranslation } from '@/i18n';
import { Event } from '@/types/event.types';
import styles from './RelatedEvents.module.scss';

export interface RelatedEventLink {
  event: Event;
  /** Resolved at build time, where the real category map exists. */
  href: string;
}

interface RelatedEventsProps {
  items: RelatedEventLink[];
}

/**
 * Horizontal rail of similar events.
 *
 * A native scroll container with CSS scroll-snap rather than a carousel
 * library: the browser already gives it keyboard scrolling, touch inertia and
 * a sensible focus order, and hand-rolled replacements for those are where
 * carousels usually break for assistive tech. The arrows are a mouse
 * affordance layered on top — desktop pointers have no good way to scroll
 * sideways — and the rail works with them removed.
 */
export default function RelatedEvents({ items }: RelatedEventsProps) {
  const { t } = useTranslation();
  const railRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncArrows = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    // A pixel of slack: fractional scroll positions never land exactly.
    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    // Also covers the case where the rail is not overflowing at all, which is
    // what disables both arrows.
    const observer = new ResizeObserver(syncArrows);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [syncArrows]);

  const scrollByPage = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="related-events-title">
      <h2 className={styles.title} id="related-events-title">
        {t.RELATED_TITLE}
      </h2>

      {/* The arrows flank the rail rather than sitting in the header: at the
          ends of what they scroll, they read as belonging to it. aria-hidden
          because the rail already scrolls with the keyboard on its own — these
          would only add duplicate stops to the tab order. */}
      <div className={styles.railWrap}>
        <IconButton
          className={`${styles.arrow} ${styles.arrowPrev}`}
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          aria-hidden="true"
          tabIndex={-1}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        <ul className={styles.rail} ref={railRef} onScroll={syncArrows}>
          {items.map(({ event, href }) => (
            <li key={event.id} className={styles.item}>
              <EventCard event={event} href={href} />
            </li>
          ))}
        </ul>

        <IconButton
          className={`${styles.arrow} ${styles.arrowNext}`}
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          aria-hidden="true"
          tabIndex={-1}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </div>
    </section>
  );
}
