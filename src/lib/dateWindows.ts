import { addMonths } from 'date-fns';
import { EventFilters } from '@/types/filter.types';
import { PresetDateWindow } from '@/types/preset.types';
import { getUpcomingWeekend } from './homeFilters';

// The date windows that mean something relative to "now": the default one the
// list falls back to, and the ones a saved filter can carry. Kept apart from
// filterUtils (which homeFilters imports) so neither has to import the other.

/** How far ahead the list looks when the visitor has not picked a date. */
export const DEFAULT_WINDOW_MONTHS = 3;

/** The windows that are re-resolved against today every time they are used. */
export type RelativeDateWindow = Extract<PresetDateWindow, 'today' | 'weekend' | 'next7'>;

type DateRange = { dateFrom: string; dateTo: string };
type DateValues = Pick<EventFilters, 'dateSingle' | 'dateFrom' | 'dateTo'>;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Today up to DEFAULT_WINDOW_MONTHS ahead. A shorter month clamps (30 Nov →
 * 28 Feb) rather than spilling over.
 */
export function defaultDateWindow(now: Date): DateRange {
  return {
    dateFrom: toLocalDateString(now),
    dateTo: toLocalDateString(addMonths(now, DEFAULT_WINDOW_MONTHS)),
  };
}

/** Whether the visitor has actually picked a date — the mode alone is not one. */
export function hasDateValue(filters: DateValues): boolean {
  return Boolean(filters.dateSingle || filters.dateFrom || filters.dateTo);
}

/**
 * The filters the events query should run with: the ones given, or — when no
 * date is chosen — the same filters bounded to the default window.
 *
 * The tables keep events after they happen, so with no date clause the list
 * opened on yesterday's events. This is applied to the query only, never
 * written to the URL: a link or saved filter without a date keeps meaning
 * "from whenever it is opened". `dateMode` is left alone on purpose, so the
 * hour range keeps needing a date the visitor chose.
 */
export function withDefaultDateWindow(filters: EventFilters, now: Date): EventFilters {
  if (hasDateValue(filters)) return filters;
  return { ...filters, ...defaultDateWindow(now) };
}

export function resolveRelativeWindow(window: RelativeDateWindow, now: Date): DateRange {
  switch (window) {
    case 'today': {
      const today = toLocalDateString(now);
      return { dateFrom: today, dateTo: today };
    }
    case 'weekend': {
      const { fromDate, toDate } = getUpcomingWeekend(now);
      return { dateFrom: fromDate, dateTo: toDate };
    }
    case 'next7':
      return { dateFrom: toLocalDateString(now), dateTo: toLocalDateString(addDays(now, 7)) };
  }
}

/**
 * The URL date fields a quick pick writes. Today is a single day, as the
 * "Jeden dzień" picker would write it; the others are ranges.
 */
export function relativeWindowFilters(
  window: RelativeDateWindow,
  now: Date
): Pick<EventFilters, 'dateMode' | 'dateSingle' | 'dateFrom' | 'dateTo'> {
  const { dateFrom, dateTo } = resolveRelativeWindow(window, now);
  if (window === 'today') {
    return { dateMode: 'single', dateSingle: dateFrom, dateFrom: null, dateTo: null };
  }
  return { dateMode: 'range', dateSingle: null, dateFrom, dateTo };
}

/**
 * Which relative window the dates on screen are, if any — however they were
 * picked: a quick pick, a preset opened today, or the calendar.
 *
 * On a Sunday "today" and "the coming weekend" are the same single day. Today
 * is always written as a single day (relativeWindowFilters, and a preset opened
 * through presetToEventFilters), so a single day reads as today and a one-day
 * range as the weekend — the window the visitor actually picked.
 */
export function matchRelativeWindow(values: DateValues, now: Date): RelativeDateWindow | null {
  const isSingle = Boolean(values.dateSingle);
  const from = values.dateSingle ?? values.dateFrom;
  const to = values.dateSingle ?? values.dateTo;
  // A half-open range is a different question ("from Friday on").
  if (!from || !to) return null;
  const candidates: readonly RelativeDateWindow[] = isSingle
    ? ['today', 'weekend', 'next7']
    : ['weekend', 'next7', 'today'];
  return (
    candidates.find((window) => {
      const range = resolveRelativeWindow(window, now);
      return range.dateFrom === from && range.dateTo === to;
    }) ?? null
  );
}

/**
 * How a saved filter should keep the dates now on screen: not at all (it then
 * opens on the default window), as a relative window when they are one, or as
 * the exact dates.
 */
export function inferDateWindow(filters: DateValues, now: Date): PresetDateWindow {
  if (!hasDateValue(filters)) return 'none';
  return matchRelativeWindow(filters, now) ?? 'fixed';
}
