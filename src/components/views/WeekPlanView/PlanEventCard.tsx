'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Event } from '@/types/event.types';
import CategoryChip from '@/components/ui/CategoryChip/CategoryChip';
import MediaFill from '@/components/ui/MediaFill/MediaFill';
import PriceLabel from '@/components/ui/PriceLabel/PriceLabel';
import { categoryColorSolidVar, categoryFallbackImage, formatEventTime } from '@/lib/utils';
import { useTranslated } from '@/i18n/translation';
import { useTranslation } from '@/i18n';
import styles from './WeekPlanView.module.scss';

interface PlanEventCardProps {
  event: Event;
  /** Permalink of the event's own page. */
  href: string;
  /** "W planie" ribbon on a decided slot. */
  chosen?: boolean;
  /** Buttons under the card: choose / skip, or change. */
  children?: React.ReactNode;
}

/**
 * A proposal in "Twój tydzień". Not EventCard: that one is a link as a whole,
 * and these cards carry their own buttons — a button inside a link is invalid
 * and a tap meant for "Pomiń" would open the event. The title links instead.
 */
export default function PlanEventCard({ event, href, chosen = false, children }: PlanEventCardProps) {
  const { t } = useTranslation();
  const name = useTranslated(event.name);
  const time = formatEventTime(event.startTime, event.endTime, event.durationMin);

  return (
    <article className={`${styles.card} ${chosen ? styles.cardChosen : ''}`} aria-label={name}>
      <div className={styles.cardImage}>
        <CardImage event={event} />
        {time && <span className={styles.cardTime}>{time}</span>}
        {chosen && <span className={styles.cardRibbon}>{t.WEEK_CHOSEN}</span>}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          <Link href={href as Route} className={styles.cardLink}>
            {name}
          </Link>
        </h3>
        <p className={styles.cardVenue}>{event.location.name}</p>
        <div className={styles.cardMeta}>
          {event.categoryMain && <CategoryChip category={event.categoryMain} />}
          <span className={styles.cardPrice}>
            <PriceLabel
              amount={event.price.amount}
              currency={event.price.currency}
              label={event.price.label}
              showLabel={event.price.showLabel}
            />
          </span>
        </div>
      </div>
      {children && <div className={styles.cardActions}>{children}</div>}
    </article>
  );
}

function CardImage({ event }: { event: Event }) {
  const art = categoryFallbackImage(event.categoryMain, event.id || event.eventKey);
  // 0 = the event's own picture, 1 = category art, 2 = a plain colour block.
  const [stage, setStage] = useState<0 | 1 | 2>(event.imageUrl ? 0 : 1);
  if (stage === 2) {
    return <div className={styles.cardImageFill} style={{ background: categoryColorSolidVar(event.categoryMain) }} />;
  }
  return (
    <MediaFill
      src={stage === 0 ? event.imageUrl : art}
      alt=""
      sizes="(max-width: 600px) 100vw, 33vw"
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
    />
  );
}
