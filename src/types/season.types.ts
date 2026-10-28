/**
 * A seasonal section ("Halloween", "Święta"), as configured in the city's
 * `seasons` table. Events opt in by carrying the slug in `events.seasons`.
 */
export interface Season {
  slug: string;
  /** Polish, like the event data; the UI translates it for other locales. */
  name: string;
  emoji: string;
  description: string;
  /** YYYY-MM-DD — when the season itself runs. */
  dateFrom: string;
  dateTo: string;
  /** YYYY-MM-DD — when the section may start announcing it, before dateFrom. */
  showFrom: string;
  /** Order among seasons running at once; lower first. */
  sort: number;
}

/** A season worth offering right now, with how many events it has from today on. */
export interface OfferedSeason extends Season {
  count: number;
  /** Announced but not started yet (today is before dateFrom). */
  upcoming: boolean;
}
