import { CalendarEvent } from './calendarEvent';
import { formatIcsDate, formatIcsDateTime } from './ics';

/** `2026-07-24` — the date half of an ISO timestamp, in UTC. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `2026-07-24T16:00:00Z` — ISO without the milliseconds Outlook does not need. */
function isoSeconds(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/**
 * Outlook's deeplink endpoint reads an all-day `enddt` as the LAST day of the
 * event, while `CalendarEvent.endUtc` is exclusive (the .ics and Google both
 * want the day after). Step back one day so a single-day event does not land on
 * the calendar spanning two.
 *
 * Unverified against a live account — the endpoint is undocumented, and this
 * follows the behaviour of the maintained add-to-calendar-button library, which
 * applies the +1 bump only to Microsoft's desktop compose URL and skips it for
 * this one. Worth a manual check before anyone trusts multi-day all-day events.
 */
function inclusiveEndDate(start: Date, exclusiveEnd: Date): string {
  const inclusive = new Date(exclusiveEnd.getTime() - 24 * 60 * 60 * 1000);
  // Never let the end precede the start, whatever the input.
  return isoDate(inclusive < start ? start : inclusive);
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = event.allDay
    ? `${formatIcsDate(event.startUtc)}/${formatIcsDate(event.endUtc)}`
    : `${formatIcsDateTime(event.startUtc)}/${formatIcsDateTime(event.endUtc)}`;

  // URLSearchParams percent-encodes the slash in `dates` and uses `+` for
  // spaces. Google decodes both; letting it do the encoding is safer than
  // hand-assembling a query string around user-supplied venue names.
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.allDay ? isoDate(event.startUtc) : isoSeconds(event.startUtc),
    enddt: event.allDay
      ? inclusiveEndDate(event.startUtc, event.endUtc)
      : isoSeconds(event.endUtc),
    body: event.description,
    location: event.location,
  });
  if (event.allDay) params.set('allday', 'true');

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
