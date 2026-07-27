import { Event } from '@/types/event.types';
import { nameSlug } from './slug';
import { slugify } from './utils';

// Picking "similar events" for an event listing is not the same problem as for a
// shop, and the two differences drive everything below.
//
// A product does not expire, so a shop can rank purely by similarity. An event
// does: a perfect match that happened yesterday is worse than no suggestion at
// all, so the date is a hard filter rather than a weight.
//
// A product also appears once. An event repeats — a weekly class is dozens of
// near-identical rows — so the highest-scoring candidates are, left alone, the
// same class over and over. Collapsing series is what stops the rail looking
// broken; it matters more than the weights.
//
// Everything here is pure and runs at build time, over the city's events that
// generateStaticParams has already loaded. It costs no extra queries.

/** How many suggestions to render at most. */
export const MAX_RELATED = 12;

/**
 * Below this the rail is not worth showing. One or two lonely cards under a
 * "Podobne wydarzenia" heading read as a bug, not as a short list.
 */
export const MIN_RELATED = 4;

/**
 * A candidate must clear this to appear, which takes at least one real signal:
 * the same top-level category, or the same venue. Proximity alone tops out
 * below it on purpose — "some other event a kilometre away" is not similar,
 * it is filler.
 */
export const MIN_SCORE = 3;

/** At most this many suggestions from one venue, so a single club cannot own the rail. */
const MAX_PER_VENUE = 2;

const SCORE = {
  sameSubCategory: 5,
  sameCategory: 3,
  sameVenue: 4,
  within1km: 2,
  within3km: 1,
  within7days: 2,
  within30days: 1,
  samePriceKind: 0.5,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Identity of a repeating series. There is no series id in the data — the
 * scraper gives us neither a recurrence field nor a parent key — so this leans
 * on the pair that does hold: the same class, at the same place. Two clubs both
 * running a "Trening obwodowy" stay separate, which is the behaviour we want.
 */
export function seriesKey(event: Event): string {
  return `${nameSlug(event.name)}|${slugify(event.location.name ?? '')}`;
}

/** Great-circle distance in km, or null when either side has no coordinates. */
export function distanceKm(a: Event, b: Event): number | null {
  const { lat: lat1, lng: lng1 } = a.location;
  const { lat: lat2, lng: lng2 } = b.location;
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00`);
  const to = Date.parse(`${toIso}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.abs(to - from) / DAY_MS;
}

/** How alike two events are. Higher is more similar; 0 means nothing in common. */
export function scoreRelated(target: Event, candidate: Event): number {
  let score = 0;

  if (target.categorySub && candidate.categorySub === target.categorySub) {
    score += SCORE.sameSubCategory;
  } else if (target.categoryMain && candidate.categoryMain === target.categoryMain) {
    // Only one of the two fires: a subcategory match already implies the
    // category, and counting both would let it outrank a same-venue match for
    // no extra information.
    score += SCORE.sameCategory;
  }

  const venue = target.location.name;
  if (venue && candidate.location.name === venue) score += SCORE.sameVenue;

  const km = distanceKm(target, candidate);
  if (km !== null) {
    if (km <= 1) score += SCORE.within1km;
    else if (km <= 3) score += SCORE.within3km;
  }

  const days = daysBetween(target.date, candidate.date);
  if (days <= 7) score += SCORE.within7days;
  else if (days <= 30) score += SCORE.within30days;

  // Someone looking at a free event is more likely to want another free one.
  const targetFree = target.price.amount === 0;
  const candidateFree = candidate.price.amount === 0;
  if (targetFree === candidateFree) score += SCORE.samePriceKind;

  return score;
}

function toDateString(now: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export interface PickRelatedOptions {
  target: Event;
  candidates: readonly Event[];
  /** Build time. Anything earlier than this date is dropped outright. */
  now: Date;
  limit?: number;
}

/**
 * The events to offer alongside `target`, best first.
 *
 * Returns an empty list rather than a short one when too little clears the bar
 * — a rail is a promise that there is more of this kind, and two cards do not
 * keep it.
 */
export function pickRelatedEvents({
  target,
  candidates,
  now,
  limit = MAX_RELATED,
}: PickRelatedOptions): Event[] {
  const today = toDateString(now);
  const targetSeries = seriesKey(target);

  // One entry per series, keeping its soonest upcoming date. The target's own
  // series is excluded entirely: the same class next Tuesday is the same thing,
  // not something similar, and letting it in fills the rail with one class.
  const bySeries = new Map<string, Event>();
  for (const candidate of candidates) {
    if (candidate.eventKey === target.eventKey) continue;
    if (candidate.date < today) continue;

    const key = seriesKey(candidate);
    if (key === targetSeries) continue;

    const kept = bySeries.get(key);
    // Candidates arrive ordered by date, but do not rely on it.
    if (!kept || candidate.date < kept.date) bySeries.set(key, candidate);
  }

  const scored = [...bySeries.values()]
    .map((event) => ({ event, score: scoreRelated(target, event) }))
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.event.date.localeCompare(b.event.date));

  const perVenue = new Map<string, number>();
  const picked: Event[] = [];
  for (const { event } of scored) {
    if (picked.length >= limit) break;
    const venue = slugify(event.location.name ?? '');
    const used = perVenue.get(venue) ?? 0;
    if (venue && used >= MAX_PER_VENUE) continue;
    perVenue.set(venue, used + 1);
    picked.push(event);
  }

  return picked.length >= MIN_RELATED ? picked : [];
}
