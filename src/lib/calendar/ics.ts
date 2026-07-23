import { CalendarEvent } from './calendarEvent';

// RFC 5545 wants CRLF; Outlook desktop rejects files that only use LF.
const CRLF = '\r\n';
const MAX_OCTETS = 75;

/**
 * Escape a TEXT value. Comma and semicolon are value separators in iCalendar,
 * so real venue names like "CAL Widawa, Dekarska 3" corrupt the file unless
 * escaped. The backslash goes first, otherwise it would escape our own escapes.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold a content line to 75 OCTETS (RFC 5545 §3.1). Polish diacritics are two
 * bytes in UTF-8, so counting characters would overflow the limit; iterating by
 * code point also guarantees a multi-byte sequence is never split. Continuation
 * lines begin with a space, which counts against their own budget.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_OCTETS) return line;

  const segments: string[] = [];
  let current = '';
  let octets = 0;
  let budget = MAX_OCTETS;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > budget) {
      segments.push(current);
      current = '';
      octets = 0;
      budget = MAX_OCTETS - 1; // the leading space of a continuation line
    }
    current += char;
    octets += size;
  }
  segments.push(current);

  return segments.join(`${CRLF} `);
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** `20260724T160000Z` */
export function formatIcsDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** `20260724` */
export function formatIcsDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export function buildIcs(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Idz na miasto//Events//PL',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${formatIcsDateTime(event.stamp)}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${formatIcsDate(event.startUtc)}`
      : `DTSTART:${formatIcsDateTime(event.startUtc)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${formatIcsDate(event.endUtc)}`
      : `DTEND:${formatIcsDateTime(event.endUtc)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  // URL is a URI value, not TEXT — escaping would corrupt a link with a comma.
  if (event.url) lines.push(`URL:${event.url}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/**
 * The file is well under 2 kB, so a data: URI carries it without the
 * createObjectURL / revokeObjectURL lifecycle — and iOS Safari handles it more
 * reliably than a blob: download.
 */
export function icsDataUri(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
