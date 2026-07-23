# Add to Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an "Dodaj do kalendarza" button on the event detail page that offers Google Calendar, Outlook and a downloadable `.ics` file.

**Architecture:** One normaliser turns an `Event` into a flat `CalendarEvent` (all time rules live there); three pure builders turn that into a Google URL, an Outlook URL and an iCalendar string. A single MUI `Button` + `Menu` component is the only piece that touches the DOM. The app is a static export, so the `.ics` is produced in the browser and handed over as a `data:` URI.

**Tech Stack:** TypeScript, React 19, Next.js 16 (`output: 'export'`), MUI 7, vitest + Testing Library + jest-axe, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-23-add-to-calendar-design.md`

---

## Background you need before starting

**Run tests with pnpm, never npm.** `npm install` corrupts this repo's tree.

```bash
pnpm test                       # all unit tests
npx vitest run <path>           # one file
pnpm lint                       # eslint src/
pnpm type-check                 # tsc --noEmit
npx playwright test <path>      # e2e (starts its own dev server)
```

**Repo conventions you must follow:**

- Unit tests live next to the file they test: `foo.ts` → `foo.spec.ts`, `Foo.tsx` → `Foo.spec.tsx`.
- Component tests do **not** need a provider wrapper. `useTranslation()` falls back to the Polish message table when rendered outside `LocaleProvider` (see `src/i18n/LocaleProvider.tsx:60-68`), so `render(<Foo />)` yields Polish strings.
- Every component spec includes a `jest-axe` accessibility assertion. Copy the shape from `src/components/ui/PriceLabel/PriceLabel.spec.tsx`.
- `src/i18n/messages.ts` holds a `pl` object (source of truth, its inferred shape becomes `Messages`) and an `en` object typed `const en: Messages`. Adding a key to `pl` without adding it to `en` is a type error — always edit both.
- Commit messages: conventional prefix (`feat:`, `test:`, `fix:`), body explains why. End each commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

**Two deliberate refinements over the spec text.** Both are improvements found while writing this plan; implement them as written here:

1. `toCalendarEvent` takes the "end time is an estimate" note as a **parameter** rather than importing `messages`. That keeps `src/lib/` free of i18n and keeps the function pure.
2. All three menu entries are real anchors (`component="a"` with `href`), not `window.open` calls. Middle-click and "copy link" work, screen readers announce them as links, and the e2e test can simply read `href`.

**Branch:** work continues on `feat/add-to-calendar`, which already holds the spec commit.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/calendar/warsawTime.ts` | Convert a Warsaw-local `YYYY-MM-DD` + `HH:MM` pair into a UTC `Date`, handling DST. Nothing else. |
| `src/lib/calendar/warsawTime.spec.ts` | Summer, winter, both DST switch days, late-evening times. |
| `src/lib/calendar/calendarEvent.ts` | `CalendarEvent` type, `DEFAULT_DURATION_MIN`, and `toCalendarEvent`. The only place holding time rules and field composition. |
| `src/lib/calendar/calendarEvent.spec.ts` | Every branch of the rule ladder. |
| `src/lib/calendar/ics.ts` | RFC 5545: escaping, 75-octet folding, UTC formatters, `buildIcs`, `icsDataUri`. |
| `src/lib/calendar/ics.spec.ts` | CRLF, folding across Polish diacritics, escaping real venue names, exclusive all-day `DTEND`. |
| `src/lib/calendar/links.ts` | `googleCalendarUrl`, `outlookCalendarUrl`. Pure string builders. |
| `src/lib/calendar/links.spec.ts` | Complete expected URLs, timed and all-day. |
| `src/components/ui/AddToCalendar/AddToCalendar.tsx` | Button + Menu. The only module touching the DOM. |
| `src/components/ui/AddToCalendar/AddToCalendar.spec.tsx` | Render, menu opens, three entries, axe, `.ics` href shape. |
| `src/i18n/messages.ts` | Five new keys in both `pl` and `en`. |
| `src/components/views/EventDetailView/EventDetailView.tsx` | Mount `<AddToCalendar>` in the sidebar info card. |
| `src/components/views/EventDetailView/EventDetailView.spec.tsx` | Assert the button appears. |
| `e2e/add-to-calendar.spec.ts` | One journey: detail page → menu → Google entry has a well-formed href. |

`src/lib/` is otherwise flat. The `calendar/` subdirectory is deliberate: four small modules beat one file mixing timezone arithmetic with RFC 5545 escaping.

---

## Task 1: Warsaw → UTC conversion

**Files:**
- Create: `src/lib/calendar/warsawTime.ts`
- Test: `src/lib/calendar/warsawTime.spec.ts`

Poland is UTC+1 in winter (CET) and UTC+2 in summer (CEST). In 2026 the switch days are **29 March** (clocks jump 02:00 → 03:00) and **25 October** (03:00 → 02:00). The expected values below were computed and verified against Node's ICU data — use them verbatim.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/warsawTime.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { warsawToUtc } from './warsawTime';

describe('warsawToUtc', () => {
  it('subtracts 2 hours in summer (CEST)', () => {
    expect(warsawToUtc('2026-07-24', '18:00').toISOString()).toBe('2026-07-24T16:00:00.000Z');
  });

  it('subtracts 1 hour in winter (CET)', () => {
    expect(warsawToUtc('2026-01-15', '18:00').toISOString()).toBe('2026-01-15T17:00:00.000Z');
  });

  // 2026-03-29: clocks jump 02:00 -> 03:00. Before the jump the offset is +1,
  // after it +2, on the same calendar day.
  it('uses the pre-jump offset on the spring DST morning', () => {
    expect(warsawToUtc('2026-03-29', '01:00').toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('uses the post-jump offset later on the spring DST day', () => {
    expect(warsawToUtc('2026-03-29', '04:00').toISOString()).toBe('2026-03-29T02:00:00.000Z');
  });

  // 2026-10-25: clocks fall back 03:00 -> 02:00.
  it('uses the post-fallback offset on the autumn DST day', () => {
    expect(warsawToUtc('2026-10-25', '04:00').toISOString()).toBe('2026-10-25T03:00:00.000Z');
  });

  it('still uses summer time the day before the autumn switch', () => {
    expect(warsawToUtc('2026-10-24', '04:00').toISOString()).toBe('2026-10-24T02:00:00.000Z');
  });

  it('handles late evening times without rolling the date', () => {
    expect(warsawToUtc('2026-07-24', '23:30').toISOString()).toBe('2026-07-24T21:30:00.000Z');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/calendar/warsawTime.spec.ts`
Expected: FAIL — `Failed to resolve import "./warsawTime"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar/warsawTime.ts`:

```ts
// Event times arrive as Warsaw local wall-clock strings with no timezone.
// Calendars need an absolute instant, so this converts one into UTC. The offset
// is derived from the platform's own IANA data via Intl rather than a hardcoded
// DST table — no extra dependency, and it keeps working when the rules change.

const WARSAW_TZ = 'Europe/Warsaw';

/** Minutes that Europe/Warsaw is ahead of UTC at the given instant. */
function warsawOffsetMinutes(instant: Date): number {
  // Render the instant as Warsaw wall-clock, then read those numbers back as if
  // they were UTC. The gap between the two is the offset.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WARSAW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Convert a Warsaw wall-clock date + time into the matching UTC instant.
 *
 * @param date `YYYY-MM-DD`
 * @param time `HH:MM`
 *
 * On the two DST switch days the offset differs across the day, so the first
 * guess is re-checked against the instant it produced. Within the hour that
 * repeats in autumn the earlier (summer-time) reading wins; a one-hour
 * ambiguity there is inherent to the wall clock, not a bug worth solving.
 */
export function warsawToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes);

  const firstGuess = warsawOffsetMinutes(new Date(naive));
  const candidate = naive - firstGuess * 60_000;
  const confirmed = warsawOffsetMinutes(new Date(candidate));

  return new Date(confirmed === firstGuess ? candidate : naive - confirmed * 60_000);
}

/** Midnight UTC on the given calendar date, optionally offset by whole days. */
export function utcMidnight(date: string, addDays = 0): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + addDays));
}

/** Shift a `YYYY-MM-DD` string by whole days, returning the same format. */
export function shiftDateString(date: string, days: number): string {
  return utcMidnight(date, days).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/calendar/warsawTime.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/warsawTime.ts src/lib/calendar/warsawTime.spec.ts
git commit -m "feat(calendar): convert Warsaw wall-clock times to UTC

Event times arrive as local strings with no timezone. Calendars need an
absolute instant, so derive the CET/CEST offset from the platform's IANA
data via Intl rather than adding a timezone library. The offset is
re-checked against the instant it produces, which is what makes the two
DST switch days come out right.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Normalise an Event into a CalendarEvent

**Files:**
- Create: `src/lib/calendar/calendarEvent.ts`
- Test: `src/lib/calendar/calendarEvent.spec.ts`

This is where every time rule lives. 87 % of production events have neither `endTime` nor `durationMin`, so rule 5 is the common path, not the exception.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/calendarEvent.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Event } from '@/types/event.types';
import { toCalendarEvent, DEFAULT_DURATION_MIN } from './calendarEvent';

const NOTE = 'Godzina zakończenia szacowana.';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '1',
    eventKey: 'evt-key',
    name: 'Koncert',
    description: 'Opis wydarzenia.',
    categoryMain: 'Muzyka',
    categorySub: 'Koncert',
    date: '2026-07-24',
    startTime: '18:00',
    endTime: '',
    durationMin: null,
    location: { name: 'CAL Widawa, Dekarska 3', city: 'Wrocław', lat: null, lng: null },
    price: { amount: null, currency: 'PLN', label: '', showLabel: false },
    url: 'https://example.test/event',
    imageUrl: '',
    sources: ['gowroclaw'],
    updatedAt: '2026-07-20T10:30:00Z',
    ...overrides,
  };
}

describe('toCalendarEvent', () => {
  it('uses an explicit end time verbatim', () => {
    const ce = toCalendarEvent(makeEvent({ endTime: '20:30' }), NOTE);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T16:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:30:00.000Z');
    expect(ce.allDay).toBe(false);
  });

  it('rolls an end time that falls after midnight onto the next day', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '22:00', endTime: '02:00' }), NOTE);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T20:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-25T00:00:00.000Z');
  });

  it('derives the end from durationMin when there is no end time', () => {
    const ce = toCalendarEvent(makeEvent({ durationMin: 75 }), NOTE);
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T17:15:00.000Z');
  });

  it('falls back to the default duration when neither is present', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(DEFAULT_DURATION_MIN).toBe(120);
    expect(ce.endUtc.toISOString()).toBe('2026-07-24T18:00:00.000Z');
  });

  it('notes the estimate in the description only when the end was guessed', () => {
    expect(toCalendarEvent(makeEvent(), NOTE).description).toContain(NOTE);
    expect(toCalendarEvent(makeEvent({ endTime: '20:30' }), NOTE).description).not.toContain(NOTE);
    expect(toCalendarEvent(makeEvent({ durationMin: 75 }), NOTE).description).not.toContain(NOTE);
  });

  it('treats the 00:00-23:59 marker as an all-day entry with an exclusive end', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '00:00', endTime: '23:59' }), NOTE);
    expect(ce.allDay).toBe(true);
    expect(ce.startUtc.toISOString()).toBe('2026-07-24T00:00:00.000Z');
    expect(ce.endUtc.toISOString()).toBe('2026-07-25T00:00:00.000Z');
    expect(ce.description).not.toContain(NOTE);
  });

  it('treats a missing start time as all-day', () => {
    const ce = toCalendarEvent(makeEvent({ startTime: '' }), NOTE);
    expect(ce.allDay).toBe(true);
  });

  it('joins venue and city into one location string', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.location).toBe('CAL Widawa, Dekarska 3, Wrocław');
  });

  it('omits the separator when the city is missing', () => {
    const ce = toCalendarEvent(
      makeEvent({ location: { name: 'Rynek', city: '', lat: null, lng: null } }),
      NOTE
    );
    expect(ce.location).toBe('Rynek');
  });

  it('builds a description from the event text, the source link and the note', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.description).toBe(
      `Opis wydarzenia.\n\nhttps://example.test/event\n\n${NOTE}`
    );
  });

  it('collapses the separators when parts are missing', () => {
    const ce = toCalendarEvent(
      makeEvent({ description: '', url: '', endTime: '20:30' }),
      NOTE
    );
    expect(ce.description).toBe('');
  });

  it('takes DTSTAMP from updatedAt so the output is deterministic', () => {
    const ce = toCalendarEvent(makeEvent(), NOTE);
    expect(ce.stamp.toISOString()).toBe('2026-07-20T10:30:00.000Z');
  });

  it('falls back to the event date at midnight UTC when updatedAt is missing', () => {
    const ce = toCalendarEvent(makeEvent({ updatedAt: null }), NOTE);
    expect(ce.stamp.toISOString()).toBe('2026-07-24T00:00:00.000Z');
  });

  it('builds a stable UID from the event key', () => {
    expect(toCalendarEvent(makeEvent(), NOTE).uid).toBe('evt-key@idznamiasto');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/calendar/calendarEvent.spec.ts`
Expected: FAIL — `Failed to resolve import "./calendarEvent"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar/calendarEvent.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/calendar/calendarEvent.spec.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/calendarEvent.ts src/lib/calendar/calendarEvent.spec.ts
git commit -m "feat(calendar): normalise events into a flat CalendarEvent

Every time rule lives here: explicit end, duration, the two-hour default
for the 87% of events that carry neither, and the 00:00-23:59 marker that
becomes a real all-day entry. The URL builders and the .ics writer consume
only CalendarEvent, so a change in the scraper's shape stops at this file.

DTSTAMP comes from updatedAt rather than now(), which is what lets the
.ics output be asserted as a whole string.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: iCalendar writer

**Files:**
- Create: `src/lib/calendar/ics.ts`
- Test: `src/lib/calendar/ics.spec.ts`

Real event names and venues already contain commas, quotes and Polish diacritics, which is exactly what breaks a naive writer.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/ics.spec.ts`:

```ts
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

  it('starts every continuation with a single space', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
    const [, ...continuations] = folded.split('\r\n');
    expect(continuations.length).toBeGreaterThan(0);
    for (const line of continuations) {
      expect(line.startsWith(' ')).toBe(true);
    }
  });

  it('round-trips: unfolding restores the original line', () => {
    const line = `DESCRIPTION:Wydarzenie w Łodzi ${'ó'.repeat(120)} koniec`;
    expect(foldIcsLine(line).split('\r\n ').join('')).toBe(line);
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
});

describe('icsDataUri', () => {
  it('produces a downloadable calendar URI', () => {
    const uri = icsDataUri('BEGIN:VCALENDAR');
    expect(uri.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',').slice(1).join(','))).toBe('BEGIN:VCALENDAR');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/calendar/ics.spec.ts`
Expected: FAIL — `Failed to resolve import "./ics"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar/ics.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/calendar/ics.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/ics.ts src/lib/calendar/ics.spec.ts
git commit -m "feat(calendar): write RFC 5545 iCalendar files

Real venue names already contain the characters that break a naive writer
— 'CAL Widawa, Dekarska 3' has a comma, which iCalendar reads as a value
separator. Folding counts octets rather than characters because Polish
diacritics are two bytes in UTF-8, and all-day entries use an exclusive
DTEND, the off-by-one this format is famous for.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Google and Outlook URL builders

**Files:**
- Create: `src/lib/calendar/links.ts`
- Test: `src/lib/calendar/links.spec.ts`

`URLSearchParams` encodes spaces as `+` and `/` as `%2F`. Both services decode that correctly — the expected strings below were generated from the real implementation, so match them exactly rather than hand-writing prettier ones.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/links.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CalendarEvent } from './calendarEvent';
import { googleCalendarUrl, outlookCalendarUrl } from './links';

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    title: 'Koncert',
    startUtc: new Date('2026-07-24T16:00:00Z'),
    endUtc: new Date('2026-07-24T18:00:00Z'),
    allDay: false,
    location: 'CAL Widawa, Dekarska 3',
    description: 'Opis.',
    url: 'https://example.test/event',
    uid: 'evt-key@idznamiasto',
    stamp: new Date('2026-07-20T10:30:00Z'),
    ...overrides,
  };
}

const allDayEvent = makeCalendarEvent({
  allDay: true,
  startUtc: new Date('2026-07-24T00:00:00Z'),
  endUtc: new Date('2026-07-25T00:00:00Z'),
});

describe('googleCalendarUrl', () => {
  it('builds a template URL for a timed event', () => {
    expect(googleCalendarUrl(makeCalendarEvent())).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Koncert' +
        '&dates=20260724T160000Z%2F20260724T180000Z&details=Opis.' +
        '&location=CAL+Widawa%2C+Dekarska+3'
    );
  });

  it('uses bare dates for an all-day event', () => {
    expect(googleCalendarUrl(allDayEvent)).toContain('dates=20260724%2F20260725');
  });
});

describe('outlookCalendarUrl', () => {
  it('builds a compose URL for a timed event', () => {
    const url = outlookCalendarUrl(makeCalendarEvent());
    expect(url.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?')).toBe(true);
    expect(url).toContain('rru=addevent');
    expect(url).toContain('subject=Koncert');
    expect(url).toContain('startdt=2026-07-24T16%3A00%3A00Z');
    expect(url).toContain('enddt=2026-07-24T18%3A00%3A00Z');
    expect(url).not.toContain('allday');
  });

  it('uses bare dates and the allday flag for an all-day event', () => {
    const url = outlookCalendarUrl(allDayEvent);
    expect(url).toContain('startdt=2026-07-24&');
    expect(url).toContain('enddt=2026-07-25&');
    expect(url).toContain('allday=true');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/calendar/links.spec.ts`
Expected: FAIL — `Failed to resolve import "./links"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar/links.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/calendar/links.spec.ts`
Expected: PASS, 4 tests.

If the Google assertion fails on the exact query string, print the actual value and reconcile — do **not** loosen the test to a `toContain`. The whole point is that the URL is asserted as a whole.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/links.ts src/lib/calendar/links.spec.ts
git commit -m "feat(calendar): build Google and Outlook add-event URLs

Both take the flattened CalendarEvent, so the all-day rule (exclusive end)
is expressed once and both providers inherit it. URLSearchParams does the
encoding rather than hand-assembling a query string around scraped venue
names that contain commas.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Translations

**Files:**
- Modify: `src/i18n/messages.ts`

The `pl` object's inferred shape becomes the `Messages` type and `en` is declared `const en: Messages`, so both tables must gain the same five keys or `pnpm type-check` fails.

- [ ] **Step 1: Add the Polish keys**

In `src/i18n/messages.ts`, inside the `pl` object, find:

```ts
  LOADING: 'Ładowanie...',
  LOADING_EVENTS: 'Wczytywanie wydarzeń…',
```

Insert directly below `LOADING_EVENTS`:

```ts
  CALENDAR_ADD: 'Dodaj do kalendarza',
  CALENDAR_GOOGLE: 'Google Calendar',
  CALENDAR_OUTLOOK: 'Outlook',
  CALENDAR_ICS: 'Pobierz plik (.ics)',
  // Written into the calendar entry's description, never shown on the page.
  CALENDAR_END_GUESS: 'Godzina zakończenia szacowana.',
```

- [ ] **Step 2: Add the English keys**

In the same file, inside the `en` object, find the matching pair:

```ts
  LOADING: 'Loading...',
  LOADING_EVENTS: 'Loading events…',
```

Insert directly below `LOADING_EVENTS`:

```ts
  CALENDAR_ADD: 'Add to calendar',
  CALENDAR_GOOGLE: 'Google Calendar',
  CALENDAR_OUTLOOK: 'Outlook',
  CALENDAR_ICS: 'Download file (.ics)',
  CALENDAR_END_GUESS: 'End time is an estimate.',
```

- [ ] **Step 3: Verify the tables still match**

Run: `pnpm type-check`
Expected: no output (success). A missing key in `en` surfaces here as
`Property 'CALENDAR_ADD' is missing in type ... but required in type 'Messages'`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(i18n): add calendar strings

CALENDAR_END_GUESS is the odd one out: it is written into the calendar
entry's description rather than rendered on the page, so the user only
meets it inside their own calendar.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: The AddToCalendar component

**Files:**
- Create: `src/components/ui/AddToCalendar/AddToCalendar.tsx`
- Test: `src/components/ui/AddToCalendar/AddToCalendar.spec.tsx`

`CitySwitcher` (`src/components/common/AppHeader/CitySwitcher.tsx`) is the reference for the Button + Menu pattern in this repo.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/AddToCalendar/AddToCalendar.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import AddToCalendar from './AddToCalendar';
import { Event } from '@/types/event.types';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '1',
    eventKey: 'evt-key',
    name: 'Koncert',
    description: 'Opis wydarzenia.',
    categoryMain: 'Muzyka',
    categorySub: 'Koncert',
    date: '2026-07-24',
    startTime: '18:00',
    endTime: '',
    durationMin: null,
    location: { name: 'CAL Widawa, Dekarska 3', city: 'Wrocław', lat: null, lng: null },
    price: { amount: null, currency: 'PLN', label: '', showLabel: false },
    url: 'https://example.test/event',
    imageUrl: '',
    sources: ['gowroclaw'],
    updatedAt: '2026-07-20T10:30:00Z',
    ...overrides,
  };
}

describe('AddToCalendar', () => {
  it('renders the trigger', () => {
    render(<AddToCalendar event={makeEvent()} />);
    expect(screen.getByRole('button', { name: 'Dodaj do kalendarza' })).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<AddToCalendar event={makeEvent()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders nothing when the event has no date', () => {
    const { container } = render(<AddToCalendar event={makeEvent({ date: '' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a menu with the three destinations', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    expect(screen.getByRole('menuitem', { name: /Google Calendar/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Outlook/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Pobierz plik/ })).toBeInTheDocument();
  });

  it('points Google at a prefilled template in a new tab', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    const item = screen.getByRole('menuitem', { name: /Google Calendar/ });
    expect(item.getAttribute('href')).toContain(
      'calendar.google.com/calendar/render?action=TEMPLATE'
    );
    expect(item).toHaveAttribute('target', '_blank');
    expect(item.getAttribute('rel')).toContain('noopener');
  });

  it('offers the .ics as a named download carrying the calendar payload', async () => {
    const user = userEvent.setup();
    render(<AddToCalendar event={makeEvent()} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj do kalendarza' }));

    const item = screen.getByRole('menuitem', { name: /Pobierz plik/ });
    expect(item).toHaveAttribute('download', 'koncert-2026-07-24.ics');

    const href = item.getAttribute('href') ?? '';
    expect(href.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    const payload = decodeURIComponent(href.slice('data:text/calendar;charset=utf-8,'.length));
    expect(payload).toContain('BEGIN:VCALENDAR');
    expect(payload).toContain('SUMMARY:Koncert');
    expect(payload).toContain('DTSTART:20260724T160000Z');
  });

  it('marks the trigger as a menu button for assistive tech', () => {
    render(<AddToCalendar event={makeEvent()} />);
    const trigger = screen.getByRole('button', { name: 'Dodaj do kalendarza' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/components/ui/AddToCalendar/AddToCalendar.spec.tsx`
Expected: FAIL — `Failed to resolve import "./AddToCalendar"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/AddToCalendar/AddToCalendar.tsx`:

```tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import EventIcon from '@mui/icons-material/Event';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import { Event } from '@/types/event.types';
import { useTranslation } from '@/i18n';
import { slugify } from '@/lib/utils';
import { toCalendarEvent } from '@/lib/calendar/calendarEvent';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar/links';
import { buildIcs, icsDataUri } from '@/lib/calendar/ics';

interface AddToCalendarProps {
  event: Event;
}

export default function AddToCalendar({ event }: Readonly<AddToCalendarProps>) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Every destination needs the same normalised entry, so build it once.
  const calendarEvent = useMemo(
    () => toCalendarEvent(event, t.CALENDAR_END_GUESS),
    [event, t]
  );

  const destinations = useMemo(
    () => ({
      google: googleCalendarUrl(calendarEvent),
      outlook: outlookCalendarUrl(calendarEvent),
      ics: icsDataUri(buildIcs(calendarEvent)),
    }),
    [calendarEvent]
  );

  const fileName = `${slugify(event.name) || 'wydarzenie'}-${event.date}.ics`;
  const close = useCallback(() => setAnchorEl(null), []);

  // Without a date there is nothing to put in a calendar.
  if (!event.date) return null;

  return (
    <>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<EventIcon />}
        endIcon={<ArrowDropDownIcon />}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{
          minHeight: 44,
          width: '100%',
          textTransform: 'none',
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border)',
          '&:hover': {
            borderColor: 'var(--color-accent-primary)',
            backgroundColor: 'var(--color-accent-tint-soft)',
          },
        }}
      >
        {t.CALENDAR_ADD}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        slotProps={{ list: { 'aria-label': t.CALENDAR_ADD } }}
      >
        {/* Real links, not scripted window.open calls: middle-click and
            "copy link address" work, and screen readers announce them as links. */}
        <MenuItem
          component="a"
          href={destinations.google}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_GOOGLE} />
        </MenuItem>

        <MenuItem
          component="a"
          href={destinations.outlook}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_OUTLOOK} />
        </MenuItem>

        <MenuItem component="a" href={destinations.ics} download={fileName} onClick={close}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_ICS} />
        </MenuItem>
      </Menu>
    </>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/ui/AddToCalendar/AddToCalendar.spec.tsx`
Expected: PASS, 7 tests.

If a menu item resolves with role `link` rather than `menuitem`, MUI has rendered the anchor without the menu role — query with `screen.getByRole('menuitem', { name })` first and only fall back after confirming the rendered HTML. Do not weaken the accessibility expectation without checking the DOM.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/AddToCalendar
git commit -m "feat(detail): add the calendar destination menu

Three explicit destinations instead of guessing from the user agent:
Google and Outlook as prefilled links, everything else (Apple, Outlook
desktop, Office 365, Thunderbird) through the .ics download.

All three are real anchors rather than scripted window.open calls, so
middle-click and copy-link behave, and assistive tech announces them as
links. The .ics rides on a data: URI, which avoids the object-URL
lifecycle entirely.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Mount it on the detail page

**Files:**
- Modify: `src/components/views/EventDetailView/EventDetailView.tsx`
- Test: `src/components/views/EventDetailView/EventDetailView.spec.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/views/EventDetailView/EventDetailView.spec.tsx`, add this test inside the existing `describe('EventDetailView', …)` block:

```tsx
  it('offers the calendar menu', () => {
    render(<EventDetailView event={mockEvent} />);
    expect(screen.getByRole('button', { name: 'Dodaj do kalendarza' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/components/views/EventDetailView/EventDetailView.spec.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name "Dodaj do kalendarza"`.

- [ ] **Step 3: Mount the component**

In `src/components/views/EventDetailView/EventDetailView.tsx`, add the import next to the other component imports:

```tsx
import AddToCalendar from '@/components/ui/AddToCalendar/AddToCalendar';
```

Then find the external-link block inside `.priceCtaRow`:

```tsx
              {/* External Link — only when the source URL is real */}
              {hasUrl && (
                <Button
                  variant="contained"
                  color="primary"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewIcon />}
                  className={styles.externalLink}
                  sx={{ minHeight: 44 }}
                >
                  {t.EXTERNAL_LINK}
                </Button>
              )}
            </Box>
```

and insert the calendar button directly after the closing `)}` of that block, still inside the `.priceCtaRow` `<Box>`:

```tsx
              {/* External Link — only when the source URL is real */}
              {hasUrl && (
                <Button
                  variant="contained"
                  color="primary"
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewIcon />}
                  className={styles.externalLink}
                  sx={{ minHeight: 44 }}
                >
                  {t.EXTERNAL_LINK}
                </Button>
              )}

              {/* Secondary CTA: the ticket link stays the primary action. */}
              <Box className={styles.externalLink}>
                <AddToCalendar event={event} />
              </Box>
            </Box>
```

The wrapping `Box` reuses `.externalLink`, which is `flex-shrink: 0` and `width: 100%` from the `md` breakpoint up — the same sizing the ticket button gets, so the two stack cleanly in the sticky info card and sit side by side on mobile.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/components/views/EventDetailView/EventDetailView.spec.tsx`
Expected: PASS, all tests including the new one and the existing axe check.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/EventDetailView
git commit -m "feat(detail): show the calendar menu in the info card

Sits under the ticket link as an outlined secondary action, so the
primary call to action is unchanged. On mobile the sidebar already
reorders under the hero, which keeps both buttons in one block.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: End-to-end journey

**Files:**
- Create: `e2e/add-to-calendar.spec.ts`

Event data changes daily, so the spec discovers a real permalink at runtime instead of hardcoding one — the convention documented at the top of `e2e/support/helpers.ts`.

- [ ] **Step 1: Write the test**

Create `e2e/add-to-calendar.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { firstCard, gotoEvents } from './support/helpers';

// The menu entries are plain anchors, so the whole contract is observable from
// their href — no need to follow the link out to Google.
test.describe('Add to calendar', () => {
  test('the detail page offers three calendar destinations', async ({ page }) => {
    await gotoEvents(page);
    await firstCard(page).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();

    await page.getByRole('button', { name: 'Dodaj do kalendarza' }).click();

    const google = page.getByRole('menuitem', { name: /Google Calendar/ });
    await expect(google).toBeVisible();
    await expect(google).toHaveAttribute(
      'href',
      /calendar\.google\.com\/calendar\/render\?action=TEMPLATE.*dates=\d{8}/
    );

    await expect(page.getByRole('menuitem', { name: /Outlook/ })).toHaveAttribute(
      'href',
      /outlook\.live\.com\/calendar\/0\/deeplink\/compose/
    );

    const ics = page.getByRole('menuitem', { name: /Pobierz plik/ });
    await expect(ics).toHaveAttribute('href', /^data:text\/calendar;charset=utf-8,/);
    await expect(ics).toHaveAttribute('download', /\.ics$/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/add-to-calendar.spec.ts --project=chromium --reporter=list`
Expected: PASS.

If Playwright reports that another dev server already holds port 3000, stop it first (`pkill -f "next dev"`) and let Playwright start its own — its server runs with `NEXT_PUBLIC_BASE_PATH=''`, which a manually started one does not.

- [ ] **Step 3: Run it on every browser**

Run: `npx playwright test e2e/add-to-calendar.spec.ts --reporter=list`
Expected: PASS on chromium, firefox and Mobile Chrome (3 tests).

- [ ] **Step 4: Commit**

```bash
git add e2e/add-to-calendar.spec.ts
git commit -m "test(e2e): cover the calendar menu on the detail page

Asserts the three hrefs rather than following the links out to Google and
Outlook — the anchors are the whole contract, and a test that navigated to
a third party would measure their uptime, not our code.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full verification and merge

- [ ] **Step 1: Run the whole unit suite**

Run: `pnpm test`
Expected: all files pass. The suite stood at 162 tests before this work; expect roughly 45 more.

- [ ] **Step 2: Lint and type-check**

Run: `pnpm lint`
Expected: 0 errors. One pre-existing warning about custom fonts in `src/app/layout.tsx` is expected and unrelated.

Run: `pnpm type-check`
Expected: no output.

- [ ] **Step 3: Confirm the static export still builds**

Run: `NEXT_PUBLIC_BASE_PATH='' pnpm build`
Expected: build completes and prints the prerendered route table.

- [ ] **Step 4: Run the full e2e suite**

Run: `npx playwright test --reporter=list`
Expected: every test passes across chromium, firefox and Mobile Chrome.

- [ ] **Step 5: Verify the .ics by hand once**

Serve the export and download a real file — automated tests cannot confirm that a calendar app accepts it.

```bash
npx --yes serve out -l 4173
```

Open a detail page at `http://localhost:4173/wroclaw/…`, choose "Pobierz plik (.ics)", then open the downloaded file with the system calendar. Confirm the title, the start time in local time, and the venue. Stop the server afterwards.

- [ ] **Step 6: Merge and push**

```bash
git checkout main
git merge --no-ff feat/add-to-calendar -m "Merge: add to calendar on the event detail page"
git push origin main
git push origin feat/add-to-calendar
```

Note: `main` carries a GitHub rule requiring pull requests. A direct push succeeds only with bypass permission and prints a warning. If you would rather follow the rule, open a PR instead:

```bash
gh pr create --base main --head feat/add-to-calendar
```
