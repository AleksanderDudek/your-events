import { describe, it, expect } from 'vitest';
import { CalendarEvent } from './calendarEvent';
import { buildIcs, escapeIcsText, foldIcsLine, icsDataUri } from './ics';

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'Koncert',
    startUtc: new Date('2026-07-24T16:00:00Z'),
    endUtc: new Date('2026-07-24T18:00:00Z'),
    allDay: false,
    location: 'CAL Widawa, Dekarska 3, Wrocław',
    description: 'Opis.\n\nhttps://example.test/event',
    url: 'https://example.test/event',
    uid: 'evt-key@idznamiasto',
    stamp: new Date('2026-07-20T10:30:00Z'),
    ...overrides,
  };
}

const byteLength = (value: string) => new TextEncoder().encode(value).length;

describe('escapeIcsText', () => {
  it('escapes the characters iCalendar treats as structure', () => {
    expect(escapeIcsText('CAL Widawa, Dekarska 3')).toBe('CAL Widawa\\, Dekarska 3');
    expect(escapeIcsText('a;b')).toBe('a\\;b');
    expect(escapeIcsText('a\\b')).toBe('a\\\\b');
    expect(escapeIcsText('linia\ndruga')).toBe('linia\\ndruga');
  });

  it('leaves quotes alone — they carry no meaning in a TEXT value', () => {
    expect(escapeIcsText('Kino plenerowe -"Forrest Gump"')).toBe(
      'Kino plenerowe -"Forrest Gump"'
    );
  });

  it('escapes a backslash before it can be read as an escape', () => {
    expect(escapeIcsText('a\\,b')).toBe('a\\\\\\,b');
  });

  it('normalises every line-break form, including a lone carriage return', () => {
    expect(escapeIcsText('a\rb')).toBe('a\\nb');
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb');
    expect(escapeIcsText('a\nb')).toBe('a\\nb');
  });

  it('drops stray control characters that a strict parser would reject', () => {
    const bell = String.fromCharCode(7);
    const startOfHeading = String.fromCharCode(1);
    expect(escapeIcsText(`a${bell}b${startOfHeading}c`)).toBe('abc');
  });

  it('keeps a horizontal tab, which is a legal value character', () => {
    expect(escapeIcsText('a\tb')).toBe('a\tb');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:Koncert')).toBe('SUMMARY:Koncert');
  });

  it('folds on octets, not characters, so diacritics do not overflow', () => {
    const line = `SUMMARY:${'ą'.repeat(60)}`;
    const folded = foldIcsLine(line);
    for (const segment of folded.split('\r\n')) {
      expect(byteLength(segment)).toBeLessThanOrEqual(75);
    }
  });

  it('keeps every continuation within the octet budget, space included', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
    const [, ...continuations] = folded.split('\r\n');
    expect(continuations.length).toBeGreaterThan(0);
    for (const line of continuations) {
      expect(line.startsWith(' ')).toBe(true);
      // The leading space counts against the 75 — this is what pins the
      // budget adjustment that a naive fold gets wrong.
      expect(byteLength(line)).toBeLessThanOrEqual(75);
    }
  });

  it('round-trips: unfolding restores the original line', () => {
    const line = `DESCRIPTION:Wydarzenie w Łodzi ${'ó'.repeat(120)} koniec`;
    expect(foldIcsLine(line).split('\r\n ').join('')).toBe(line);
  });

  it('leaves a line of exactly 75 octets unfolded, and folds at 76', () => {
    const exactly75 = 'SUMMARY:' + 'x'.repeat(75 - 'SUMMARY:'.length);
    expect(byteLength(exactly75)).toBe(75);
    expect(foldIcsLine(exactly75)).toBe(exactly75);

    const seventySix = `${exactly75}x`;
    expect(byteLength(seventySix)).toBe(76);
    expect(foldIcsLine(seventySix)).toContain('\r\n ');
  });
});

describe('buildIcs', () => {
  it('emits a complete timed event', () => {
    expect(buildIcs(makeCalendarEvent())).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Idz na miasto//Events//PL',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:evt-key@idznamiasto',
        'DTSTAMP:20260720T103000Z',
        'DTSTART:20260724T160000Z',
        'DTEND:20260724T180000Z',
        'SUMMARY:Koncert',
        'LOCATION:CAL Widawa\\, Dekarska 3\\, Wrocław',
        'DESCRIPTION:Opis.\\n\\nhttps://example.test/event',
        'URL:https://example.test/event',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n')
    );
  });

  it('terminates every line with CRLF — Outlook desktop rejects bare LF', () => {
    const ics = buildIcs(makeCalendarEvent());
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('writes all-day entries as dates with an exclusive end', () => {
    const ics = buildIcs(
      makeCalendarEvent({
        allDay: true,
        startUtc: new Date('2026-07-24T00:00:00Z'),
        endUtc: new Date('2026-07-25T00:00:00Z'),
      })
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20260724');
    expect(ics).toContain('DTEND;VALUE=DATE:20260725');
    expect(ics).not.toContain('DTSTART:2026');
  });

  it('omits optional properties that have no value', () => {
    const ics = buildIcs(makeCalendarEvent({ location: '', description: '', url: '' }));
    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('URL:');
  });

  it('strips control characters from the URL without escaping its punctuation', () => {
    const ics = buildIcs(
      makeCalendarEvent({ url: 'https://example.test/a,b?x=1\n&y=2' })
    );
    // Commas and semicolons are legal in a URI value and must survive intact;
    // a newline would otherwise masquerade as a line fold.
    expect(ics).toContain('URL:https://example.test/a,b?x=1&y=2');
  });
});

describe('icsDataUri', () => {
  it('produces a downloadable calendar URI', () => {
    const uri = icsDataUri('BEGIN:VCALENDAR');
    expect(uri.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',').slice(1).join(','))).toBe('BEGIN:VCALENDAR');
  });
});
