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
    enddt: event.allDay ? isoDate(event.endUtc) : isoSeconds(event.endUtc),
    body: event.description,
    location: event.location,
  });
  // The end stays exclusive for all-day entries, matching the .ics rule.
  if (event.allDay) params.set('allday', 'true');

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
