import { Event } from '@/types/event.types';
import { shiftDateString, utcMidnight, warsawToUtc } from './warsawTime';

// 87% of scraped events carry neither an end time nor a duration, so this
// default is the common path rather than an edge case. Two hours is long enough
// to read as "an evening thing" without blocking the rest of someone's day.
export const DEFAULT_DURATION_MIN = 120;

const UID_DOMAIN = 'idznamiasto';

/**
 * A calendar entry, flattened away from the scraper's shape. The URL builders
 * and the .ics writer consume only this — they never see an `Event`, so a
 * change in the data pipeline stops at `toCalendarEvent`.
 */
export interface CalendarEvent {
  title: string;
  startUtc: Date;
  /** Exclusive for all-day entries: a single day ends at the next midnight. */
  endUtc: Date;
  allDay: boolean;
  location: string;
  description: string;
  url: string;
  uid: string;
  /** DTSTAMP. Derived, never `now()`, so the output stays testable. */
  stamp: Date;
}

function joinNonEmpty(parts: string[], separator: string): string {
  return parts.map((p) => p.trim()).filter((p) => p.length > 0).join(separator);
}

function resolveStamp(event: Event): Date {
  if (event.updatedAt) {
    const parsed = new Date(event.updatedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return utcMidnight(event.date);
}

/**
 * Normalise an event into a calendar entry.
 *
 * @param endGuessNote localised sentence appended to the description when the
 *   end time had to be invented. Passed in rather than imported so this module
 *   stays free of i18n and remains a pure function.
 */
export function toCalendarEvent(event: Event, endGuessNote: string): CalendarEvent {
  const allDay =
    !event.startTime || (event.startTime === '00:00' && event.endTime === '23:59');

  let startUtc: Date;
  let endUtc: Date;
  let endEstimated = false;

  if (allDay) {
    startUtc = utcMidnight(event.date);
    endUtc = utcMidnight(event.date, 1);
  } else {
    startUtc = warsawToUtc(event.date, event.startTime);
    if (event.endTime) {
      const sameDay = warsawToUtc(event.date, event.endTime);
      // "22:00-02:00" means the event runs past midnight into the next day.
      endUtc =
        sameDay > startUtc
          ? sameDay
          : warsawToUtc(shiftDateString(event.date, 1), event.endTime);
    } else if (event.durationMin && event.durationMin > 0) {
      endUtc = new Date(startUtc.getTime() + event.durationMin * 60_000);
    } else {
      endUtc = new Date(startUtc.getTime() + DEFAULT_DURATION_MIN * 60_000);
      endEstimated = true;
    }
  }

  return {
    title: event.name,
    startUtc,
    endUtc,
    allDay,
    location: joinNonEmpty([event.location.name, event.location.city], ', '),
    description: joinNonEmpty(
      [event.description, event.url, endEstimated ? endGuessNote : ''],
      '\n\n'
    ),
    url: event.url,
    uid: `${event.eventKey}@${UID_DOMAIN}`,
    stamp: resolveStamp(event),
  };
}
