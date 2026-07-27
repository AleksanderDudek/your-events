import { Weekday } from '@/types/filter.types';

// Monday first — the Polish (and ISO) reading order. The values themselves stay
// JS `Date#getDay()` numbers so no conversion is needed when a date is tested,
// which is why Sunday is 0 yet sorts last.
export const WEEKDAY_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/**
 * How far ahead a weekday filter looks when the user has not closed the range
 * themselves.
 *
 * The predicate "this event falls on a Monday" has no SQL equivalent reachable
 * through PostgREST — the events table has no day-of-week column and its schema
 * belongs to the scraper — so the selected weekdays are expanded into the actual
 * dates they cover and sent as `date=in.(...)`. That list has to end somewhere,
 * and an unbounded one would also grow the request URL past what the gateway
 * accepts.
 *
 * A city's table holds a rolling window of roughly a week of upcoming events, so
 * half a year of lookahead is orders of magnitude more than the data spans. If
 * the pipeline ever starts publishing further out than this, weekday-filtered
 * results would quietly stop at the horizon — that is the one assumption to
 * revisit here.
 */
export const WEEKDAY_HORIZON_DAYS = 180;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Local-time construction on purpose: `new Date('2026-07-27')` parses as UTC and
// lands on the previous day for anyone west of Greenwich, which would shift
// every weekday by one.
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Read the `weekdays` query parameter. Unknown or duplicated entries are
 * dropped, and the result is always in {@link WEEKDAY_ORDER} — one canonical
 * spelling per selection, so the same choice never produces two query strings
 * (and two React Query cache entries).
 */
export function parseWeekdays(value: string | null): Weekday[] {
  if (!value) return [];
  const picked = new Set<number>();
  for (const part of value.split(',')) {
    const num = Number.parseInt(part, 10);
    if (isWeekday(num)) picked.add(num);
  }
  return WEEKDAY_ORDER.filter((day) => picked.has(day));
}

export function serializeWeekdays(weekdays: readonly Weekday[]): string {
  const picked = new Set<Weekday>(weekdays);
  return WEEKDAY_ORDER.filter((day) => picked.has(day)).join(',');
}

/** Put a selection back into display order, whatever order it arrived in. */
export function sortWeekdays(weekdays: readonly Weekday[]): Weekday[] {
  const picked = new Set<Weekday>(weekdays);
  return WEEKDAY_ORDER.filter((day) => picked.has(day));
}

/**
 * The concrete dates a weekday selection covers, to be handed to `date=in.(…)`.
 *
 * Returns `null` when the selection cannot exclude anything (nothing picked, or
 * all seven days) — the caller must then leave the query untouched rather than
 * filter on an empty list. An empty array is a different answer: the selection
 * is real but no date in range satisfies it (Sunday within a Mon–Tue range), and
 * the query must return nothing.
 *
 * @param bounds Date range already applied to the query, either side optional.
 * @param now    Lower bound when the range is open at the start.
 */
export function expandWeekdayDates(
  weekdays: readonly Weekday[],
  bounds: { from: string | null; to: string | null },
  now: Date
): string[] | null {
  const selected = new Set(weekdays.filter(isWeekday));
  if (selected.size === 0 || selected.size === WEEKDAY_ORDER.length) return null;

  const from = bounds.from && DATE_REGEX.test(bounds.from) ? parseLocalDate(bounds.from) : null;
  const to = bounds.to && DATE_REGEX.test(bounds.to) ? parseLocalDate(bounds.to) : null;

  // An open start means "from today on" — a weekday filter is about upcoming
  // Mondays, and expanding backwards over the whole table would only add dates
  // that are already past.
  const start = from ?? startOfDay(now);
  const horizon = addDays(start, WEEKDAY_HORIZON_DAYS);
  const end = to && to < horizon ? to : horizon;

  const dates: string[] = [];
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    if (selected.has(day.getDay() as Weekday)) dates.push(toLocalDateString(day));
  }
  return dates;
}
