// Sharing a "Twój tydzień" plan: the link, the message that goes with it, the
// copy a recipient makes of it, and the PDF's file name. Pure — the dialog
// (PlanShareDialog) and the PDF writer (planPdf) do the browser parts.

import type { Event } from '@/types/event.types';
import type { Messages } from '@/i18n/messages';
import type { PlanPdfInput } from '@/lib/planPdf';
import { formatDateShort, formatEventTime } from '@/lib/utils';
import {
  dayPartOf,
  encodePlanParam,
  MAX_SLOTS_PER_DAY,
  planCost,
  slotId,
  type DaySettings,
  type PlanCost,
  type StoredPlan,
  weekdayOf,
} from '@/lib/weekPlan';
import { windowDates } from '@/lib/weekPlans';

/** By day, then by start time; an event with no time (an exhibition) leads its day. */
export function sortPlanEvents(events: readonly Event[]): Event[] {
  return [...events].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

export interface PlanDay {
  date: string;
  events: Event[];
}

/** The plan as days, in order. */
export function groupPlanByDay(events: readonly Event[]): PlanDay[] {
  const days: PlanDay[] = [];
  for (const event of sortPlanEvents(events)) {
    const last = days.at(-1);
    if (last?.date === event.date) last.events.push(event);
    else days.push({ date: event.date, events: [event] });
  }
  return days;
}

/**
 * The link to a plan. `base` is origin + the page's own path, so a base path
 * (the dev deployment) survives.
 */
export function planShareUrl(base: string, events: readonly Event[]): string {
  return `${base}?plan=${encodePlanParam(sortPlanEvents(events).map((e) => e.id))}`;
}

/** "Kino Helios Magnolia, ul. Legnicka 58, Wrocław" → "Kino Helios Magnolia". */
export function shortVenue(venue: string): string {
  return venue.split(',')[0].trim();
}

const MAX_NAME = 70;

function clip(text: string, max: number): string {
  const chars = [...text.trim()];
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

/** "Pt 28 lis", "Fri 28 Nov". */
export function planDayLabel(date: string, t: Pick<Messages, 'WEEKDAY_SHORT'>, locale: string): string {
  return `${t.WEEKDAY_SHORT[weekdayOf(date)]} ${formatDateShort(date, locale)}`;
}

type TextMessages = Pick<Messages, 'WEEK_SHARE_TEXT' | 'WEEK_SHARE_LINK_LINE' | 'WEEKDAY_SHORT'>;

/**
 * The message that goes with the link: the plan itself, readable in a chat
 * or an e-mail without opening anything, then the link.
 *
 *   Mój tydzień w Szczecinie — zobacz, gdzie idę:
 *
 *   Pt 28 lis
 *   • 19:00 Koncert jazzowy (Filharmonia)
 *   …
 *
 *   Cały plan — możesz go skopiować i zmienić po swojemu:
 *   https://idznamiasto.pl/szczecin/moj-tydzien/?plan=…
 */
export function planShareText(
  events: readonly Event[],
  { t, locale, cityLocative, url }: { t: TextMessages; locale: string; cityLocative: string; url: string }
): string {
  const lines = [t.WEEK_SHARE_TEXT(cityLocative)];
  for (const day of groupPlanByDay(events)) {
    lines.push('', planDayLabel(day.date, t, locale));
    for (const event of day.events) {
      const time = formatEventTime(event.startTime, '', null);
      const venue = shortVenue(event.location.name);
      lines.push(`• ${time ? `${time} ` : ''}${clip(event.name, MAX_NAME)}${venue ? ` (${venue})` : ''}`);
    }
  }
  lines.push('', t.WEEK_SHARE_LINK_LINE(url));
  return lines.join('\n');
}

/**
 * A recipient's own copy of a shared plan, in the shape the planner stores:
 * a 7-day window from the plan's first day still ahead, one day per date in
 * it, one slot per event (the day's first three), each slot set to its
 * event's time of day, every slot decided. Null when nothing is still ahead.
 *
 * The window starts at the first event rather than on a Monday: a link made
 * before plans had weeks covers a rolling 7 days (Thursday to Wednesday), and
 * a Monday-aligned window would cut it in two.
 */
export function planFromEvents(
  events: readonly Event[],
  today: string
): (StoredPlan & { start: string }) | null {
  const ahead = groupPlanByDay(events).filter((day) => day.date >= today);
  if (ahead.length === 0) return null;
  const start = ahead[0].date;
  const window = new Set(windowDates(start));
  const days: DaySettings[] = [];
  const chosen: Record<string, string> = {};
  for (const day of ahead) {
    if (!window.has(day.date)) continue;
    const kept = day.events.slice(0, MAX_SLOTS_PER_DAY);
    days.push({ date: day.date, parts: kept.map((e) => dayPartOf(e.startTime) ?? 'any') });
    kept.forEach((event, index) => {
      chosen[slotId(day.date, index)] = event.id;
    });
  }
  return { start, settings: { days, moods: [], freeOnly: false }, chosen };
}

/** "idznamiasto-plan-szczecin-2026-11-28.pdf". */
export function planPdfFileName(cityId: string, events: readonly Event[]): string {
  const first = sortPlanEvents(events)[0]?.date;
  return `idznamiasto-plan-${cityId}${first ? `-${first}` : ''}.pdf`;
}

type CostMessages = Pick<
  Messages,
  'WEEK_COST_UNKNOWN' | 'WEEK_COST_FREE' | 'WEEK_COST_AMOUNT' | 'WEEK_COST_PLUS_UNKNOWN'
>;

/** "ok. 125 zł + 1 bez ceny", "za darmo", "cena w opisie". */
export function planCostLabel(t: CostMessages, cost: PlanCost): string {
  if (cost.paid === 0) return cost.unknown > 0 ? t.WEEK_COST_UNKNOWN : t.WEEK_COST_FREE;
  const amount = t.WEEK_COST_AMOUNT(Math.round(cost.total));
  return cost.unknown > 0 ? `${amount} ${t.WEEK_COST_PLUS_UNKNOWN(cost.unknown)}` : amount;
}

/** "Piątek, 28 lis". */
export function planDayLongLabel(date: string, t: Pick<Messages, 'WEEKDAY_LONG'>, locale: string): string {
  return `${t.WEEKDAY_LONG[weekdayOf(date)]}, ${formatDateShort(date, locale)}`;
}

type PdfMessages = CostMessages &
  Pick<
    Messages,
    | 'WEEKDAY_LONG'
    | 'WEEK_META_TITLE'
    | 'WEEK_PDF_SUBTITLE'
    | 'WEEK_COST_WEEK'
    | 'WEEK_COST_PER_PERSON'
    | 'WEEK_PDF_NO_TIME'
    | 'WEEK_PDF_OPEN_ONLINE'
    | 'WEEK_PDF_DETAILS'
    | 'WEEK_PDF_FOOTER'
    | 'WEEK_PDF_PAGE'
    | 'PRICE_FREE'
  >;

function priceText(event: Event, t: Pick<Messages, 'PRICE_FREE'>): string {
  const { amount, currency, label, showLabel } = event.price;
  if (showLabel && label) return label;
  if (amount === null) return '';
  if (amount === 0) return t.PRICE_FREE;
  return `${amount} ${currency === 'PLN' ? 'zł' : currency}`;
}

/** Everything the PDF says, from the plan — the fonts are the caller's. */
export function planPdfContent(
  events: readonly Event[],
  {
    t,
    locale,
    cityLocative,
    planUrl,
    eventUrl,
    colorOf,
    today,
  }: {
    t: PdfMessages;
    locale: string;
    cityLocative: string;
    planUrl: string;
    /** Absolute address of an event's page. */
    eventUrl: (event: Event) => string;
    colorOf: (event: Event) => string | undefined;
    today: Date;
  }
): Omit<PlanPdfInput, 'fonts'> {
  const days = groupPlanByDay(events);
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  return {
    title: t.WEEK_META_TITLE(cityLocative),
    subtitle: first && last ? t.WEEK_PDF_SUBTITLE(formatDateShort(first, locale), formatDateShort(last, locale)) : '',
    cost:
      events.length > 0
        ? `${t.WEEK_COST_WEEK}: ${planCostLabel(t, planCost(events))} · ${t.WEEK_COST_PER_PERSON}`
        : undefined,
    days: days.map((day) => ({
      label: planDayLongLabel(day.date, t, locale),
      events: day.events.map((event) => ({
        time: formatEventTime(event.startTime, '', null) || t.WEEK_PDF_NO_TIME,
        name: event.name,
        meta: [shortVenue(event.location.name), priceText(event, t), event.categoryMain].filter(Boolean).join(' · '),
        url: eventUrl(event),
        color: colorOf(event),
      })),
    })),
    planUrl,
    openOnlineLabel: t.WEEK_PDF_OPEN_ONLINE,
    detailsLabel: t.WEEK_PDF_DETAILS,
    footer: t.WEEK_PDF_FOOTER(today.toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB')),
    pageLabel: t.WEEK_PDF_PAGE,
    language: locale === 'pl' ? 'pl-PL' : 'en-GB',
  };
}
