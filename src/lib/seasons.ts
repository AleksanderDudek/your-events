import { Season } from '@/types/season.types';

// The pure half of seasonal sections: which seasons to offer today and how a
// slug may look. Reading the table lives in eventsApi, the hook in
// components/service/useSeasons.

// filterUtils imports this file, and dateWindows imports filterUtils (through
// homeFilters), so the date helper is kept local rather than closing a cycle.
const pad2 = (n: number) => String(n).padStart(2, '0');
const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// A slug travels in the URL and into a PostgREST array literal (`cs.{…}`), so
// only the characters a slug can actually have are let through — no comma,
// brace or quote that could reshape the filter.
const SEASON_SLUG_REGEX = /^[a-z0-9-]{1,40}$/;

export function parseSeasonSlug(value: string | null | undefined): string | null {
  return value && SEASON_SLUG_REGEX.test(value) ? value : null;
}

/**
 * Whether the calendar says a season may be shown today: from its `show_from`
 * (the announcement) to the last day it runs. Whether it has any events left is
 * a separate question, answered by a count (see useSeasons).
 */
export function isSeasonInWindow(season: Season, now: Date): boolean {
  const today = toLocalDateString(now);
  return season.showFrom <= today && today <= season.dateTo;
}

/** Announced, but its first day is still ahead. */
export function isSeasonUpcoming(season: Season, now: Date): boolean {
  return toLocalDateString(now) < season.dateFrom;
}

/** The seasons the calendar allows today, in their configured order. */
export function seasonsInWindow(seasons: readonly Season[], now: Date): Season[] {
  return seasons
    .filter((season) => isSeasonInWindow(season, now))
    .sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug));
}

/**
 * A name for a season known only by its slug — one in a saved filter or an old
 * link, not on offer today, so the table row is not at hand. "halloween" →
 * "Halloween", "dzien-dziecka" → "Dzien dziecka".
 */
export function seasonNameFromSlug(slug: string): string {
  const words = slug.replace(/-/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The visual theme a season's tile and toggle use. Unknown seasons get the neutral one. */
export type SeasonTheme = 'halloween' | 'swieta' | 'default';

export function seasonTheme(slug: string): SeasonTheme {
  return slug === 'halloween' || slug === 'swieta' ? slug : 'default';
}
