# "Add to calendar" on the event detail page — Design

**Date:** 2026-07-23
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/add-to-calendar` (to be created)

## Goal

Give the event detail page a way to put the event into the visitor's own
calendar, covering Google Calendar, Outlook and everything else (Apple,
Outlook desktop, Office 365, Thunderbird, Proton) without guessing which one
they use.

## Confirmed context

- The app is a Next.js `output: 'export'` static site. There is no server, so an
  `.ics` file cannot be produced by an endpoint — it has to be generated in the
  browser.
- `Event` (see `src/types/event.types.ts`) carries `date` (`YYYY-MM-DD`),
  `startTime` (`HH:MM`), `endTime` (`HH:MM` or `''`), `durationMin`
  (`number | null`), `location.name`, `location.city`, `description`, `url`,
  `eventKey` and `updatedAt`.
- Times are Warsaw local time. There is no timezone column.
- Measured against the Wrocław Supabase project on 2026-07-23 (60 rows):

  | field state | share |
  |---|---|
  | no `time_end` **and** no `duration_min` | **87 %** |
  | `time_start = 00:00`, `time_end = 23:59` (all-day marker) | 3 % |
  | no `time_start` | 0 % |
  | no coordinates | 13 % |

  "Unknown end time" is therefore the dominant case, not an edge case.
- Real values already contain the characters that break a naive iCalendar
  writer: `CAL Widawa, Dekarska 3` (comma), `Kino plenerowe -"Forrest Gump"`
  (quotes), `II SZCZEPIŃSKI FESTIWAL KOBIET "ANIA"` (diacritics).

## Decisions (locked)

1. **Button plus menu**, three entries: Google Calendar (URL), Outlook (URL),
   download `.ics`. No user-agent sniffing, no auto-detection — the user picks.
2. **Unknown end time → start + 2 h**, with a note in the calendar entry's
   description saying the end time is an estimate. `00:00–23:59` becomes a
   genuine all-day entry rather than a 24-hour block.
3. **Times are converted to UTC** and emitted with a `Z` suffix. The Warsaw
   offset (CET +1 / CEST +2) is derived with the built-in `Intl` API — no new
   dependency.
4. **`.ics` is delivered as a `data:` URI**, not a `Blob` URL.
5. Yahoo, recurring events, alarms, bulk export and `webcal://` subscriptions
   are out of scope.

## 1. Module layout

```text
Event (from Supabase)
      │
      ▼
src/lib/calendar/calendarEvent.ts
  toCalendarEvent(event) → CalendarEvent
  • the ONLY place holding time rules
      │ uses
      ▼
src/lib/calendar/warsawTime.ts
  warsawToUtc('2026-07-24', '18:00') → Date
      │
      ├───────────────┬────────────────┐
      ▼               ▼                ▼
 links.ts         links.ts          ics.ts
 googleCalendarUrl  outlookCalendarUrl  buildIcs → string
      │               │                │
      └───────────────┴────────────────┘
                      ▼
src/components/ui/AddToCalendar/AddToCalendar.tsx
  MUI Button + Menu — the only module that touches the DOM
```

Everything except the component is a pure function of data, testable without
jsdom, matching how `filterUtils` and `slug` are already structured.

`src/lib/` is currently flat. A `calendar/` subdirectory is a deliberate
exception: four small modules with their specs alongside beat one file that
would mix timezone arithmetic with RFC 5545 escaping.

### The `CalendarEvent` contract

```ts
export interface CalendarEvent {
  title: string;
  startUtc: Date;
  endUtc: Date;
  allDay: boolean;      // when true, builders emit dates, not timestamps
  location: string;     // venue + city
  description: string;  // description + source link + estimate note
  url: string;          // '' when missing
  uid: string;          // `${eventKey}@idznamiasto`
  stamp: Date;          // DTSTAMP — see "Determinism"
}
```

The builders never see an `Event`. If the scraper's shape changes, only
`toCalendarEvent` changes.

## 2. Time rules

All rules live in `toCalendarEvent`, evaluated in this order — the first match
wins:

1. `startTime === ''` → `allDay: true`. No time to anchor to. 0 % of current
   data, but the guard costs one branch.
2. `startTime === '00:00' && endTime === '23:59'` → `allDay: true`. Start and end
   are dates; no times are emitted.
3. `endTime` present → use it verbatim.
4. `durationMin > 0` → `start + durationMin`.
5. Otherwise → `start + DEFAULT_DURATION_MIN` (120), and append
   `CALENDAR_END_GUESS` to the description.

Only rule 5 marks the end time as estimated. Rules 1 and 2 produce all-day
entries, which make no claim about an end time at all.

### Composed fields

- `location` = `location.name` when `location.city` is empty, otherwise
  `` `${location.name}, ${location.city}` ``.
- `description` = the event description, then a blank line, then the source URL
  when present, then a blank line and `CALENDAR_END_GUESS` when rule 5 fired.
  Any of the three parts may be absent; the separators collapse accordingly.

`DEFAULT_DURATION_MIN` is exported from `src/lib/calendar/calendarEvent.ts` so
the tests can name it rather than repeat `120`.

### Timezone

`warsawToUtc(date, time)` derives the Warsaw offset for that specific instant
using `Intl.DateTimeFormat` with `timeZone: 'Europe/Warsaw'`, then subtracts it.
This handles DST without a lookup table:

```text
2026-07-24 18:00 Warsaw (CEST +2) → 2026-07-24T16:00:00Z
2026-01-15 18:00 Warsaw (CET  +1) → 2026-01-15T17:00:00Z
```

### Determinism

`DTSTAMP` is required by RFC 5545 and would naturally be `now()`, which makes the
output untestable. It comes from `event.updatedAt` when present, otherwise the
event's date at `00:00Z`. `buildIcs` is then a pure function and its test can
assert the complete string.

## 3. Output formats

### Google Calendar

```text
https://calendar.google.com/calendar/render
  ?action=TEMPLATE
  &text=<title>
  &dates=20260724T160000Z/20260724T180000Z
  &details=<description>
  &location=<location>
```

All-day uses `dates=20260724/20260725` (end exclusive).

### Outlook

```text
https://outlook.live.com/calendar/0/deeplink/compose
  ?path=/calendar/action/compose
  &rru=addevent
  &subject=<title>
  &startdt=2026-07-24T16:00:00Z
  &enddt=2026-07-24T18:00:00Z
  &body=<description>
  &location=<location>
```

All-day adds `&allday=true` and reduces both `startdt` and `enddt` to bare dates
(`2026-07-24` / `2026-07-25`, end exclusive, matching the `.ics` rule).

### iCalendar (`.ics`)

Required properties: `BEGIN/END:VCALENDAR`, `VERSION:2.0`, `PRODID`,
`BEGIN/END:VEVENT`, `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`.
`LOCATION`, `DESCRIPTION` and `URL` are emitted when non-empty.

Correctness requirements, each of which real data already exercises:

- Escape `\` → `\\`, `;` → `\;`, `,` → `\,`, newline → literal `\n`.
- Fold lines at 75 **octets**, not characters — Polish diacritics are two bytes
  in UTF-8.
- Terminate every line with **CRLF**; Outlook desktop rejects LF-only files.
- All-day entries use `DTSTART;VALUE=DATE:20260724` with
  `DTEND;VALUE=DATE:20260725`. `DTEND` is exclusive; an off-by-one here is the
  most common bug in this class of code.

## 4. UI

Placement: the sidebar `infoCard`, directly below the existing "Przejdź do
strony" button. On mobile `detailSidebar` already reorders under the hero, so
both calls to action stay in one block.

```text
┌─ infoCard ────────────────────────┐
│ CENA                              │
│ Bezpłatne                         │
│ ┌───────────────────────────────┐ │
│ │  Przejdź do strony        ↗   │ │  contained — unchanged primary CTA
│ └───────────────────────────────┘ │
│ ┌───────────────────────────────┐ │
│ │  📅 Dodaj do kalendarza   ▾   │ │  outlined — new, secondary
│ └───────────────────────────────┘ │
│ ─────────────────────────────     │
│ ŹRÓDŁA   [gowroclaw]              │
└───────────────────────────────────┘
```

`outlined`, not `contained`, so the ticket link stays the page's primary action.
`minHeight: 44` matching `.externalLink`.

| menu entry | action |
|---|---|
| Google Calendar | `window.open(url, '_blank', 'noopener')` |
| Outlook | same, different URL template |
| Pobierz plik (.ics) | an `<a download>` whose `href` is the `data:` URI |

The file is under 2 kB, so a `data:text/calendar;charset=utf-8,…` URI is
comfortable and avoids the `URL.createObjectURL` / `revokeObjectURL` lifecycle
altogether. It also sidesteps iOS Safari's unreliable handling of `blob:`
downloads — one code path for every platform, no user-agent branching.

Filename: `slugify(event.name)` + date, e.g. `koncert-jazzowy-2026-07-24.ics`.

The whole button is omitted when `event.date` is empty.

Accessibility: `aria-haspopup="menu"` and `aria-expanded` on the trigger; MUI
`Menu` supplies keyboard navigation and the focus trap. The `.ics` entry is an
anchor, not a button, so screen readers announce it as a download link.

### i18n

Five new keys in both `pl` and `en` tables:

| key | pl | en |
|---|---|---|
| `CALENDAR_ADD` | `Dodaj do kalendarza` | `Add to calendar` |
| `CALENDAR_GOOGLE` | `Google Calendar` | `Google Calendar` |
| `CALENDAR_OUTLOOK` | `Outlook` | `Outlook` |
| `CALENDAR_ICS` | `Pobierz plik (.ics)` | `Download file (.ics)` |
| `CALENDAR_END_GUESS` | `Godzina zakończenia szacowana.` | `End time is an estimate.` |

`CALENDAR_END_GUESS` is written into the calendar entry's description, not shown
on the page. The description also carries the source link so the entry stays
useful a month later.

## 5. Tests

| file | covers |
|---|---|
| `warsawTime.spec.ts` | summer CEST +2, winter CET +1, DST transition days (2026-03-29, 2026-10-25), past-midnight wrap |
| `calendarEvent.spec.ts` | end from `endTime`; from `durationMin`; the +2 h default; `00:00–23:59` → `allDay`; estimate note present only when the end was guessed; location joins venue and city |
| `links.spec.ts` | the complete expected Google and Outlook URLs for a fixed event, plus the all-day variant |
| `ics.spec.ts` | CRLF endings; 75-octet folding across Polish diacritics; escaping of commas in real venue names; exclusive `DTEND` for all-day |
| `AddToCalendar.spec.tsx` | renders; menu opens; three entries; axe clean; the `.ics` entry's `href` starts with `data:text/calendar` |
| e2e | one spec: open a detail page, open the menu, assert the Google entry's `href` matches the expected pattern |

No test drives an actual file download: jsdom cannot represent it, and a
Playwright assertion there would be testing the browser rather than this code.

## 6. Out of scope

Yahoo Calendar (marginal traffic in PL), recurring events (`recurrence` does not
exist in the data — `event.types.ts` records that the field was removed),
`VALARM` reminders, a button on list cards, bulk export of filtered results,
`webcal://` subscription feeds.

## 7. Known risk

The 2-hour default will be wrong for festivals and too long for a 30-minute
talk. The description note softens this but does not remove it. The real fix
belongs in the scraper: once `time_end` starts arriving, rule 4 simply stops
firing and no code here changes.
