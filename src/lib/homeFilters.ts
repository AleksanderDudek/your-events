import { filtersToSearchParams } from './filterUtils';

// Slug of the top-level "Sport" category in the categories table. Treated as a
// constant for now — the category seed is owned by the data pipeline, so if
// the slug ever changes we'd notice on the homepage immediately.
export const SPORT_CATEGORY_SLUG = 'sport';

const pad2 = (n: number) => String(n).padStart(2, '0');

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeString(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Round `now` down to the previous half-hour so the "next 4h" window catches
// events that started slightly before the current moment.
function floorToHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  out.setMinutes(out.getMinutes() < 30 ? 0 : 30);
  return out;
}

function addHours(d: Date, hours: number): Date {
  const out = new Date(d);
  out.setHours(out.getHours() + hours);
  return out;
}

// Returns the upcoming weekend window. If `now` is already on Fri/Sat/Sun the
// weekend is "this one" starting from today (so a Saturday afternoon click
// doesn't dump the user into yesterday).
export function getUpcomingWeekend(now: Date): { fromDate: string; toDate: string } {
  const day = now.getDay(); // 0 Sun, 5 Fri, 6 Sat
  const fromOffset = day === 0 ? 0 : day <= 5 ? 5 - day : 0;
  const toOffset = day === 0 ? 0 : day <= 5 ? 7 - day : 7 - day;

  const friday = new Date(now);
  friday.setHours(0, 0, 0, 0);
  friday.setDate(friday.getDate() + fromOffset);

  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() + toOffset);

  return { fromDate: toLocalDateString(friday), toDate: toLocalDateString(sunday) };
}

// "Co się dzieje teraz" — today, from the nearest half-hour for the next 4h.
export function buildNowUrl(now: Date): string {
  const start = floorToHalfHour(now);
  const end = addHours(start, 4);
  const params = filtersToSearchParams({
    dateMode: 'single',
    dateSingle: toLocalDateString(now),
    hourFrom: toLocalTimeString(start),
    hourTo: toLocalTimeString(end),
  });
  return `/events?${params.toString()}`;
}

// "Co się dzieje w ten weekend" — Fri–Sun, 12:00 → 23:00.
export function buildWeekendUrl(now: Date): string {
  const { fromDate, toDate } = getUpcomingWeekend(now);
  const params = filtersToSearchParams({
    dateMode: 'range',
    dateFrom: fromDate,
    dateTo: toDate,
    hourFrom: '12:00',
    hourTo: '23:00',
  });
  return `/events?${params.toString()}`;
}

// "Gdzie mogę dzisiaj poćwiczyć" — today, sport category, from now onward.
export function buildSportNowUrl(now: Date): string {
  const start = floorToHalfHour(now);
  const params = filtersToSearchParams({
    categories: [SPORT_CATEGORY_SLUG],
    dateMode: 'single',
    dateSingle: toLocalDateString(now),
    hourFrom: toLocalTimeString(start),
  });
  return `/events?${params.toString()}`;
}
